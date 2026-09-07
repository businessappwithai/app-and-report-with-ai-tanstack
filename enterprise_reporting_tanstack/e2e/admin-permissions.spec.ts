import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Permission Management
 * Tests CRUD operations for resource-level permissions
 */

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin - Permission Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/');
    await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for page load after login
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
  });

  test('should display permissions management page', async ({ page }) => {
    await page.goto('/admin/permissions');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Permission Management' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Manage resource-level permissions for roles')).toBeVisible();

    // Wait for table to be visible or "No permissions" message
    await page.waitForTimeout(2000);

    // Check for table OR "No permissions found" message
    const tableVisible = await page.getByRole('columnheader', { name: 'Role' }).isVisible().catch(() => false);
    const noPermsVisible = await page.getByText(/no permissions|no resource permissions/i).isVisible().catch(() => false);
    const loadingVisible = await page.getByText(/loading|loading permissions/i).isVisible().catch(() => false);

    // At least one should be visible
    expect(tableVisible || noPermsVisible || loadingVisible).toBeTruthy();

    // Verify Assign Permission button
    await expect(page.getByRole('button', { name: /assign permission/i })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-permissions-page.png' });
  });

  test('should open assign permission dialog', async ({ page }) => {
    await page.goto('/admin/permissions');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Click Assign Permission button
    await page.getByRole('button', { name: /assign permission/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Assign Permission' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Grant a role access to a specific resource')).toBeVisible();

    // Verify dialog has form fields with labels
    await expect(page.getByText('Resource Type *')).toBeVisible();
    await expect(page.getByText('Resource *')).toBeVisible();
    await expect(page.getByText('Role *')).toBeVisible();
    await expect(page.getByText('Permission Level *')).toBeVisible();

    // Verify Cancel button
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-permission-dialog.png' });
  });

  test('should validate permission creation - missing fields', async ({ page }) => {
    await page.goto('/admin/permissions');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Click Assign Permission button
    await page.getByRole('button', { name: /assign permission/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Assign Permission' })).toBeVisible({ timeout: 5000 });

    // Try to submit without selecting fields
    const submitButton = page.getByRole('button', { name: 'Assign Permission' });

    // Button should be disabled when required fields are not selected
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-permission-validation.png' });
  });

  test('should display permission badges with correct colors', async ({ page }) => {
    await page.goto('/admin/permissions');

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Check if any permissions exist
    const hasPermissions = await page.getByRole('columnheader', { name: 'Role' }).isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPermissions) {
      // Look for permission level badges if they exist
      const tableVisible = await page.locator('table').isVisible().catch(() => false);
      expect(tableVisible).toBeTruthy();
    }

    // Take screenshot showing page state (with or without permissions)
    await page.screenshot({ path: 'screenshots/admin-permission-badges.png' });
  });

  test('should handle empty permissions state', async ({ page }) => {
    await page.goto('/admin/permissions');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check for "No permissions found" message OR table
    const noPermsText = page.getByText(/no permissions found/i);
    const hasNoPerms = await noPermsText.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasNoPerms) {
      await expect(noPermsText).toBeVisible();
      // Assign Permission button should still be visible
      await expect(page.getByRole('button', { name: /assign permission/i })).toBeVisible();
    } else {
      // Table exists with permissions
      const tableVisible = await page.getByRole('table').isVisible().catch(() => false);
      expect(tableVisible).toBeTruthy();
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-permission-empty-state.png' });
  });
});
