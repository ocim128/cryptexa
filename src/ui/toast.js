/**
 * Toast Notification System
 * Provides toast notifications and general notification utilities
 */

import { qs } from '../utils/dom.js';

/**
 * Enhanced toast notification system
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
export function toast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        const outer = qs("#outer-toast"), el = qs("#toast");
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
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toastEl.innerHTML = `<div class="toast-content"><span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button></div>`;
    container.appendChild(toastEl);
    setTimeout(() => toastEl.parentElement && toastEl.remove(), duration);
}

/**
 * Shows a notification (production error handling style)
 * @param {string} message - Message to display (supports HTML)
 * @param {string} type - Type: 'info', 'success', 'error', 'warning'
 * @param {number} duration - Duration in milliseconds (default: 5000)
 */
export function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = message; // Changed to innerHTML to support HTML content

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
