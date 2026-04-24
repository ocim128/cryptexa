/**
 * Dialog Management Module
 * Provides dialog helpers using native <dialog> element with async validation
 */

import { qs, setPasswordMode, hideHint } from '../utils/dom.js';
import { toast } from './toast.js';

// ============================================================================
// TYPES
// ============================================================================

/** Password dialog configuration */
export interface PasswordDialogConfig {
    onOk: (password: string) => Promise<boolean>;
    obscure?: boolean;
    hideUI?: boolean;
}

/** Delete password dialog configuration */
export interface DeletePasswordDialogConfig {
    onOk: (password: string) => Promise<boolean>;
}

/** New password dialog configuration */
export interface NewPasswordDialogConfig {
    title?: string;
    onSave: (pass1: string, pass2: string) => Promise<boolean>;
}

/** Confirm dialog callback */
export type ConfirmDialogCallback = (confirmed: boolean) => void | Promise<void>;

// ============================================================================
// DIALOG FUNCTIONS
// ============================================================================

/**
 * Opens password dialog for decryption
 * @param config - Configuration object
 */
export const openPasswordDialog = ({
    onOk,
    obscure = true,
    hideUI = false
}: PasswordDialogConfig): void => {
    const dlg = qs<HTMLDialogElement>("#dialog-password")!;
    const input = qs<HTMLInputElement>("#enterpassword")!;

    dlg.returnValue = "cancel";
    input.value = "";

    if (obscure) setPasswordMode(true, { hide: hideUI });
    dlg.dataset.lockClose = "true";
    dlg.showModal();
    queueMicrotask(() => input.focus());

    const btnOk = dlg.querySelector<HTMLButtonElement>("button[value='ok']")!;
    const handleLockedCancel = (event: Event): void => {
        event.preventDefault();
        input.focus();
    };
    const handleEnterKey = (event: KeyboardEvent): void => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (!btnOk.disabled) {
            void handleOk(event);
        }
    };

    const handleOk = async (ev?: Event): Promise<void> => {
        ev?.preventDefault?.();
        btnOk.disabled = true;
        try {
            const success = await onOk(input.value);
            if (success) {
                dlg.close("ok");
                setPasswordMode(false);
            } else {
                toast("Incorrect password.", "error");
                input.select();
                input.focus();
                return; // keep dialog open
            }
        } finally {
            btnOk.disabled = false;
        }
    };

    btnOk.addEventListener("click", handleOk, { once: false });
    input.addEventListener("keydown", handleEnterKey);
    dlg.addEventListener("cancel", handleLockedCancel);

    const cleanup = (): void => {
        btnOk.removeEventListener("click", handleOk);
        input.removeEventListener("keydown", handleEnterKey);
        dlg.removeEventListener("cancel", handleLockedCancel);
        dlg.removeEventListener("close", cleanup);
        delete dlg.dataset.lockClose;
    };
    dlg.addEventListener("close", cleanup);
};

/**
 * Opens password dialog for delete confirmation
 * @param config - Configuration object
 */
export const openDeletePasswordDialog = ({ onOk }: DeletePasswordDialogConfig): void => {
    const dlg = qs<HTMLDialogElement>("#dialog-delete-password")!;
    const input = qs<HTMLInputElement>("#deletepassword")!;

    dlg.returnValue = "cancel";
    input.value = "";
    dlg.showModal();
    queueMicrotask(() => input.focus());

    const btnOk = dlg.querySelector<HTMLButtonElement>("button[value='ok']")!;
    const handleEnterKey = (event: KeyboardEvent): void => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (!btnOk.disabled) {
            void handleOk(event);
        }
    };

    const handleOk = async (ev?: Event): Promise<void> => {
        ev?.preventDefault?.();
        btnOk.disabled = true;
        try {
            const success = await onOk(input.value);
            if (success) {
                dlg.close("ok");
            } else {
                toast("Incorrect password.", "error");
                input.select();
                input.focus();
                return; // keep dialog open
            }
        } finally {
            btnOk.disabled = false;
        }
    };

    btnOk.addEventListener("click", handleOk, { once: false });
    input.addEventListener("keydown", handleEnterKey);

    const cleanup = (): void => {
        btnOk.removeEventListener("click", handleOk);
        input.removeEventListener("keydown", handleEnterKey);
        dlg.removeEventListener("close", cleanup);
    };
    dlg.addEventListener("close", cleanup);
};

/**
 * Opens new password creation/change dialog
 * @param config - Configuration object
 */
export const openNewPasswordDialog = ({ title, onSave }: NewPasswordDialogConfig): void => {
    const dlg = qs<HTMLDialogElement>("#dialog-new-password")!;
    const titleEl = qs<HTMLElement>("#dialog-new-password-title")!;
    const p1 = qs<HTMLInputElement>("#newpassword1")!;
    const p2 = qs<HTMLInputElement>("#newpassword2")!;
    const btnOk = dlg.querySelector<HTMLButtonElement>("button[value='ok']")!;

    titleEl.textContent = title || "Create password";
    hideHint("#passwords-empty");
    hideHint("#passwords-dont-match");
    dlg.returnValue = "cancel";
    p1.value = "";
    p2.value = "";
    dlg.showModal();
    queueMicrotask(() => p1.focus());
    const handleEnterKey = (event: KeyboardEvent): void => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (!btnOk.disabled) {
            void handleOk(event);
        }
    };

    const handleOk = async (ev?: Event): Promise<void> => {
        ev?.preventDefault?.();
        btnOk.disabled = true;
        try {
            const proceed = await onSave(p1.value, p2.value);
            if (proceed) {
                dlg.close("ok");
            }
        } finally {
            btnOk.disabled = false;
        }
    };

    btnOk.addEventListener("click", handleOk, { once: false });
    p1.addEventListener("keydown", handleEnterKey);
    p2.addEventListener("keydown", handleEnterKey);

    const cleanup = (): void => {
        btnOk.removeEventListener("click", handleOk);
        p1.removeEventListener("keydown", handleEnterKey);
        p2.removeEventListener("keydown", handleEnterKey);
        dlg.removeEventListener("close", cleanup);
    };

    dlg.addEventListener("close", cleanup);
};

/**
 * Opens a confirmation dialog
 * @param selector - CSS selector for the dialog
 * @param cb - Callback with boolean result
 */
export const openConfirmDialog = (
    selector: string,
    cb: ConfirmDialogCallback
): void => {
    const dlg = qs<HTMLDialogElement>(selector)!;
    dlg.returnValue = "cancel";
    dlg.showModal();

    const handler = (): void => {
        dlg.removeEventListener("close", handler);
        cb(dlg.returnValue === "ok");
    };

    dlg.addEventListener("close", handler);
};
