/**
 * Toast Notification System
 * Provides toast notifications and general notification utilities
 */

import { qs } from '../utils/dom.js';

/** Toast notification type */
export type ToastType = 'info' | 'success' | 'error' | 'warning';

/** Icon mapping for toast types */
const TOAST_ICONS: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
};

/**
 * Enhanced toast notification system
 * @param message - Message to display
 * @param type - Type: 'info', 'success', 'error', 'warning'
 * @param duration - Duration in milliseconds (default: 4000)
 */
export function toast(
    message: string,
    type: ToastType = 'info',
    duration: number = 4000
): void {
    const container = document.getElementById('toast-container');

    if (!container) {
        // Fallback to legacy toast
        const outer = qs<HTMLElement>("#outer-toast");
        const el = qs<HTMLElement>("#toast");
        if (outer && el) {
            el.innerHTML = message;
            outer.style.display = "block";
            outer.style.opacity = "1";
            setTimeout(() => outer.style.display = "none", duration);
        }
        return;
    }

    const toastEl = document.createElement('div');
    toastEl.className = `toast ${type}`;

    const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
    toastEl.innerHTML = `<div class="toast-content"><span class="toast-icon">${icon}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button></div>`;

    container.appendChild(toastEl);
    setTimeout(() => toastEl.parentElement && toastEl.remove(), duration);
}

/**
 * Shows a notification (production error handling style)
 * @param message - Message to display (supports HTML)
 * @param type - Type: 'info', 'success', 'error', 'warning'
 * @param duration - Duration in milliseconds (default: 5000)
 */
export function showNotification(
    message: string,
    type: ToastType = 'info',
    duration: number = 5000
): void {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message;

    // Add to DOM
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}
