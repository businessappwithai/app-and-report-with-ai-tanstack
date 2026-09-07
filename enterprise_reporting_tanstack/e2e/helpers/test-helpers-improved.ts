import { Page, Locator, expect } from '@playwright/test';

/**
 * Improved Test Helpers with better reliability and performance
 * Addresses issues with race conditions, timing, and selector specificity
 */
export class ImprovedTestHelpers {
  constructor(private page: Page) {}

  /**
   * IMPROVED: Login with multiple verification strategies
   * Fixes the dashboard heading timeout issues
   */
  async login(email = 'admin@admin.com', password = 'admin') {
    await this.page.goto('/');

    // Fill in login form
    await this.page.getByPlaceholder('name@example.com').fill(email);
    await this.page.getByLabel('Password').fill(password);

    // Click sign in
    await this.page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for ONE of multiple indicators of successful login (more robust)
    await Promise.race([
      // Option 1: Any heading with "dashboard" (case-insensitive, not exact)
      this.page.getByRole('heading', { name: /dashboard/i }).waitFor({ state: 'visible', timeout: 15000 }),
      // Option 2: Navigation menu (appears after login)
      this.page.getByRole('navigation').waitFor({ state: 'visible', timeout: 15000 }),
      // Option 3: Quick Actions text
      this.page.getByText('Quick Actions').waitFor({ state: 'visible', timeout: 15000 }),
      // Option 4: URL change
      this.page.waitForURL('/', { timeout: 15000 }),
    ]);

    // Verify authentication state in storage
    const isAuthenticated = await this.page.evaluate(() => {
      return localStorage.getItem('auth_token') !== null ||
             document.cookie.includes('auth') ||
             sessionStorage.getItem('auth') !== null;
    });

    if (!isAuthenticated) {
      throw new Error('Login completed but no auth token found');
    }

    // Small wait for any pending redirects
    await this.page.waitForTimeout(500);
  }

  /**
   * IMPROVED: Navigate to page with proper waiting
   */
  async navigateToPage(pageName: 'Dashboard' | 'SQL Editor' | 'Reports' | 'Charts' | 'Dashboards') {
    // Use data-testid if available, fallback to role
    const link = this.page.getByRole('link', { name: pageName, exact: true }).first();
    await expect(link).toBeVisible({ timeout: 5000 });
    await link.click();

    // Wait for navigation to complete using network idle
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      // Network idle might timeout, but page might still be loaded
    });

    // Wait a bit for React Router to settle
    await this.page.waitForTimeout(300);
  }

  /**
   * IMPROVED: Wait for Monaco Editor to be FULLY ready (not just visible)
   * Fixes the "editor not clickable" issues
   */
  async waitForMonacoEditorReady(timeout = 15000) {
    const editor = this.page.locator('.monaco-editor').first();

    // Wait for editor container to be visible
    await editor.waitFor({ state: 'visible', timeout });

    // CRITICAL: Wait for Monaco to be fully hydrated and editable
    await this.page.waitForFunction(() => {
      const monacoContainer = document.querySelector('.monaco-editor');
      if (!monacoContainer) return false;

      // Check for actual Monaco editor elements (view-lines means it's rendered)
      const editorElement = monacoContainer.querySelector('.monaco-editor .view-lines');
      if (!editorElement) return false;

      // Check if editor is visible and not hidden
      const styles = window.getComputedStyle(monacoContainer);
      return styles.visibility !== 'hidden' &&
             styles.display !== 'none' &&
             styles.opacity !== '0';
    }, { timeout });

    // Click to focus and verify it's interactive
    await editor.click();

    // Verify the textarea is editable (Monaco uses a hidden textarea)
    const isEditable = await this.page.evaluate(() => {
      const textarea = document.querySelector('.monaco-editor textarea');
      return textarea && !textarea.disabled && !textarea.readOnly;
    });

    if (!isEditable) {
      throw new Error('Monaco Editor is visible but not editable');
    }

    // Wait for editor decorations to settle
    await this.page.waitForTimeout(200);
  }

  /**
   * IMPROVED: Type in Monaco Editor with proper preparation
   */
  async typeInMonacoEditor(text: string, append = false) {
    await this.waitForMonacoEditorReady();

    // Click in the editor to focus it
    const editor = this.page.locator('.monaco-editor').first();
    await editor.click();

    if (!append) {
      // Select all and delete existing content
      await this.page.keyboard.press('ControlOrMeta+A');
      await this.page.waitForTimeout(50); // Small wait for selection to complete
      await this.page.keyboard.press('Delete');
      await this.page.waitForTimeout(50);
    }

    // Type the new content
    await this.page.keyboard.type(text, { delay: 10 }); // Small delay for reliability
  }

  /**
   * IMPROVED: Select data source with better waiting
   * Fixes the "button not found" timeout issues
   */
  async selectDataSource(dataSourceName?: string) {
    // Wait for data source dropdown to be available AND enabled
    const selectTrigger = this.page.locator('button').filter({
      hasText: /Select data source/i
    }).first();

    // Wait for visibility
    await selectTrigger.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for button to be enabled (not disabled)
    await expect(async () => {
      const isDisabled = await selectTrigger.isDisabled();
      expect(isDisabled).toBeFalsy();
    }).toPass({ timeout: 10000, intervals: [500, 1000] });

    // Wait a bit for React state to settle
    await this.page.waitForTimeout(500);

    // Click the dropdown
    await selectTrigger.click();

    // Wait for dropdown options to appear
    const optionsList = this.page.locator('[role="option"]').or(
      this.page.locator('[data-radix-dropdown-item-content]')
    );

    await expect(async () => {
      const count = await optionsList.count();
      expect(count).toBeGreaterThan(0);
    }).toPass({ timeout: 5000, intervals: [200, 500] });

    await this.page.waitForTimeout(300);

    // Select the option
    if (dataSourceName) {
      const option = optionsList.filter({ hasText: dataSourceName }).first();
      await expect(option).toBeVisible({ timeout: 5000 });
      await option.click();
    } else {
      const firstOption = optionsList.first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();
    }

    // Wait for selection to complete
    await this.page.waitForTimeout(500);

    // Wait for dropdown to close
    await expect(optionsList).toHaveCount(0, { timeout: 5000 }).catch(() => {
      // Dropdown might close via animation, which is fine
    });
  }

  /**
   * IMPROVED: Switch tab with better error handling
   */
  async switchTab(tabText: string) {
    const tab = this.page.getByRole('tab', { name: tabText });

    // Wait for tab to be visible and enabled
    await expect(tab).toBeVisible({ timeout: 5000 });
    await expect(tab).toBeEnabled();

    await tab.click();

    // Wait for tab panel to appear
    const tabPanel = this.page.getByRole('tabpanel', { name: tabText });
    await expect(tabPanel).toBeVisible({ timeout: 5000 });

    await this.page.waitForTimeout(200);
  }

  /**
   * IMPROVED: Verify toast with better locator
   */
  async verifyToast(message: string, type: 'success' | 'error' = 'success') {
    // Use data-testid if available
    const toast = this.page.locator(`[data-testid="toast-${type}"]`).filter({
      hasText: message
    }).or(
      this.page.getByText(message).first()
    );

    await expect(toast).toBeVisible({ timeout: 5000 });
    return toast;
  }

  /**
   * NEW: Wait for element to be interactive (visible + enabled)
   */
  async assertElementInteractive(selector: string | Locator) {
    const locator = typeof selector === 'string'
      ? this.page.locator(selector)
      : selector;

    await expect(locator).toBeVisible();
    await expect(locator).toBeEnabled();

    const isInteractive = await locator.evaluate(el => {
      return window.getComputedStyle(el).pointerEvents !== 'none';
    });

    expect(isInteractive).toBeTruthy();
  }

  /**
   * NEW: Retry an operation with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: { retries?: number; baseDelay?: number } = {}
  ): Promise<T> {
    const { retries = 3, baseDelay = 500 } = options;
    let lastError: Error | undefined;

    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries) {
          const delay = baseDelay * Math.pow(2, i); // Exponential backoff
          await this.page.waitForTimeout(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * NEW: Wait for network to be idle
   */
  async waitForNetworkIdle(timeout = 10000) {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => {
      // Network idle might timeout, but continue anyway
    });
  }

  /**
   * NEW: Execute query and wait for results
   */
  async executeQueryAndWait(sql: string) {
    await this.typeInMonacoEditor(sql);
    await this.page.getByRole('button', { name: /execute/i }).click();

    // Wait for results to appear
    await this.page.waitForSelector('[data-testid="query-results"]', {
      state: 'visible',
      timeout: 10000
    }).catch(() => {
      // Fallback: wait for any table
      return this.page.locator('table').waitFor({ state: 'visible', timeout: 10000 });
    });

    await this.waitForNetworkIdle();
  }

  /**
   * IMPROVED: Click button with better waiting
   */
  async clickButton(text: string, options: { timeout?: number; exact?: boolean } = {}) {
    const { timeout = 10000, exact = false } = options;
    const button = this.page.getByRole('button', { name: text, exact }).first();

    await expect(button).toBeVisible({ timeout });
    await expect(button).toBeEnabled();
    await button.click();

    await this.page.waitForTimeout(100);
  }

  /**
   * NEW: Assert no console errors
   */
  async assertNoConsoleErrors(duration = 1000) {
    const errors: string[] = [];

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await this.page.waitForTimeout(duration);

    expect(errors).toEqual([]);
  }
}

/**
 * SQL queries for testing
 */
export const TEST_QUERIES = {
  simple: 'SELECT * FROM users LIMIT 10;',
  join: `
    SELECT
      u.name,
      u.email,
      o.id as order_id,
      o.total_amount,
      o.status
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    LIMIT 20;
  `,
  complexJoin: `
    SELECT
      u.name,
      u.email,
      COUNT(o.id) as order_count,
      SUM(o.total_amount) as total_spent,
      AVG(o.total_amount) as avg_order_value
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id, u.name, u.email
    HAVING COUNT(o.id) > 0
    ORDER BY total_spent DESC
    LIMIT 10;
  `,
  aggregation: `
    SELECT
      status,
      COUNT(*) as count,
      SUM(total_amount) as total,
      AVG(total_amount) as average
    FROM orders
    GROUP BY status
    ORDER BY total DESC;
  `,
  withSubquery: `
    WITH customer_stats AS (
      SELECT
        user_id,
        COUNT(*) as order_count,
        SUM(total_amount) as total_spent
      FROM orders
      GROUP BY user_id
    )
    SELECT
      u.name,
      u.email,
      COALESCE(cs.order_count, 0) as orders,
      COALESCE(cs.total_spent, 0) as spent
    FROM users u
    LEFT JOIN customer_stats cs ON u.id = cs.user_id
    ORDER BY spent DESC
    LIMIT 10;
  `,
};
