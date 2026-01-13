/**
 * Crypto Utilities Unit Tests
 * Tests for encryption, decryption, and crypto helper functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll test the utility functions by recreating them here
// since app.js is not modular. In a real refactor, these would be imported.

// ---------- Utility Functions (copied from app.js for testing) ----------

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bufToHex(buf) {
    const arr = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
    return s;
}

function hexToBuf(hex) {
    const len = hex.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out.buffer;
}

function simpleWeakHash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 ^= c; h1 = Math.imul(h1, 0x01000193);
        h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
    }
    return (Math.abs(h1) + Math.abs(h2)).toString(16);
}

// ---------- Tests ----------

describe('Hex Conversion Utilities', () => {
    describe('bufToHex', () => {
        it('should convert empty buffer to empty string', () => {
            const buf = new ArrayBuffer(0);
            expect(bufToHex(buf)).toBe('');
        });

        it('should convert single byte buffer correctly', () => {
            const arr = new Uint8Array([255]);
            expect(bufToHex(arr.buffer)).toBe('ff');
        });

        it('should convert multi-byte buffer correctly', () => {
            const arr = new Uint8Array([0, 1, 15, 16, 255]);
            expect(bufToHex(arr.buffer)).toBe('00010f10ff');
        });

        it('should pad single-digit hex values with leading zero', () => {
            const arr = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            expect(bufToHex(arr.buffer)).toBe('000102030405060708090a0b0c0d0e0f');
        });

        it('should handle known test vectors', () => {
            // "Hello" in ASCII
            const hello = new Uint8Array([72, 101, 108, 108, 111]);
            expect(bufToHex(hello.buffer)).toBe('48656c6c6f');
        });
    });

    describe('hexToBuf', () => {
        it('should convert empty string to empty buffer', () => {
            const buf = hexToBuf('');
            expect(new Uint8Array(buf).length).toBe(0);
        });

        it('should convert single byte hex correctly', () => {
            const buf = hexToBuf('ff');
            expect(new Uint8Array(buf)[0]).toBe(255);
        });

        it('should convert multi-byte hex correctly', () => {
            const buf = hexToBuf('00010f10ff');
            const arr = new Uint8Array(buf);
            expect(arr[0]).toBe(0);
            expect(arr[1]).toBe(1);
            expect(arr[2]).toBe(15);
            expect(arr[3]).toBe(16);
            expect(arr[4]).toBe(255);
        });

        it('should handle lowercase hex', () => {
            const buf = hexToBuf('abcdef');
            const arr = new Uint8Array(buf);
            expect(arr[0]).toBe(171);
            expect(arr[1]).toBe(205);
            expect(arr[2]).toBe(239);
        });

        it('should handle uppercase hex', () => {
            const buf = hexToBuf('ABCDEF');
            const arr = new Uint8Array(buf);
            expect(arr[0]).toBe(171);
            expect(arr[1]).toBe(205);
            expect(arr[2]).toBe(239);
        });
    });

    describe('roundtrip conversion', () => {
        it('should roundtrip buffer -> hex -> buffer', () => {
            const original = new Uint8Array([0, 127, 255, 1, 128]);
            const hex = bufToHex(original.buffer);
            const restored = new Uint8Array(hexToBuf(hex));

            expect(restored.length).toBe(original.length);
            for (let i = 0; i < original.length; i++) {
                expect(restored[i]).toBe(original[i]);
            }
        });

        it('should handle large buffers', () => {
            const original = new Uint8Array(1000);
            for (let i = 0; i < 1000; i++) {
                original[i] = i % 256;
            }
            const hex = bufToHex(original.buffer);
            const restored = new Uint8Array(hexToBuf(hex));

            expect(hex.length).toBe(2000);
            expect(restored.length).toBe(1000);
            for (let i = 0; i < 1000; i++) {
                expect(restored[i]).toBe(original[i]);
            }
        });
    });
});

describe('simpleWeakHash', () => {
    it('should produce consistent hash for same input', () => {
        const hash1 = simpleWeakHash('test');
        const hash2 = simpleWeakHash('test');
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
        const hash1 = simpleWeakHash('test1');
        const hash2 = simpleWeakHash('test2');
        expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
        const hash = simpleWeakHash('');
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
    });

    it('should handle unicode characters', () => {
        const hash = simpleWeakHash('Hello 世界 🌍');
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
    });

    it('should produce hex string output', () => {
        const hash = simpleWeakHash('test');
        expect(/^[0-9a-f]+$/i.test(hash)).toBe(true);
    });
});

describe('TextEncoder/TextDecoder', () => {
    it('should encode and decode ASCII correctly', () => {
        const original = 'Hello, World!';
        const encoded = textEncoder.encode(original);
        const decoded = textDecoder.decode(encoded);
        expect(decoded).toBe(original);
    });

    it('should encode and decode UTF-8 correctly', () => {
        const original = 'Hello, 世界! 🚀';
        const encoded = textEncoder.encode(original);
        const decoded = textDecoder.decode(encoded);
        expect(decoded).toBe(original);
    });

    it('should handle empty string', () => {
        const original = '';
        const encoded = textEncoder.encode(original);
        const decoded = textDecoder.decode(encoded);
        expect(decoded).toBe(original);
    });
});

describe('Debounce Function', () => {
    // Recreate debounce for testing
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should delay function execution', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call once for multiple rapid calls', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        debounced();
        debounced();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the function', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('arg1', 'arg2');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should use latest arguments', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced('first');
        debounced('second');
        debounced('third');

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('third');
    });
});
