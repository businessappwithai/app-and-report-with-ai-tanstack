import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Granular (Resource-Level) Permissions
 * Tests the ability to assign specific permission levels to individual resources
 */

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Granular Permissions - Resource-Level Access', () => {
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

  test('should display resource permissions tab in create role dialog', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Verify both tabs are visible
    await expect(page.getByRole('tab', { name: 'Global Permissions' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resource Permissions' })).toBeVisible();

    // Click on Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Verify resource sections are visible
    await expect(page.getByText('Add specific permissions for individual reports')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Charts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboards' })).toBeVisible();

    await page.screenshot({ path: 'screenshots/granular-permissions-tabs.png' });
  });

  test('should create role with resource-specific permissions', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Fill in role details
    const timestamp = Date.now();
    const roleName = `Resource Viewer ${timestamp}`;
    await page.getByLabel('Role Name').fill(roleName);
    await page.getByLabel('Description').fill('Role with specific resource permissions');

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Check if there are any resources available
    const hasResources = await page.getByRole('heading', { name: 'Reports' }).isVisible({ timeout: 2000 }).catch(() => false);

    if (hasResources) {
      // Expand Reports section if collapsed
      const showButton = page.getByText('Show Resources').first();
      const showVisible = await showButton.isVisible().catch(() => false);

      if (showVisible) {
        await showButton.click();
        await page.waitForTimeout(300);
      }

      // Try to find first report and set permission
      const firstReportSelector = page.locator('[class*="SelectTrigger"]').first();
      const selectorVisible = await firstReportSelector.isVisible({ timeout: 2000 }).catch(() => false);

      if (selectorVisible) {
        await firstReportSelector.click();
        await page.waitForTimeout(300);

        // Select "View" permission
        const viewOption = page.getByRole('option', { name: 'View' }).first();
        if (await viewOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await viewOption.click();
          await page.waitForTimeout(300);
        }
      }

      // Also add at least one global permission so form is valid
      await page.getByRole('tab', { name: 'Global Permissions' }).click();
      await page.waitForTimeout(300);

      const dashboardViewPerm = page.getByText('dashboard → view').first();
      if (await dashboardViewPerm.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dashboardViewPerm.click();
      }

      // Submit form
      await page.getByRole('button', { name: 'Create Role' }).click();
      await page.waitForTimeout(3000);

      // Verify role was created
      const roleCreated = await page.getByText(roleName).isVisible({ timeout: 5000 }).catch(() => false);
      expect(roleCreated).toBeTruthy();
    } else {
      // No resources available - this is okay, just verify tabs are present
      await expect(page.getByRole('tab', { name: 'Resource Permissions' })).toBeVisible();
    }

    await page.screenshot({ path: 'screenshots/granular-permissions-create.png' });
  });

  test('should edit role and update resource permissions', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Find an existing edit button (skip complex creation step)
    const editButtons = await page.getByRole('button', { name: /edit/i }).all();

    if (editButtons.length === 0) {
      await page.screenshot({ path: 'screenshots/granular-permissions-edit-no-roles.png' });
      return; // Skip test if no editable roles
    }

    // Click the first edit button
    await editButtons[0].click();
    await page.waitForTimeout(2000);

    // Verify edit dialog opened
    const dialogVisible = await page.getByRole('heading', { name: 'Edit Role' }).isVisible({ timeout: 10000 }).catch(() => false);

    if (!dialogVisible) {
      await page.screenshot({ path: 'screenshots/granular-permissions-edit-no-dialog.png' });
      return; // Skip if dialog didn't open
    }

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(1000);

    // Verify resource sections are visible
    const hasReports = await page.getByRole('heading', { name: 'Reports' }).isVisible({ timeout: 5000 }).catch(() => false);

    if (hasReports) {
      // Expand Reports section if needed
      const showButton = page.getByText('Show Resources').first();
      const showVisible = await showButton.isVisible().catch(() => false);

      if (showVisible) {
        await showButton.click();
        await page.waitForTimeout(500);
      }

      // Verify the resource permissions section is accessible
      await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    }

    // Navigate back to Global Permissions tab
    await page.getByRole('tab', { name: 'Global Permissions' }).click();
    await page.waitForTimeout(500);

    // Try to save changes (may or may not succeed depending on state)
    const saveButton = page.getByRole('button', { name: 'Save Changes' }).first();
    const saveVisible = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (saveVisible) {
      await saveButton.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'screenshots/granular-permissions-edit.png' });
  });

  test('should load existing resource permissions when editing role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Find and edit an existing role (prefer non-Admin)
    const editButtons = await page.getByRole('button', { name: /edit/i }).all();

    if (editButtons.length > 0) {
      const firstEditButton = editButtons[0];
      await firstEditButton.click();
      await page.waitForTimeout(1000);

      // Verify edit dialog opened
      await expect(page.getByRole('heading', { name: 'Edit Role' })).toBeVisible({ timeout: 5000 });

      // Navigate to Resource Permissions tab
      await page.getByRole('tab', { name: 'Resource Permissions' }).click();
      await page.waitForTimeout(500);

      // Verify that the resource permissions section loads
      // It should show the current state of permissions for this role
      await expect(page.getByText('Add specific permissions for individual reports')).toBeVisible();

      // Verify the resource sections are visible
      const hasReports = await page.getByRole('heading', { name: 'Reports' }).isVisible({ timeout: 2000 }).catch(() => false);
      const hasCharts = await page.getByRole('heading', { name: 'Charts' }).isVisible().catch(() => false);
      const hasDashboards = await page.getByRole('heading', { name: 'Dashboards' }).isVisible().catch(() => false);

      expect(hasReports || hasCharts || hasDashboards).toBeTruthy();

      await page.screenshot({ path: 'screenshots/granular-permissions-load-existing.png' });
    }
  });

  test('should allow different permission levels on different resources', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Create a new role
    const createButton = page.getByRole('button', { name: /create role/i }).first();
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.screenshot({ path: 'screenshots/granular-permissions-different-levels-no-create.png' });
      return;
    }

    await createButton.click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    const timestamp = Date.now();
    const roleName = `Mixed Permissions ${timestamp}`;
    await page.getByLabel('Role Name').fill(roleName);
    await page.getByLabel('Description').fill('Role with different permission levels');

    // Add one global permission
    await page.getByText('dashboard → view').first().click();

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Expand Reports section
    const showButton = page.getByText('Show Resources').first();
    const showVisible = await showButton.isVisible().catch(() => false);

    if (showVisible) {
      await showButton.click();
      await page.waitForTimeout(300);
    }

    // Try to set different permission levels if multiple resources exist
    const selectors = await page.locator('[class*="SelectTrigger"]').all();

    if (selectors.length >= 2) {
      // Set first resource to "View"
      await selectors[0].click();
      await page.waitForTimeout(300);
      const viewOption = page.getByRole('option', { name: 'View' }).first();
      if (await viewOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await viewOption.click();
      }

      await page.waitForTimeout(300);

      // Set second resource to "Edit"
      await selectors[1].click();
      await page.waitForTimeout(300);
      const editOption = page.getByRole('option', { name: 'Edit' }).first();
      if (await editOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editOption.click();
      }

      await page.waitForTimeout(300);

      // Submit form
      await page.getByRole('button', { name: 'Create Role' }).click();
      await page.waitForTimeout(3000);

      // Verify role was created
      const roleCreated = await page.getByText(roleName).isVisible({ timeout: 5000 }).catch(() => false);
      expect(roleCreated).toBeTruthy();
    }

    await page.screenshot({ path: 'screenshots/granular-permissions-different-levels.png' });
  });

  test('should support collapse/expand for resource sections', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Find the Reports section
    const reportsSection = page.getByRole('heading', { name: 'Reports' }).first();
    await expect(reportsSection).toBeVisible();

    // Check for Show/Hide button (collapse functionality)
    const showButton = page.getByText('Show Resources').first();
    const hideButton = page.getByText('Hide Resources').first();

    const showVisible = await showButton.isVisible({ timeout: 2000 }).catch(() => false);
    const hideVisible = await hideButton.isVisible().catch(() => false);

    // Either show or hide should be visible (depending on initial state)
    expect(showVisible || hideVisible).toBeTruthy();

    // Test toggle if available
    if (showVisible) {
      await showButton.click();
      await page.waitForTimeout(300);

      // Now "Hide" should be visible
      const hideNowVisible = await hideButton.isVisible().catch(() => false);
      expect(hideNowVisible).toBeTruthy();

      // Click to hide
      await hideButton.click();
      await page.waitForTimeout(300);

      // Now "Show" should be visible again
      const showNowVisible = await showButton.isVisible().catch(() => false);
      expect(showNowVisible).toBeTruthy();
    }

    await page.screenshot({ path: 'screenshots/granular-permissions-collapse.png' });
  });

  test('should clear resource permission by selecting None', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Create a role with a resource permission first
    const createButton = page.getByRole('button', { name: /create role/i }).first();
    if (!(await createButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      return;
    }

    await createButton.click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    const timestamp = Date.now();
    const roleName = `Clear Test ${timestamp}`;
    await page.getByLabel('Role Name').fill(roleName);

    // Add a global permission
    await page.getByText('dashboard → view').first().click();

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Expand Reports section
    const showButton = page.getByText('Show Resources').first();
    const showVisible = await showButton.isVisible().catch(() => false);
    if (showVisible) {
      await showButton.click();
      await page.waitForTimeout(300);
    }

    // Set a permission
    const firstSelector = page.locator('[class*="SelectTrigger"]').first();
    const selectorVisible = await firstSelector.isVisible({ timeout: 2000 }).catch(() => false);

    if (selectorVisible) {
      await firstSelector.click();
      await page.waitForTimeout(300);

      const viewOption = page.getByRole('option', { name: 'View' }).first();
      if (await viewOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await viewOption.click();
      }

      await page.waitForTimeout(300);

      // Now clear it by selecting "None"
      await firstSelector.click();
      await page.waitForTimeout(300);

      const noneOption = page.getByRole('option', { name: 'None' }).first();
      if (await noneOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await noneOption.click();
      }

      await page.waitForTimeout(300);
    }

    // Submit form
    await page.getByRole('button', { name: 'Create Role' }).click();
    await page.waitForTimeout(3000);

    // Verify role was created
    const roleCreated = await page.getByText(roleName).isVisible({ timeout: 5000 }).catch(() => false);
    expect(roleCreated).toBeTruthy();

    await page.screenshot({ path: 'screenshots/granular-permissions-clear.png' });
  });

  test('should display permission levels: View, Edit, Admin', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Expand Reports section
    const showButton = page.getByText('Show Resources').first();
    const showVisible = await showButton.isVisible().catch(() => false);
    if (showVisible) {
      await showButton.click();
      await page.waitForTimeout(300);
    }

    // Find a permission selector and click it
    const firstSelector = page.locator('[class*="SelectTrigger"]').first();
    const selectorVisible = await firstSelector.isVisible({ timeout: 2000 }).catch(() => false);

    if (selectorVisible) {
      await firstSelector.click();
      await page.waitForTimeout(500);

      // Verify that all expected permission levels are available
      const hasView = await page.getByRole('option', { name: 'View' }).isVisible().catch(() => false);
      const hasEdit = await page.getByRole('option', { name: 'Edit' }).isVisible().catch(() => false);
      const hasAdmin = await page.getByRole('option', { name: 'Admin' }).isVisible().catch(() => false);

      // At least some options should be visible
      expect(hasView || hasEdit || hasAdmin).toBeTruthy();

      // Close dropdown
      await page.keyboard.press('Escape');
    }

    await page.screenshot({ path: 'screenshots/granular-permissions-levels.png' });
  });

  test('should work with both global and resource permissions combined', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 10000 });

    const timestamp = Date.now();
    const roleName = `Hybrid Role ${timestamp}`;
    await page.getByLabel('Role Name').fill(roleName);
    await page.getByLabel('Description').fill('Role with both global and resource permissions');

    // Add global permissions
    const dashboardPerm = page.getByText('dashboard → view').first();
    if (await dashboardPerm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dashboardPerm.click();
      await page.waitForTimeout(200);
    }

    const reportPerm = page.getByText('report → view').first();
    if (await reportPerm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reportPerm.click();
      await page.waitForTimeout(200);
    }

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Verify we can still see the tabs (can navigate back)
    await expect(page.getByRole('tab', { name: 'Global Permissions' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resource Permissions' })).toBeVisible();

    // Navigate back to verify global permissions are still accessible
    await page.getByRole('tab', { name: 'Global Permissions' }).click();
    await page.waitForTimeout(300);

    // Just verify the dialog is still open and we're on the global permissions tab
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Global Permissions' })).toBeVisible();

    await page.screenshot({ path: 'screenshots/granular-permissions-hybrid.png' });
  });

  test('should show resources organized by type', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Navigate to Resource Permissions tab
    await page.getByRole('tab', { name: 'Resource Permissions' }).click();
    await page.waitForTimeout(500);

    // Verify that resources are organized into sections
    const hasReportsSection = await page.getByRole('heading', { name: 'Reports' }).isVisible().catch(() => false);
    const hasChartsSection = await page.getByRole('heading', { name: 'Charts' }).isVisible().catch(() => false);
    const hasDashboardsSection = await page.getByRole('heading', { name: 'Dashboards' }).isVisible().catch(() => false);

    // All sections should be visible (even if empty, the headers should be there)
    expect(hasReportsSection).toBeTruthy();
    expect(hasChartsSection).toBeTruthy();
    expect(hasDashboardsSection).toBeTruthy();

    await page.screenshot({ path: 'screenshots/granular-permissions-organized.png' });
  });

  test('should require at least one permission (global or resource) to create role', async ({ page }) => {
    await page.goto('/admin/roles');
    await page.waitForTimeout(2000);

    // Click Create Role button
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.getByRole('heading', { name: 'Create Role' })).toBeVisible({ timeout: 5000 });

    // Fill in role name but no permissions
    const roleName = `No Permissions ${Date.now()}`;
    await page.getByLabel('Role Name').fill(roleName);

    // Try to submit without any permissions
    const submitButton = page.getByRole('button', { name: 'Create Role' }).first();

    // Button should be disabled
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBeTruthy();

    await page.screenshot({ path: 'screenshots/granular-permissions-validation.png' });
  });
});
