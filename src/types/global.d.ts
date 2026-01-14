/**
 * Global Type Definitions for Cryptexa
 */

// ============================================================================
// CRYPTO TYPES
// ============================================================================

/** Result of AES-GCM encryption */
export interface EncryptionResult {
    ivHex: string;
    cipherHex: string;
}

/** Encrypted content format stored/transmitted */
export interface EncryptedContent {
    iv: string;
    cipher: string;
}

// ============================================================================
// STATE TYPES
// ============================================================================

/** Tab data structure */
export interface Tab {
    id: string;
    title: string;
    content: string;
    color?: string;
}

/** Client state stored in memory */
export interface ClientStateData {
    siteId: string;
    password: string;
    saltHex: string;
    tabs: Tab[];
    activeTabId: string;
    initHashContent: string;
    currentHashContent: string;
    isNew: boolean;
    encryptedContent: string;
}

/** Serialized content format */
export interface SerializedContent {
    tabs: Tab[];
    activeTabId: string;
}

// ============================================================================
// API TYPES
// ============================================================================

/** API response for site data */
export interface SiteResponse {
    status: 'success' | 'error';
    isNew: boolean;
    eContent: string;
    currentDBVersion: number;
    expectedDBVersion: number;
    message?: string;
}

/** API request for saving */
export interface SaveRequest {
    site: string;
    initHashContent: string;
    currentHashContent: string;
    encryptedContent: string;
}

/** API request for deletion */
export interface DeleteRequest {
    site: string;
    initHashContent: string;
}

/** Generic API response */
export interface ApiResponse {
    status: 'success' | 'error';
    message?: string;
}

// ============================================================================
// UI TYPES
// ============================================================================

/** Toast notification types */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast options */
export interface ToastOptions {
    type?: ToastType;
    duration?: number;
    dismissible?: boolean;
}

/** Theme preference */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Dialog result */
export interface DialogResult<T = string> {
    confirmed: boolean;
    value?: T;
}

// ============================================================================
// DOM HELPER TYPES
// ============================================================================

/** Query selector result with null check */
export type ElementOrNull<T extends Element = Element> = T | null;

/** Event listener cleanup function */
export type CleanupFunction = () => void;

// ============================================================================
// SERVER TYPES (for reference)
// ============================================================================

/** Database site record */
export interface SiteRecord {
    hashContent: string;
    eContent: string;
}

/** Database structure */
export interface DatabaseSchema {
    version: number;
    sites: Record<string, SiteRecord>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Make specific properties optional */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Make specific properties required */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/** Async function return type */
export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> =
    T extends (...args: unknown[]) => Promise<infer R> ? R : never;
