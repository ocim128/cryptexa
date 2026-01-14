/**
 * AES-GCM Encryption/Decryption Module
 * Provides secure encryption using Web Crypto API with AES-GCM 256-bit
 */

import { pbkdf2KeyFromPassword } from './pbkdf2.js';
import { hexToBuf, bufToHex, randomHex, textEncoder, textDecoder } from '../utils/crypto-helpers.js';

/**
 * Encrypts plaintext using AES-GCM
 * @param {string} plainText - The text to encrypt
 * @param {string} password - User password
 * @param {string} saltHex - Salt in hex format
 * @returns {Promise<{ivHex: string, cipherHex: string}>}
 */
export async function aesGcmEncryptHex(plainText, password, saltHex) {
    const ivHex = randomHex(12);
    const key = await pbkdf2KeyFromPassword(password, saltHex);
    const cipherBuf = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: hexToBuf(ivHex) },
        key,
        textEncoder.encode(plainText)
    );
    return { ivHex, cipherHex: bufToHex(cipherBuf) };
}

/**
 * Decrypts ciphertext using AES-GCM
 * @param {string} ivHex - Initialization vector in hex format
 * @param {string} cipherHex - Ciphertext in hex format
 * @param {string} password - User password
 * @param {string} saltHex - Salt in hex format
 * @returns {Promise<string>} - Decrypted plaintext or empty string on failure
 */
export async function aesGcmDecryptHex(ivHex, cipherHex, password, saltHex) {
    const key = await pbkdf2KeyFromPassword(password, saltHex);
    try {
        const plainBuf = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: hexToBuf(ivHex) },
            key,
            hexToBuf(cipherHex)
        );
        return textDecoder.decode(plainBuf);
    } catch {
        // Normalize occasional WebCrypto errors without throwing to callers
        return "";
    }
}
