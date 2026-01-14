/**
 * DOM Utilities
 * Provides common DOM helper functions
 */

/**
 * Query selector shorthand
 * @param {string} sel - CSS selector
 * @param {Document|Element} root - Root element (default: document)
 * @returns {Element|null}
 */
export function qs(sel, root = document) {
    return root.querySelector(sel);
}

/**
 * Query selector all shorthand (returns array)
 * @param {string} sel - CSS selector
 * @param {Document|Element} root - Root element (default: document)
 * @returns {Element[]}
 */
export function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
}

/**
 * Add event listener shorthand
 * @param {Element} el - Element to attach listener to
 * @param {string} ev - Event name
 * @param {Function} fn - Event handler
 * @param {Object} opts - Event listener options
 */
export function on(el, ev, fn, opts) {
    el.addEventListener(ev, fn, opts);
}

/**
 * Shows/hides loader element
 * @param {boolean} onFlag - Whether to show the loader
 */
export function showLoader(onFlag) {
    qs("#loader").style.display = onFlag ? "flex" : "none";
}

/**
 * Ensures the obscure overlay exists in DOM
 * @returns {HTMLElement} - The overlay element
 */
export function ensureObscureOverlay() {
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
 * @param {boolean} active - Whether password mode is active
 * @param {Object} opts - Options { hide: boolean }
 */
export function setPasswordMode(active, opts = { hide: false }) {
    const menubar = qs("#menubar");
    const main = qs("#main-content-outter");
    const html = document.documentElement;
    const ov = ensureObscureOverlay();

    if (active) {
        html.classList.add("password-mode");
        ov.classList.remove("hidden");
        // Prefer masking with blur + opacity for privacy; optionally hide for stricter mode
        if (opts.hide) {
            menubar && menubar.classList.add("app-hidden");
            main && main.classList.add("app-hidden");
            menubar && menubar.classList.remove("app-masked");
            main && main.classList.remove("app-masked");
        } else {
            menubar && menubar.classList.add("app-masked");
            main && main.classList.add("app-masked");
            menubar && menubar.classList.remove("app-hidden");
            main && main.classList.remove("app-hidden");
        }
    } else {
        html.classList.remove("password-mode");
        ov.classList.add("hidden");
        menubar && menubar.classList.remove("app-masked", "app-hidden");
        main && main.classList.remove("app-masked", "app-hidden");
    }
}

/**
 * Show hint element
 * @param {string} sel - CSS selector
 */
export const showHint = sel => qs(sel)?.style.setProperty('display', 'block');

/**
 * Hide hint element
 * @param {string} sel - CSS selector
 */
export const hideHint = sel => qs(sel)?.style.setProperty('display', 'none');
