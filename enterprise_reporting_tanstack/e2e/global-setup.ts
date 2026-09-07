import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for E2E tests
 * Handles authentication setup and session management
 */
async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'http://localhost:4050';

  // Create a browser context for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n🔐 Setting up authentication for E2E tests...');
    console.log(`   Base URL: ${baseURL}`);

    // Navigate to home
    await page.goto(`${baseURL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // Check if we're on login page
    if (currentUrl.includes('/login')) {
      console.log('   ✓ Login page detected, proceeding with authentication...');

      // Fill email
      const emailInput = page.getByPlaceholder('name@example.com');
      await emailInput.waitFor({ state: 'visible', timeout: 5000 });
      await emailInput.fill('admin@admin.com');
      console.log('   ✓ Email entered');

      // Fill password
      const passwordInput = page.getByLabel('Password');
      await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
      await passwordInput.fill('admin');
      console.log('   ✓ Password entered');

      // Click sign in
      const signInButton = page.getByRole('button', { name: 'Sign In' });
      await signInButton.waitFor({ state: 'visible', timeout: 5000 });

      console.log('   ⏳ Submitting login form...');
      await signInButton.click();

      // Wait for navigation or visible indicators of successful login
      await Promise.race([
        page.waitForURL(/\/(dashboard|)/, { timeout: 15000 }),
        page.waitForLoadState('domcontentloaded'),
        page.getByRole('heading', { name: /dashboard/i }).waitFor({ timeout: 15000 }).catch(() => null),
      ]);

      console.log('   ✓ Login completed');
      await page.waitForTimeout(2000);
    } else {
      console.log('   ✓ Already authenticated or on home page');
    }

    // Verify session cookie is set
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_token');

    if (sessionCookie) {
      console.log(`   ✓ Session token obtained (${sessionCookie.value.substring(0, 20)}...)`);
    } else {
      console.log(`   ⚠️  No session_token cookie found`);
      console.log(`   Available cookies: ${cookies.map(c => c.name).join(', ')}`);
    }

    // Save authentication state to reuse in tests
    const authFile = 'auth.json';
    await context.storageState({ path: authFile });
    console.log(`   ✓ Auth state saved to ${authFile}`);

    console.log('\n✅ Global setup completed\n');
  } catch (error) {
    console.error('\n❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
