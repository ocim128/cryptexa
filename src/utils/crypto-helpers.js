/**
 * Crypto Helper Utilities
 * Provides common cryptographic utility functions
 */

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

/**
 * Computes SHA-512 hash of input
 * @param {string|Uint8Array} input - Input to hash
 * @returns {Promise<string>} - Hash in hex format
 */
export async function sha512Hex(input) {
    const data = typeof input === "string" ? textEncoder.encode(input) : input;
    const buf = await crypto.subtle.digest("SHA-512", data);
    return bufToHex(buf);
}

/**
 * Converts ArrayBuffer to hex string
 * @param {ArrayBuffer} buf - Buffer to convert
 * @returns {string} - Hex string
 */
export function bufToHex(buf) {
    const arr = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
    return s;
}

/**
 * Converts hex string to ArrayBuffer
 * @param {string} hex - Hex string to convert
 * @returns {ArrayBuffer} - Buffer
 */
export function hexToBuf(hex) {
    const len = hex.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out.buffer;
}

/**
 * Generates random hex string
 * @param {number} bytes - Number of bytes (default: 12)
 * @returns {string} - Random hex string
 */
export function randomHex(bytes = 12) {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return bufToHex(b.buffer);
}

// ---------- Separator ----------
let separatorHexCache = null;

/**
 * Gets the separator hex (cached)
 * @returns {Promise<string>} - Separator hex string
 */
export async function getSeparatorHex() {
    if (!separatorHexCache) {
        separatorHexCache = await sha512Hex("-- tab separator --");
    }
    return separatorHexCache;
}

/**
 * Simple weak hash (non-crypto) only for concurrency token
 * @param {string} str - String to hash
 * @returns {string} - Hash as hex string
 */
export function simpleWeakHash(str) {
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 ^= c; h1 = Math.imul(h1, 0x01000193);
        h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
    }
    return (Math.abs(h1) + Math.abs(h2)).toString(16);
}
