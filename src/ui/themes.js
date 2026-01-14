/**
 * Theme Management Module
 * Provides theme toggling with persistence and accessibility
 */

const STORAGE_KEY = 'theme-preference'; // 'dark' | 'light'
const root = document.documentElement;

/**
 * Gets system color scheme preference
 * @returns {'light'|'dark'}
 */
export function getSystemPref() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light' : 'dark';
}

/**
 * Gets stored theme preference from localStorage
 * @returns {string|null}
 */
export function getStored() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * Stores theme preference to localStorage
 * @param {string} theme - Theme to store
 */
export function store(theme) {
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        /* ignore storage errors */
    }
}

/**
 * Applies theme to document and updates toggle button
 * @param {string} theme - Theme to apply
 */
export function applyTheme(theme) {
    root.classList.remove('theme-dark', 'theme-light');
    if (theme === 'light') {
        root.classList.add('theme-light');
    } else {
        root.classList.add('theme-dark'); // default explicit
    }
    updateToggle(theme);
}

/**
 * Gets current active theme
 * @returns {'light'|'dark'}
 */
export function currentTheme() {
    const stored = getStored();
    if (stored === 'dark' || stored === 'light') return stored;
    if (root.classList.contains('theme-light')) return 'light';
    if (root.classList.contains('theme-dark')) return 'dark';
    const system = getSystemPref();
    return system === 'light' ? 'light' : 'dark';
}

/**
 * Updates theme toggle button state
 * @param {string} theme - Current theme
 */
export function updateToggle(theme) {
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
export function initTheme() {
    const initial = getStored() || 'light'; // default to light
    applyTheme(initial);
}

/**
 * Wires up theme toggle button and system preference listener
 */
export function wireThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        store(next);
    });
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const handleChange = () => {
            if (getStored()) return; // user preference wins
            applyTheme(getSystemPref());
        };
        if (mq.addEventListener) mq.addEventListener('change', handleChange);
        else if (mq.addListener) mq.addListener(handleChange);
    }
}
