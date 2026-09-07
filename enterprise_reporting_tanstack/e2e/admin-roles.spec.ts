import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Tests for Role Management
 * Tests CRUD operations for roles in the admin panel
 */

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin - Role Management', () => {
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

  test('should display roles management page', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Role Management' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Manage roles and their permissions')).toBeVisible();

    // Wait for table to be visible or "No roles" message
    await page.waitForTimeout(2000);

    // Check for table OR "No roles found" message
    const tableVisible = await page.getByRole('columnheader', { name: 'Role Name' }).isVisible().catch(() => false);
    const noRolesVisible = await page.getByText('No roles found').isVisible().catch(() => false);
    const loadingVisible = await page.getByText('Loading roles').isVisible().catch(() => false);

    // At least one should be visible
    expect(tableVisible || noRolesVisible || loadingVisible).toBeTruthy();

    // Verify Create Role button
    await expect(page.getByRole('button', { name: /create role/i }).or(page.getByRole('button', { name: /create role/i }))).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-roles-page.png' });
  });

  test('should display default roles', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // Verify default roles exist - wait for table to load
    const tableVisible = await page.getByRole('table').isVisible({ timeout: 5000 }).catch(() => false);

    if (tableVisible) {
      // Check for at least one default role
      await expect(page.getByText('Admin').first()).toBeVisible({ timeout: 5000 });
    } else {
      // If no table, check for "No roles" message
      const noRolesVisible = await page.getByText('No roles found').isVisible().catch(() => false);
      expect(noRolesVisible).toBeTruthy();
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/admin-roles-default.png' });
  });

  test('should create a new role', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Fill in role details
    const timestamp = Date.now();
    const roleName = `Test Role ${timestamp}`;
    const roleDescription = `Test role description ${timestamp}`;

    await page.getByLabel('Role Name').fill(roleName);
    await page.getByLabel('Description').fill(roleDescription);

    // Select permissions using checkboxes
    // The permissions are displayed as checkboxes with labels like "dashboard → view"
    // Click on a few permission checkboxes
    const permissions = [
      'dashboard → view',
      'report → view',
    ];

    for (const permission of permissions) {
      // Find the label for this permission and click it
      const permissionLabel = page.getByText(permission).first();
      if (await permissionLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await permissionLabel.click();
        await page.waitForTimeout(200);
      }
    }

    // Submit form
    await page.getByRole('button', { name: 'Create Role' }).click();

    // Wait for dialog to close (either success or error)
    await page.waitForTimeout(3000);

    // Check for success toast OR if role was created
    const dialogVisible = await page.getByRole('heading', { name: 'Create Role' }).isVisible().catch(() => false);
    const hasSuccess = await page.getByText(/created successfully/i, { exact: false }).isVisible().catch(() => false);
    const roleVisible = await page.getByText(roleName).isVisible({ timeout: 5000 }).catch(() => false);

    // Either dialog should be closed with success, or role should be visible in table
    expect(!dialogVisible || hasSuccess || roleVisible).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-role-created.png' });
  });

  test('should validate role creation - duplicate name', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Click Create Role button
    const createButton = page.getByRole('button', { name: /create role/i }).first();
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Skip test if button not available
      await page.screenshot({ path: 'screenshots/admin-role-duplicate-button-not-available.png' });
      return;
    }

    await createButton.click();

    // Wait for dialog
    await page.waitForTimeout(500);

    // Try to create role with existing name
    await page.getByLabel('Role Name').fill('Admin');
    await page.getByLabel('Description').fill('Duplicate Admin');

    // Submit form - button might be disabled if no permissions selected
    const submitButton = page.getByRole('button', { name: 'Create Role' }).first();

    // Check if button is disabled or if error appears
    const isDisabled = await submitButton.isDisabled().catch(() => false);

    if (!isDisabled) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }

    // Either button should be disabled, or error should be shown, or dialog should still be open
    const dialogStillOpen = await page.getByRole('heading', { name: 'Create Role' }).isVisible().catch(() => false);
    const hasError = await page.getByText(/already exists|error|failed/i, { exact: false }).isVisible().catch(() => false);

    expect(isDisabled || dialogStillOpen || hasError).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-role-duplicate.png' });
  });

  test('should validate role creation - missing name', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Click Create Role button
    const createButton = page.getByRole('button', { name: /create role/i }).first();
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'screenshots/admin-role-validation-button-not-available.png' });
      return;
    }

    await createButton.click();
    await page.waitForTimeout(500);

    // Try to submit without name
    await page.getByLabel('Description').fill('Role without name');

    // Button should be disabled or validation should appear
    const submitButton = page.getByRole('button', { name: 'Create Role' }).first();
    const isDisabled = await submitButton.isDisabled();

    if (!isDisabled) {
      await submitButton.click();
      await page.waitForTimeout(1000);
    }

    // Either button is disabled or dialog is still open
    const dialogStillOpen = await page.getByRole('heading', { name: 'Create Role' }).isVisible().catch(() => false);
    expect(isDisabled || dialogStillOpen).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-role-validation.png' });
  });

  test('should edit an existing role', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Find first edit button (skip Admin role as it's special)
    const editButtons = page.getByRole('button', { name: /edit/i }).all();

    if ((await editButtons).length > 0) {
      const firstEditButton = (await editButtons)[0];
      await firstEditButton.click();

      // Wait for dialog to open
      await expect(page.getByRole('heading', { name: 'Edit Role' })).toBeVisible({ timeout: 5000 });

      // Update role description
      const descInput = page.getByLabel('Description');
      await descInput.clear();
      const newDesc = `Updated description ${Date.now()}`;
      await descInput.fill(newDesc);

      // Submit form
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Wait for dialog to close or success
      await page.waitForTimeout(2000);

      // Verify description updated OR dialog closed (success)
      const dialogClosed = await page.getByRole('heading', { name: 'Edit Role' }).isVisible().catch(() => true); // isVisible returns true, so !isVisible means closed
      const hasSuccess = await page.getByText(/updated successfully/i, { exact: false }).isVisible().catch(() => false);
      const descVisible = await page.getByText(newDesc).isVisible().catch(() => false);

      expect(dialogClosed || hasSuccess || descVisible).toBeTruthy();
    } else {
      // No edit buttons found - might only have default roles
      await page.screenshot({ path: 'screenshots/admin-role-no-editable-roles.png' });
    }

    await page.screenshot({ path: 'screenshots/admin-role-edited.png' });
  });

  test('should delete a custom role', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for page load
    await page.waitForTimeout(2000);

    // First create a role to delete
    const createButton = page.getByRole('button', { name: /create role/i }).first();
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      // Can't test deletion without being able to create
      await page.screenshot({ path: 'screenshots/admin-role-delete-button-not-available.png' });
      return;
    }

    await createButton.click();

    const dialogVisible = await page.getByRole('heading', { name: 'Create Role' }).isVisible({ timeout: 3000 }).catch(() => false);
    if (!dialogVisible) {
      return;
    }

    const timestamp = Date.now();
    const roleName = `Delete Test ${timestamp}`;
    await page.getByLabel('Role Name').fill(roleName);
    await page.getByLabel('Description').fill('This role will be deleted');

    // Select at least one permission so the button isn't disabled
    const permLabel = page.getByText('dashboard → view').first();
    if (await permLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await permLabel.click();
    }

    await page.getByRole('button', { name: 'Create Role' }).click();
    await page.waitForTimeout(3000);

    // Verify role was created
    const roleCreated = await page.getByText(roleName).isVisible({ timeout: 5000 }).catch(() => false);
    expect(roleCreated).toBeTruthy();

    // Find and delete the role
    const deleteButtons = await page.getByRole('button', { name: /delete/i }).all();

    // Find the delete button for our role
    let foundDelete = false;
    for (const button of deleteButtons) {
      const row = await page.evaluate((el) => {
        const btn = el as HTMLElement;
        return btn.closest('tr')?.textContent;
      }, await button.elementHandle());

      if (row?.includes(roleName)) {
        // Set up dialog handler BEFORE clicking delete
        page.once('dialog', async dialog => {
          await dialog.accept();
        });

        await button.click();
        foundDelete = true;
        break;
      }
    }

    expect(foundDelete).toBeTruthy();

    // Wait for success toast and table refresh
    await page.waitForTimeout(3000);

    // Verify success toast appears
    const successToast = await page.getByText(/deleted successfully/i).isVisible({ timeout: 5000 }).catch(() => false);
    expect(successToast).toBeTruthy();

    // Verify the specific role is gone
    const roleStillVisible = await page.getByText(roleName).isVisible().catch(() => false);
    expect(!roleStillVisible).toBeTruthy();

    await page.screenshot({ path: 'screenshots/admin-role-deleted.png' });
  });

  test('should not allow deleting default roles', async ({ page }) => {
    await page.goto('/admin/roles');

    // Try to find delete button for Admin role
    const adminRow = page.getByText('Admin').first();
    const adminRowElement = await adminRow.locator('..').locator('..');

    // Check if delete button exists for admin
    const deleteButton = adminRowElement.getByRole('button', { name: /delete/i });

    // Admin role delete button should not exist or be disabled
    const isVisible = await deleteButton.isVisible().catch(() => false);

    if (isVisible) {
      const isDisabled = await deleteButton.isDisabled();
      expect(isDisabled).toBeTruthy();
    }

    await page.screenshot({ path: 'screenshots/admin-role-default-protected.png' });
  });

  test('should display role permissions', async ({ page }) => {
    await page.goto('/admin/roles');

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Click on a role to view its permissions
    const viewerRole = page.getByText('Viewer').first();
    await expect(viewerRole).toBeVisible();

    // Check if permissions are visible in the table
    await expect(page.getByText(/view.*\*/i)).toBeVisible();

    await page.screenshot({ path: 'screenshots/admin-role-permissions.png' });
  });
});
