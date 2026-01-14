// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Password Strength E2E Tests
 * Tests for the password strength indicator functionality
 * 
 * Note: For new sites, the password dialog appears when saving for the first time.
 * The "Change Password" button is disabled for new sites.
 */

test.describe('Password Strength Indicator', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to a new site - this creates a fresh session
        await page.goto('/pw-strength-test-' + Date.now());
        await page.waitForLoadState('networkidle');

        // Wait for the app to be ready
        await page.waitForSelector('.textarea-contents', { state: 'visible', timeout: 5000 });
    });

    test('should show password strength indicator when saving new site', async ({ page }) => {
        // Add some content first
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Test content for password strength');

        // Click Save button - this should trigger the new password dialog for a new site
        await page.locator('#button-save').click();

        // New password dialog should be visible
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        // Password strength indicator should be present after typing
        const passwordInput = page.locator('#newpassword1');
        await passwordInput.fill('test');

        const strengthIndicator = dialog.locator('.password-strength');
        await expect(strengthIndicator).toBeVisible();
    });

    test('should show weak strength for short passwords', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Test content');

        await page.locator('#button-save').click();

        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const passwordInput = page.locator('#newpassword1');
        await passwordInput.fill('abc');

        const strengthFill = page.locator('.password-strength-fill');
        await expect(strengthFill).toHaveAttribute('data-level', 'weak');

        const strengthLabel = page.locator('.password-strength-label');
        await expect(strengthLabel).toContainText('Weak');

        // Cancel dialog
        await dialog.locator('button[value="cancel"]').click();
    });

    test('should show strong strength for complex passwords', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Test content');

        await page.locator('#button-save').click();

        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const passwordInput = page.locator('#newpassword1');
        await passwordInput.fill('MyStr0ng!Password2024');

        const strengthFill = page.locator('.password-strength-fill');
        const level = await strengthFill.getAttribute('data-level');
        expect(['strong', 'very-strong']).toContain(level);

        // Cancel dialog
        await dialog.locator('button[value="cancel"]').click();
    });

    test('should update strength indicator as user types', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Test content');

        await page.locator('#button-save').click();

        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const passwordInput = page.locator('#newpassword1');
        const strengthFill = page.locator('.password-strength-fill');

        // Type short password - should be weak
        await passwordInput.fill('ab');
        let level = await strengthFill.getAttribute('data-level');
        expect(level).toBe('weak');

        // Add complexity - should improve
        await passwordInput.fill('Abcdefgh1!');
        level = await strengthFill.getAttribute('data-level');
        expect(['good', 'strong', 'very-strong']).toContain(level);

        // Cancel dialog
        await dialog.locator('button[value="cancel"]').click();
    });

    test('should show feedback suggestions for weak passwords', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Test content');

        await page.locator('#button-save').click();

        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const passwordInput = page.locator('#newpassword1');
        await passwordInput.fill('abc');

        const feedback = page.locator('.password-strength-feedback');
        const feedbackText = await feedback.textContent();

        // Should suggest improvements
        expect(feedbackText).not.toBe('');

        // Cancel dialog
        await dialog.locator('button[value="cancel"]').click();
    });
});
