/**
 * Toast Notification System
 */

import { qs } from "../utils/dom.js";

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

    if (!container) {
        const outer = qs<HTMLElement>("#outer-toast");
        const element = qs<HTMLElement>("#toast");
        if (outer && element) {
            element.textContent = message;
            outer.classList.remove("hidden");
            setTimeout(() => outer.classList.add("hidden"), duration);
        }
        return;
    }

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

    closeButton?.addEventListener("click", () => toastEl.remove());

    container.appendChild(toastEl);
    setTimeout(() => {
        if (toastEl.parentElement) {
            toastEl.remove();
        }
    }, duration);
}

export function showNotification(
    message: string,
    type: ToastType = "info",
    duration: number = 5000
): void {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 180);
    }, duration);
}
