/**
 * Client state and URL parsing tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientState } from '../../src/state/ClientState';
import { getQueryParamFromUrl, getSiteFromUrl, getUrlPasswordFromUrl, removeUrlPassword } from '../../src/utils/url';

describe('ClientState', () => {
    let state: ClientState;

    beforeEach(() => {
        state = new ClientState('test-site');
    });

    describe('constructor and getters', () => {
        it('initializes with default values', () => {
            expect(state.site).toBe('test-site');
            expect(state.currentDBVersion).toBe(2);
            expect(state.expectedDBVersion).toBe(2);
            expect(state.getContent()).toBe('');
            expect(state.getPassword()).toBe('');
            expect(state.getIsTextModified()).toBe(false);
            expect(state.getIsNew()).toBe(true);
        });

        it('stores the optional URL password', () => {
            const customState = new ClientState('workspace-a', 'secret');
            expect(customState.site).toBe('workspace-a');
            expect(customState.urlPassword).toBe('secret');
        });
    });

    describe('mobile app metadata', () => {
        it('sets and normalizes metadata', () => {
            state.setMobileAppMetadataTabContent('{"version":1}');
            expect(state.getMobileAppMetadataTabContent()).toBe('{"version":1}');

            state.setMobileAppMetadataTabContent('');
            expect(state.getMobileAppMetadataTabContent()).toBe('');
        });
    });

    describe('updateIsTextModified', () => {
        it('updates modified state and only notifies on changes', () => {
            const onButtonEnablementChange = vi.fn();
            state.onButtonEnablementChange = onButtonEnablementChange;

            state.updateIsTextModified(true);
            state.updateIsTextModified(true);
            state.updateIsTextModified(false);

            expect(state.getIsTextModified()).toBe(false);
            expect(onButtonEnablementChange).toHaveBeenCalledTimes(2);
            expect(onButtonEnablementChange).toHaveBeenNthCalledWith(1, true, true);
            expect(onButtonEnablementChange).toHaveBeenNthCalledWith(2, false, true);
        });
    });

    describe('computeHashContentForDBVersion', () => {
        it('is deterministic for identical inputs', () => {
            const hash1 = state.computeHashContentForDBVersion('content', 'pass', 2);
            const hash2 = state.computeHashContentForDBVersion('content', 'pass', 2);
            expect(hash1).toBe(hash2);
        });

        it('changes when content, password, or DB version changes', () => {
            const base = state.computeHashContentForDBVersion('content', 'pass', 2);
            expect(state.computeHashContentForDBVersion('content2', 'pass', 2)).not.toBe(base);
            expect(state.computeHashContentForDBVersion('content', 'pass2', 2)).not.toBe(base);
            expect(state.computeHashContentForDBVersion('content', 'pass', 3)).not.toBe(base);
        });
    });

    describe('setInitHashContent', () => {
        it('uses the remote hash when present', () => {
            state.remote.currentHashContent = 'remotehash123';
            state.setInitHashContent();
            expect(state.initHashContent).toBe('remotehash123');
        });

        it('computes a hash when no remote hash exists', () => {
            state.content = 'my content';
            state.password = 'mypass';
            state.remote.currentHashContent = null;

            state.setInitHashContent();

            expect(state.initHashContent).toBeDefined();
            expect(state.initHashContent!.length).toBeGreaterThan(0);
        });
    });
});

describe('URL parsing', () => {
    it('extracts named query parameters', () => {
        expect(getQueryParamFromUrl('http://example.com/?site=mysite', 'site')).toBe('mysite');
        expect(getQueryParamFromUrl('http://example.com/?site=mysite', 'other')).toBeNull();
        expect(getQueryParamFromUrl('http://example.com/', 'site')).toBeNull();
    });

    it('extracts site from path or query', () => {
        expect(getSiteFromUrl('http://example.com/mysite')).toBe('mysite');
        expect(getSiteFromUrl('http://example.com/?site=querysite')).toBe('querysite');
        expect(getSiteFromUrl('http://example.com/pathsite?site=querysite')).toBe('pathsite');
        expect(getSiteFromUrl('http://example.com/api?site=querysite')).toBe('querysite');
        expect(getSiteFromUrl('http://example.com/')).toBeNull();
    });

    it('prefers fragment passwords and flags URLs for scrubbing', () => {
        expect(getUrlPasswordFromUrl('http://example.com/#password=mysecret')).toEqual({
            password: 'mysecret',
            shouldScrub: true
        });
        expect(getUrlPasswordFromUrl('http://example.com/?password=legacy')).toEqual({
            password: 'legacy',
            shouldScrub: true
        });
        expect(getUrlPasswordFromUrl('http://example.com/?rawsecret')).toEqual({
            password: 'rawsecret',
            shouldScrub: true
        });
        expect(getUrlPasswordFromUrl('http://example.com/')).toEqual({
            password: null,
            shouldScrub: false
        });
    });

    it('removes password material from query strings and fragments', () => {
        expect(removeUrlPassword('http://example.com/workspace?password=legacy&site=x#password=secret')).toBe('/workspace?site=x');
        expect(removeUrlPassword('http://example.com/workspace?rawsecret')).toBe('/workspace');
    });
});
