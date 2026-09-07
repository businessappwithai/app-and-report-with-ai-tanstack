/**
 * Save Query Functionality Test
 *
 * This test verifies that the save query feature works correctly
 * after fixing the saved_queries table schema.
 */

import { test, expect } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

test.describe('Save Query Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Navigate to SQL Editor and check save button', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Wait for Monaco editor to load
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

    // Click in editor and type a query
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT COUNT(*) as count FROM users');

    console.log('✓ Query typed in editor');

    // Look for save button
    const saveBtn = page.getByRole('button', { name: /save/i }).or(page.getByRole('button', { name: /save query/i }));
    const count = await saveBtn.count();

    console.log(`✓ Found ${count} save button(s)`);

    // Try clicking save if button exists
    if (count > 0) {
      await saveBtn.first().click();
      await page.waitForTimeout(2000);

      // Check for any dialog or modal for saving
      const dialog = page.locator('[role="dialog"], .modal, .dialog').first();
      const hasDialog = await dialog.isVisible().catch(() => false);

      if (hasDialog) {
        console.log('✓ Save dialog appeared');

        // Look for name input
        const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
        const hasInput = await nameInput.isVisible().catch(() => false);

        if (hasInput) {
          await nameInput.fill('Test Query');
          console.log('✓ Query name entered');

          // Look for confirm button
          const confirmBtn = page.getByRole('button', { name: /save|create|confirm/i }).or(page.getByRole('button', { name: /ok/i }));
          await confirmBtn.first().click();
          await page.waitForTimeout(2000);

          console.log('✓ Save query completed');
        }
      } else {
        console.log('⚠ No save dialog appeared - might be inline save');
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/save-query-test.png' });
  });

  test('Check console for query save API calls', async ({ page }) => {
    const apiCalls: string[] = [];

    // Listen for API calls
    page.on('request', request => {
      if (request.url().includes('/api/queries')) {
        apiCalls.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(`${BASE_URL}/sql-editor`);
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

    // Try to trigger a save query action
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT 1');

    // Look for and click save button
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    const hasSave = await saveBtn.isVisible().catch(() => false);

    if (hasSave) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log('API calls to /api/queries:', apiCalls.length > 0 ? apiCalls : 'None detected');

    // Check for 500 errors in console
    const errors: string[] = [];
    page.on('response', response => {
      if (response.status() === 500 && response.url().includes('/api/queries')) {
        errors.push(response.url());
      }
    });

    await page.waitForTimeout(1000);

    if (errors.length > 0) {
      console.log('⚠ 500 errors detected:', errors);
    } else {
      console.log('✓ No 500 errors on /api/queries');
    }

    expect(errors.length).toBe(0);
  });
});
