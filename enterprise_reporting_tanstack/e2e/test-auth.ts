import { type APIRequestContext, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

/**
 * Get authentication cookie for API requests
 * Note: Global setup handles authentication, this is for API-specific requests
 */
export async function getAuthCookie(request: APIRequestContext): Promise<string> {
  try {
    // Try to get cookies from the request context (inherited from global auth)
    const response = await request.get(`${BASE_URL}/dashboard`);

    // If we get a 200, we're already authenticated
    if (response.status() === 200) {
      console.log('✓ Already authenticated via inherited session');
      return '';
    }

    throw new Error(`Auth check failed with status ${response.status()}`);
  } catch (error) {
    console.error('Error checking auth:', error);
    throw new Error('Unable to verify authentication');
  }
}

/**
 * Simple login function for E2E tests - emergency re-auth only
 * In most cases, global setup authentication is sufficient
 */
export async function login(page: Page, email: string = 'admin@admin.com', password: string = 'admin'): Promise<void> {
  // Navigate to home - should redirect to login if needed
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const currentUrl = page.url();

  // If already authenticated, return
  if (!currentUrl.includes('/login')) {
    console.log('✓ Already authenticated, skipping login');
    return;
  }

  console.log('⏳ Performing emergency re-authentication...');

  // Fill and submit login form
  try {
    // Email field
    const emailInput = page.getByPlaceholder('name@example.com');
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(email);

    // Password field
    const passwordInput = page.getByLabel('Password');
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(password);

    // Sign in button
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await signInButton.waitFor({ state: 'visible', timeout: 5000 });
    await signInButton.click();

    // Wait for successful authentication
    await Promise.race([
      page.waitForURL(/\/(dashboard|)/, { timeout: 15000 }),
      page.waitForLoadState('domcontentloaded'),
      page.getByRole('heading', { name: /dashboard/i }).waitFor({ timeout: 15000 }).catch(() => null),
    ]);

    console.log('✓ Emergency re-authentication successful');
    await page.waitForTimeout(1000);
  } catch (error) {
    console.error('⚠️  Emergency re-authentication failed:', error);
    throw new Error(`Login failed: ${error}`);
  }
}
