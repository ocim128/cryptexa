/**
 * PBKDF2 Key Derivation Module
 * Provides secure key derivation using Web Crypto API
 */

import { hexToBuf, textEncoder } from '../utils/crypto-helpers.js';

/** Default PBKDF2 iterations for security */
const DEFAULT_ITERATIONS = 150000;

/**
 * Derives an AES-GCM key from a password using PBKDF2
 * @param password - User password
 * @param saltHex - Salt in hex format
 * @param iterations - Number of iterations (default: 150000)
 * @returns CryptoKey for AES-GCM encryption/decryption
 */
export async function pbkdf2KeyFromPassword(
    password: string,
    saltHex: string,
    iterations: number = DEFAULT_ITERATIONS
): Promise<CryptoKey> {
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
