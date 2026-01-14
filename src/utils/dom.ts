/**
 * DOM Utilities
 * Provides common DOM helper functions
 */

/** Options for password mode */
export interface PasswordModeOptions {
    hide?: boolean;
}

/** Event listener options type */
type EventListenerOptionsType = boolean | AddEventListenerOptions;

/**
 * Query selector shorthand
 * @param sel - CSS selector
 * @param root - Root element (default: document)
 * @returns Element or null
 */
export function qs<T extends Element = Element>(
    sel: string,
    root: Document | Element = document
): T | null {
    return root.querySelector<T>(sel);
}

/**
 * Query selector all shorthand (returns array)
 * @param sel - CSS selector
 * @param root - Root element (default: document)
 * @returns Array of elements
 */
export function qsa<T extends Element = Element>(
    sel: string,
    root: Document | Element = document
): T[] {
    return Array.from(root.querySelectorAll<T>(sel));
}

/**
 * Add event listener shorthand
 * @param el - Element to attach listener to
 * @param ev - Event name
 * @param fn - Event handler
 * @param opts - Event listener options
 */
export function on<K extends keyof HTMLElementEventMap>(
    el: HTMLElement | Document | Window,
    ev: K | string,
    fn: EventListenerOrEventListenerObject,
    opts?: EventListenerOptionsType
): void {
    el.addEventListener(ev, fn, opts);
}

/**
 * Shows/hides loader element
 * @param onFlag - Whether to show the loader
 */
export function showLoader(onFlag: boolean): void {
    const loader = qs<HTMLElement>("#loader");
    if (loader) {
        loader.style.display = onFlag ? "flex" : "none";
    }
}

/**
 * Ensures the obscure overlay exists in DOM
 * @returns The overlay element
 */
export function ensureObscureOverlay(): HTMLElement {
    let ov = document.getElementById("app-obscure-overlay");
    if (!ov) {
        ov = document.createElement("div");
        ov.id = "app-obscure-overlay";
        ov.className = "app-obscure-overlay hidden";
        document.body.appendChild(ov);
    }
    return ov;
}

/**
 * Sets password mode (obscures or reveals UI)
 * @param active - Whether password mode is active
 * @param opts - Options { hide: boolean }
 */
export function setPasswordMode(
    active: boolean,
    opts: PasswordModeOptions = { hide: false }
): void {
    const menubar = qs<HTMLElement>("#menubar");
    const main = qs<HTMLElement>("#main-content-outter");
    const html = document.documentElement;
    const ov = ensureObscureOverlay();

    if (active) {
        html.classList.add("password-mode");
        ov.classList.remove("hidden");
        // Prefer masking with blur + opacity for privacy; optionally hide for stricter mode
        if (opts.hide) {
            menubar?.classList.add("app-hidden");
            main?.classList.add("app-hidden");
            menubar?.classList.remove("app-masked");
            main?.classList.remove("app-masked");
        } else {
            menubar?.classList.add("app-masked");
            main?.classList.add("app-masked");
            menubar?.classList.remove("app-hidden");
            main?.classList.remove("app-hidden");
        }
    } else {
        html.classList.remove("password-mode");
        ov.classList.add("hidden");
        menubar?.classList.remove("app-masked", "app-hidden");
        main?.classList.remove("app-masked", "app-hidden");
    }
}

/**
 * Show hint element
 * @param sel - CSS selector
 */
export const showHint = (sel: string): void => {
    qs<HTMLElement>(sel)?.style.setProperty('display', 'block');
};

/**
 * Hide hint element
 * @param sel - CSS selector
 */
export const hideHint = (sel: string): void => {
    qs<HTMLElement>(sel)?.style.setProperty('display', 'none');
};
