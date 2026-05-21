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
import { MongoClient, Db, MongoServerError } from 'mongodb';
import { normalizeSiteKey, validateEncryptedContent, validateHashToken } from './src/server/validation.js';

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_CONTENT_SIZE = process.env.MAX_CONTENT_SIZE || '4mb';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX = NODE_ENV === 'production' ? 100 : 1000;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const RATE_LIMIT_WINDOW_MS = parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
const RATE_LIMIT_MAX = parsePositiveInteger(
    process.env.RATE_LIMIT_MAX || process.env.RATE_LIMIT_REQUESTS || process.env.RATE_LIMIT_MAX_REQUESTS,
    DEFAULT_RATE_LIMIT_MAX
);

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
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
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
    ['/favicon-32.png', 'favicon-32.png'],
    ['/favicon-16.png', 'favicon-16.png'],
    ['/apple-touch-icon.png', 'apple-touch-icon.png'],
    ['/favicon.ico', 'favicon-32.png']
];

const runtimeFileCache = new Map<string, string>();

function resolveRuntimeFile(fileName: string): string {
    const cached = runtimeFileCache.get(fileName);
    if (cached) {
        return cached;
    }

    for (const baseDir of RUNTIME_FILE_SEARCH_DIRS) {
        const candidate = path.join(baseDir, fileName);
        if (fs.existsSync(candidate)) {
            runtimeFileCache.set(fileName, candidate);
            return candidate;
        }
    }

    const fallback = path.join(PROJECT_ROOT, fileName);
    runtimeFileCache.set(fileName, fallback);
    return fallback;
}

function redactRequestUrl(requestUrl: string): string {
    try {
        const url = new URL(requestUrl, 'http://localhost');
        if (url.search.startsWith('?') && url.search.length > 1 && !url.search.includes('=')) {
            url.search = '?[redacted]';
        } else if (url.searchParams.has('password')) {
            url.searchParams.set('password', '[redacted]');
        }
        return `${url.pathname}${url.search}`;
    } catch {
        return requestUrl.replace(/([?&]password=)[^&]*/gi, '$1[redacted]');
    }
}

const INDEX_FILE = resolveRuntimeFile('index.html');
const STATIC_ASSET_FILES = new Map(STATIC_ASSETS.map(([route, fileName]) => [route, resolveRuntimeFile(fileName)]));

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let mongoConnectPromise: Promise<void> | null = null;
let databaseInitPromise: Promise<void> | null = null;

interface SiteData {
    site?: string;
    encryptedContent: string;
    currentHashContent: string | null;
    updatedAt: number;
}

interface FileDB {
    sites: Record<string, SiteData>;
}

function loadDB(): FileDB {
    if (!fs.existsSync(DB_FILE)) {
        return { sites: {} };
    }

    try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw) as FileDB;
    } catch (error) {
        const backupFile = `${DB_FILE}.bak`;
        try {
            const raw = fs.readFileSync(backupFile, 'utf-8');
            console.warn(`Database file could not be read; loaded backup ${backupFile}`);
            return JSON.parse(raw) as FileDB;
        } catch {
            console.error('Database load error:', error);
            return { sites: {} };
        }
    }
}

class FileDatabaseStore {
    private writeQueue: Promise<void> = Promise.resolve();
    private directoryReady = false;

    load(): FileDB {
        return loadDB();
    }

    save(db: FileDB): Promise<void> {
        const writeTask = this.writeQueue
            .catch(() => undefined)
            .then(async () => {
                const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
                try {
                    await this.ensureDirectory();
                    if (fs.existsSync(DB_FILE)) {
                        await fs.promises.copyFile(DB_FILE, `${DB_FILE}.bak`);
                    }
                    await fs.promises.writeFile(tmpFile, JSON.stringify(db), 'utf-8');
                    await fs.promises.rename(tmpFile, DB_FILE);
                } catch (error) {
                    await fs.promises.rm(tmpFile, { force: true }).catch(() => undefined);
                    console.error('Database save error:', error);
                    throw error;
                }
            });

        this.writeQueue = writeTask;
        return writeTask;
    }

    private async ensureDirectory(): Promise<void> {
        if (this.directoryReady) {
            return;
        }

        await fs.promises.mkdir(path.dirname(DB_FILE), { recursive: true });
        this.directoryReady = true;
    }
}

const fileDatabaseStore = new FileDatabaseStore();

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
    private fileMutationQueue: Promise<void> = Promise.resolve();

    constructor() {
        this.fileDb = DB_TYPE === 'file' ? fileDatabaseStore.load() : { sites: {} };
    }

    private runFileMutation<T>(task: () => Promise<T>): Promise<T> {
        const mutation = this.fileMutationQueue
            .catch(() => undefined)
            .then(task);

        this.fileMutationQueue = mutation.then(() => undefined, () => undefined);
        return mutation;
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

    async saveSiteIfUnchanged(siteKey: string, initHashContent: string, data: SiteData): Promise<boolean> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            const collection = mongoDb.collection<SiteData>('sites');
            const document: SiteData = {
                site: siteKey,
                encryptedContent: data.encryptedContent,
                currentHashContent: data.currentHashContent,
                updatedAt: data.updatedAt
            };
            const currentHashFilter = initHashContent
                ? { site: siteKey, currentHashContent: initHashContent }
                : {
                    site: siteKey,
                    $or: [
                        { currentHashContent: '' },
                        { currentHashContent: null },
                        { currentHashContent: { $exists: false } }
                    ]
                };

            const updateResult = await collection.updateOne(currentHashFilter, { $set: document });
            if (updateResult.matchedCount > 0) {
                return true;
            }

            try {
                await collection.insertOne(document);
                return true;
            } catch (error) {
                if (error instanceof MongoServerError && error.code === 11000) {
                    return false;
                }
                throw error;
            }
        }

        return this.runFileMutation(async () => {
            const existing = this.fileDb.sites[siteKey] || null;
            if (existing && (existing.currentHashContent || '') !== initHashContent) {
                return false;
            }

            this.fileDb.sites[siteKey] = data;
            await fileDatabaseStore.save(this.fileDb);
            return true;
        });
    }

    async deleteSiteIfUnchanged(siteKey: string, initHashContent: string): Promise<boolean> {
        if (DB_TYPE === 'mongodb' && mongoDb) {
            const collection = mongoDb.collection('sites');
            const currentHashFilter = initHashContent
                ? { site: siteKey, currentHashContent: initHashContent }
                : {
                    site: siteKey,
                    $or: [
                        { currentHashContent: '' },
                        { currentHashContent: null },
                        { currentHashContent: { $exists: false } }
                    ]
                };
            const deleteResult = await collection.deleteOne(currentHashFilter);
            if (deleteResult.deletedCount > 0) {
                return true;
            }

            const existing = await collection.findOne({ site: siteKey });
            return !existing;
        }

        return this.runFileMutation(async () => {
            const existing = this.fileDb.sites[siteKey] || null;
            if (!existing) {
                return true;
            }

            if ((existing.currentHashContent || '') !== initHashContent) {
                return false;
            }

            delete this.fileDb.sites[siteKey];
            await fileDatabaseStore.save(this.fileDb);
            return true;
        });
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

app.use(express.json({ limit: MAX_CONTENT_SIZE }));

if (NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            console.log(`${new Date().toISOString()} ${req.method} ${redactRequestUrl(req.url)} ${res.statusCode} ${duration}ms`);
        });
        next();
    });
}

for (const [route, fileName] of STATIC_ASSETS) {
    app.get(route, (_req: Request, res: Response) => {
        res.sendFile(STATIC_ASSET_FILES.get(route) || resolveRuntimeFile(fileName));
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
        const siteValidation = normalizeSiteKey(req.query.site);
        if (!siteValidation.ok) {
            return res.status(400).json({ status: 'error', message: siteValidation.message });
        }

        const entry = await database.getSite(siteValidation.value);
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

        const siteValidation = normalizeSiteKey(site);
        if (!siteValidation.ok) {
            return res.status(400).json({ status: 'error', message: siteValidation.message });
        }

        const initHashValidation = validateHashToken(initHashContent, 'initHashContent');
        if (!initHashValidation.ok) {
            return res.status(400).json({ status: 'error', message: initHashValidation.message });
        }

        const currentHashValidation = validateHashToken(currentHashContent, 'currentHashContent');
        if (!currentHashValidation.ok) {
            return res.status(400).json({ status: 'error', message: currentHashValidation.message });
        }

        const encryptedContentValidation = validateEncryptedContent(encryptedContent);
        if (!encryptedContentValidation.ok) {
            return res.status(400).json({ status: 'error', message: encryptedContentValidation.message });
        }

        const siteKey = siteValidation.value;
        const wasSaved = await database.saveSiteIfUnchanged(siteKey, initHashValidation.value, {
            encryptedContent: encryptedContentValidation.value,
            currentHashContent: currentHashValidation.value,
            updatedAt: Date.now()
        });

        if (!wasSaved) {
            return res.json({
                status: 'error',
                message: 'Site was modified in the meantime.'
            });
        }

        return res.json({ status: 'success', currentHashContent: currentHashValidation.value });
    } catch (error) {
        console.error('Save endpoint error:', error);
        return res.status(500).json({ status: 'error', message: 'Failed to save data' });
    }
});

app.post('/api/delete', async (req: Request, res: Response): Promise<Response> => {
    try {
        const { site, initHashContent } = req.body || {};
        const siteValidation = normalizeSiteKey(site);
        if (!siteValidation.ok) {
            return res.status(400).json({ status: 'error', message: siteValidation.message });
        }

        const initHashValidation = validateHashToken(initHashContent, 'initHashContent');
        if (!initHashValidation.ok) {
            return res.status(400).json({ status: 'error', message: initHashValidation.message });
        }

        const wasDeleted = await database.deleteSiteIfUnchanged(siteValidation.value, initHashValidation.value);
        if (!wasDeleted) {
            return res.json({
                status: 'error',
                message: 'Site was modified in the meantime. Reload first.'
            });
        }

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
