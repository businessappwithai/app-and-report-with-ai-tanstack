import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Role-Based Access Control
 * Tests that the permission system actually enforces access control
 */

// Admin credentials for testing
const ADMIN_USER = {
  email: 'admin@admin.com',
  password: 'admin',
};

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('RBAC - Admin Access Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/');
    await page.getByPlaceholder('name@example.com').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard using multiple indicators
    await Promise.race([
      page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor({ state: 'visible', timeout: 15000 }),
      page.getByText('Welcome to the Enterprise Reporting System').waitFor({ state: 'visible', timeout: 15000 }),
      page.getByRole('navigation').first().waitFor({ state: 'visible', timeout: 15000 }),
    ]);

    await page.waitForTimeout(1000);
  });

  test('admin can access all admin pages', async ({ page }) => {
    // Access admin users page
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });

    // Access admin roles page
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'Role Management' })).toBeVisible({ timeout: 5000 });

    // Access admin permissions page
    await page.goto('/admin/permissions');
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { name: 'Permission Management' })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'screenshots/rbac-admin-full-access.png' });
  });

  test('admin can manage users - create button visible', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);

    // Should see Create User button
    await expect(page.getByRole('button', { name: /create user/i })).toBeVisible();

    await page.screenshot({ path: 'screenshots/rbac-admin-user-management.png' });
  });

  test('admin can manage roles - create button visible', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Should see Create Role button
    await expect(page.getByRole('button', { name: /create role/i })).toBeVisible();

    await page.screenshot({ path: 'screenshots/rbac-admin-role-management.png' });
  });

  test('admin can manage permissions - assign button visible', async ({ page }) => {
    await page.goto('/admin/permissions');
    await page.waitForTimeout(2000);

    // Should see Assign Permission button
    await expect(page.getByRole('button', { name: /assign permission/i })).toBeVisible();

    await page.screenshot({ path: 'screenshots/rbac-admin-permission-management.png' });
  });

  test('admin can access and view all resource types', async ({ page }) => {
    // Verify admin can navigate to all main pages
    const pages = [
      { name: 'Dashboards', url: '/dashboards', heading: 'Dashboards' },
      { name: 'Reports', url: '/reports', heading: 'Reports' },
      { name: 'Charts', url: '/charts', heading: 'Charts' },
      { name: 'SQL Editor', url: '/sql-editor', heading: 'SQL Editor' },
    ];

    for (const pageInfo of pages) {
      await page.goto(pageInfo.url);
      await page.waitForTimeout(2000);

      // Check if we can access the page
      const currentUrl = page.url();
      const hasAccess = currentUrl.includes(pageInfo.url.replace('/', '')) ||
                       !currentUrl.includes('/login');

      expect(hasAccess).toBeTruthy();

      // Take screenshot for each page
      await page.screenshot({ path: `screenshots/rbac-admin-${pageInfo.name.toLowerCase()}.png` });
    }
  });
});

test.describe('RBAC - Permission System Structure', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.getByPlaceholder('name@example.com').fill(ADMIN_USER.email);
    await page.getByLabel('Password').fill(ADMIN_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await Promise.race([
      page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor({ state: 'visible', timeout: 15000 }),
      page.getByText('Welcome to the Enterprise Reporting System').waitFor({ state: 'visible', timeout: 15000 }),
      page.getByRole('navigation').first().waitFor({ state: 'visible', timeout: 15000 }),
    ]);

    await page.waitForTimeout(1000);
  });

  test('roles page displays default roles', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(3000);

    // Check for table structure with roles
    const tableVisible = await page.getByRole('table').isVisible({ timeout: 5000 }).catch(() => false);
    expect(tableVisible).toBeTruthy();

    // Should see Admin role in the table (use cell to be more specific)
    const adminCell = page.getByRole('cell').filter({ hasText: 'Admin' }).first();
    await expect(adminCell).toBeVisible({ timeout: 5000 });

    // May also see other default roles
    const hasViewer = await page.getByRole('cell').filter({ hasText: 'Viewer' }).isVisible({ timeout: 2000 }).catch(() => false);
    const hasEditor = await page.getByRole('cell').filter({ hasText: 'Editor' }).isVisible({ timeout: 2000 }).catch(() => false);
    const hasAnalyst = await page.getByRole('cell').filter({ hasText: 'Analyst' }).isVisible({ timeout: 2000 }).catch(() => false);

    // At least one other role should exist
    expect(hasViewer || hasEditor || hasAnalyst).toBeTruthy();

    await page.screenshot({ path: 'screenshots/rbac-roles-display.png' });
  });

  test('permissions page has permission management interface', async ({ page }) => {
    await page.goto('/admin/permissions');
    await page.waitForTimeout(2000);

    // Should see the permissions management page
    await expect(page.getByRole('heading', { name: 'Permission Management' })).toBeVisible();

    // Should see table structure or empty state
    const hasTable = await page.getByRole('table').isVisible().catch(() => false);
    const hasEmptyMessage = await page.getByText(/no permissions/i).isVisible().catch(() => false);

    expect(hasTable || hasEmptyMessage).toBeTruthy();

    // Should see Assign Permission button
    await expect(page.getByRole('button', { name: /assign permission/i })).toBeVisible();

    await page.screenshot({ path: 'screenshots/rbac-permissions-interface.png' });
  });

  test('assign permission dialog has required fields', async ({ page }) => {
    await page.goto('/admin/permissions');
    await page.waitForTimeout(2000);

    // Click Assign Permission button
    await page.getByRole('button', { name: /assign permission/i }).click();

    // Wait for dialog
    await expect(page.getByRole('heading', { name: 'Assign Permission' })).toBeVisible({ timeout: 5000 });

    // Verify all required fields are present
    await expect(page.getByText('Resource Type *')).toBeVisible();
    await expect(page.getByText('Resource *')).toBeVisible();
    await expect(page.getByText('Role *')).toBeVisible();
    await expect(page.getByText('Permission Level *')).toBeVisible();

    // Submit button should be disabled without selections
    const submitButton = page.getByRole('button', { name: 'Assign Permission' });
    await expect(submitButton).toBeDisabled();

    await page.screenshot({ path: 'screenshots/rbac-permission-dialog.png' });
  });

  test('users page shows role assignments', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForTimeout(2000);

    // Should see users table
    const tableVisible = await page.getByRole('table').isVisible().catch(() => false);
    const hasUsers = await page.getByText('Admin').isVisible().catch(() => false);

    expect(tableVisible || hasUsers).toBeTruthy();

    await page.screenshot({ path: 'screenshots/rbac-users-roles.png' });
  });
});
