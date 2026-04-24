/**
 * Theme Management Module
 * Provides theme toggling with persistence and accessibility
 */

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "theme-preference";
const root = document.documentElement;

export function getSystemPref(): ThemePreference {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
}

export function getStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

export function store(theme: ThemePreference): void {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        void 0;
    }
}

export function applyTheme(theme: ThemePreference): void {
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(theme === "light" ? "theme-light" : "theme-dark");
    updateToggle(theme);
}

export function currentTheme(): ThemePreference {
    const stored = getStored();
    if (stored === "dark" || stored === "light") return stored;
    if (root.classList.contains("theme-light")) return "light";
    if (root.classList.contains("theme-dark")) return "dark";
    return getSystemPref();
}

export function updateToggle(theme: ThemePreference): void {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    const label = button.querySelector(".label");
    const isDark = theme === "dark";

    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
    if (label) {
        label.textContent = isDark ? "Dark" : "Light";
    }
}

export function initTheme(): void {
    const initial = (getStored() || "light") as ThemePreference;
    applyTheme(initial);
}

export function wireThemeToggle(): void {
    const button = document.getElementById("theme-toggle");
    if (!button) return;

    button.addEventListener("click", () => {
        const next: ThemePreference = currentTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        store(next);
    });

    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (): void => {
        if (getStored()) return;
        applyTheme(getSystemPref());
    };

    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
    } else if ("addListener" in mediaQuery) {
        mediaQuery.addListener(handleChange);
    }
}
