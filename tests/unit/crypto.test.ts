/**
 * Crypto and utility tests using production helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bufToHex, hexToBuf, simpleWeakHash, textEncoder, textDecoder } from '../../src/utils/crypto-helpers';
import { debounce } from '../../src/utils/fetch';

describe('hex conversion utilities', () => {
    describe('bufToHex', () => {
        it('converts empty and populated buffers', () => {
            expect(bufToHex(new ArrayBuffer(0))).toBe('');
            expect(bufToHex(new Uint8Array([255]).buffer)).toBe('ff');
            expect(bufToHex(new Uint8Array([0, 1, 15, 16, 255]).buffer)).toBe('00010f10ff');
        });

        it('pads single-digit hex values', () => {
            const arr = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
            expect(bufToHex(arr.buffer)).toBe('000102030405060708090a0b0c0d0e0f');
        });
    });

    describe('hexToBuf', () => {
        it('converts empty and populated hex strings', () => {
            expect(new Uint8Array(hexToBuf('')).length).toBe(0);
            expect(new Uint8Array(hexToBuf('ff'))[0]).toBe(255);
            expect(Array.from(new Uint8Array(hexToBuf('00010f10ff')))).toEqual([0, 1, 15, 16, 255]);
        });

        it('handles uppercase and lowercase hex', () => {
            expect(Array.from(new Uint8Array(hexToBuf('abcdef')))).toEqual([171, 205, 239]);
            expect(Array.from(new Uint8Array(hexToBuf('ABCDEF')))).toEqual([171, 205, 239]);
        });
    });

    it('roundtrips buffer -> hex -> buffer', () => {
        const original = new Uint8Array([0, 127, 255, 1, 128]);
        const restored = new Uint8Array(hexToBuf(bufToHex(original.buffer)));
        expect(Array.from(restored)).toEqual(Array.from(original));
    });
});

describe('simpleWeakHash', () => {
    it('is deterministic and sensitive to input changes', () => {
        expect(simpleWeakHash('test')).toBe(simpleWeakHash('test'));
        expect(simpleWeakHash('test1')).not.toBe(simpleWeakHash('test2'));
    });

    it('returns a hex-looking string for empty and unicode input', () => {
        expect(simpleWeakHash('')).toMatch(/^[0-9a-f]+$/i);
        expect(simpleWeakHash('Hello 世界 🌍')).toMatch(/^[0-9a-f]+$/i);
    });
});

describe('TextEncoder/TextDecoder', () => {
    it('encodes and decodes strings', () => {
        const original = 'Hello, World!';
        expect(textDecoder.decode(textEncoder.encode(original))).toBe(original);
    });

    it('handles UTF-8 and empty strings', () => {
        expect(textDecoder.decode(textEncoder.encode('Hello, 世界! 🚀'))).toBe('Hello, 世界! 🚀');
        expect(textDecoder.decode(textEncoder.encode(''))).toBe('');
    });
});

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('delays execution', () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 100);

        debounced();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('uses the latest arguments for rapid calls', () => {
        const fn = vi.fn();
        const debounced = debounce((value: string) => fn(value), 100);

        debounced('first');
        debounced('second');
        debounced('third');

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledWith('third');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
