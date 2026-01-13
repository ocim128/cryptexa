// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Site Access E2E Tests
 * Tests for accessing and interacting with note sites
 */

test.describe('Site Access', () => {
    test('should show editor when site is specified in URL path', async ({ page }) => {
        await page.goto('/my-test-site');

        // Landing should be hidden
        const landing = page.locator('#landing');
        await expect(landing).toBeHidden();

        // Main content should be visible
        const mainContent = page.locator('#main-content-outter');
        await expect(mainContent).toBeVisible();

        // Menubar should be visible
        const menubar = page.locator('#menubar');
        await expect(menubar).toBeVisible();
    });

    test('should show editor when site is specified in query param', async ({ page }) => {
        await page.goto('/?site=my-query-site');

        const landing = page.locator('#landing');
        await expect(landing).toBeHidden();

        const mainContent = page.locator('#main-content-outter');
        await expect(mainContent).toBeVisible();
    });

    test('should display branding in menubar', async ({ page }) => {
        await page.goto('/test-site');

        const brand = page.locator('#brand');
        await expect(brand).toBeVisible();
        await expect(brand).toContainText('Cryptexa');
    });

    test('should display all action buttons', async ({ page }) => {
        await page.goto('/test-site');

        await expect(page.locator('#button-save')).toBeVisible();
        await expect(page.locator('#button-savenew')).toBeVisible();
        await expect(page.locator('#button-reload')).toBeVisible();
        await expect(page.locator('#button-delete')).toBeVisible();
    });
});

test.describe('New Site Creation', () => {
    const uniqueSite = `test-site-${Date.now()}`;

    test('should show password dialog for new site when saving', async ({ page }) => {
        await page.goto(`/${uniqueSite}`);

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Type some content
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('My secret notes');

        // Click save
        const saveButton = page.locator('#button-save');
        await saveButton.click();

        // Password dialog should appear
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();
    });

    test('should validate matching passwords', async ({ page }) => {
        await page.goto(`/${uniqueSite}`);
        await page.waitForLoadState('networkidle');

        // Type content
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Content');

        // Click save
        await page.locator('#button-save').click();

        // Wait for dialog
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();

        // Enter mismatching passwords
        await page.locator('#newpassword1').fill('password123');
        await page.locator('#newpassword2').fill('differentpassword');

        // Click save
        await dialog.locator('button[value="ok"]').click();

        // Error hint should appear
        const hint = page.locator('#passwords-dont-match');
        await expect(hint).toBeVisible();
    });

    test('should reject empty password', async ({ page }) => {
        await page.goto(`/${uniqueSite}`);
        await page.waitForLoadState('networkidle');

        // Type content
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Content');

        // Click save
        await page.locator('#button-save').click();

        // Wait for dialog
        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();

        // Leave passwords empty, click save
        await dialog.locator('button[value="ok"]').click();

        // Error hint should appear
        const hint = page.locator('#passwords-empty');
        await expect(hint).toBeVisible();
    });
});

test.describe('Password Dialogs', () => {
    test('should have cancel button in password dialog', async ({ page }) => {
        await page.goto('/test-site');
        await page.waitForLoadState('networkidle');

        await page.locator('.textarea-contents').first().fill('Content');
        await page.locator('#button-save').click();

        const dialog = page.locator('#dialog-new-password');
        await expect(dialog).toBeVisible();

        const cancelButton = dialog.locator('button[value="cancel"]');
        await expect(cancelButton).toBeVisible();

        await cancelButton.click();

        // Dialog should close
        await expect(dialog).toBeHidden();
    });
});
