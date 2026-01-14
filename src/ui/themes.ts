/**
 * Theme Management Module
 * Provides theme toggling with persistence and accessibility
 */

/** Theme preference type */
export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';
const root = document.documentElement;

/**
 * Gets system color scheme preference
 * @returns System theme preference
 */
export function getSystemPref(): ThemePreference {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark';
}

/**
 * Gets stored theme preference from localStorage
 * @returns Stored theme or null
 */
export function getStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Stores theme preference to localStorage
 * @param theme - Theme to store
 */
export function store(theme: ThemePreference): void {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* ignore storage errors */
    }
}

/**
 * Applies theme to document and updates toggle button
 * @param theme - Theme to apply
 */
export function applyTheme(theme: ThemePreference): void {
    root.classList.remove('theme-dark', 'theme-light');
    if (theme === 'light') {
        root.classList.add('theme-light');
    } else {
        root.classList.add('theme-dark');
    }
    updateToggle(theme);
}

/**
 * Gets current active theme
 * @returns Current theme
 */
export function currentTheme(): ThemePreference {
    const stored = getStored();
    if (stored === 'dark' || stored === 'light') return stored;
    if (root.classList.contains('theme-light')) return 'light';
    if (root.classList.contains('theme-dark')) return 'dark';
    const system = getSystemPref();
    return system === 'light' ? 'light' : 'dark';
}

/**
 * Updates theme toggle button state
 * @param theme - Current theme
 */
export function updateToggle(theme: ThemePreference): void {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const label = btn.querySelector('.label');
    const icon = btn.querySelector('.icon');
    const isDark = theme === 'dark';

    btn.setAttribute('aria-pressed', String(isDark));
    if (label) label.textContent = isDark ? 'Dark' : 'Light';
    if (icon) icon.textContent = isDark ? '🌙' : '🔆';
}

/**
 * Initializes theme on page load
 */
export function initTheme(): void {
    const initial = (getStored() || 'light') as ThemePreference;
    applyTheme(initial);
}

/**
 * Wires up theme toggle button and system preference listener
 */
export function wireThemeToggle(): void {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const next: ThemePreference = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        store(next);
    });

    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const handleChange = (): void => {
            if (getStored()) return; // user preference wins
            applyTheme(getSystemPref());
        };

        if (mq.addEventListener) {
            mq.addEventListener('change', handleChange);
        } else if ('addListener' in mq) {
            // Legacy support
            (mq as MediaQueryList).addListener(handleChange);
        }
    }
}
