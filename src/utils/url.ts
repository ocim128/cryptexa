export interface UrlPasswordResult {
    password: string | null;
    shouldScrub: boolean;
}

function getUrl(href: string): URL {
    return new URL(href, "http://localhost");
}

function decodePathSegment(segment: string): string {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
}

export function getQueryParamFromUrl(href: string, name: string): string | null {
    const url = getUrl(href);
    const value = url.searchParams.get(name);
    return value && value.trim().length ? value.trim() : null;
}

export function getSiteFromUrl(href: string): string | null {
    const url = getUrl(href);
    const segment = url.pathname.replace(/^\/+|\/+$/g, "");
    if (segment && segment !== "api") return decodePathSegment(segment);
    return getQueryParamFromUrl(href, "site");
}

export function getUrlPasswordFromUrl(href: string): UrlPasswordResult {
    const url = getUrl(href);
    const hash = url.hash.startsWith("#") ? url.hash.substring(1) : url.hash;
    const hashParams = new URLSearchParams(hash);
    const hashPassword = hashParams.get("password");
    const queryPassword = url.searchParams.get("password");
    const rawQueryPassword = url.search.startsWith("?") && url.search.length > 1 && !url.search.includes("=")
        ? decodeURIComponent(url.search.substring(1))
        : null;

    const password = hashPassword || queryPassword || rawQueryPassword;
    return {
        password: password && password.trim().length ? password.trim() : null,
        shouldScrub: Boolean(hashPassword || queryPassword || rawQueryPassword)
    };
}

export function removeUrlPassword(href: string): string {
    const url = getUrl(href);

    if (url.search.startsWith("?") && url.search.length > 1 && !url.search.includes("=")) {
        url.search = "";
    } else {
        url.searchParams.delete("password");
    }

    if (url.hash) {
        const hash = url.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        if (hashParams.has("password")) {
            hashParams.delete("password");
            const nextHash = hashParams.toString();
            url.hash = nextHash ? `#${nextHash}` : "";
        }
    }

    return `${url.pathname}${url.search}${url.hash}`;
}
