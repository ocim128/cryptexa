/**
 * Password Strength Indicator Module
 * Provides visual feedback on password strength
 */

import { qs } from '../utils/dom.js';

// ============================================================================
// TYPES
// ============================================================================

/** Password strength level */
export type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';

/** Password strength analysis result */
export interface PasswordStrength {
    level: StrengthLevel;
    score: number; // 0-100
    label: string;
    color: string;
    feedback: string[];
}

// ============================================================================
// STRENGTH ANALYSIS
// ============================================================================

/**
 * Analyzes password strength and returns detailed feedback
 */
export function analyzePasswordStrength(password: string): PasswordStrength {
    if (!password || password.length === 0) {
        return {
            level: 'weak',
            score: 0,
            label: 'Enter password',
            color: 'var(--muted)',
            feedback: []
        };
    }

    let score = 0;
    const feedback: string[] = [];

    // Length scoring (up to 30 points)
    if (password.length >= 16) {
        score += 30;
    } else if (password.length >= 12) {
        score += 25;
    } else if (password.length >= 8) {
        score += 15;
    } else if (password.length >= 6) {
        score += 10;
    } else {
        feedback.push('Use at least 8 characters');
    }

    // Character variety scoring
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=[\]{}|;':",.<>?/`~\\]/.test(password);
    const hasSpaces = /\s/.test(password);

    // Lowercase (10 points)
    if (hasLowercase) {
        score += 10;
    } else {
        feedback.push('Add lowercase letters');
    }

    // Uppercase (10 points)
    if (hasUppercase) {
        score += 10;
    } else {
        feedback.push('Add uppercase letters');
    }

    // Numbers (15 points)
    if (hasNumbers) {
        score += 15;
    } else {
        feedback.push('Add numbers');
    }

    // Symbols (20 points)
    if (hasSymbols) {
        score += 20;
    } else {
        feedback.push('Add special characters (!@#$%...)');
    }

    // Spaces (passphrase bonus - 5 points)
    if (hasSpaces && password.split(' ').length >= 3) {
        score += 5;
    }

    // Penalize common patterns
    const commonPatterns = [
        /^12345/,
        /^password/i,
        /^qwerty/i,
        /^abc123/i,
        /(.)\1{3,}/, // Repeated characters (4+)
        /^[a-z]+$/i, // All letters only
        /^\d+$/, // All numbers only
    ];

    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            score = Math.max(0, score - 20);
            if (!feedback.includes('Avoid common patterns')) {
                feedback.push('Avoid common patterns');
            }
        }
    }

    // Bonus for long passphrases
    if (password.length >= 20 && hasSpaces) {
        score = Math.min(100, score + 10);
    }

    // Determine level
    let level: StrengthLevel;
    let label: string;
    let color: string;

    if (score >= 85) {
        level = 'very-strong';
        label = 'Very Strong';
        color = 'var(--accent)';
    } else if (score >= 70) {
        level = 'strong';
        label = 'Strong';
        color = '#22c55e';
    } else if (score >= 50) {
        level = 'good';
        label = 'Good';
        color = '#eab308';
    } else if (score >= 30) {
        level = 'fair';
        label = 'Fair';
        color = 'var(--warning)';
    } else {
        level = 'weak';
        label = 'Weak';
        color = 'var(--danger)';
    }

    return {
        level,
        score: Math.min(100, Math.max(0, score)),
        label,
        color,
        feedback: feedback.slice(0, 3) // Max 3 feedback items
    };
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

/**
 * Creates a password strength indicator element
 */
export function createStrengthIndicator(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'password-strength';
    container.innerHTML = `
        <div class="password-strength-bar">
            <div class="password-strength-fill"></div>
        </div>
        <div class="password-strength-info">
            <span class="password-strength-label"></span>
            <span class="password-strength-feedback"></span>
        </div>
    `;
    return container;
}

/**
 * Updates the strength indicator with current password strength
 */
export function updateStrengthIndicator(container: HTMLElement, strength: PasswordStrength): void {
    const fill = container.querySelector<HTMLElement>('.password-strength-fill');
    const label = container.querySelector<HTMLElement>('.password-strength-label');
    const feedback = container.querySelector<HTMLElement>('.password-strength-feedback');

    if (fill) {
        fill.style.width = `${strength.score}%`;
        fill.style.backgroundColor = strength.color;
        fill.setAttribute('data-level', strength.level);
    }

    if (label) {
        label.textContent = strength.label;
        label.style.color = strength.color;
    }

    if (feedback) {
        feedback.textContent = strength.feedback.join(' • ');
    }
}

/**
 * Attaches strength indicator to a password input
 */
export function attachStrengthIndicator(inputSelector: string): HTMLElement | null {
    const input = qs<HTMLInputElement>(inputSelector);
    if (!input) return null;

    // Check if indicator already exists
    const existingIndicator = input.parentElement?.querySelector('.password-strength');
    if (existingIndicator) {
        return existingIndicator as HTMLElement;
    }

    const indicator = createStrengthIndicator();

    // Insert after the input
    input.parentNode?.insertBefore(indicator, input.nextSibling);

    // Wire up input event
    input.addEventListener('input', () => {
        const strength = analyzePasswordStrength(input.value);
        updateStrengthIndicator(indicator, strength);
    });

    // Initial update
    updateStrengthIndicator(indicator, analyzePasswordStrength(input.value));

    return indicator;
}

/**
 * Initializes password strength indicators for new password dialogs
 */
export function initPasswordStrengthIndicators(): void {
    // Attach to new password input in the new password dialog
    const newPasswordInput = qs<HTMLInputElement>('#newpassword1');
    if (newPasswordInput) {
        attachStrengthIndicator('#newpassword1');
    }

    // Watch for dialog open to ensure indicator is attached
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
                const dialog = mutation.target as HTMLDialogElement;
                if (dialog.id === 'dialog-new-password' && dialog.open) {
                    // Re-attach or reinitialize the indicator
                    const input = qs<HTMLInputElement>('#newpassword1');
                    if (input) {
                        const existing = dialog.querySelector('.password-strength');
                        if (!existing) {
                            attachStrengthIndicator('#newpassword1');
                        }
                        // Reset the indicator
                        const indicator = dialog.querySelector('.password-strength');
                        if (indicator) {
                            updateStrengthIndicator(
                                indicator as HTMLElement,
                                analyzePasswordStrength('')
                            );
                        }
                    }
                }
            }
        }
    });

    const newPasswordDialog = qs<HTMLDialogElement>('#dialog-new-password');
    if (newPasswordDialog) {
        observer.observe(newPasswordDialog, { attributes: true });
    }
}
