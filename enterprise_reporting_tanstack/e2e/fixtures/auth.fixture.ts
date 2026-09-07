import { test as base, Page } from '@playwright/test';

/**
 * Authentication Fixture for TanStack Start JWT Session
 * Uses global setup for auth - all tests inherit authenticated state
 */

type AuthFixtures = {
  authenticatedPage: Page;
};

const test = base.extend<AuthFixtures>({
  // Standard authenticated page - uses global auth setup
  authenticatedPage: async ({ page }, use) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

    // Global setup has already authenticated and saved state to auth.json
    // playwright.config.ts reuses this state via storageState: 'auth.json'
    // So the page should already be authenticated

    // Verify we're not on login page (sign of successful global auth)
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // This shouldn't happen if global setup worked, but handle gracefully
      console.warn('⚠️  Global auth may have failed, performing emergency re-auth...');

      await page.getByPlaceholder('name@example.com').fill('admin@admin.com');
      await page.getByLabel('Password').fill('admin');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await Promise.race([
        page.waitForURL(/\/(dashboard|)/, { timeout: 15000 }),
        page.getByRole('heading', { name: /dashboard/i }).waitFor({ state: 'visible', timeout: 15000 }),
      ]).catch(() => null);
    }

    // Use the authenticated page
    await use(page);
  },
});

// Export the base expect for convenience
export { expect } from '@playwright/test';
export { test };
