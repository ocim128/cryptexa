const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;
const RESERVED_WORKSPACE_IDS = new Set(["api"]);

export const WORKSPACE_ID_REQUIREMENTS =
    "Use 1-128 characters: letters, numbers, dots, dashes, underscores, or tildes.";

export function normalizeWorkspaceId(input: unknown): string | null {
    if (typeof input !== "string" && typeof input !== "number") {
        return null;
    }

    const value = String(input).trim();
    if (!value || RESERVED_WORKSPACE_IDS.has(value.toLowerCase())) {
        return null;
    }

    return WORKSPACE_ID_PATTERN.test(value) ? value : null;
}
