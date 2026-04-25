/**
 * Toast Notification System
 */

export type ToastType = "info" | "success" | "error" | "warning";

const TOAST_ICONS: Record<ToastType, string> = {
    success: "OK",
    error: "X",
    warning: "!",
    info: "i"
};

export function toast(
    message: string,
    type: ToastType = "info",
    duration: number = 4000
): void {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toastEl = document.createElement("div");
    toastEl.className = `toast ${type}`;
    const content = document.createElement("div");
    content.className = "toast-content";

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = TOAST_ICONS[type];

    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "toast-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss notification");
    closeButton.textContent = String.fromCharCode(215);

    content.append(icon, text, closeButton);
    toastEl.appendChild(content);

    const dismiss = (): void => {
        if (toastEl.classList.contains("toast--leaving")) return;
        toastEl.classList.add("toast--leaving");
        setTimeout(() => toastEl.remove(), 180);
    };

    closeButton?.addEventListener("click", dismiss);

    container.appendChild(toastEl);
    setTimeout(dismiss, duration);
}
