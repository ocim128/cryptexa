/*
  Cryptexa - Minimal Node/Express backend
  Stores only encrypted blobs (never plaintext). File-backed store for persistence.

  API:
    GET  /api/json?site=siteName
      -> { status: "success", isNew, eContent, currentDBVersion, expectedDBVersion, currentHashContent }
    POST /api/save
      body: { site, initHashContent, currentHashContent, encryptedContent }
      -> { status: "success", currentHashContent } or overwrite error
    POST /api/delete
      body: { site, initHashContent }
      -> { status: "success" } or overwrite error

  Notes:
    - initHashContent is the client's view of the baseline (server's currentHashContent at fetch time).
    - Overwrite protection: save/delete only if initHashContent equals server's stored currentHashContent.
    - Server stores only encryptedContent (ciphertext), never plaintext or passwords.
    - encryptedContent should be saltHex:ivHex:cipherHex.
*/

const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_CONTENT_SIZE = process.env.MAX_CONTENT_SIZE || '10mb';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// In-file JSON DB
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "db.json");
const DB_VERSION = 2;

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { sites: {} };
  }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

let db = loadDB();

app.use(express.json({ 
  limit: MAX_CONTENT_SIZE,
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      const error = new Error('Invalid JSON');
      error.status = 400;
      throw error;
    }
  }
}));

// Request logging middleware
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  });
}

// Serve static frontend
app.use(express.static(__dirname, {
  maxAge: NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// Support pretty site URLs: /:site should serve index.html (SPA) while preserving API routes
app.get("/:site", (req, res, next) => {
  // Skip if path collides with known static files or API
  const site = req.params.site;
  if (!site || site === "api" || site.includes(".")) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Get site blob in ProtectedText-like JSON shape
app.get("/api/json", (req, res) => {
  const site = String(req.query.site || "").trim();
  if (!site) {
    return res.status(400).json({ status: "error", message: "Missing site" });
  }
  const entry = db.sites[site];
  if (!entry) {
    return res.json({
      status: "success",
      isNew: true,
      eContent: "",
      currentDBVersion: DB_VERSION,
      expectedDBVersion: DB_VERSION,
      currentHashContent: null
    });
  }
  return res.json({
    status: "success",
    isNew: false,
    eContent: entry.encryptedContent,
    currentDBVersion: DB_VERSION,
    expectedDBVersion: DB_VERSION,
    currentHashContent: entry.currentHashContent || null
  });
});

// Save encrypted content with overwrite protection
app.post("/api/save", (req, res) => {
  const { site, initHashContent, currentHashContent, encryptedContent } = req.body || {};
  if (!site || typeof initHashContent !== "string" || typeof currentHashContent !== "string" || typeof encryptedContent !== "string") {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  const siteKey = String(site).trim();
  const existing = db.sites[siteKey];

  if (existing) {
    if ((existing.currentHashContent || "") !== initHashContent) {
      return res.json({
        status: "error",
        message: "Site was modified in the meantime."
      });
    }
  }

  db.sites[siteKey] = {
    encryptedContent,
    currentHashContent, // becomes the new baseline to be returned to clients
    updatedAt: Date.now()
  };
  saveDB(db);

  return res.json({ status: "success", currentHashContent });
});

// Delete site with overwrite protection
app.post("/api/delete", (req, res) => {
  const { site, initHashContent } = req.body || {};
  if (!site || typeof initHashContent !== "string") {
    return res.status(400).json({ status: "error", message: "Missing required fields" });
  }
  const siteKey = String(site).trim();
  const existing = db.sites[siteKey];

  if (!existing) {
    // Consider already deleted
    return res.json({ status: "success" });
  }
  if ((existing.currentHashContent || "") !== initHashContent) {
    return res.json({
      status: "error",
      message: "Site was modified in the meantime. Reload first."
    });
  }

  delete db.sites[siteKey];
  saveDB(db);
  return res.json({ status: "success" });
});

// Global error handler
app.use((err, req, res, next) => {
  if (NODE_ENV === 'production') {
    console.error(`${new Date().toISOString()} ERROR:`, err.message);
  } else {
    console.error('Error:', err);
  }
  
  const status = err.status || 500;
  const message = NODE_ENV === 'production' && status === 500 
    ? 'Internal server error' 
    : err.message;
    
  res.status(status).json({ status: 'error', message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Cryptexa server running on port ${PORT}`);
  console.log(`📝 Environment: ${NODE_ENV}`);
  console.log(`💾 Database file: ${DB_FILE}`);
  if (NODE_ENV === 'development') {
    console.log(`🌐 Local access: http://localhost:${PORT}`);
  }
});