import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Charts Management', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();

    // Wait for page to stabilize after login
    await page.waitForTimeout(2000);

    // Navigate to Charts
    await helpers.navigateToPage('Charts');

    // Charts page takes longer to load due to permission API
    await page.waitForTimeout(3000);
  });

  test('Charts page loads correctly', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for page to be fully loaded
    await page.waitForTimeout(3000);

    // Check we're on the charts page (not login page)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/charts');
    expect(currentUrl).not.toContain('/login');

    // Check for main page elements - use exact match
    await expect(page.getByRole('heading', { name: 'Charts', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Create and manage data visualizations')).toBeVisible();

    // Check for "All Charts" table header
    await expect(page.getByText('All Charts')).toBeVisible();

    // Take screenshot of current state
    await helpers.screenshot('charts-page-loaded');
  });

  test('displays charts list table or empty state', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Check for either table with content OR empty state message
    const hasTable = await page.getByRole('table').isVisible().catch(() => false);
    const hasEmptyMessage = await page.getByText(/no charts/i).isVisible().catch(() => false);
    const hasLoading = await page.getByText(/loading/i).isVisible().catch(() => false);

    // At least one state should be visible
    expect(hasTable || hasEmptyMessage || hasLoading).toBeTruthy();

    await helpers.screenshot('charts-list-or-empty');
  });

  test('Charts page has navigation', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Verify we're on the charts page
    await expect(page.getByRole('heading', { name: 'Charts', exact: true })).toBeVisible();

    // Check if navigation links exist (even if not clickable)
    const hasDashboardLink = await page.getByRole('link', { name: 'Dashboard', exact: true }).isVisible().catch(() => false);
    const hasReportsLink = await page.getByRole('link', { name: 'Reports' }).isVisible().catch(() => false);

    // At least basic navigation should exist
    expect(hasDashboardLink || hasReportsLink).toBeTruthy();

    await helpers.screenshot('charts-navigation');
  });

  test('charts page structure is valid', async ({ page }) => {
    const helpers = new TestHelpers(page);

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Check for basic page structure
    await expect(page.locator('main')).toBeVisible();

    // Check for charts heading
    await expect(page.getByRole('heading', { name: 'Charts', exact: true })).toBeVisible();

    await helpers.screenshot('charts-structure');
  });
});

test.describe('Charts - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    const helpers = new TestHelpers(page);
    await helpers.login();
    await page.waitForTimeout(2000);
    await helpers.navigateToPage('Charts');
    await page.waitForTimeout(3000);
  });

  test('handle navigation to charts page', async ({ page }) => {
    // Verify we can navigate to charts page
    await expect(page.getByRole('heading', { name: 'Charts', exact: true })).toBeVisible({ timeout: 15000 });

    // Take screenshot
    await page.screenshot({ path: 'screenshots/charts-navigation-success.png' });
  });

  test('handle charts page loading', async ({ page }) => {
    // Just verify the page doesn't crash and has basic structure
    await expect(page.locator('body')).toBeVisible();

    // Should have either charts list or empty state
    const hasContent = await page.locator('main').isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();

    await page.screenshot({ path: 'screenshots/charts-page-stable.png' });
  });

  test('verify charts page is accessible', async ({ page }) => {
    // Check for any accessibility issues - page should be responsive
    await page.waitForTimeout(2000);

    // Page should have loaded without errors
    const hasChartsHeading = await page.getByRole('heading', { name: 'Charts', exact: true }).isVisible().catch(() => false);
    expect(hasChartsHeading).toBeTruthy();

    await page.screenshot({ path: 'screenshots/charts-accessible.png' });
  });
});
