import { Page, Locator } from '@playwright/test';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Verify authentication - called by tests to ensure logged in
   * In most cases, global setup handles auth, this is just for verification
   */
  async login(email = 'admin@admin.com', password = 'admin') {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

    // Navigate to home
    await this.page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});

    // Check current state
    const currentUrl = this.page.url();

    // If not on login page, already authenticated
    if (!currentUrl.includes('/login')) {
      console.log('✓ Already authenticated via global setup');
      return;
    }

    // If here, emergency re-auth is needed
    console.log('⏳ Performing emergency re-authentication...');

    try {
      await this.page.getByPlaceholder('name@example.com').fill(email);
      await this.page.getByLabel('Password').fill(password);
      await this.page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for successful login (multiple indicators for reliability)
      await Promise.race([
        this.page.waitForURL(/\/(dashboard|)/, { timeout: 15000 }),
        this.page.getByRole('heading', { name: /dashboard/i }).waitFor({ state: 'visible', timeout: 15000 }),
        this.page.getByRole('navigation').waitFor({ state: 'visible', timeout: 15000 }),
      ]).catch(() => this.page.waitForTimeout(3000));

      console.log('✓ Emergency re-authentication successful');
    } catch (error) {
      console.error('⚠️  Emergency re-auth failed:', error);
      throw error;
    }

    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  }

  /**
   * Navigate to a specific page by name
   * Uses direct URL navigation for reliability
   */
  async navigateToPage(pageName: 'Dashboard' | 'SQL Editor' | 'Reports' | 'Charts' | 'Dashboards') {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

    // Map page names to their routes
    const routes: Record<string, string> = {
      'Dashboard': '/dashboard',
      'SQL Editor': '/sql-editor',
      'Reports': '/reports',
      'Charts': '/charts',
      'Dashboards': '/dashboards',
    };

    const route = routes[pageName];
    if (!route) {
      throw new Error(`Unknown page: ${pageName}`);
    }

    // Use direct URL navigation - most reliable
    await this.page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });

    // Wait for page to be fully loaded
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for and verify toast notification
   */
  async verifyToast(message: string, type: 'success' | 'error' = 'success') {
    const toast = this.page.getByText(message).first();
    await toast.waitFor({ state: 'visible', timeout: 5000 });
    return toast;
  }

  /**
   * Select from a dropdown by trigger and option text
   * Improved to handle Radix UI dropdowns with better waiting
   */
  async selectDropdown(triggerText: string, optionText: string, timeout = 10000) {
    // Click the dropdown trigger
    const trigger = this.page.getByText(triggerText).first();
    await trigger.waitFor({ state: 'visible', timeout });
    await trigger.click();

    // Wait for dropdown content to appear - Radix UI uses portals
    await this.page.waitForTimeout(500);

    // Try to find the option with multiple selectors for robustness
    const option = this.page.getByRole('option', { name: optionText }).first();

    try {
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    } catch (error) {
      // Fallback: try clicking by text if role='option' didn't work
      const textOption = this.page.getByText(optionText).first();
      await textOption.waitFor({ state: 'visible', timeout: 5000 });
      await textOption.click();
    }

    // Wait for selection to complete
    await this.page.waitForTimeout(300);
  }

  /**
   * Fill a form field by label
   */
  async fillByLabel(label: string, value: string) {
    await this.page.getByLabel(label).fill(value);
  }

  /**
   * Click a button by text
   * Waits for button to be visible and enabled before clicking
   */
  async clickButton(text: string, timeout = 10000) {
    const button = this.page.getByRole('button', { name: text }).first();
    await button.waitFor({ state: 'visible', timeout });
    await button.click();
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * Wait for loading to complete (spinner disappears)
   */
  async waitForLoading() {
    const spinners = this.page.locator('.animate-spin');
    if (await spinners.count() > 0) {
      await spinners.first().waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  /**
   * Get table rows count
   */
  async getTableRowCount(tableLocator?: Locator) {
    const table = tableLocator || this.page.locator('table').first();
    const rows = await table.locator('tbody tr').all();
    return rows.length;
  }

  /**
   * Verify table has content
   */
  async verifyTableHasContent(expectedMinRows = 1) {
    const count = await this.getTableRowCount();
    if (count < expectedMinRows) {
      throw new Error(`Expected at least ${expectedMinRows} table rows, but found ${count}`);
    }
  }

  /**
   * Click a menu item in a dropdown menu
   */
  async clickMenuItem(menuTriggerText: string, menuItemText: string) {
    // Click the menu trigger (usually a button with icon)
    const trigger = this.page.getByRole('button').filter({ hasText: menuTriggerText }).first();
    await trigger.click();

    // Wait for menu to appear
    await this.page.waitForTimeout(200);

    // Click the menu item
    const menuItem = this.page.getByRole('menuitem').filter({ hasText: menuItemText }).first();
    await menuItem.click();
  }

  /**
   * Wait for Monaco Editor to be ready
   */
  async waitForMonacoEditor() {
    const editor = this.page.locator('.monaco-editor').first();
    await editor.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Type in Monaco Editor
   */
  async typeInMonacoEditor(text: string, append = false) {
    await this.waitForMonacoEditor();

    // Click in the editor to focus it
    const editor = this.page.locator('.monaco-editor').first();
    await editor.click();

    if (!append) {
      // Select all and delete existing content
      await this.page.keyboard.press('ControlOrMeta+A');
      await this.page.keyboard.press('Delete');
    }

    // Type the new content
    await this.page.keyboard.type(text);
  }

  /**
   * Get Monaco Editor content
   */
  async getMonacoEditorContent(): Promise<string> {
    await this.waitForMonacoEditor();

    // Select all content
    await this.page.keyboard.press('ControlOrMeta+A');

    // Copy to clipboard
    await this.page.keyboard.press('ControlOrMeta+C');

    // Get from clipboard
    return await this.page.evaluate(() => navigator.clipboard.readText());
  }

  /**
   * Switch to a specific tab by text
   */
  async switchTab(tabText: string) {
    const tab = this.page.getByRole('tab', { name: tabText });
    await tab.click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Verify no console errors
   */
  async verifyNoConsoleErrors() {
    const errors: string[] = [];

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait a bit for any async errors
    await this.page.waitForTimeout(1000);

    return errors;
  }

  /**
   * Handle a dialog (confirm/alert)
   */
  async handleDialog(accept: boolean, promptText?: string) {
    this.page.once('dialog', async dialog => {
      if (promptText) {
        await dialog.accept(promptText);
      } else if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * Verify element visibility with timeout
   */
  async verifyVisible(selector: string, timeout = 5000) {
    await this.page.locator(selector).first().waitFor({ state: 'visible', timeout });
  }

  /**
   * Select a data source in SQL Editor
   * Uses JavaScript clicks to avoid Playwright timeout issues with Radix UI components
   */
  async selectDataSource(dataSourceName?: string) {
    // Wait for data source dropdown to be available
    const selectTrigger = this.page.locator('button').filter({ hasText: /Select data source/i }).first();

    // Wait for trigger to be visible
    await selectTrigger.waitFor({ state: 'visible', timeout: 10000 });

    // Wait for React state to settle
    await this.page.waitForTimeout(1000);

    // Check if data sources are available - retry check
    let isDisabled = true;
    for (let i = 0; i < 5; i++) {
      isDisabled = await selectTrigger.isDisabled();
      if (!isDisabled) break;
      await this.page.waitForTimeout(500);
    }

    if (isDisabled) {
      throw new Error('No data sources available - button is disabled');
    }

    // Click using JavaScript (more reliable for Radix UI)
    await this.page.evaluate((element) => element.click(), await selectTrigger.elementHandle());

    // Wait for options to appear with a longer timeout
    await this.page.waitForSelector('[role="option"]', { state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(300);

    // Select first option or specific data source by name using JavaScript
    if (dataSourceName) {
      const option = this.page.locator('[role="option"]').filter({ hasText: dataSourceName }).first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await this.page.evaluate((el) => el.click(), await option.elementHandle());
    } else {
      const firstOption = this.page.locator('[role="option"]').first();
      await firstOption.waitFor({ state: 'visible', timeout: 5000 });
      await this.page.evaluate((el) => el.click(), await firstOption.elementHandle());
    }

    // Wait for selection to complete and schema to start loading
    await this.page.waitForTimeout(1000);

    // Wait for the dropdown to close
    await this.page.waitForSelector('[role="option"]', { state: 'hidden', timeout: 5000 }).catch(() => {
      // Dropdown might close immediately, which is fine
    });

    // Additional wait for schema loading to start
    await this.page.waitForTimeout(500);
  }

  /**
   * Retry a function with delay
   */
  async retry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await this.page.waitForTimeout(delay);
        }
      }
    }

    throw lastError;
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
