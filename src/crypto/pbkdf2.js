/**
 * PBKDF2 Key Derivation Module
 * Provides secure key derivation using Web Crypto API
 */

import { hexToBuf, textEncoder } from '../utils/crypto-helpers.js';

/**
 * Derives an AES-GCM key from a password using PBKDF2
 * @param {string} password - User password
 * @param {string} saltHex - Salt in hex format
 * @param {number} iterations - Number of iterations (default: 150000)
 * @returns {Promise<CryptoKey>}
 */
export async function pbkdf2KeyFromPassword(password, saltHex, iterations = 150000) {
    const salt = hexToBuf(saltHex);
    const baseKey = await crypto.subtle.importKey(
        "raw",
        textEncoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}
