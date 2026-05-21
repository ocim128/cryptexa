// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PLAYWRIGHT_PORT || '3100';

module.exports = defineConfig({
    testDir: './tests/e2e',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Keep local runs from rewriting the checked-in report artifact. */
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: `http://127.0.0.1:${PORT}`,

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'node dist/server.js',
        url: `http://127.0.0.1:${PORT}`,
        env: {
            ...process.env,
            PORT,
            DB_TYPE: 'file',
            DB_FILE: 'test-results/e2e-db.json',
        },
        reuseExistingServer: false,
        timeout: 120 * 1000,
    },
});
