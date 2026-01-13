/**
 * Client State Unit Tests
 * Tests for ClientState class and state management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulated ClientState for testing (simplified version)
class TestClientState {
    constructor(siteId = 'test-site') {
        this.site = siteId;
        this.currentDBVersion = 2;
        this.expectedDBVersion = 2;
        this.siteHash = null;
        this.isTextModified = false;
        this.initHashContent = null;
        this.content = '';
        this.password = '';
        this.initialIsNew = true;
        this.mobileAppMetadataTabContent = '';
        this.remote = {
            isNew: true,
            eContent: null,
            currentHashContent: null
        };
    }

    getIsNew() { return !!this.remote.isNew; }
    getInitialIsNew() { return this.initialIsNew; }
    getIsTextModified() { return this.isTextModified; }
    getContent() { return this.content; }
    getPassword() { return this.password; }
    getMobileAppMetadataTabContent() { return this.mobileAppMetadataTabContent; }
    setMobileAppMetadataTabContent(m) { this.mobileAppMetadataTabContent = m || ''; }

    updateIsTextModified(mod) {
        this.isTextModified = mod;
    }

    computeHashContentForDBVersion(contentForHash, passwordForHash, dbVersion) {
        // Simplified hash computation for testing
        const weak = this._simpleWeakHash(`${contentForHash}::${passwordForHash}`);
        return weak + String(dbVersion);
    }

    _simpleWeakHash(str) {
        let h1 = 0x811c9dc5, h2 = 0x1000193;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h1 ^= c; h1 = Math.imul(h1, 0x01000193);
            h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
        }
        return (Math.abs(h1) + Math.abs(h2)).toString(16);
    }

    setInitHashContent() {
        if (this.remote.currentHashContent) {
            this.initHashContent = this.remote.currentHashContent;
        } else {
            this.initHashContent = this.computeHashContentForDBVersion(
                this.content,
                this.password || '',
                this.currentDBVersion
            );
        }
    }
}

describe('ClientState', () => {
    let state;

    beforeEach(() => {
        state = new TestClientState('test-site');
    });

    describe('Constructor', () => {
        it('should initialize with default values', () => {
            expect(state.site).toBe('test-site');
            expect(state.currentDBVersion).toBe(2);
            expect(state.expectedDBVersion).toBe(2);
            expect(state.content).toBe('');
            expect(state.password).toBe('');
            expect(state.isTextModified).toBe(false);
        });

        it('should initialize remote state as new', () => {
            expect(state.remote.isNew).toBe(true);
            expect(state.remote.eContent).toBeNull();
            expect(state.remote.currentHashContent).toBeNull();
        });

        it('should use provided site ID', () => {
            const customState = new TestClientState('my-custom-site');
            expect(customState.site).toBe('my-custom-site');
        });
    });

    describe('Getters', () => {
        it('should return isNew from remote state', () => {
            expect(state.getIsNew()).toBe(true);
            state.remote.isNew = false;
            expect(state.getIsNew()).toBe(false);
        });

        it('should return initialIsNew', () => {
            expect(state.getInitialIsNew()).toBe(true);
            state.initialIsNew = false;
            expect(state.getInitialIsNew()).toBe(false);
        });

        it('should return isTextModified', () => {
            expect(state.getIsTextModified()).toBe(false);
            state.isTextModified = true;
            expect(state.getIsTextModified()).toBe(true);
        });

        it('should return content', () => {
            expect(state.getContent()).toBe('');
            state.content = 'test content';
            expect(state.getContent()).toBe('test content');
        });

        it('should return password', () => {
            expect(state.getPassword()).toBe('');
            state.password = 'secret';
            expect(state.getPassword()).toBe('secret');
        });
    });

    describe('Mobile App Metadata', () => {
        it('should get empty metadata by default', () => {
            expect(state.getMobileAppMetadataTabContent()).toBe('');
        });

        it('should set and get metadata', () => {
            state.setMobileAppMetadataTabContent('{"version": 1}');
            expect(state.getMobileAppMetadataTabContent()).toBe('{"version": 1}');
        });

        it('should handle null/undefined as empty string', () => {
            state.setMobileAppMetadataTabContent('some value');
            state.setMobileAppMetadataTabContent(null);
            expect(state.getMobileAppMetadataTabContent()).toBe('');

            state.setMobileAppMetadataTabContent('another value');
            state.setMobileAppMetadataTabContent(undefined);
            expect(state.getMobileAppMetadataTabContent()).toBe('');
        });
    });

    describe('updateIsTextModified', () => {
        it('should update modified state', () => {
            expect(state.isTextModified).toBe(false);
            state.updateIsTextModified(true);
            expect(state.isTextModified).toBe(true);
            state.updateIsTextModified(false);
            expect(state.isTextModified).toBe(false);
        });
    });

    describe('computeHashContentForDBVersion', () => {
        it('should produce consistent hash for same inputs', () => {
            const hash1 = state.computeHashContentForDBVersion('content', 'pass', 2);
            const hash2 = state.computeHashContentForDBVersion('content', 'pass', 2);
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different content', () => {
            const hash1 = state.computeHashContentForDBVersion('content1', 'pass', 2);
            const hash2 = state.computeHashContentForDBVersion('content2', 'pass', 2);
            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hash for different password', () => {
            const hash1 = state.computeHashContentForDBVersion('content', 'pass1', 2);
            const hash2 = state.computeHashContentForDBVersion('content', 'pass2', 2);
            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hash for different DB version', () => {
            const hash1 = state.computeHashContentForDBVersion('content', 'pass', 1);
            const hash2 = state.computeHashContentForDBVersion('content', 'pass', 2);
            expect(hash1).not.toBe(hash2);
        });

        it('should include DB version in hash', () => {
            const hash = state.computeHashContentForDBVersion('content', 'pass', 2);
            expect(hash.endsWith('2')).toBe(true);
        });
    });

    describe('setInitHashContent', () => {
        it('should use remote hash if available', () => {
            state.remote.currentHashContent = 'remotehash123';
            state.setInitHashContent();
            expect(state.initHashContent).toBe('remotehash123');
        });

        it('should compute hash if no remote hash', () => {
            state.content = 'my content';
            state.password = 'mypass';
            state.remote.currentHashContent = null;
            state.setInitHashContent();

            expect(state.initHashContent).toBeDefined();
            expect(state.initHashContent.length).toBeGreaterThan(0);
        });
    });
});

describe('URL Parameter Parsing', () => {
    // Recreate URL parsing functions for testing
    function getQueryParam(searchString, name) {
        const url = new URL('http://example.com' + (searchString || ''));
        const v = url.searchParams.get(name);
        return v && v.trim().length ? v.trim() : null;
    }

    function getSiteFromURL(pathname, searchString) {
        const path = pathname || '/';
        const seg = path.replace(/^\/+|\/+$/g, '');
        if (seg && seg !== 'api') return seg;
        const qp = getQueryParam(searchString, 'site');
        return qp || 'local-notes';
    }

    function getURLPassword(searchString) {
        const named = getQueryParam(searchString, 'password');
        if (named) return named;
        const qs = searchString || '';
        if (qs.startsWith('?') && qs.length > 1 && !qs.includes('=')) {
            return decodeURIComponent(qs.substring(1));
        }
        return null;
    }

    describe('getQueryParam', () => {
        it('should extract named parameter', () => {
            expect(getQueryParam('?site=mysite', 'site')).toBe('mysite');
        });

        it('should return null for missing parameter', () => {
            expect(getQueryParam('?site=mysite', 'other')).toBeNull();
        });

        it('should handle empty search string', () => {
            expect(getQueryParam('', 'site')).toBeNull();
        });

        it('should trim whitespace', () => {
            expect(getQueryParam('?site=  mysite  ', 'site')).toBe('mysite');
        });
    });

    describe('getSiteFromURL', () => {
        it('should extract site from path segment', () => {
            expect(getSiteFromURL('/mysite', '')).toBe('mysite');
        });

        it('should extract site from query parameter', () => {
            expect(getSiteFromURL('/', '?site=mysite')).toBe('mysite');
        });

        it('should prefer path over query', () => {
            expect(getSiteFromURL('/pathsite', '?site=querysite')).toBe('pathsite');
        });

        it('should ignore "api" path segment', () => {
            expect(getSiteFromURL('/api', '?site=mysite')).toBe('mysite');
        });

        it('should return default for root path without query', () => {
            expect(getSiteFromURL('/', '')).toBe('local-notes');
        });

        it('should handle trailing slashes', () => {
            expect(getSiteFromURL('/mysite/', '')).toBe('mysite');
        });
    });

    describe('getURLPassword', () => {
        it('should extract named password parameter', () => {
            expect(getURLPassword('?password=mysecret')).toBe('mysecret');
        });

        it('should extract raw password from query string', () => {
            expect(getURLPassword('?mysecret')).toBe('mysecret');
        });

        it('should prefer named parameter over raw', () => {
            expect(getURLPassword('?password=named')).toBe('named');
        });

        it('should return null for no password', () => {
            expect(getURLPassword('')).toBeNull();
            expect(getURLPassword('?site=test')).toBeNull();
        });

        it('should decode URL-encoded password', () => {
            expect(getURLPassword('?hello%20world')).toBe('hello world');
        });
    });
});
