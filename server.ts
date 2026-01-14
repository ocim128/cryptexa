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

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MongoClient, Db } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_CONTENT_SIZE = process.env.MAX_CONTENT_SIZE || '10mb';

// Trust proxy for Render deployment
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

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
    message: { status: 'error', message: 'Too many requests, please try again later.' } as any,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Database Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DB_FILE = process.env.DB_FILE || path.join(process.cwd(), "db.json");
const DB_TYPE = process.env.DB_TYPE || 'file'; // 'mongodb' or 'file'
const DB_VERSION = 2;

// MongoDB connection
let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

interface SiteData {
    site?: string;
    encryptedContent: string;
    currentHashContent: string;
    updatedAt: number;
}

interface FileDB {
    sites: Record<string, SiteData>;
}

// File-based DB functions (fallback)
function loadDB(): FileDB {
    try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw) as FileDB;
    } catch {
        return { sites: {} };
    }
}

function saveDB(db: FileDB): void {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    } catch (error) {
        console.error('Database save error:', error);
        throw error;
    }
}

// MongoDB functions
async function connectMongoDB(): Promise<void> {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is required for MongoDB mode');
    }

    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        mongoDb = mongoClient.db('cryptexa');
        console.log('✅ Connected to MongoDB');

        // Create index for better performance
        await mongoDb.collection('sites').createIndex({ site: 1 }, { unique: true });
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        throw error;
    }
}

// Database abstraction layer
class Database {
    private fileDb: FileDB;

    constructor() {
        this.fileDb = loadDB();
    }

    async getSite(siteKey: string): Promise<SiteData | null> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            const doc = await mongoDb.collection<SiteData>('sites').findOne({ site: siteKey });
            return doc ? {
                encryptedContent: doc.encryptedContent,
                currentHashContent: doc.currentHashContent,
                updatedAt: doc.updatedAt
            } : null;
        } else {
            return this.fileDb.sites[siteKey] || null;
        }
    }

    async saveSite(siteKey: string, data: SiteData): Promise<void> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            await mongoDb.collection<SiteData>('sites').replaceOne(
                { site: siteKey },
                {
                    site: siteKey,
                    encryptedContent: data.encryptedContent,
                    currentHashContent: data.currentHashContent,
                    updatedAt: data.updatedAt
                },
                { upsert: true }
            );
        } else {
            this.fileDb.sites[siteKey] = data;
            saveDB(this.fileDb);
        }
    }

    async deleteSite(siteKey: string): Promise<void> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            await mongoDb.collection('sites').deleteOne({ site: siteKey });
        } else {
            delete this.fileDb.sites[siteKey];
            saveDB(this.fileDb);
        }
    }
}

const database = new Database();

app.use(express.json({
    limit: MAX_CONTENT_SIZE,
    verify: (_req: any, _res: any, buf: Buffer) => {
        try {
            JSON.parse(buf.toString());
        } catch {
            const error: any = new Error('Invalid JSON');
            error.status = 400;
            throw error;
        }
    }
}));

// Request logging middleware
if (NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
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

// Health check - must be before /:site catch-all
app.get("/health", (_req: Request, res: Response) => { res.json({ ok: true }); });

// Support pretty site URLs: /:site should serve index.html (SPA) while preserving API routes
app.get("/:site", (req: Request, res: Response, next: NextFunction) => {
    // Skip if path collides with known static files or API
    const site = req.params.site;
    if (!site || site === "api" || site.includes(".")) return next();
    res.sendFile(path.join(__dirname, "index.html"));
});

// Get site blob in ProtectedText-like JSON shape
app.get("/api/json", async (req: Request, res: Response): Promise<any> => {
    try {
        const site = String(req.query.site || "").trim();
        if (!site) {
            return res.status(400).json({ status: "error", message: "Missing site" });
        }

        const entry = await database.getSite(site);
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
    } catch (error) {
        console.error('Get endpoint error:', error);
        return res.status(500).json({ status: "error", message: "Failed to retrieve data" });
    }
});

// Save encrypted content with overwrite protection
app.post("/api/save", async (req: Request, res: Response): Promise<any> => {
    try {
        const { site, initHashContent, currentHashContent, encryptedContent } = req.body || {};
        if (!site || typeof initHashContent !== "string" || typeof currentHashContent !== "string" || typeof encryptedContent !== "string") {
            return res.status(400).json({ status: "error", message: "Missing required fields" });
        }

        const siteKey = String(site).trim();
        const existing = await database.getSite(siteKey);

        if (existing) {
            if ((existing.currentHashContent || "") !== initHashContent) {
                return res.json({
                    status: "error",
                    message: "Site was modified in the meantime."
                });
            }
        }

        const siteData: SiteData = {
            encryptedContent,
            currentHashContent, // becomes the new baseline to be returned to clients
            updatedAt: Date.now()
        };

        await database.saveSite(siteKey, siteData);
        return res.json({ status: "success", currentHashContent });
    } catch (error) {
        console.error('Save endpoint error:', error);
        return res.status(500).json({ status: "error", message: "Failed to save data" });
    }
});

// Delete site with overwrite protection
app.post("/api/delete", async (req: Request, res: Response): Promise<any> => {
    try {
        const { site, initHashContent } = req.body || {};
        if (!site || typeof initHashContent !== "string") {
            return res.status(400).json({ status: "error", message: "Missing required fields" });
        }

        const siteKey = String(site).trim();
        const existing = await database.getSite(siteKey);

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

        await database.deleteSite(siteKey);
        return res.json({ status: "success" });
    } catch (error) {
        console.error('Delete endpoint error:', error);
        return res.status(500).json({ status: "error", message: "Failed to delete data" });
    }
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
app.use((_req: Request, res: Response) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
    console.log(`${signal} received, shutting down gracefully`);

    if (mongoClient) {
        try {
            await mongoClient.close();
            console.log('✅ MongoDB connection closed');
        } catch (error) {
            console.error('❌ Error closing MongoDB connection:', error);
        }
    }

    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize database and start server
async function startServer() {
    try {
        // Initialize MongoDB if configured
        if (DB_TYPE === 'mongodb') {
            await connectMongoDB();
        }

        app.listen(PORT, () => {
            console.log(`🚀 Cryptexa server running on port ${PORT}`);
            console.log(`📝 Environment: ${NODE_ENV}`);
            console.log(`💾 Database type: ${DB_TYPE}`);

            if (DB_TYPE === 'mongodb') {
                console.log(`🍃 MongoDB: Connected`);
            } else {
                console.log(`📁 Database file: ${DB_FILE}`);
            }

            if (NODE_ENV === 'development') {
                console.log(`🌐 Local access: http://localhost:${PORT}`);
            }
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
