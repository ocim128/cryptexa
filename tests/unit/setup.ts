/**
 * Vitest Setup File
 * Sets up the test environment with browser-like globals
 */

import { vi, beforeEach } from 'vitest';

// Mock crypto.subtle for Web Crypto API testing
const cryptoMock = {
    subtle: {
        digest: vi.fn(async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
            // Simple mock that returns a deterministic hash for testing
            // Handle different data types for mock processing
            let bufferData: Uint8Array;
            if (data instanceof ArrayBuffer) {
                bufferData = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
                // Creating Uint8Array from generic ArrayBufferView
                bufferData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else {
                // Fallback for mock simplicity
                bufferData = new Uint8Array(0);
            }

            const arr = new Uint8Array(64);
            for (let i = 0; i < arr.length; i++) {
                if (bufferData.length > 0) {
                    arr[i] = (bufferData[i % bufferData.length] || 0) ^ i;
                } else {
                    arr[i] = 0 ^ i;
                }
            }
            return arr.buffer;
        }),
        importKey: vi.fn(async () => ({ type: 'secret' })),
        deriveKey: vi.fn(async () => ({ type: 'derived' })),
        encrypt: vi.fn(async (_algorithm: any, _key: CryptoKey, data: BufferSource) => {
            // Mock encryption - just return the data with some transformation
            let bufferData: Uint8Array;
            if (data instanceof ArrayBuffer) {
                bufferData = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
                bufferData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else {
                bufferData = new Uint8Array(0);
            }

            const result = new Uint8Array(bufferData.length + 16); // Add auth tag
            for (let i = 0; i < bufferData.length; i++) {
                result[i] = (bufferData[i] ?? 0) ^ 0x5a; // Simple XOR for testing
            }
            return result.buffer;
        }),
        decrypt: vi.fn(async (_algorithm: any, _key: CryptoKey, data: BufferSource) => {
            // Mock decryption - reverse the mock encryption
            let bufferData: Uint8Array;
            if (data instanceof ArrayBuffer) {
                bufferData = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
                bufferData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else {
                bufferData = new Uint8Array(0);
            }

            const resLength = Math.max(0, bufferData.length - 16);
            const result = new Uint8Array(resLength);
            for (let i = 0; i < result.length; i++) {
                result[i] = (bufferData[i] ?? 0) ^ 0x5a;
            }
            return result.buffer;
        }),
    },
    getRandomValues: vi.fn((arr: ArrayBufferView) => {
        const view = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        for (let i = 0; i < view.length; i++) {
            view[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }),
} as unknown as Crypto;

// Only set up crypto mock if not already available
if (typeof globalThis.crypto === 'undefined' || !(globalThis.crypto as any)?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
        value: cryptoMock,
        writable: true
    });
}

// Mock localStorage
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {};
    }),
    get length() {
        return Object.keys(localStorageMock.store || {}).length;
    },
    key: vi.fn((index: number) => Object.keys(localStorageMock.store)[index] || null),
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
