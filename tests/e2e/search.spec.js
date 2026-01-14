// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Global Search E2E Tests
 * Tests for the global search functionality across all tabs
 */

test.describe('Global Search', () => {
    test.beforeEach(async ({ page }) => {
        // Listen for console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`PAGE ERROR: ${msg.text()}`);
            }
        });
        page.on('pageerror', err => {
            console.log(`PAGE EXCEPTION: ${err.message}`);
        });

        await page.goto('/search-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should open search dialog with keyboard shortcut Ctrl+Shift+F', async ({ page }) => {
        await page.keyboard.press('Control+Shift+f');

        const searchDialog = page.locator('#search-dialog');
        await expect(searchDialog).toBeVisible();
    });

    test('should open search dialog with search button click', async ({ page }) => {
        const searchButton = page.locator('#search-button');

        // Wait for the button to be added dynamically
        await expect(searchButton).toBeVisible({ timeout: 5000 });
        await searchButton.click();

        const searchDialog = page.locator('#search-dialog');
        await expect(searchDialog).toBeVisible();
    });

    test('should close search dialog with Escape key', async ({ page }) => {
        await page.keyboard.press('Control+Shift+f');
        const searchDialog = page.locator('#search-dialog');
        await expect(searchDialog).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(searchDialog).not.toBeVisible();
    });

    test('should show hint when search input is empty', async ({ page }) => {
        await page.keyboard.press('Control+Shift+f');

        const hint = page.locator('.search-hint');
        await expect(hint).toContainText('Start typing to search');
    });

    test('should show minimum characters hint for single character', async ({ page }) => {
        await page.keyboard.press('Control+Shift+f');

        const searchInput = page.locator('#search-input');
        await searchInput.fill('a');

        const hint = page.locator('.search-hint');
        await expect(hint).toContainText('at least 2 characters');
    });

    test('should find text in current tab', async ({ page }) => {
        // First, add some content to the textarea
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Hello World Test Content\nAnother line with test');

        // Open search
        await page.keyboard.press('Control+Shift+f');

        // Search for "test"
        const searchInput = page.locator('#search-input');
        await searchInput.fill('test');

        // Should find results
        const results = page.locator('.search-result');
        await expect(results).toHaveCount(2); // "Test" and "test"
    });

    test('should highlight search matches', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Hello World Example');

        await page.keyboard.press('Control+Shift+f');

        const searchInput = page.locator('#search-input');
        await searchInput.fill('World');

        const mark = page.locator('.search-result-content mark');
        await expect(mark.first()).toContainText('World');
    });

    test('should show "no matches" when search has no results', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Hello World');

        await page.keyboard.press('Control+Shift+f');

        const searchInput = page.locator('#search-input');
        await searchInput.fill('xyznonexistent');

        const noResults = page.locator('.search-no-results');
        await expect(noResults).toBeVisible();
    });

    test('should navigate results with arrow keys', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Line one\nLine two\nLine three');

        await page.keyboard.press('Control+Shift+f');

        const searchInput = page.locator('#search-input');
        await searchInput.fill('Line');

        // First result should be selected by default
        let selectedResult = page.locator('.search-result.selected');
        await expect(selectedResult).toHaveCount(1);

        // Press down arrow
        await page.keyboard.press('ArrowDown');

        // Second result should now be selected
        const secondResult = page.locator('.search-result').nth(1);
        await expect(secondResult).toHaveClass(/selected/);
    });

    test('should go to result on Enter key', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        const testContent = 'Hello World on line one\nThis is line two\nLine three here';
        await textarea.fill(testContent);

        await page.keyboard.press('Control+Shift+f');

        const searchInput = page.locator('#search-input');
        await searchInput.fill('line two');

        // Press Enter to go to result
        await page.keyboard.press('Enter');

        // Search dialog should close
        const searchDialog = page.locator('#search-dialog');
        await expect(searchDialog).not.toBeVisible();

        // Textarea should be focused
        await expect(textarea).toBeFocused();
    });

    test('should search across multiple tabs', async ({ page }) => {
        // Add content to first tab
        const firstTextarea = page.locator('.textarea-contents').first();
        await firstTextarea.fill('First tab content with keyword');

        // Add a second tab
        await page.locator('#add_tab').click();

        // Add content to second tab
        const secondTextarea = page.locator('.tab-panel.active .textarea-contents');
        await secondTextarea.fill('Second tab with different keyword');

        // Open search
        await page.keyboard.press('Control+Shift+f');

        // Search for "keyword" - should find in both tabs
        const searchInput = page.locator('#search-input');
        await searchInput.fill('keyword');

        const results = page.locator('.search-result');
        await expect(results).toHaveCount(2);
    });
});
