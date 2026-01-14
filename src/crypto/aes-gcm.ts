/**
 * AES-GCM Encryption/Decryption Module
 * Provides secure encryption using Web Crypto API with AES-GCM 256-bit
 */

import { pbkdf2KeyFromPassword } from './pbkdf2.js';
import { hexToBuf, bufToHex, randomHex, textEncoder, textDecoder } from '../utils/crypto-helpers.js';
import type { EncryptionResult } from '../types/global.js';

/**
 * Encrypts plaintext using AES-GCM
 * @param plainText - The text to encrypt
 * @param password - User password
 * @param saltHex - Salt in hex format
 * @returns Object containing IV and ciphertext in hex format
 */
export async function aesGcmEncryptHex(
    plainText: string,
    password: string,
    saltHex: string
): Promise<EncryptionResult> {
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
 * @param ivHex - Initialization vector in hex format
 * @param cipherHex - Ciphertext in hex format
 * @param password - User password
 * @param saltHex - Salt in hex format
 * @returns Decrypted plaintext or empty string on failure
 */
export async function aesGcmDecryptHex(
    ivHex: string,
    cipherHex: string,
    password: string,
    saltHex: string
): Promise<string> {
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
