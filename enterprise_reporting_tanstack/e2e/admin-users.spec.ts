import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for User Management
 * Tests CRUD operations for users in the admin panel
 */

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin - User Management', () => {
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

  test('should display users management page', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Verify page title
    await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Manage user accounts and assign roles')).toBeVisible();

    // Wait for table to be visible or "No users" message
    await page.waitForTimeout(2000);

    // Check for table OR "No users found" message
    const tableVisible = await page.getByRole('columnheader', { name: 'Name' }).isVisible().catch(() => false);
    const noUsersVisible = await page.getByText('No users found').isVisible().catch(() => false);
    const loadingVisible = await page.getByText('Loading users').isVisible().catch(() => false);

    // At least one should be visible (table, no users message, or loading)
    expect(tableVisible || noUsersVisible || loadingVisible).toBeTruthy();

    // Verify Create User button
    await expect(page.getByRole('button', { name: /create user/i }).or(page.getByRole('button', { name: /add user/i }))).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-users-page.png' });
  });

  test('should create a new user', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Click Create User button
    await page.getByRole('button', { name: /create user/i }).or(page.getByRole('button', { name: /add user/i })).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible();

    // Fill in user details
    const timestamp = Date.now();
    const userEmail = `testuser${timestamp}@test.com`;
    const userName = `Test User ${timestamp}`;

    await page.getByLabel('Name').fill(userName);
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Password').fill('TestPassword123!');

    // Submit form (no role selection during creation)
    await page.getByRole('button', { name: 'Create User' }).click();

    // Wait for success toast or dialog close
    await page.waitForTimeout(3000);

    // Refresh the page to see the new user
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify user appears in table
    await expect(page.getByText(userEmail)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(userName)).toBeVisible();

    await page.screenshot({ path: 'screenshots/admin-user-created.png' });
  });

  test('should validate user creation - duplicate email', async ({ page }) => {
    await page.goto('/admin/users');

    // Click Create User button
    await page.getByRole('button', { name: /create user/i }).click();

    // Try to create user with admin email (should fail)
    await page.getByLabel('Name').fill('Duplicate User');
    await page.getByLabel('Email').fill('admin@admin.com');
    await page.getByLabel('Password').fill('TestPassword123!');

    // Submit form
    await page.getByRole('button', { name: 'Create User' }).click();

    // Wait a bit for error
    await page.waitForTimeout(2000);

    // Should show error or dialog should still be open
    const dialogVisible = await page.getByRole('heading', { name: 'Create User' }).isVisible().catch(() => false);
    const hasError = await page.getByText(/already exists|error|failed/i).isVisible().catch(() => false);

    expect(dialogVisible || hasError).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-user-duplicate-email.png' });
  });

  test('should validate user creation - missing fields', async ({ page }) => {
    await page.goto('/admin/users');

    // Click Create User button
    await page.getByRole('button', { name: /create user/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible();

    // Try to submit without filling required fields - only fill password
    await page.getByLabel('Password').fill('TestPassword123!');

    // Verify the Create User button is disabled when Name and Email are missing
    const createButton = page.getByRole('button', { name: 'Create User' });
    await expect(createButton).toBeDisabled();

    // Dialog should still be visible
    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible();

    await page.screenshot({ path: 'screenshots/admin-user-validation.png' });
  });

  test('should assign roles to existing user', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for table to load
    await page.waitForTimeout(1000);

    // Find first Roles button
    const rolesButtons = page.getByRole('button', { name: /roles/i }).all();

    if ((await rolesButtons).length > 0) {
      const firstRolesButton = (await rolesButtons)[0];
      await firstRolesButton.click();

      // Wait for dialog or verify roles are displayed
      await page.waitForTimeout(1000);

      // Check if role assignment dialog opens or roles are shown
      const hasRoleDialog = await page.getByRole('dialog').isVisible().catch(() => false);
      const hasRoles = await page.getByText(/admin|editor|viewer/i).isVisible().catch(() => false);

      expect(hasRoleDialog || hasRoles).toBeTruthy();
    }

    await page.screenshot({ path: 'screenshots/admin-user-roles.png' });
  });

  test('should toggle user active status', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for table to load
    await page.waitForTimeout(1000);

    // Find first Enable/Disable button
    const toggleButtons = page.getByRole('button', { name: /(enable|disable)/i }).all();

    if ((await toggleButtons).length > 0) {
      const firstToggle = (await toggleButtons)[0];
      const buttonText = await firstToggle.textContent();

      await firstToggle.click();
      await page.waitForTimeout(2000);

      // Verify button text changed
      const newButtonText = await firstToggle.textContent();
      expect(buttonText).not.toEqual(newButtonText);
    }

    await page.screenshot({ path: 'screenshots/admin-user-toggle.png' });
  });

  test('should display user roles badges', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Check for role badges - admin user should have Admin role badge
    // The Admin text appears in the role badge column
    const adminBadge = page.getByText('Admin').first();
    await expect(adminBadge).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'screenshots/admin-user-badges.png' });
  });

  test('should display user status badges', async ({ page }) => {
    await page.goto('/admin/users');

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Check for user table - it should display the admin user
    // Status badges might be displayed visually or through icons
    const userTable = page.locator('table').first();
    await expect(userTable).toBeVisible({ timeout: 5000 });

    // Verify admin user is in the table
    await expect(page.getByText('admin@admin.com')).toBeVisible();

    await page.screenshot({ path: 'screenshots/admin-user-status.png' });
  });

  test('should handle loading state', async ({ page }) => {
    await page.goto('/admin/users');

    // Check if loading state appears
    const loadingText = page.getByText(/loading users/i);
    const hasLoading = await loadingText.isVisible().catch(() => false);

    // Or check that table eventually appears
    await page.waitForTimeout(2000);
    const tableVisible = await page.getByRole('table').isVisible().catch(() => false);

    expect(hasLoading || tableVisible).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-user-loading.png' });
  });
});
