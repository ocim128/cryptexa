/**
 * Dialog Management Module
 * Provides dialog helpers using native <dialog> element with async validation
 */

import { qs, setPasswordMode, hideHint } from '../utils/dom.js';
import { toast } from './toast.js';

/**
 * Opens password dialog for decryption
 * @param {Object} config - Configuration object
 * @param {Function} config.onOk - Callback when OK clicked, receives password, returns boolean
 * @param {boolean} config.obscure - Whether to obscure UI (default: true)
 * @param {boolean} config.hideUI - Whether to completely hide UI (default: false)
 */
export const openPasswordDialog = ({ onOk, obscure = true, hideUI = false }) => {
    const dlg = qs("#dialog-password"), input = qs("#enterpassword");
    dlg.returnValue = "cancel";
    input.value = "";
    if (obscure) setPasswordMode(true, { hide: hideUI });
    dlg.showModal();
    queueMicrotask(() => input.focus());

    const btnOk = dlg.querySelector("button[value='ok']");

    const handleOk = async (ev) => {
        ev?.preventDefault?.();
        btnOk.disabled = true;
        try {
            const success = await onOk(input.value);
            if (success) {
                dlg.close("ok");
                setPasswordMode(false);
            } else {
                toast("Wrong password", "error");
                input.select();
                input.focus();
                return; // keep dialog open
            }
        } finally {
            btnOk.disabled = false;
        }
    };

    btnOk.addEventListener("click", handleOk, { once: false });

    const cleanup = () => {
        btnOk.removeEventListener("click", handleOk);
        dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
};

/**
 * Opens password dialog for delete confirmation
 * @param {Object} config - Configuration object
 * @param {Function} config.onOk - Callback when OK clicked, receives password, returns boolean
 */
export const openDeletePasswordDialog = ({ onOk }) => {
    const dlg = qs("#dialog-delete-password"), input = qs("#deletepassword");
    dlg.returnValue = "cancel";
    input.value = "";
    dlg.showModal();
    queueMicrotask(() => input.focus());

    const btnOk = dlg.querySelector("button[value='ok']");

    const handleOk = async (ev) => {
        ev?.preventDefault?.();
        btnOk.disabled = true;
        try {
            const success = await onOk(input.value);
            if (success) {
                dlg.close("ok");
            } else {
                toast("Wrong password", "error");
                input.select();
                input.focus();
                return; // keep dialog open
            }
        } finally {
            btnOk.disabled = false;
        }
    };

    btnOk.addEventListener("click", handleOk, { once: false });

    const cleanup = () => {
        btnOk.removeEventListener("click", handleOk);
        dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
};

/**
 * Opens new password creation/change dialog
 * @param {Object} config - Configuration object
 * @param {string} config.title - Dialog title
 * @param {Function} config.onSave - Callback when save clicked, receives (pass1, pass2), returns boolean
 */
export const openNewPasswordDialog = ({ title, onSave }) => {
    const dlg = qs("#dialog-new-password"), titleEl = qs("#dialog-new-password-title"), p1 = qs("#newpassword1"), p2 = qs("#newpassword2");
    titleEl.textContent = title || "Create password";
    hideHint("#passwords-empty");
    hideHint("#passwords-dont-match");
    dlg.returnValue = "cancel";
    dlg.showModal();
    setTimeout(() => (p1.value = "", p2.value = "", p1.focus()), 0);
    const handler = async () => {
        const ok = dlg.returnValue === "ok";
        if (!ok) return dlg.removeEventListener("close", handler);
        const proceed = await onSave(p1.value, p2.value);
        proceed ? dlg.removeEventListener("close", handler) : setTimeout(() => dlg.showModal(), 0);
    };
    dlg.addEventListener("close", handler);
};

/**
 * Opens a confirmation dialog
 * @param {string} selector - CSS selector for the dialog
 * @param {Function} cb - Callback with boolean result (true if OK, false if cancel)
 */
export const openConfirmDialog = (selector, cb) => {
    const dlg = qs(selector);
    dlg.returnValue = "cancel";
    dlg.showModal();
    const handler = () => {
        dlg.removeEventListener("close", handler);
        cb(dlg.returnValue === "ok");
    };
    dlg.addEventListener("close", handler);
};
