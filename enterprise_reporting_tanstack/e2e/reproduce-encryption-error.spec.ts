import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Test to reproduce the "Invalid initialization vector" error
 * when running a SQL query in the SQL Editor
 */

test.describe('SQL Editor - Reproduce Encryption Error', () => {
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    await testHelpers.login();
  });

  test('should execute Sakila query successfully', async ({ page }) => {
    await testHelpers.navigateToPage('SQL Editor');

    // Wait for data source dropdown to be available
    await page.waitForTimeout(2000);

    // Select a data source (using JavaScript click for Radix UI)
    await testHelpers.selectDataSource();

    // Wait for schema to load
    await page.waitForTimeout(3000);

    // Type the Sakila query that was failing
    await testHelpers.typeInMonacoEditor(`SELECT
  a.first_name,
  a.last_name,
  COUNT(fa.film_id) as film_count
FROM actor a
JOIN film_actor fa ON a.actor_id = fa.actor_id
GROUP BY a.actor_id, a.first_name, a.last_name
ORDER BY film_count DESC
LIMIT 10;`);

    await page.waitForTimeout(1000);

    // Click the execute button
    await page.locator('button').filter({ hasText: /Run/i }).first().click();

    // Wait for results
    await page.waitForTimeout(5000);

    // Check for errors
    const hasError = await page.getByText(/Invalid initialization vector/i).count() > 0;
    if (hasError) {
      await page.screenshot({ path: 'screenshots/encryption-error-reproduced.png', fullPage: true });
      test.fail(true, 'Encryption error reproduced');
    }

    // Check for successful results
    const hasResults = await page.locator('table').count() > 0;
    expect(hasResults).toBe(true);
  });
});
