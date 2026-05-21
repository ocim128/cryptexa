import { WORKSPACE_ID_REQUIREMENTS, normalizeWorkspaceId } from "../utils/workspace.js";

export type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; message: string };

const HASH_TOKEN_PATTERN = /^[A-Za-z0-9._:~-]{0,512}$/;
const HEX_PATTERN = /^[0-9a-f]+$/i;

function fail(message: string): ValidationResult<never> {
    return { ok: false, message };
}

function isEvenHex(value: string): boolean {
    return value.length > 0 && value.length % 2 === 0 && HEX_PATTERN.test(value);
}

export function normalizeSiteKey(input: unknown): ValidationResult<string> {
    const value = normalizeWorkspaceId(input);
    if (!value) {
        return fail(`Invalid site. ${WORKSPACE_ID_REQUIREMENTS}`);
    }

    return { ok: true, value };
}

export function validateHashToken(input: unknown, fieldName: string): ValidationResult<string> {
    if (typeof input !== "string") {
        return fail(`Invalid ${fieldName}`);
    }

    if (!HASH_TOKEN_PATTERN.test(input)) {
        return fail(`${fieldName} contains invalid characters or is too long`);
    }

    return { ok: true, value: input };
}

export function validateEncryptedContent(input: unknown): ValidationResult<string> {
    if (typeof input !== "string") {
        return fail("Invalid encryptedContent");
    }

    if (input.length > 5 * 1024 * 1024) {
        return fail("encryptedContent is too large");
    }

    const parts = input.split(":");
    if (parts.length !== 3) {
        return fail("encryptedContent must use salt:iv:cipher format");
    }

    const [saltHex, ivHex, cipherHex] = parts;
    if (!saltHex || !ivHex || !cipherHex) {
        return fail("encryptedContent is missing a component");
    }

    if (!isEvenHex(saltHex) || saltHex.length < 32) {
        return fail("encryptedContent salt must be hex and at least 16 bytes");
    }

    if (!isEvenHex(ivHex) || ivHex.length !== 24) {
        return fail("encryptedContent iv must be 12 bytes of hex");
    }

    if (!isEvenHex(cipherHex) || cipherHex.length < 32) {
        return fail("encryptedContent cipher must be hex and include an authentication tag");
    }

    return { ok: true, value: input };
}
