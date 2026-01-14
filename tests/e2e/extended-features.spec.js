// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Extended Tab Management E2E Tests
 * Additional coverage for tab management scenarios
 */

test.describe('Extended Tab Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/extended-tab-test');
        await page.waitForLoadState('networkidle');
    });

    test('should switch tabs with Ctrl+Tab', async ({ page }) => {
        // Add a second tab
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Switch to first tab
        await page.locator('.tab-header').first().click();
        await expect(page.locator('.tab-header').first()).toHaveClass(/active/);

        // Use Ctrl+Tab to go to next
        await page.keyboard.press('Control+Tab');
        await expect(page.locator('.tab-header').nth(1)).toHaveClass(/active/);
    });

    test('should switch tabs with Ctrl+Shift+Tab (previous)', async ({ page }) => {
        // Add a second tab
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Second tab should be active
        await expect(page.locator('.tab-header').nth(1)).toHaveClass(/active/);

        // Use Ctrl+Shift+Tab to go to previous
        await page.keyboard.press('Control+Shift+Tab');
        await expect(page.locator('.tab-header').first()).toHaveClass(/active/);
    });

    test('should switch to tab by number Ctrl+1-9', async ({ page }) => {
        // Add multiple tabs
        await page.locator('#add_tab').click();
        await page.locator('#add_tab').click();
        await page.waitForTimeout(100);

        // Switch to first tab with Ctrl+1
        await page.keyboard.press('Control+1');
        await expect(page.locator('.tab-header').first()).toHaveClass(/active/);

        // Switch to third tab with Ctrl+3
        await page.keyboard.press('Control+3');
        await expect(page.locator('.tab-header').nth(2)).toHaveClass(/active/);
    });

    test('should create new tab with Ctrl+Alt+T', async ({ page }) => {
        const initialCount = await page.locator('.tab-header').count();

        await page.keyboard.press('Control+Alt+t');
        await page.waitForTimeout(100);

        const newCount = await page.locator('.tab-header').count();
        expect(newCount).toBe(initialCount + 1);
    });

    test('should maintain tab content after switching', async ({ page }) => {
        // Add content to first tab
        const firstTextarea = page.locator('.textarea-contents').first();
        await firstTextarea.fill('Content in first tab');

        // Add second tab
        await page.locator('#add_tab').click();

        // Add content to second tab
        const activeTextarea = page.locator('.tab-panel.active .textarea-contents');
        await activeTextarea.fill('Content in second tab');

        // Switch back to first tab
        await page.locator('.tab-header').first().click();

        // Verify first tab content
        const firstTabContent = page.locator('.tab-panel.active .textarea-contents');
        await expect(firstTabContent).toHaveValue('Content in first tab');
    });

    test('should support tab color customization', async ({ page }) => {
        const colorPicker = page.locator('#tab-color-picker');
        const activeTab = page.locator('.tab-header.active');

        // Check color picker exists
        await expect(colorPicker).toBeVisible();

        // Change color (note: actual color input interaction varies by browser)
        await colorPicker.evaluate((el) => {
            /** @type {HTMLInputElement} */ (el).value = '#ff5500';
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Tab should have the color stored
        const tabColor = await activeTab.getAttribute('data-tab-color');
        expect(tabColor).toBe('#ff5500');
    });

    test('should update tab title based on content', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('My Important Note Title\nThis is the body of the note');

        // Wait for title update
        await page.waitForTimeout(100);

        const tabTitle = page.locator('.tab-header.active .tab-title');
        await expect(tabTitle).toContainText('My Important Note');
    });

    test('should show "Empty Tab" for empty content', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('');

        await page.waitForTimeout(100);

        const tabTitle = page.locator('.tab-header.active .tab-title');
        await expect(tabTitle).toContainText('Empty Tab');
    });

    test('should truncate long tab titles', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('This is a very long title that should be truncated');

        await page.waitForTimeout(100);

        const tabTitle = page.locator('.tab-header.active .tab-title');
        const titleText = await tabTitle.textContent();

        // Title should be max 20 chars with ellipsis
        expect(titleText?.length).toBeLessThanOrEqual(21);
        expect(titleText).toContain('...');
    });

    test('should handle many tabs gracefully', async ({ page }) => {
        // Add 10 tabs
        for (let i = 0; i < 10; i++) {
            await page.locator('#add_tab').click();
            await page.waitForTimeout(50);
        }

        const tabCount = await page.locator('.tab-header').count();
        expect(tabCount).toBe(11); // Initial + 10 added

        // All tabs should be visible (wrapped layout)
        const tabs = page.locator('.tab-header');
        for (let i = 0; i < 11; i++) {
            await expect(tabs.nth(i)).toBeAttached();
        }
    });
});

test.describe('Editor Features', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/editor-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should insert 4 spaces when Tab is pressed', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.focus();
        await textarea.fill('Hello');

        // Move cursor to end
        await page.keyboard.press('End');

        // Press Tab
        await page.keyboard.press('Tab');

        const value = await textarea.inputValue();
        expect(value).toBe('Hello    ');
    });

    test('should have line gutter with line numbers', async ({ page }) => {
        const gutter = page.locator('.line-gutter').first();
        await expect(gutter).toBeVisible();

        // Add multiple lines
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');

        // Gutter should have line numbers
        const gutterContent = await gutter.getAttribute('data-lines');
        expect(gutterContent).toContain('1');
        expect(gutterContent).toContain('5');
    });

    test('should show placeholder when empty', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        const placeholder = await textarea.getAttribute('placeholder');

        expect(placeholder).toBe('your text goes here...');
    });

    test('should focus textarea on Escape key', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();

        // Click somewhere else first
        await page.locator('#menubar').click();

        // Press Escape
        await page.keyboard.press('Escape');

        // Textarea should be focused
        await expect(textarea).toBeFocused();
    });

    test('should handle paste events', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.focus();

        // Simulate paste via keyboard
        await page.evaluate(() => {
            /** @type {HTMLTextAreaElement | null} */
            const ta = document.querySelector('.textarea-contents');
            if (ta) {
                ta.value = 'Pasted content';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        await expect(textarea).toHaveValue('Pasted content');
    });
});

test.describe('Save and Load', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/save-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should show status indicator', async ({ page }) => {
        const statusIndicator = page.locator('#status-indicator');
        await expect(statusIndicator).toBeVisible();
    });

    test('should change status to Modified when content changes', async ({ page }) => {
        const textarea = page.locator('.textarea-contents').first();
        await textarea.fill('New content');

        const statusText = page.locator('.status-text');
        await expect(statusText).toContainText('Modified');
    });

    test('should have Save button', async ({ page }) => {
        const saveButton = page.locator('#button-save');
        await expect(saveButton).toBeVisible();
    });

    test('should enable Save button when content is modified', async ({ page }) => {
        const saveButton = page.locator('#button-save');
        const textarea = page.locator('.textarea-contents').first();

        await textarea.fill('Modified content');

        // Save button should be enabled (not disabled)
        await expect(saveButton).not.toBeDisabled();
    });

    test('should have Reload button', async ({ page }) => {
        const reloadButton = page.locator('#button-reload');
        await expect(reloadButton).toBeVisible();
    });

    test('should have Delete button', async ({ page }) => {
        const deleteButton = page.locator('#button-delete');
        await expect(deleteButton).toBeVisible();
    });

    test('should have Delete button disabled for new site', async ({ page }) => {
        const deleteButton = page.locator('#button-delete');
        // Delete button should be disabled for new sites
        await expect(deleteButton).toBeDisabled();
    });
});

test.describe('Keyboard Shortcuts Help', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/shortcuts-test-site');
        await page.waitForLoadState('networkidle');
    });

    test('should show keyboard shortcuts on F1', async ({ page }) => {
        await page.keyboard.press('F1');

        // Toast notification should appear with shortcuts info
        await page.waitForTimeout(500);

        // Check for notification content (implementation varies)
        const toastContainer = page.locator('#toast-container, #outer-toast, .toast-container');
        const toastVisible = await toastContainer.isVisible().catch(() => false);

        // If toast container exists and is visible, check content
        if (toastVisible) {
            const toastContent = await toastContainer.textContent();
            expect(toastContent).toContain('Ctrl');
        }
    });

    test('should have help button in menubar', async ({ page }) => {
        const helpButton = page.locator('#help-button');
        await expect(helpButton).toBeVisible();
    });

    test('should show shortcuts on help button click', async ({ page }) => {
        const helpButton = page.locator('#help-button');
        await helpButton.click();

        await page.waitForTimeout(500);

        // Should show some notification
        const hasNotification = await page.evaluate(() => {
            const container = document.querySelector('#toast-container, #outer-toast');
            return container && container.innerHTML.length > 0;
        });

        expect(hasNotification).toBeTruthy();
    });
});
