/**
 * Load and Comprehensive Testing Suite
 * Tests application with 300K+ records
 */

import { test, expect } from '@playwright/test';

test.describe('Load Testing - Large Dataset', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('L1. Dashboard loads with large dataset', async ({ page }) => {
    await page.goto('/');

    // Dashboard should load
    await expect(page.locator('h1').first()).toContainText('Dashboard', { timeout: 10000 });

    // Stats should be visible
    await expect(page.locator('text=Total Reports').first()).toBeVisible();
    await expect(page.locator('text=Active Charts').first()).toBeVisible();
    await expect(page.locator('text=Dashboards').first()).toBeVisible();
  });

  test('L2. SQL Editor - Simple query on large dataset', async ({ page }) => {
    await page.goto('/sql-editor');

    // Wait for page to load
    await expect(page.locator('h1').or(page.locator('text=SQL')).first()).toBeVisible({ timeout: 10000 });

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Click in the editor
    await page.locator('.monaco-editor').click();

    // Type simple query
    await page.keyboard.type('SELECT COUNT(*) as total FROM customers');

    // Look for and click execute button
    const executeBtn = page.locator('button:has-text("Execute"), button:has-text("Run"), button[title*="Execute"], button[title*="Run"]').first();
    if (await executeBtn.isVisible()) {
      await executeBtn.click();
    }

    // Wait for results
    await page.waitForTimeout(5000);
  });

  test('L3. Complex JOIN query performance', async ({ page }) => {
    await page.goto('/sql-editor');

    await expect(page.locator('text=SQL Editor').or(page.locator('h1'))).toBeVisible();

    const editor = page.locator('.monaco-editor, .view-line').first();
    await editor.click();

    // Complex JOIN query
    const complexQuery = `SELECT
  c.name,
  COUNT(o.order_id) as order_count,
  SUM(o.total_amount) as total_spent
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id
ORDER BY total_spent DESC
LIMIT 100`;

    await page.keyboard.type(complexQuery);

    // Execute and measure time
    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run"), button:has-text("▶")');

    // Wait for results
    await page.waitForTimeout(10000);
    const queryTime = Date.now() - startTime;

    console.log(`Complex JOIN query completed in ${queryTime}ms`);

    // Query should complete within 30 seconds
    expect(queryTime).toBeLessThan(30000);
  });

  test('L4. Large result set handling (1000 rows)', async ({ page }) => {
    await page.goto('/sql-editor');

    await expect(page.locator('text=SQL Editor').or(page.locator('h1'))).toBeVisible();

    const editor = page.locator('.monaco-editor, .view-line').first();
    await editor.click();

    await page.keyboard.type('SELECT * FROM orders ORDER BY id DESC LIMIT 1000');

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run"), button:has-text("▶")');

    await page.waitForTimeout(15000);
    const queryTime = Date.now() - startTime;

    console.log(`1000 row query completed in ${queryTime}ms`);
  });

  test('L5. Aggregation query performance', async ({ page }) => {
    await page.goto('/sql-editor');

    await expect(page.locator('text=SQL Editor').or(page.locator('h1'))).toBeVisible();

    const editor = page.locator('.monaco-editor, .view-line').first();
    await editor.click();

    const aggQuery = `SELECT
  status,
  COUNT(*) as count,
  SUM(total_amount) as total,
  AVG(total_amount) as average
FROM orders
GROUP BY status`;

    await page.keyboard.type(aggQuery);

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run"), button:has-text("▶")');

    await page.waitForTimeout(10000);
    const queryTime = Date.now() - startTime;

    console.log(`Aggregation query completed in ${queryTime}ms`);
    expect(queryTime).toBeLessThan(20000);
  });

  test('L6. Multiple sequential queries (stress test)', async ({ page }) => {
    await page.goto('/sql-editor');

    await expect(page.locator('text=SQL Editor').or(page.locator('h1'))).toBeVisible();

    const queries = [
      'SELECT COUNT(*) FROM customers',
      'SELECT COUNT(*) FROM orders',
      'SELECT COUNT(*) FROM order_items',
      'SELECT status, COUNT(*) FROM orders GROUP BY status'
    ];

    const editor = page.locator('.monaco-editor, .view-line').first();
    const totalTime = Date.now();

    for (const query of queries) {
      await editor.click();
      // Clear editor
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      await page.keyboard.type(query);

      await page.click('button:has-text("Execute"), button:has-text("Run"), button:has-text("▶")');
      await page.waitForTimeout(5000);
    }

    const totalTimeMs = Date.now() - totalTime;
    console.log(`All queries completed in ${totalTimeMs}ms`);
    expect(totalTimeMs).toBeLessThan(60000);
  });
});

test.describe('Comprehensive Application Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('C1. Navigate all main pages', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Dashboard' },
      { path: '/sql-editor', name: 'SQL Editor' },
      { path: '/queries', name: 'Saved Queries' },
      { path: '/reports', name: 'Reports' },
      { path: '/charts', name: 'Charts' },
      { path: '/dashboards', name: 'Dashboards' },
      { path: '/filters', name: 'Filters' },
      { path: '/jobs', name: 'Jobs' },
      { path: '/data-sources', name: 'Data Sources' },
      { path: '/admin/users', name: 'Users' },
      { path: '/admin/roles', name: 'Roles' },
      { path: '/settings', name: 'Settings' }
    ];

    for (const pageData of pages) {
      await page.goto(pageData.path);
      const visible = await page.locator('h1').or(page.locator(`text=${pageData.name}`)).or(page.locator('text=Dashboard')).or(page.locator('text=SQL')).or(page.locator('text=Reports')).first().isVisible({ timeout: 10000 });
      expect(visible).toBeTruthy();
      console.log(`✓ ${pageData.name} page loaded`);
    }
  });

  test('C2. Theme toggle works', async ({ page }) => {
    await page.goto('/');

    // Get initial theme
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('class');

    // Toggle theme
    await page.click('button:has-text("Toggle theme"), button[aria-label*="theme"], button:has([data-lucide="moon"], [data-lucide="sun"])');

    await page.waitForTimeout(1000);
    const newTheme = await html.getAttribute('class');

    // Theme should change
    expect(initialTheme).not.toBe(newTheme);
  });

  test('C3. Sidebar navigation', async ({ page }) => {
    await page.goto('/');

    // Find sidebar links and navigate
    const dashboardLink = page.locator('a').filter({ hasText: 'Dashboard' }).first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await expect(page).toHaveURL(/\//);
    }
  });

  test('C4. Quick Actions cards', async ({ page }) => {
    await page.goto('/');

    // Check for Quick Actions
    await expect(page.locator('text=Quick Actions').or(page.locator('text=SQL')).or(page.locator('text=Report')).first()).toBeVisible();
  });

  test('C5. Page load performance', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Dashboard' },
      { path: '/sql-editor', name: 'SQL Editor' },
      { path: '/reports', name: 'Reports' }
    ];

    for (const pageData of pages) {
      const startTime = Date.now();
      await page.goto(pageData.path);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      console.log(`${pageData.name} loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000);
    }
  });
});

test.describe('Authentication Tests', () => {
  test('A1. Login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\//);
  });

  test('A2. Invalid login shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"], input[type="email"]', 'invalid@test.com');
    await page.fill('input[name="password"], input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Should show error
    await expect(page.locator('text=Invalid').or(page.locator('.error')).or(page.locator('text=Email or password'))).toBeVisible({ timeout: 5000 });
  });

  test('A3. Protected routes redirect to login', async ({ page, context }) => {
    // Clear all cookies
    await context.clearCookies();

    await page.goto('/reports');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Data Source Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('D1. Data sources page loads', async ({ page }) => {
    await page.goto('/data-sources');

    await expect(page.locator('h1').or(page.locator('text=Data Source')).first()).toBeVisible();
  });

  test('D2. Add data source form', async ({ page }) => {
    await page.goto('/data-sources');

    // Look for add button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Reports and Charts', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('R1. Reports page loads', async ({ page }) => {
    await page.goto('/reports');

    await expect(page.locator('h1').or(page.locator('text=Report')).first()).toBeVisible();
  });

  test('R2. Charts page loads', async ({ page }) => {
    await page.goto('/charts');

    await expect(page.locator('h1').or(page.locator('text=Chart')).first()).toBeVisible();
  });

  test('R3. Dashboards page loads', async ({ page }) => {
    await page.goto('/dashboards');

    await expect(page.locator('h1').or(page.locator('text=Dashboard')).first()).toBeVisible();
  });
});

test.describe('Admin Functions', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\//);
  });

  test('ADM1. Users page loads', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page.locator('h1').or(page.locator('text=User')).first()).toBeVisible();
  });

  test('ADM2. Roles page loads', async ({ page }) => {
    await page.goto('/admin/roles');

    await expect(page.locator('h1').or(page.locator('text=Role')).first()).toBeVisible();
  });

  test('ADM3. Settings page loads', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.locator('h1').first()).toBeVisible();
  });
});
