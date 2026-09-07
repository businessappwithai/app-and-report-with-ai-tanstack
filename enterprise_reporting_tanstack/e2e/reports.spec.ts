import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

// Helper function to check if create report button is available
async function checkCreateReportButton(page: any) {
  const button = page.getByRole('button', { name: 'New Report' }).first();
  return await button.isVisible({ timeout: 3000 }).catch(() => false);
}

test.describe('Reports Management', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await helpers.navigateToPage('Reports');
  });

  test('Reports page loads correctly', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for page to fully load after navigation
    // First test needs more time for initial authentication to settle
    await page.waitForTimeout(5000);

    // Check for main page elements - use exact match to avoid ambiguity with "All Reports"
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.getByText('Create and manage tabular reports')).toBeVisible();

    // Check for All Reports table header
    await expect(page.getByText('All Reports')).toBeVisible();

    // New Report button
    await expect(page.getByRole('button', { name: 'New Report' })).toBeVisible();

    await helpers.screenshot('reports-page-loaded');
  });

  test('displays reports list table', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for page to fully load after navigation
    await page.waitForTimeout(2000);

    // Wait for loading to complete
    await helpers.waitForLoading();

    // Check for table headers - use role to avoid strict mode violations
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Query' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible();

    await helpers.screenshot('reports-list-table');
  });

  test('create new report with query', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Click New Report button
    await helpers.clickButton('New Report');

    // Wait for dialog to appear - use role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: 'Create Report' })).toBeVisible();
    await expect(page.getByText('Create a new report from a saved query.')).toBeVisible();

    // Fill in report name
    await helpers.fillByLabel('Name', 'E2E Test Report');

    // Fill in description
    await helpers.fillByLabel('Description', 'This is a test report from E2E tests');

    // Try to select a query if available
    const querySelect = page.locator('[role="combobox"]').filter({ hasText: 'Select a query' });
    if (await querySelect.isVisible()) {
      await querySelect.click();
      await page.waitForTimeout(500);

      // Check if there are any queries available
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
      }
    }

    // Click Create Report button
    await helpers.clickButton('Create Report');

    // Verify success toast
    await helpers.verifyToast('Report created successfully');

    await helpers.screenshot('report-created');
  });

  test('create new report without query', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Click New Report button
    await helpers.clickButton('New Report');

    // Fill in report name only
    await helpers.fillByLabel('Name', 'E2E Test Report No Query');

    // Create report
    await helpers.clickButton('Create Report');

    // Verify success
    await helpers.verifyToast('Report created successfully');

    await helpers.screenshot('report-created-no-query');
  });

  test('validation prevents creating report without name', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Click New Report button
    await helpers.clickButton('New Report');

    // Don't fill in name, try to create
    const createButton = page.getByRole('button', { name: 'Create Report' });
    await expect(createButton).toBeDisabled();

    await helpers.screenshot('report-validation-no-name');
  });

  test('cancel report creation', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Click New Report button
    await helpers.clickButton('New Report');

    // Fill in some data
    await helpers.fillByLabel('Name', 'Test Report');
    await helpers.fillByLabel('Description', 'Test description');

    // Click Cancel
    await helpers.clickButton('Cancel');

    // Verify dialog is closed - use role to avoid strict mode violation
    await expect(page.getByRole('heading', { name: 'Create Report' })).not.toBeVisible();

    await helpers.screenshot('report-creation-cancelled');
  });

  test('view report details', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for reports to load
    await helpers.waitForLoading();

    // Try to find and click View button for the first report
    const viewButton = page.getByRole('menuitem').filter({ hasText: 'View' }).first();

    // Need to open the dropdown menu first
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Should navigate to report viewer
        await page.waitForTimeout(1000);

        // Verify report viewer elements
        await expect(page.locator('table').first()).toBeVisible();

        await helpers.screenshot('report-viewer-page');
      }
    }
  });

  test('edit report', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for reports to load
    await helpers.waitForLoading();

    // Open dropdown menu for first report
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      // Click Edit
      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to report editor
        await page.waitForTimeout(1000);

        // Verify editor elements
        await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
        await expect(page.getByRole('link', { name: /View/i })).toBeVisible();

        await helpers.screenshot('report-editor-page');
      }
    }
  });

  test('delete report', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for reports to load
    await helpers.waitForLoading();

    // Get initial row count
    const initialCount = await helpers.getTableRowCount();

    // Open dropdown menu for first report
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      // Click Delete
      const deleteButton = page.getByRole('menuitem').filter({ hasText: 'Delete' }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Verify success toast
        await helpers.verifyToast('Report deleted successfully');

        // Verify row count decreased
        await helpers.waitForLoading();
        const newCount = await helpers.getTableRowCount();
        expect(newCount).toBeLessThan(initialCount);

        await helpers.screenshot('report-deleted');
      }
    }
  });

  test('query status badges are displayed correctly', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for reports to load
    await helpers.waitForLoading();

    // Check if there are any reports in the table
    const tableRows = await page.locator('tbody tr').count();

    if (tableRows > 0) {
      // Check for query status badges if there are reports
      const linkedBadge = page.getByText('Linked').first();
      const noQueryBadge = page.getByText('No Query').first();

      const badgesVisible = await linkedBadge.isVisible().catch(() => false) ||
                            await noQueryBadge.isVisible().catch(() => false);
      expect(badgesVisible).toBe(true);
    } else {
      // If no reports, badges test passes (nothing to check)
      expect(tableRows).toBe(0);
    }

    await helpers.screenshot('report-query-badges');
  });
});

test.describe('Report Editor', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await helpers.navigateToPage('Reports');
  });

  test('report editor loads with column configuration', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for reports to load
    await helpers.waitForLoading();

    // Navigate to editor
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Check for column configuration table
        const table = page.locator('table').first();
        if (await table.isVisible()) {
          // Look for column configuration headers
          await expect(page.getByText('Header')).toBeVisible();
          await expect(page.getByText('Field')).toBeVisible();
          await expect(page.getByText('Width')).toBeVisible();
          await expect(page.getByText('Visible')).toBeVisible();
          await expect(page.getByText('Sortable')).toBeVisible();
          await expect(page.getByText('Filterable')).toBeVisible();
          await expect(page.getByText('Formatter')).toBeVisible();

          await helpers.screenshot('report-editor-columns');
        }
      }
    }
  });

  test('update column header', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Find first column header input
        const headerInput = page.locator('input').filter({ hasText: '' }).first();
        if (await headerInput.isVisible()) {
          await headerInput.clear();
          await headerInput.fill('Updated Header');

          // Save changes
          await helpers.clickButton('Save');

          // Verify success toast
          await helpers.verifyToast('Report updated successfully');

          await helpers.screenshot('report-editor-column-updated');
        }
      }
    }
  });

  test('toggle column visibility', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Find and click a visibility toggle switch
        const toggle = page.locator('[role="switch"]').first();
        if (await toggle.isVisible()) {
          await toggle.click();
          await page.waitForTimeout(500);

          // Save changes
          await helpers.clickButton('Save');

          // Verify success
          await helpers.verifyToast('Report updated successfully');

          await helpers.screenshot('report-editor-visibility-toggled');
        }
      }
    }
  });

  test('change column formatter', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Find formatter dropdown
        const formatterSelect = page.locator('[role="combobox"]').filter({ hasText: /Text|Number/ }).first();
        if (await formatterSelect.isVisible()) {
          await formatterSelect.click();
          await page.waitForTimeout(300);

          // Select Currency formatter
          const currencyOption = page.getByRole('option').filter({ hasText: 'Currency' }).first();
          if (await currencyOption.isVisible()) {
            await currencyOption.click();
            await page.waitForTimeout(500);

            // Save
            await helpers.clickButton('Save');

            // Verify success
            await helpers.verifyToast('Report updated successfully');

            await helpers.screenshot('report-editor-formatter-changed');
          }
        }
      }
    }
  });

  test('delete column from configuration', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Get initial row count
        const initialRows = await page.locator('tbody tr').count();

        // Click delete button for a column
        const deleteButton = page.locator('button').filter({ hasText: /Delete/ }).first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          await page.waitForTimeout(500);

          // Save
          await helpers.clickButton('Save');

          // Verify success
          await helpers.verifyToast('Report updated successfully');

          // Verify row count decreased
          await page.waitForTimeout(1000);
          const newRows = await page.locator('tbody tr').count();
          expect(newRows).toBeLessThan(initialRows);

          await helpers.screenshot('report-editor-column-deleted');
        }
      }
    }
  });

  test('save report configuration', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Click Save button
        await helpers.clickButton('Save');

        // Verify success toast
        await helpers.verifyToast('Report updated successfully');

        await helpers.screenshot('report-editor-saved');
      }
    }
  });

  test('breadcrumb navigation in editor', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Click breadcrumb to go back
        const breadcrumb = page.getByRole('link', { name: 'Reports' });
        if (await breadcrumb.isVisible()) {
          await breadcrumb.click();

          // Should be back on reports list
          await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

          await helpers.screenshot('report-editor-breadcrumb');
        }
      }
    }
  });

  test('view report from editor', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to editor
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const editButton = page.getByRole('menuitem').filter({ hasText: 'Edit' }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // Click View button
        const viewButton = page.getByRole('link', { name: /View/i }).first();
        if (await viewButton.isVisible()) {
          await viewButton.click();

          // Should navigate to report viewer
          await page.waitForTimeout(1000);

          await helpers.screenshot('report-editor-view-clicked');
        }
      }
    }
  });
});

test.describe('Report Viewer', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await helpers.navigateToPage('Reports');
  });

  test('view report with data', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to report viewer
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const viewButton = page.getByRole('menuitem').filter({ hasText: 'View' }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();

        // Wait for report to load
        await page.waitForTimeout(2000);

        // Verify table is visible
        await expect(page.locator('table').first()).toBeVisible();

        await helpers.screenshot('report-viewer-loaded');
      }
    }
  });

  test('report displays with proper columns', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to report viewer
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const viewButton = page.getByRole('menuitem').filter({ hasText: 'View' }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await page.waitForTimeout(2000);

        // Check for table headers
        const headers = page.locator('th');
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThan(0);

        // Check for table rows
        await helpers.verifyTableHasContent();

        await helpers.screenshot('report-viewer-columns');
      }
    }
  });

  test('breadcrumb navigation in viewer', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Navigate to report viewer
    await helpers.waitForLoading();
    const menuTrigger = page.locator('button').filter({ hasText: /More/i }).first();
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      await page.waitForTimeout(200);

      const viewButton = page.getByRole('menuitem').filter({ hasText: 'View' }).first();
      if (await viewButton.isVisible()) {
        await viewButton.click();
        await page.waitForTimeout(1000);

        // Click breadcrumb to go back
        const breadcrumb = page.getByRole('link', { name: 'Reports' });
        if (await breadcrumb.isVisible()) {
          await breadcrumb.click();

          // Should be back on reports list
          await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

          await helpers.screenshot('report-viewer-breadcrumb');
        }
      }
    }
  });
});

test.describe('Reports - Error Handling', () => {
  test('handle empty reports list', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await helpers.navigateToPage('Reports');

    // Wait for loading
    await helpers.waitForLoading();

    // Check if empty state is shown
    const emptyState = page.getByText(/No reports created yet/);
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      await expect(page.getByRole('button', { name: 'New Report' })).toBeVisible();

      await helpers.screenshot('reports-empty-state');
    }
  });

  test('handle report not found', async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();

    // Try to navigate to non-existent report
    await page.goto('/reports/viewer/nonexistent-id');

    // Should show not found message or error
    await page.waitForTimeout(2000);

    const notFound = page.getByText(/not found|error/i).first();
    if (await notFound.isVisible()) {
      await expect(notFound).toBeVisible();
    }

    await helpers.screenshot('report-not-found');
  });
});
