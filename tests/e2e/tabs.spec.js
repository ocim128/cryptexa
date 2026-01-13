// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tab Management E2E Tests
 * Tests for tab creation, deletion, and interaction
 */

test.describe('Tab Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tab-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should display initial tab', async ({ page }) => {
        const tabHeader = page.locator('.tab-header').first();
        await expect(tabHeader).toBeVisible();
    });

    test('should have add tab button', async ({ page }) => {
        const addButton = page.locator('#add_tab');
        await expect(addButton).toBeVisible();
        await expect(addButton).toContainText('+');
    });

    test('should add new tab when clicking add button', async ({ page }) => {
        const addButton = page.locator('#add_tab');
        const initialTabCount = await page.locator('.tab-header').count();

        await addButton.click();

        const newTabCount = await page.locator('.tab-header').count();
        expect(newTabCount).toBe(initialTabCount + 1);
    });

    test('should switch active tab when clicking tab header', async ({ page }) => {
        // Add a second tab
        await page.locator('#add_tab').click();

        const firstTab = page.locator('.tab-header').first();
        const secondTab = page.locator('.tab-header').nth(1);

        // Click second tab
        await secondTab.locator('.tab-title').click();
        await expect(secondTab).toHaveClass(/active/);

        // Click first tab
        await firstTab.locator('.tab-title').click();
        await expect(firstTab).toHaveClass(/active/);
    });

    test('should have close button on tab', async ({ page }) => {
        const tabHeader = page.locator('.tab-header').first();
        const closeButton = tabHeader.locator('.close');

        // Close button should exist
        await expect(closeButton).toBeAttached();
    });

    test('should show confirmation dialog when double-clicking close button', async ({ page }) => {
        // First add a tab so we have more than one
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Double-click close on the second tab (close requires double-click)
        const tabHeader = page.locator('.tab-header').nth(1);
        const closeButton = tabHeader.locator('.close');
        await closeButton.dblclick();

        // Confirmation dialog should appear
        const dialog = page.locator('#dialog-confirm-delete-tab');
        await expect(dialog).toBeVisible();
    });

    test('should delete tab when confirming after double-click', async ({ page }) => {
        // Add a new tab
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        const initialCount = await page.locator('.tab-header').count();
        expect(initialCount).toBe(2);

        // Double-click close on the second tab
        const tabHeader = page.locator('.tab-header').nth(1);
        await tabHeader.locator('.close').dblclick();

        // Confirm deletion
        const dialog = page.locator('#dialog-confirm-delete-tab');
        await expect(dialog).toBeVisible();
        await dialog.locator('button[value="ok"]').click();

        // Should only have one tab now
        await expect(page.locator('.tab-header')).toHaveCount(1);
    });

    test('should cancel tab deletion when clicking cancel', async ({ page }) => {
        // Add a new tab
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Double-click close on the second tab
        await page.locator('.tab-header').nth(1).locator('.close').dblclick();

        // Cancel deletion
        const dialog = page.locator('#dialog-confirm-delete-tab');
        await expect(dialog).toBeVisible();
        await dialog.locator('button[value="cancel"]').click();

        // Should still have two tabs
        await expect(page.locator('.tab-header')).toHaveCount(2);
    });
});

test.describe('Tab Content', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/content-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should have textarea for content', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await expect(textarea).toBeVisible();
    });

    test('should accept text input', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();

        await textarea.fill('Hello, World!');

        await expect(textarea).toHaveValue('Hello, World!');
    });

    test('should show placeholder text', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await expect(textarea).toHaveAttribute('placeholder', 'your text goes here...');
    });

    test('should have line gutter', async ({ page }) => {
        const gutter = page.locator('.line-gutter').first();
        await expect(gutter).toBeVisible();
    });

    test('should maintain separate content per tab', async ({ page }) => {
        // Type in first tab
        await page.locator('.textarea-contents').first().fill('First tab content');

        // Add second tab
        await page.locator('#add_tab').click();

        // Second tab should be active and have empty textarea
        const secondTextarea = page.locator('.tab-panel.active .textarea-contents');
        await expect(secondTextarea).toHaveValue('');

        // Type in second tab
        await secondTextarea.fill('Second tab content');

        // Switch back to first tab
        await page.locator('.tab-header').first().locator('.tab-title').click();

        // First tab should still have its content
        const firstTextarea = page.locator('.tab-panel.active .textarea-contents');
        await expect(firstTextarea).toHaveValue('First tab content');
    });
});
