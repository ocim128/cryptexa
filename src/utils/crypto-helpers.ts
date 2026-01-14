/**
 * Crypto Helper Utilities
 * Provides common cryptographic utility functions
 */

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

/**
 * Computes SHA-512 hash of input
 * @param input - Input to hash (string or Uint8Array)
 * @returns Hash in hex format
 */
export async function sha512Hex(input: string | Uint8Array): Promise<string> {
    const data = typeof input === "string" ? textEncoder.encode(input) : input;
    // TypeScript's strict mode has issues with Uint8Array -> BufferSource assignment
    // but this is valid at runtime as Uint8Array implements BufferSource
    const buf = await crypto.subtle.digest("SHA-512", data as unknown as BufferSource);
    return bufToHex(buf);
}

/**
 * Converts ArrayBuffer to hex string
 * @param buf - Buffer to convert
 * @returns Hex string
 */
export function bufToHex(buf: ArrayBuffer): string {
    const arr = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < arr.length; i++) {
        const byte = arr[i];
        s += byte !== undefined ? byte.toString(16).padStart(2, "0") : "";
    }
    return s;
}

/**
 * Converts hex string to ArrayBuffer
 * @param hex - Hex string to convert
 * @returns ArrayBuffer
 */
export function hexToBuf(hex: string): ArrayBuffer {
    const len = hex.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out.buffer;
}

/**
 * Generates random hex string
 * @param bytes - Number of bytes (default: 12)
 * @returns Random hex string
 */
export function randomHex(bytes: number = 12): string {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return bufToHex(b.buffer);
}

// ---------- Separator ----------
let separatorHexCache: string | null = null;

/**
 * Gets the separator hex (cached)
 * @returns Separator hex string
 */
export async function getSeparatorHex(): Promise<string> {
    if (!separatorHexCache) {
        separatorHexCache = await sha512Hex("-- tab separator --");
    }
    return separatorHexCache;
}

/**
 * Simple weak hash (non-crypto) only for concurrency token
 * @param str - String to hash
 * @returns Hash as hex string
 */
export function simpleWeakHash(str: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 0x01000193);
        h2 += c + (h2 << 1) + (h2 << 4) + (h2 << 7) + (h2 << 8) + (h2 << 24);
    }
    return (Math.abs(h1) + Math.abs(h2)).toString(16);
}
