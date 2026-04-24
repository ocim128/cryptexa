// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Landing Page E2E Tests
 * Tests for the landing page and navigation
 */

test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display landing page when no site specified', async ({ page }) => {
        // Landing page should be visible
        const landing = page.locator('#landing');
        await expect(landing).toBeVisible();

        // Main content should be hidden
        const mainContent = page.locator('#main-content-outter');
        await expect(mainContent).toBeHidden();
    });

    test('should display branding', async ({ page }) => {
        const title = page.locator('.landing h1');
        await expect(title).toContainText('Open a workspace');
    });

    test('should have site name input field', async ({ page }) => {
        const input = page.locator('#landing-site');
        await expect(input).toBeVisible();
        await expect(input).toHaveAttribute('placeholder', 'work-notes');
    });

    test('should have submit button', async ({ page }) => {
        const button = page.locator('#landing-open');
        await expect(button).toBeVisible();
        await expect(button).toContainText('Open Workspace');
    });

    test('should navigate to site when form is submitted', async ({ page }) => {
        const input = page.locator('#landing-site');
        const button = page.locator('#landing-open');

        await input.fill('test-site-123');
        await button.click();

        // Should navigate to the site URL
        await expect(page).toHaveURL(/\/test-site-123/);
    });

    test('should keep the user on landing for empty site name', async ({ page }) => {
        const button = page.locator('#landing-open');
        await button.click();

        // URL should not change
        await expect(page).toHaveURL('/');
        await expect(page.locator('.toast')).toContainText('Enter a workspace id.');
    });

    test('should display security information', async ({ page }) => {
        const landingMeta = page.locator('.landing-meta');
        await expect(landingMeta).toBeVisible();
        await expect(landingMeta).toContainText('AES-256-GCM');
    });
});

test.describe('Landing Page - Theme', () => {
    test('should apply light theme by default if no preference stored', async ({ page }) => {
        // Clear localStorage before navigating
        await page.addInitScript(() => {
            localStorage.clear();
        });

        await page.goto('/');

        const html = page.locator('html');
        await expect(html).toHaveClass(/theme-light/);
    });

    test('should apply stored theme preference', async ({ page }) => {
        // Set dark theme preference
        await page.addInitScript(() => {
            localStorage.setItem('theme-preference', 'dark');
        });

        await page.goto('/');

        const html = page.locator('html');
        await expect(html).toHaveClass(/theme-dark/);
    });
});
