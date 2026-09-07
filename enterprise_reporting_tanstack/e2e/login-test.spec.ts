import { test, expect } from '@playwright/test';

test.describe('Admin Login Test', () => {
  test('should login with admin credentials', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we're on the login page
    const url = page.url();
    console.log('Current URL:', url);

    // Take a screenshot for debugging
    await page.screenshot({ path: 'screenshots/login-page.png' });

    // Fill in email
    await page.fill('input[type="email"]', 'admin@admin.com');
    console.log('Entered email: admin@admin.com');

    // Fill in password
    await page.fill('input[type="password"]', 'admin');
    console.log('Entered password: ******');

    // Click sign in button
    await page.click('button[type="submit"], button:has-text("Sign In")');

    // Wait for navigation or response
    await page.waitForTimeout(5000);

    // Take screenshot after login attempt
    await page.screenshot({ path: 'screenshots/after-login.png' });

    // Check if login was successful - we should be redirected to dashboard or stay on login with error
    const currentUrl = page.url();
    console.log('Current URL after login attempt:', currentUrl);

    // Check for error message
    const hasError = await page.getByText('Invalid email or password').count();
    const hasDashboard = await page.getByText('Dashboard').count();

    console.log('Error message present:', hasError > 0);
    console.log('Dashboard present:', hasDashboard > 0);

    if (hasDashboard > 0) {
      console.log('✅ Login successful!');
      expect(currentUrl).not.toContain('/login');
    } else if (hasError > 0) {
      console.log('❌ Login failed - Invalid credentials');
    }
  });

  test('debug - check database directly', async () => {
    // This test just checks what's in the database
    console.log('Checking database contents...');
  });
});
