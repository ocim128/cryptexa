// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Keyboard Shortcuts E2E Tests
 * Tests for keyboard navigation and shortcuts
 */

test.describe('Keyboard Shortcuts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/keyboard-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should show help with F1 key', async ({ page }) => {
        await page.keyboard.press('F1');

        const dialog = page.locator('#dialog-help');
        await expect(dialog).toBeVisible({ timeout: 5000 });
        await expect(dialog).toContainText('Keyboard shortcuts');
    });

    test('should close dialog with Escape key', async ({ page }) => {
        // Open a dialog
        await page.locator('.textarea-contents').first().fill('Content');
        await page.locator('#button-save').click();

        // Dialog should be open
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();

        // Press Escape
        await page.keyboard.press('Escape');

        // Dialog should close
        await expect(dialog).toBeHidden();
    });

    test('should not replace an active modal when F1 is pressed', async ({ page }) => {
        await page.locator('.textarea-contents').first().fill('Content');
        await page.locator('#button-save').click();

        const passwordDialog = page.locator('#dialog-new-password');
        await expect(passwordDialog).toBeVisible();

        await page.keyboard.press('F1');

        await expect(passwordDialog).toBeVisible();
        await expect(page.locator('#dialog-help')).toBeHidden();
    });

    test('should trigger save with Ctrl+S', async ({ page }) => {
        await page.locator('.textarea-contents').first().fill('Test content');

        // Press Ctrl+S
        await page.keyboard.press('Control+s');

        // Password dialog should appear (for new site)
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();
    });

    test('should add new tab with add button click', async ({ page }) => {
        // Note: Ctrl+Alt+T may be intercepted by browser/OS
        // Test the functionality via the button which the shortcut triggers
        const initialCount = await page.locator('.tab-header').count();

        await page.locator('#add_tab').click();

        // Should have one more tab
        const newCount = await page.locator('.tab-header').count();
        expect(newCount).toBe(initialCount + 1);
    });

    test('should switch tabs with Ctrl+Tab', async ({ page }) => {
        // Add a second tab
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Go back to first tab
        await page.locator('.tab-header').first().locator('.tab-title').click();
        await expect(page.locator('.tab-header').first()).toHaveClass(/active/);

        // Press Ctrl+Tab to go to next tab
        await page.keyboard.press('Control+Tab');
        await page.waitForTimeout(100);

        // Second tab should now be active
        await expect(page.locator('.tab-header').nth(1)).toHaveClass(/active/);
    });

    test('should open tab switcher with Ctrl+Shift+P', async ({ page }) => {
        await page.keyboard.press('Control+Shift+P');

        const dialog = page.locator('#tab-switcher-dialog');
        await expect(dialog).toBeVisible();
    });

    test('should switch to specific tab with Ctrl+1-9', async ({ page }) => {
        // Add tabs
        await page.locator('#add_tab').click();
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Go to first tab
        await page.keyboard.press('Control+1');
        await page.waitForTimeout(100);
        await expect(page.locator('.tab-header').first()).toHaveClass(/active/);

        // Go to second tab
        await page.keyboard.press('Control+2');
        await page.waitForTimeout(100);
        await expect(page.locator('.tab-header').nth(1)).toHaveClass(/active/);

        // Go to third tab
        await page.keyboard.press('Control+3');
        await page.waitForTimeout(100);
        await expect(page.locator('.tab-header').nth(2)).toHaveClass(/active/);
    });
});

test.describe('Help Button', () => {
    test('should show shortcuts when clicking help button', async ({ page }) => {
        await page.goto('/help-test-site');
        await page.waitForLoadState('networkidle');

        const helpButton = page.locator('#help-button');
        await helpButton.click();

        const dialog = page.locator('#dialog-help');
        await expect(dialog).toBeVisible({ timeout: 5000 });
        await expect(dialog).toContainText('Keyboard shortcuts');
    });
});
