/** @vitest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const encryptedContent = `${'a'.repeat(32)}:${'b'.repeat(24)}:${'c'.repeat(32)}`;
let directory: string;
let dbFile: string;
let server: http.Server | undefined;

async function startApp(): Promise<void> {
    const { default: app } = await import('../../server-app');
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server!.once('listening', resolve));
}

function request(route: string, body?: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
    const address = server!.address() as { port: number };
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port: address.port, path: route,
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' }
        }, (res) => {
            let content = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { content += chunk; });
            res.on('end', () => resolve({ status: res.statusCode!, body: content, headers: res.headers }));
        });
        req.on('error', reject);
        req.end(body);
    });
}

function save(site: string, initHashContent = '', currentHashContent = 'saved-token') {
    return request('/api/save', JSON.stringify({ site, initHashContent, currentHashContent, encryptedContent }));
}

beforeEach(() => {
    vi.resetModules();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cryptexa-runtime-test-'));
    dbFile = path.join(directory, 'db.json');
    vi.stubEnv('DB_TYPE', 'file');
    vi.stubEnv('DB_FILE', dbFile);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('RATE_LIMIT_MAX', '1000');
    vi.stubEnv('MAX_CONTENT_SIZE', '1kb');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
    if (server) {
        await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
        server = undefined;
    }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(directory, { recursive: true, force: true });
});

describe('file persistence', () => {
    it('refuses to replace existing unreadable data with an empty database', async () => {
        fs.writeFileSync(dbFile, '{broken');
        fs.writeFileSync(`${dbFile}.bak`, '{broken-backup');
        await expect(startApp()).rejects.toThrow();
        expect(fs.readFileSync(dbFile, 'utf8')).toBe('{broken');
    });

    it('refuses to discard an unreadable backup when the active file is missing', async () => {
        fs.writeFileSync(`${dbFile}.bak`, '{broken-backup');
        await expect(startApp()).rejects.toThrow();
    });

    it('recovers a valid backup when the active file is corrupt', async () => {
        fs.writeFileSync(dbFile, '{broken');
        fs.writeFileSync(`${dbFile}.bak`, JSON.stringify({ sites: {
            recovered: { encryptedContent, currentHashContent: 'old', updatedAt: 1 }
        } }));
        await startApp();
        expect(JSON.parse((await request('/api/json?site=recovered')).body).currentHashContent).toBe('old');
    });

    it('keeps failed saves invisible and permits retry with the original token', async () => {
        await startApp();
        expect(JSON.parse((await save('notes')).body).status).toBe('success');
        vi.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('disk unavailable'));
        expect((await save('notes', 'saved-token', 'failed-token')).status).toBe(500);
        expect(JSON.parse((await request('/api/json?site=notes')).body).currentHashContent).toBe('saved-token');
        expect(JSON.parse(fs.readFileSync(dbFile, 'utf8')).sites.notes.currentHashContent).toBe('saved-token');
        expect(JSON.parse((await save('notes', 'saved-token', 'retry-token')).body).status).toBe('success');
    });

    it('keeps a record available after failed deletion and permits retry', async () => {
        await startApp();
        await save('notes');
        const body = JSON.stringify({ site: 'notes', initHashContent: 'saved-token' });
        vi.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('disk unavailable'));
        expect((await request('/api/delete', body)).status).toBe(500);
        expect(JSON.parse((await request('/api/json?site=notes')).body).isNew).toBe(false);
        expect(JSON.parse((await request('/api/delete', body)).body).status).toBe('success');
        expect(JSON.parse((await request('/api/json?site=notes')).body).isNew).toBe(true);
    });

    it.each(['constructor', 'toString'])('treats %s as a workspace rather than an inherited property', async (site) => {
        await startApp();
        expect(JSON.parse((await request(`/api/json?site=${site}`)).body).isNew).toBe(true);
        expect(JSON.parse((await save(site)).body).status).toBe('success');
        expect(JSON.parse((await request(`/api/json?site=${site}`)).body).eContent).toBe(encryptedContent);
        expect(JSON.parse((await request('/api/delete', JSON.stringify({ site, initHashContent: 'saved-token' }))).body).status).toBe('success');
        expect(JSON.parse((await request(`/api/json?site=${site}`)).body).isNew).toBe(true);
    });
});

describe('routing and logging', () => {
    it('serves valid dotted workspace IDs while preserving explicit routes and rejecting invalid IDs', async () => {
        await startApp();
        const response = await request('/team.notes');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect((await request('/app.js')).headers['content-type']).toContain('javascript');
        expect(JSON.parse((await request('/health')).body).ok).toBe(true);
        expect((await request('/api/missing')).status).toBe(404);
        expect((await request('/with%20space')).status).toBe(404);
    });

    it('logs parser and rate-limit rejections without exposing URL passwords', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('RATE_LIMIT_MAX', '2');
        const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
        await startApp();
        expect((await request('/api/save?password=secret', '{broken')).status).toBe(400);
        expect((await request('/api/save', JSON.stringify({ content: 'x'.repeat(2000) }))).status).toBe(413);
        expect((await request('/api/json?site=notes')).status).toBe(429);
        const entries = logs.mock.calls.map(([entry]) => JSON.parse(String(entry)));
        expect(entries.map((entry) => entry.status)).toEqual([400, 413, 429]);
        expect(entries.every((entry) => typeof entry.durationMs === 'number')).toBe(true);
        expect(JSON.stringify(entries)).not.toContain('secret');
    });
});
