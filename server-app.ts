/*
  Cryptexa - Minimal Node/Express backend
  Stores only encrypted blobs (never plaintext).

  API:
    GET  /api/json?site=siteName
      -> { status: "success", isNew, eContent, currentDBVersion, expectedDBVersion, currentHashContent }
    POST /api/save
      body: { site, initHashContent, currentHashContent, encryptedContent }
      -> { status: "success", currentHashContent } or overwrite error
    POST /api/delete
      body: { site, initHashContent }
      -> { status: "success" } or overwrite error
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
const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_CONTENT_SIZE = process.env.MAX_CONTENT_SIZE || '4mb';

if (NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: { status: 'error', message: 'Too many requests, please try again later.' } as any,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', limiter);

const MONGODB_URI = process.env.MONGODB_URI;
const DB_FILE = process.env.DB_FILE || path.join(PROJECT_ROOT, 'db.json');
const DB_TYPE = process.env.DB_TYPE || (IS_VERCEL ? 'mongodb' : 'file');
const DB_VERSION = 2;
const RUNTIME_FILE_SEARCH_DIRS = NODE_ENV === 'development'
    ? [PROJECT_ROOT, PUBLIC_DIR, path.join(PROJECT_ROOT, 'dist')]
    : [PUBLIC_DIR, PROJECT_ROOT, path.join(PROJECT_ROOT, 'dist')];

const STATIC_ASSETS: Array<[route: string, fileName: string]> = [
    ['/app.js', 'app.js'],
    ['/styles.css', 'styles.css'],
    ['/icon.png', 'icon.png'],
    ['/favicon.ico', 'icon.png']
];

function resolveRuntimeFile(fileName: string): string {
    for (const baseDir of RUNTIME_FILE_SEARCH_DIRS) {
        const candidate = path.join(baseDir, fileName);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return path.join(PROJECT_ROOT, fileName);
}

const INDEX_FILE = resolveRuntimeFile('index.html');

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let mongoConnectPromise: Promise<void> | null = null;
let databaseInitPromise: Promise<void> | null = null;

interface SiteData {
    site?: string;
    encryptedContent: string;
    currentHashContent: string;
    updatedAt: number;
}

interface FileDB {
    sites: Record<string, SiteData>;
}

function loadDB(): FileDB {
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
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

        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (error) {
        console.error('Database save error:', error);
        throw error;
    }
}

async function connectMongoDB(): Promise<void> {
    if (mongoDb) {
        return;
    }

    if (mongoConnectPromise) {
        await mongoConnectPromise;
        return;
    }

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is required for MongoDB mode');
    }

    mongoConnectPromise = (async () => {
        try {
            mongoClient = new MongoClient(MONGODB_URI);
            await mongoClient.connect();
            mongoDb = mongoClient.db('cryptexa');
            console.log('Connected to MongoDB');

            await mongoDb.collection('sites').createIndex({ site: 1 }, { unique: true });
        } catch (error) {
            console.error('MongoDB connection failed:', error);
            throw error;
        }
    })();

    try {
        await mongoConnectPromise;
    } catch (error) {
        mongoConnectPromise = null;
        throw error;
    }
}

class Database {
    private fileDb: FileDB;

    constructor() {
        this.fileDb = DB_TYPE === 'file' ? loadDB() : { sites: {} };
    }

    async getSite(siteKey: string): Promise<SiteData | null> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            const doc = await mongoDb.collection<SiteData>('sites').findOne({ site: siteKey });
            return doc ? {
                encryptedContent: doc.encryptedContent,
                currentHashContent: doc.currentHashContent,
                updatedAt: doc.updatedAt
            } : null;
        }

        return this.fileDb.sites[siteKey] || null;
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
            return;
        }

        this.fileDb.sites[siteKey] = data;
        saveDB(this.fileDb);
    }

    async deleteSite(siteKey: string): Promise<void> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            await mongoDb.collection('sites').deleteOne({ site: siteKey });
            return;
        }

        delete this.fileDb.sites[siteKey];
        saveDB(this.fileDb);
    }
}

const database = new Database();

function validateRuntimeConfiguration(): void {
    if (IS_VERCEL && DB_TYPE !== 'mongodb') {
        throw new Error('Vercel deployments require DB_TYPE=mongodb because local filesystem persistence is not durable.');
    }
}

async function initializeDatabase(): Promise<void> {
    if (!databaseInitPromise) {
        databaseInitPromise = (async () => {
            validateRuntimeConfiguration();

            if (DB_TYPE === 'mongodb') {
                await connectMongoDB();
            }
        })();
    }

    try {
        await databaseInitPromise;
    } catch (error) {
        databaseInitPromise = null;
        throw error;
    }
}

app.use(express.json({
    limit: MAX_CONTENT_SIZE,
    verify: (_req: Request, _res: Response, buf: Buffer) => {
        try {
            JSON.parse(buf.toString());
        } catch {
            const error = new Error('Invalid JSON') as Error & { status?: number };
            error.status = 400;
            throw error;
        }
    }
}));

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

for (const [route, fileName] of STATIC_ASSETS) {
    app.get(route, (_req: Request, res: Response) => {
        res.sendFile(resolveRuntimeFile(fileName));
    });
}

app.use('/api', async (_req: Request, _res: Response, next: NextFunction) => {
    try {
        await initializeDatabase();
        next();
    } catch (error) {
        next(error);
    }
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

app.get('/', (_req: Request, res: Response) => {
    res.sendFile(INDEX_FILE);
});

app.get('/:site', (req: Request, res: Response, next: NextFunction) => {
    const site = req.params.site;
    if (!site || site === 'api' || site.includes('.')) {
        return next();
    }

    res.sendFile(INDEX_FILE);
});

app.get('/api/json', async (req: Request, res: Response): Promise<Response> => {
    try {
        const site = String(req.query.site || '').trim();
        if (!site) {
            return res.status(400).json({ status: 'error', message: 'Missing site' });
        }

        const entry = await database.getSite(site);
        if (!entry) {
            return res.json({
                status: 'success',
                isNew: true,
                eContent: '',
                currentDBVersion: DB_VERSION,
                expectedDBVersion: DB_VERSION,
                currentHashContent: null
            });
        }

        return res.json({
            status: 'success',
            isNew: false,
            eContent: entry.encryptedContent,
            currentDBVersion: DB_VERSION,
            expectedDBVersion: DB_VERSION,
            currentHashContent: entry.currentHashContent || null
        });
    } catch (error) {
        console.error('Get endpoint error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve data' });
    }
});

app.post('/api/save', async (req: Request, res: Response): Promise<Response> => {
    try {
        const { site, initHashContent, currentHashContent, encryptedContent } = req.body || {};
        if (!site || typeof initHashContent !== 'string' || typeof currentHashContent !== 'string' || typeof encryptedContent !== 'string') {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const siteKey = String(site).trim();
        const existing = await database.getSite(siteKey);

        if (existing && (existing.currentHashContent || '') !== initHashContent) {
            return res.json({
                status: 'error',
                message: 'Site was modified in the meantime.'
            });
        }

        const siteData: SiteData = {
            encryptedContent,
            currentHashContent,
            updatedAt: Date.now()
        };

        await database.saveSite(siteKey, siteData);
        return res.json({ status: 'success', currentHashContent });
    } catch (error) {
        console.error('Save endpoint error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to save data' });
    }
});

app.post('/api/delete', async (req: Request, res: Response): Promise<Response> => {
    try {
        const { site, initHashContent } = req.body || {};
        if (!site || typeof initHashContent !== 'string') {
            return res.status(400).json({ status: 'error', message: 'Missing required fields' });
        }

        const siteKey = String(site).trim();
        const existing = await database.getSite(siteKey);

        if (!existing) {
            return res.json({ status: 'success' });
        }

        if ((existing.currentHashContent || '') !== initHashContent) {
            return res.json({
                status: 'error',
                message: 'Site was modified in the meantime. Reload first.'
            });
        }

        await database.deleteSite(siteKey);
        return res.json({ status: 'success' });
    } catch (error) {
        console.error('Delete endpoint error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to delete data' });
    }
});

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
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

app.use((_req: Request, res: Response) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
});

async function gracefulShutdown(signal: string): Promise<void> {
    console.log(`${signal} received, shutting down gracefully`);

    if (mongoClient) {
        try {
            await mongoClient.close();
            console.log('MongoDB connection closed');
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }

    process.exit(0);
}

async function startServer(): Promise<void> {
    try {
        await initializeDatabase();

        app.listen(PORT, () => {
            console.log(`Cryptexa server running on port ${PORT}`);
            console.log(`Environment: ${NODE_ENV}`);
            console.log(`Database type: ${DB_TYPE}`);

            if (DB_TYPE === 'mongodb') {
                console.log('MongoDB: connected');
            } else {
                console.log(`Database file: ${DB_FILE}`);
            }

            if (NODE_ENV === 'development') {
                console.log(`Local access: http://localhost:${PORT}`);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

const isDirectExecution = typeof require !== 'undefined' && require.main === module;

if (isDirectExecution) {
    process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
    process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
    void startServer();
}

export default app;
export { startServer, initializeDatabase };
