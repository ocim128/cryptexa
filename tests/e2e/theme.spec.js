// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Theme Toggle E2E Tests
 * Tests for dark/light theme functionality
 */

test.describe('Theme Toggle', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/theme-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should display theme toggle button', async ({ page }) => {
        const themeToggle = page.locator('#theme-toggle');
        await expect(themeToggle).toBeVisible();
    });

    test('should toggle theme when clicking button', async ({ page }) => {
        const html = page.locator('html');
        const themeToggle = page.locator('#theme-toggle');

        // Get initial theme
        const initialHasLight = await html.evaluate(el => el.classList.contains('theme-light'));
        const initialHasDark = await html.evaluate(el => el.classList.contains('theme-dark'));

        // Click toggle
        await themeToggle.click();
        await page.waitForTimeout(100);

        // Theme should have changed
        const afterClickHasLight = await html.evaluate(el => el.classList.contains('theme-light'));
        const afterClickHasDark = await html.evaluate(el => el.classList.contains('theme-dark'));

        // If was light, should now be dark and vice versa
        if (initialHasLight) {
            expect(afterClickHasDark).toBe(true);
            expect(afterClickHasLight).toBe(false);
        } else if (initialHasDark) {
            expect(afterClickHasLight).toBe(true);
            expect(afterClickHasDark).toBe(false);
        }

        // Click toggle again to restore
        await themeToggle.click();
        await page.waitForTimeout(100);

        const finalHasLight = await html.evaluate(el => el.classList.contains('theme-light'));
        const finalHasDark = await html.evaluate(el => el.classList.contains('theme-dark'));

        // Should be back to original state
        expect(finalHasLight).toBe(initialHasLight);
        expect(finalHasDark).toBe(initialHasDark);
    });

    test('should store theme preference in localStorage', async ({ page }) => {
        const themeToggle = page.locator('#theme-toggle');

        // Click to toggle theme
        await themeToggle.click();
        await page.waitForTimeout(100);

        // Check localStorage was set
        const storedTheme = await page.evaluate(() => localStorage.getItem('theme-preference'));
        expect(storedTheme).toBeTruthy();
        expect(['light', 'dark']).toContain(storedTheme);
    });

    test('should have label on theme toggle button', async ({ page }) => {
        const themeToggle = page.locator('#theme-toggle');
        const label = themeToggle.locator('.label');

        // Label should exist and have text
        await expect(label).toBeVisible();
        const labelText = await label.textContent();
        expect(['Light', 'Dark']).toContain(labelText);
    });

    test('should update label when theme changes', async ({ page }) => {
        const themeToggle = page.locator('#theme-toggle');
        const label = themeToggle.locator('.label');

        // Get initial label
        const initialLabel = await label.textContent();

        // Click to toggle
        await themeToggle.click();
        await page.waitForTimeout(100);

        // Label should change
        const newLabel = await label.textContent();
        expect(newLabel).not.toBe(initialLabel);
    });
});
