/**
 * Vitest Setup File
 * Sets up the test environment with browser-like globals
 */

import { vi, beforeEach } from 'vitest';

// Mock crypto.subtle for Web Crypto API testing
const cryptoMock = {
    subtle: {
        digest: vi.fn(async (algorithm, data) => {
            // Simple mock that returns a deterministic hash for testing
            const arr = new Uint8Array(64);
            for (let i = 0; i < arr.length; i++) {
                arr[i] = (data[i % data.length] || 0) ^ i;
            }
            return arr.buffer;
        }),
        importKey: vi.fn(async () => ({ type: 'secret' })),
        deriveKey: vi.fn(async () => ({ type: 'derived' })),
        encrypt: vi.fn(async (algorithm, key, data) => {
            // Mock encryption - just return the data with some transformation
            const arr = new Uint8Array(data);
            const result = new Uint8Array(arr.length + 16); // Add auth tag
            for (let i = 0; i < arr.length; i++) {
                result[i] = arr[i] ^ 0x5a; // Simple XOR for testing
            }
            return result.buffer;
        }),
        decrypt: vi.fn(async (algorithm, key, data) => {
            // Mock decryption - reverse the mock encryption
            const arr = new Uint8Array(data);
            const result = new Uint8Array(arr.length - 16);
            for (let i = 0; i < result.length; i++) {
                result[i] = arr[i] ^ 0x5a;
            }
            return result.buffer;
        }),
    },
    getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }),
};

// Only set up crypto mock if not already available
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    globalThis.crypto = cryptoMock;
}

// Mock localStorage
const localStorageMock = {
    store: {},
    getItem: vi.fn((key) => localStorageMock.store[key] || null),
    setItem: vi.fn((key, value) => {
        localStorageMock.store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
        delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {};
    }),
    get length() {
        return Object.keys(localStorageMock.store).length;
    },
    key: vi.fn((index) => Object.keys(localStorageMock.store)[index] || null),
};

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

// Mock fetch
globalThis.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.store = {};
});
