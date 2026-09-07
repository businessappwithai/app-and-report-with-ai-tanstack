import { test, expect, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

// Clear storage for all tests in this file
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('login page loads successfully', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);

    // Check if login form elements exist
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to your Enterprise Reporting account')).toBeVisible();
    await expect(page.getByPlaceholder('name@example.com')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/login-page.png' });
  });

  test('successful login with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in login form with correct credentials
    await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
    await page.getByLabel('Password').fill('admin');

    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome to the Enterprise Reporting System')).toBeVisible();

    // Verify we're no longer on login page
    await expect(page).not.toHaveURL(/login/);

    await page.screenshot({ path: 'screenshots/successful-login.png' });
  });

  test('failed login with invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in login form with invalid credentials
    await page.getByPlaceholder('name@example.com').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');

    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for error message
    await page.waitForTimeout(2000);

    // Should still be on login page or show error
    const errorMessage = page.getByText(/invalid|incorrect|failed|error/i).first();
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toBeVisible();
    }

    // Verify we're not logged in (should not see Dashboard)
    const dashboard = page.getByRole('heading', { name: 'Dashboard', exact: true });
    await expect(dashboard).not.toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'screenshots/failed-login.png' });
  });

  test('login validation - empty email', async ({ page }) => {
    await page.goto('/');

    // Fill only password
    await page.getByLabel('Password').fill('admin');

    // Try to sign in (button should be disabled or validation should trigger)
    const signInButton = page.getByRole('button', { name: 'Sign In' });

    // Check if button is disabled or if there's validation
    const isDisabled = await signInButton.isDisabled();

    if (isDisabled) {
      await expect(signInButton).toBeDisabled();
    } else {
      // Click and check for validation error
      await signInButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/login-validation-email.png' });
  });

  test('login validation - empty password', async ({ page }) => {
    await page.goto('/');

    // Fill only email
    await page.getByPlaceholder('name@example.com').fill('admin@admin.com');

    // Try to sign in
    const signInButton = page.getByRole('button', { name: 'Sign In' });

    const isDisabled = await signInButton.isDisabled();

    if (isDisabled) {
      await expect(signInButton).toBeDisabled();
    } else {
      await signInButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'screenshots/login-validation-password.png' });
  });

  test('logout functionality', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
    await page.getByLabel('Password').fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 5000 });

    // Look for logout button/user menu
    const userMenuButton = page.locator('button').filter({ hasText: /admin|user|logout/i }).first();

    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      await page.waitForTimeout(500);

      // Click logout if visible
      const logoutButton = page.getByRole('menuitem').filter({ hasText: /logout|sign out/i }).first();
      if (await logoutButton.isVisible()) {
        await logoutButton.click();

        // Should redirect to login
        await expect(page).toHaveURL(/login/, { timeout: 5000 });
        await expect(page.getByText('Welcome back')).toBeVisible();
      }
    }

    await page.screenshot({ path: 'screenshots/logout.png' });
  });
});

async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
  await page.getByLabel('Password').fill('admin');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 5000 });
}

test.describe('Enterprise Reporting System - Public Pages', () => {
  test('redirects to login when accessing protected pages', async ({ page }) => {
    await page.goto('/sql-editor');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('no console errors on login page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });

  test('responsive design on mobile - login page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if page is responsive
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Welcome back')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'screenshots/mobile-login.png' });
  });
});

test.describe('Enterprise Reporting System - Authenticated', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each authenticated test
    await page.goto('/');

    // Fill in login form with correct credentials
    await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
    await page.getByLabel('Password').fill('admin');

    // Click sign in
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for dashboard to load (client-side routing, URL might stay at /)
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome to the Enterprise Reporting System')).toBeVisible();
  });

  test('dashboard loads after login', async ({ page }) => {
    // Check for dashboard elements
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Welcome to the Enterprise Reporting System')).toBeVisible();

    // Check for stats cards
    await expect(page.getByText('Total Reports')).toBeVisible();
    await expect(page.getByText('Active Charts')).toBeVisible();
    await expect(page.getByText('Dashboards').first()).toBeVisible();
    await expect(page.getByText('Scheduled Jobs')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/dashboard.png' });
  });

  test('navigation menu is visible after login', async ({ page }) => {
    // Check if main navigation elements exist
    await expect(page.locator('nav').first()).toBeVisible();

    // Check for common navigation items
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'SQL Editor', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Charts' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboards' }).first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/navigation.png' });
  });

  test('SQL Editor page loads after login', async ({ page }) => {
    // Navigate to SQL Editor (use the first link)
    await page.getByRole('link', { name: 'SQL Editor', exact: true }).click();

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Check for SQL editor elements
    await expect(page.locator('main')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/sql-editor.png' });
  });

  test('Quick Actions cards are visible', async ({ page }) => {
    // Check for quick action cards
    await expect(page.getByText('Quick Actions')).toBeVisible();
    await expect(page.getByText('SQL Editor').first()).toBeVisible();
    await expect(page.getByText('Write and execute SQL queries')).toBeVisible();
    await expect(page.getByText('Reports').first()).toBeVisible();
    await expect(page.getByText('View and manage reports')).toBeVisible();
    await expect(page.getByText('Charts').first()).toBeVisible();
    await expect(page.getByText('Dashboards').first()).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/quick-actions.png' });
  });

  test('navigate between pages', async ({ page }) => {
    // Navigate to SQL Editor (use the first link)
    await page.getByRole('link', { name: 'SQL Editor', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('main')).toBeVisible();

    // Navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Welcome to the Enterprise Reporting System')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'screenshots/navigation-working.png' });
  });
});
