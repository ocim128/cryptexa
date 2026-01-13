// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * API Endpoint Integration Tests
 * Tests for server API endpoints
 */

test.describe('API Endpoints', () => {
    test('should return health check', async ({ request }) => {
        const response = await request.get('/health');

        // Health endpoint should return 200
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.ok).toBe(true);
    });

    test('should return new site data for non-existent site', async ({ request }) => {
        const response = await request.get('/api/json?site=non-existent-site-12345');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBe('success');
        expect(data.isNew).toBe(true);
        expect(data.eContent).toBe('');
    });

    test('should reject save without required fields', async ({ request }) => {
        const response = await request.post('/api/save', {
            data: {
                site: 'test-site'
                // Missing other required fields
            }
        });

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.status).toBe('error');
    });

    test('should reject delete without required fields', async ({ request }) => {
        const response = await request.post('/api/delete', {
            data: {
                site: 'test-site'
                // Missing initHashContent
            }
        });

        expect(response.status()).toBe(400);
        const data = await response.json();
        expect(data.status).toBe('error');
    });

    test('should accept valid save request', async ({ request }) => {
        const uniqueSite = `api-test-${Date.now()}`;

        const response = await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: '',
                currentHashContent: 'testhash123',
                encryptedContent: 'salt:iv:cipher'
            }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBe('success');
        expect(data.currentHashContent).toBe('testhash123');
    });

    test('should retrieve saved site', async ({ request }) => {
        const uniqueSite = `api-test-retrieve-${Date.now()}`;

        // Save first
        await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: '',
                currentHashContent: 'myhash',
                encryptedContent: 'mysalt:myiv:mycipher'
            }
        });

        // Retrieve
        const response = await request.get(`/api/json?site=${uniqueSite}`);
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBe('success');
        expect(data.isNew).toBe(false);
        expect(data.eContent).toBe('mysalt:myiv:mycipher');
        expect(data.currentHashContent).toBe('myhash');
    });

    test('should enforce overwrite protection', async ({ request }) => {
        const uniqueSite = `api-test-overwrite-${Date.now()}`;

        // First save
        await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: '',
                currentHashContent: 'hash1',
                encryptedContent: 'content1'
            }
        });

        // Second save with wrong initHashContent
        const response = await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: 'wronghash',
                currentHashContent: 'hash2',
                encryptedContent: 'content2'
            }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBe('error');
        expect(data.message).toContain('modified');
    });

    test('should delete site successfully', async ({ request }) => {
        const uniqueSite = `api-test-delete-${Date.now()}`;

        // Create site
        await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: '',
                currentHashContent: 'deletehash',
                encryptedContent: 'deletecontent'
            }
        });

        // Delete with correct hash
        const response = await request.post('/api/delete', {
            data: {
                site: uniqueSite,
                initHashContent: 'deletehash'
            }
        });

        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data.status).toBe('success');

        // Verify site is gone
        const getResponse = await request.get(`/api/json?site=${uniqueSite}`);
        const getData = await getResponse.json();
        expect(getData.isNew).toBe(true);
    });

    test('should handle concurrent save conflicts', async ({ request }) => {
        const uniqueSite = `api-test-conflict-${Date.now()}`;

        // Create initial site
        await request.post('/api/save', {
            data: {
                site: uniqueSite,
                initHashContent: '',
                currentHashContent: 'initial',
                encryptedContent: 'initial-content'
            }
        });

        // Simulate two concurrent saves
        const [save1, save2] = await Promise.all([
            request.post('/api/save', {
                data: {
                    site: uniqueSite,
                    initHashContent: 'initial',
                    currentHashContent: 'update1',
                    encryptedContent: 'content1'
                }
            }),
            request.post('/api/save', {
                data: {
                    site: uniqueSite,
                    initHashContent: 'initial',
                    currentHashContent: 'update2',
                    encryptedContent: 'content2'
                }
            })
        ]);

        // One should succeed, one should fail (or both could succeed if truly concurrent)
        const data1 = await save1.json();
        const data2 = await save2.json();

        // At least one should have succeeded
        const successes = [data1, data2].filter(d => d.status === 'success').length;
        expect(successes).toBeGreaterThanOrEqual(1);
    });
});

test.describe('API Rate Limiting', () => {
    test('should not rate limit in development mode', async ({ request }) => {
        // Make multiple quick requests
        const requests = [];
        for (let i = 0; i < 10; i++) {
            requests.push(request.get('/health'));
        }

        const responses = await Promise.all(requests);

        // All should succeed in development
        responses.forEach(response => {
            expect(response.ok()).toBeTruthy();
        });
    });
});
