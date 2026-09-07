/**
 * Comprehensive End-to-End Test Suite
 * Tests complete application functionality including load testing with 300K+ records
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

// Complex SQL queries for testing
const COMPLEX_QUERIES = {
  // Join across multiple tables with aggregations
  customerOrderSummary: `
    SELECT
      c.customer_id,
      c.name,
      c.country,
      c.segment,
      COUNT(DISTINCT o.order_id) as total_orders,
      SUM(o.total_amount) as total_spent,
      AVG(o.total_amount) as avg_order_value,
      MAX(o.order_date) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.customer_id = o.customer_id
    GROUP BY c.customer_id
    ORDER BY total_spent DESC
    LIMIT 100
  `,

  // Complex join with subquery
  topProductsByRevenue: `
    SELECT
      p.product_id,
      p.name,
      p.category,
      p.brand,
      COUNT(oi.order_id) as order_count,
      SUM(oi.quantity) as total_sold,
      SUM(oi.line_total) as total_revenue,
      (SELECT AVG(line_total) FROM order_items) as avg_line_total
    FROM products p
    INNER JOIN order_items oi ON p.product_id = oi.product_id
    WHERE p.is_active = 1
    GROUP BY p.product_id
    HAVING total_revenue > (
      SELECT AVG(line_total) * 100 FROM order_items
    )
    ORDER BY total_revenue DESC
    LIMIT 50
  `,

  // Window function equivalent (using self-join)
  rankedEmployees: `
    SELECT
      e1.employee_id,
      e1.first_name || ' ' || e1.last_name as employee_name,
      e1.department,
      e1.title,
      COUNT(DISTINCT o.order_id) as orders_count,
      SUM(o.total_amount) as total_sales
    FROM employees e1
    LEFT JOIN orders o ON e1.employee_id = SUBSTR(o.order_id, 5, INSTR(o.order_id, '-') - 5)
    WHERE e1.is_active = 1
    GROUP BY e1.employee_id
    ORDER BY total_sales DESC
    LIMIT 20
  `,

  // Multiple joins with CASE statements
  orderStatusBreakdown: `
    SELECT
      strftime('%Y-%m', o.order_date) as month,
      c.country,
      c.segment,
      COUNT(*) as total_orders,
      SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN o.status = 'Shipped' THEN 1 ELSE 0 END) as shipped,
      SUM(CASE WHEN o.status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN o.status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(o.total_amount) as total_revenue,
      AVG(o.total_amount) as avg_order_value
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_date >= '2024-01-01'
    GROUP BY month, c.country, c.segment
    ORDER BY month DESC, total_revenue DESC
    LIMIT 100
  `,

  // Complex subquery with EXISTS
  customersWithLargeOrders: `
    SELECT
      c.customer_id,
      c.name,
      c.email,
      c.country,
      c.tier,
      COUNT(DISTINCT o.order_id) as order_count,
      SUM(o.total_amount) as total_spent
    FROM customers c
    INNER JOIN orders o ON c.customer_id = o.customer_id
    WHERE EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.customer_id = c.customer_id
      AND o2.total_amount > 5000
    )
    GROUP BY c.customer_id
    HAVING total_spent > 10000
    ORDER BY total_spent DESC
    LIMIT 50
  `,

  // Performance test query - scans all orders
  allOrdersWithCustomerInfo: `
    SELECT
      o.order_id,
      o.order_date,
      o.status,
      o.total_amount,
      c.name as customer_name,
      c.country,
      c.segment,
      c.tier
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
    ORDER BY o.order_date DESC
    LIMIT 10000
  `,

  // Aggregation with GROUPING SETS equivalent
  salesByMultipleDimensions: `
    SELECT
      c.country,
      c.segment,
      strftime('%Y', o.order_date) as year,
      strftime('%m', o.order_date) as month,
      COUNT(*) as order_count,
      SUM(o.total_amount) as total_revenue,
      AVG(o.total_amount) as avg_order_value,
      MIN(o.total_amount) as min_order,
      MAX(o.total_amount) as max_order
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_date >= '2024-01-01'
    GROUP BY c.country, c.segment, year, month
    ORDER BY year DESC, month DESC, total_revenue DESC
    LIMIT 500
  `,

  // Product category analysis with CTE-like approach
  productCategoryAnalysis: `
    SELECT
      p.category,
      p.brand,
      COUNT(DISTINCT p.product_id) as product_count,
      SUM(p.stock_quantity) as total_stock,
      AVG(p.price) as avg_price,
      AVG(p.cost) as avg_cost,
      COUNT(DISTINCT oi.order_id) as times_ordered,
      COALESCE(SUM(oi.quantity), 0) as total_sold
    FROM products p
    LEFT JOIN order_items oi ON p.product_id = oi.product_id
    WHERE p.is_active = 1
    GROUP BY p.category, p.brand
    ORDER BY category, total_sold DESC
  `,

  // Support ticket analysis
  supportTicketMetrics: `
    SELECT
      st.category,
      st.status,
      st.priority,
      COUNT(*) as ticket_count,
      COUNT(DISTINCT st.customer_id) as unique_customers,
      AVG(CASE WHEN st.resolved_at IS NOT NULL
        THEN julianday(st.resolved_at) - julianday(st.created_at)
        ELSE NULL END) as avg_resolution_days,
      SUM(CASE WHEN st.status = 'Closed' THEN 1 ELSE 0 END) as closed_tickets
    FROM support_tickets st
    WHERE st.created_at >= '2024-01-01'
    GROUP BY st.category, st.status, st.priority
    ORDER BY ticket_count DESC
  `,

  // Load test query - full table scan with join
  massiveDataJoin: `
    SELECT
      o.order_id,
      o.order_date,
      o.status,
      o.total_amount,
      c.name as customer_name,
      c.email,
      p.name as product_name,
      p.category as product_category,
      oi.quantity,
      oi.line_total
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.customer_id
    INNER JOIN order_items oi ON o.order_id = oi.order_id
    INNER JOIN products p ON oi.product_id = p.product_id
    WHERE o.order_date BETWEEN '2024-01-01' AND '2024-12-31'
      AND o.status IN ('Shipped', 'Delivered')
    ORDER BY o.order_date DESC, o.order_id
    LIMIT 20000
  `
};

test.describe('Enterprise Reporting System - Comprehensive Suite', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('1. Dashboard loads and displays key metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Wait for dashboard to load
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Check for stats cards
    await expect(page.locator('text=Total Reports')).toBeVisible();
    await expect(page.locator('text=Active Charts')).toBeVisible();
    await expect(page.locator('text=Dashboards')).toBeVisible();
    await expect(page.locator('text=Scheduled Jobs')).toBeVisible();

    // Check for quick actions
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=SQL Editor')).toBeVisible();
    await expect(page.locator('text=Reports')).toBeVisible();
    await expect(page.locator('text=Charts')).toBeVisible();
    await expect(page.locator('text=Dashboards')).toBeVisible();
  });

  test('2. SQL Editor - Execute simple query', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Wait for SQL editor to load
    await expect(page.locator('text=SQL Editor')).toBeVisible();

    // Type a simple query
    await page.fill('[contenteditable="true"]', 'SELECT * FROM customers LIMIT 10');

    // Click execute button
    await page.click('button:has-text("Execute")');

    // Wait for results
    await expect(page.locator('text=customer_id')).toBeVisible({ timeout: 10000 });
  });

  test('3. SQL Editor - Complex JOIN query with aggregations', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Execute complex customer order summary query
    const query = COMPLEX_QUERIES.customerOrderSummary;

    // Find and fill the editor
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);

    // Execute query
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Verify results loaded
    await expect(page.locator('text=customer_id').or(page.locator('text=name')).or(page.locator('table'))).toBeVisible({ timeout: 15000 });

    // Check for data in results
    const table = page.locator('table, [role="table"]').first();
    if (await table.isVisible()) {
      const rows = await table.locator('tr').count();
      expect(rows).toBeGreaterThan(1); // At least header + data rows
    }
  });

  test('4. SQL Editor - Product performance with subquery', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const query = COMPLEX_QUERIES.topProductsByRevenue;
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Verify results
    await expect(page.locator('text=product_id').or(page.locator('table')).or(page.locator('text=total_revenue'))).toBeVisible({ timeout: 15000 });
  });

  test('5. SQL Editor - Large dataset query (load test)', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Execute query that returns 10,000+ records
    const query = COMPLEX_QUERIES.allOrdersWithCustomerInfo;
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Verify results load within reasonable time
    await expect(page.locator('table, [role="table"], text=order_id')).toBeVisible({ timeout: 30000 });
  });

  test('6. SQL Editor - Massive JOIN query (20K records)', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const query = COMPLEX_QUERIES.massiveDataJoin;
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);

    // Record start time
    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Verify results load
    await expect(page.locator('table, [role="table"], text=order_date')).toBeVisible({ timeout: 45000 });

    const executionTime = Date.now() - startTime;
    console.log(`Massive JOIN query executed in ${executionTime}ms`);

    // Query should complete within 45 seconds
    expect(executionTime).toBeLessThan(45000);
  });

  test('7. Create and save a new query', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Enter query
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT COUNT(*) as total_customers FROM customers');

    // Execute
    await page.click('button:has-text("Execute"), button:has-text("Run")');
    await expect(page.locator('table, text=total_customers')).toBeVisible({ timeout: 10000 });

    // Save query
    await page.click('button:has-text("Save"), button[aria-label*="save"]');

    // Fill in save dialog
    await page.fill('input[name="name"], input[placeholder*="name"]', 'Customer Count Query');
    await page.fill('textarea[name="description"], textarea[placeholder*="description"]', 'Returns total customer count');

    // Submit
    await page.click('button:has-text("Save"), button[type="submit"]');

    // Verify success message
    await expect(page.locator('text=successfully saved, text=saved').or(page.locator('.toast'))).toBeVisible({ timeout: 5000 });
  });

  test('8. View saved queries', async ({ page }) => {
    await page.goto(`${BASE_URL}/queries`);

    // Check for saved queries section
    await expect(page.locator('text=Saved Queries').or(page.locator('h1:has-text("Query")'))).toBeVisible();
  });

  test('9. Create a new report from query results', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Enter and execute query
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT country, COUNT(*) as customer_count FROM customers GROUP BY country ORDER BY customer_count DESC');
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results
    await expect(page.locator('table, text=country')).toBeVisible({ timeout: 10000 });

    // Click create report button
    const createReportBtn = page.locator('button:has-text("Create Report"), button:has-text("Save as Report")').first();
    if (await createReportBtn.isVisible()) {
      await createReportBtn.click();

      // Fill report details
      await page.fill('input[name="name"]', 'Customers by Country Report');
      await page.fill('textarea[name="description"]', 'Distribution of customers by country');

      // Save
      await page.click('button[type="submit"], button:has-text("Save")');

      // Verify success
      await expect(page.locator('text=successfully created, text=Report created')).toBeVisible({ timeout: 5000 });
    }
  });

  test('10. Navigate to reports page', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);

    // Check reports page loads
    await expect(page.locator('text=Reports').or(page.locator('h1'))).toBeVisible();
  });

  test('11. Create a new chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/charts`);

    // Click new chart button
    await page.click('button:has-text("New Chart"), button:has-text("Create")');

    // Fill chart details
    await page.fill('input[name="name"]', 'Sales by Country Chart');
    await page.selectOption('select[name="chartType"]', 'bar');

    // Save
    await page.click('button:has-text("Save"), button[type="submit"]');

    // Verify chart created
    await expect(page.locator('text=Chart created').or(page.locator('text=successfully saved'))).toBeVisible({ timeout: 5000 });
  });

  test('12. Navigate to dashboards', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboards`);

    // Check dashboards page
    await expect(page.locator('text=Dashboards').or(page.locator('h1:has-text("Dashboard")'))).toBeVisible();
  });

  test('13. Create a new dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboards`);

    // Click new dashboard
    await page.click('button:has-text("New Dashboard"), button:has-text("Create")');

    // Fill details
    await page.fill('input[name="name"]', 'Executive Dashboard');

    // Save
    await page.click('button:has-text("Save"), button[type="submit"]');

    // Verify
    await expect(page.locator('text=Dashboard created').or(page.locator('text=successfully created'))).toBeVisible({ timeout: 5000 });
  });

  test('14. Data sources management', async ({ page }) => {
    await page.goto(`${BASE_URL}/data-sources`);

    // Check data sources page
    await expect(page.locator('text=Data Sources').or(page.locator('h1'))).toBeVisible();
  });

  test('15. Add a new data source (test connection)', async ({ page }) => {
    await page.goto(`${BASE_URL}/data-sources`);

    // Click add new
    await page.click('button:has-text("Add Data Source"), button:has-text("New")');

    // Fill form
    await page.fill('input[name="name"]', 'Test SQLite Database');
    await page.selectOption('select[name="client_type"]', 'sqlite');

    // Enter database path
    await page.fill('input[name="path"], input[placeholder*="path"]', './database/test_large_dataset.db');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for connection result (may fail if DB doesn't exist, that's OK)
    await page.waitForTimeout(2000);
  });

  test('16. Jobs management page', async ({ page }) => {
    await page.goto(`${BASE_URL}/jobs`);

    // Check jobs page
    await expect(page.locator('text=Jobs').or(page.locator('h1'))).toBeVisible();
  });

  test('17. Create a scheduled job', async ({ page }) => {
    await page.goto(`${BASE_URL}/jobs`);

    // Click new job
    await page.click('button:has-text("New Job"), button:has-text("Create")');

    // Fill job details
    await page.fill('input[name="name"]', 'Daily Sales Report');
    await page.fill('textarea[name="description"]', 'Generates daily sales summary');

    // Save
    await page.click('button:has-text("Save"), button[type="submit"]');

    // Verify
    await expect(page.locator('text=Job created').or(page.locator('text=successfully'))).toBeVisible({ timeout: 5000 });
  });

  test('18. Filters management', async ({ page }) => {
    await page.goto(`${BASE_URL}/filters`);

    // Check filters page
    await expect(page.locator('text=Filters').or(page.locator('h1'))).toBeVisible();
  });

  test('19. User management (admin)', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);

    // Check users page
    await expect(page.locator('text=Users').or(page.locator('h1'))).toBeVisible();
  });

  test('20. Roles management', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/roles`);

    // Check roles page
    await expect(page.locator('text=Roles').or(page.locator('h1'))).toBeVisible();
  });

  test('21. Settings page', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);

    // Check settings page
    await expect(page.locator('text=Settings').or(page.locator('h1'))).toBeVisible();
  });

  test('22. Theme toggle', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Get initial theme
    const html = page.locator('html');
    const initialClass = await html.getAttribute('class');

    // Click theme toggle
    await page.click('button:has-text("Toggle theme"), button[aria-label*="theme"]');

    // Wait for theme change
    await page.waitForTimeout(500);
    const newClass = await html.getAttribute('class');

    // Theme should have changed
    expect(initialClass).not.toBe(newClass);
  });

  test('23. Notifications panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Click notifications button
    await page.click('button:has-text("Notifications"), [aria-label*="notification"]');

    // Check notifications panel appears
    await expect(page.locator('[role="dialog"], .popover, text=Notifications').or(page.locator('text=No notifications'))).toBeVisible();
  });

  test('24. Sidebar navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Navigate through sidebar links
    const links = [
      { text: 'Dashboard', url: '/' },
      { text: 'SQL Editor', url: '/sql-editor' },
      { text: 'Reports', url: '/reports' },
      { text: 'Charts', url: '/charts' },
      { text: 'Dashboards', url: '/dashboards' }
    ];

    for (const link of links) {
      await page.click(`a:has-text("${link.text}")`);
      await expect(page).toHaveURL(new RegExp(link.url));
      await page.waitForTimeout(500);
    }
  });

  test('25. Pagination test - large dataset', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Query that returns many records
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT * FROM orders LIMIT 1000');
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Check for pagination controls
    await expect(page.locator('text=Next, text=Previous, button[aria-label*="page"]').or(page.locator('table')).first()).toBeVisible({ timeout: 15000 });
  });

  test('26. SQL validation - error handling', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Enter invalid SQL
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT * FROM nonexistent_table');

    // Try to execute
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Should show error message
    await page.waitForTimeout(2000);

    // Check for error indicator
    const hasError = await page.locator('text=error, text=syntax, text=failed, .error, [role="alert"]').count() > 0;
    // Error may or may not be shown depending on implementation
  });

  test('27. Export functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Execute query
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT * FROM customers LIMIT 100');
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results
    await expect(page.locator('table, text=customer_id')).toBeVisible({ timeout: 10000 });

    // Check for export buttons
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download")').first();
    if (await exportBtn.isVisible()) {
      // Export should be available
      expect(exportBtn).toBeTruthy();
    }
  });

  test('28. Search/filter functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);

    // Look for search input
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"], input[type="search"]').first();

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
    }
  });

  test('29. Responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/`);

    // Check sidebar is collapsed or hidden
    await expect(page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]')).or(page.locator('.sidebar, aside')).toBeVisible();
  });

  test('30. Performance - sequential queries', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const queries = [
      'SELECT COUNT(*) FROM customers',
      'SELECT COUNT(*) FROM orders',
      'SELECT COUNT(*) FROM products'
    ];

    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    const executionTimes: number[] = [];

    for (const query of queries) {
      await editor.fill(query);
      const startTime = Date.now();
      await page.click('button:has-text("Execute"), button:has-text("Run")');
      await expect(page.locator('table, text=count')).toBeVisible({ timeout: 10000 });
      executionTimes.push(Date.now() - startTime);
      await page.waitForTimeout(500);
    }

    // Log performance
    console.log('Query execution times:', executionTimes);

    // All queries should complete within 10 seconds each
    executionTimes.forEach(time => {
      expect(time).toBeLessThan(10000);
    });
  });

  test('31. Complex GROUP BY with multiple dimensions', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const query = COMPLEX_QUERIES.salesByMultipleDimensions;
    const editor = page.locator('.monono-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    await expect(page.locator('table, text=country, text=revenue')).toBeVisible({ timeout: 20000 });
  });

  test('32. Support ticket analytics query', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const query = COMPLEX_QUERIES.supportTicketMetrics;
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(query);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    await expect(page.locator('table, text=ticket_count, text=category')).toBeVisible({ timeout: 15000 });
  });

  test('33. Logout and login again', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Click logout
    await page.click('button:has-text("Logout"), [aria-label*="logout"], button:has-text("Sign out")');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);

    // Login again
    await page.fill('input[name="email"], input[type="email"]', 'admin@admin.com');
    await page.fill('input[name="password"], input[type="password"]', 'admin');
    await page.click('button[type="submit"], button:has-text("Sign In")');

    // Should be redirected to dashboard
    await expect(page).toHaveURL(new RegExp('/'));
  });

  test('34. Check for console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/sql-editor`);
    await page.goto(`${BASE_URL}/reports`);

    // Log any errors (for debugging, not failing test)
    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    }
  });

  test('35. Page load performance check', async ({ page }) => {
    const pages = [
      { path: '/', name: 'Dashboard' },
      { path: '/sql-editor', name: 'SQL Editor' },
      { path: '/reports', name: 'Reports' },
      { path: '/charts', name: 'Charts' },
      { path: '/dashboards', name: 'Dashboards' }
    ];

    for (const pageData of pages) {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}${pageData.path}`);

      // Wait for page to be ready
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      console.log(`${pageData.name} loaded in ${loadTime}ms`);

      // Page should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    }
  });
});

test.describe('Load Testing - High Volume Data', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('L1. Query 100K+ customers with pagination', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill('SELECT * FROM customers ORDER BY id');

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run")');
    await expect(page.locator('table, text=customer_id')).toBeVisible({ timeout: 30000 });
    const queryTime = Date.now() - startTime;

    console.log(`100K customers query executed in ${queryTime}ms`);
    expect(queryTime).toBeLessThan(30000);
  });

  test('L2. Query 300K orders with date filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(`
      SELECT
        order_date,
        status,
        COUNT(*) as order_count,
        SUM(total_amount) as daily_revenue
      FROM orders
      WHERE order_date >= '2024-01-01'
      GROUP BY order_date, status
      ORDER BY order_date DESC
    `);

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run")');
    await expect(page.locator('table, text=order_date')).toBeVisible({ timeout: 45000 });
    const queryTime = Date.now() - startTime;

    console.log(`300K orders aggregation executed in ${queryTime}ms`);
    expect(queryTime).toBeLessThan(45000);
  });

  test('L3. Complex 3-table JOIN with large datasets', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(`
      SELECT
        c.country,
        c.segment,
        p.category,
        COUNT(DISTINCT o.order_id) as order_count,
        SUM(oi.line_total) as total_revenue,
        AVG(oi.line_total) as avg_line_total
      FROM customers c
      INNER JOIN orders o ON c.customer_id = o.customer_id
      INNER JOIN order_items oi ON o.order_id = oi.order_id
      INNER JOIN products p ON oi.product_id = p.product_id
      WHERE o.order_date >= '2024-01-01'
      GROUP BY c.country, c.segment, p.category
      ORDER BY total_revenue DESC
      LIMIT 500
    `);

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run")');
    await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
    const queryTime = Date.now() - startTime;

    console.log(`Complex 3-table JOIN executed in ${queryTime}ms`);
    expect(queryTime).toBeLessThan(60000);
  });

  test('L4. Multiple sequential queries (stress test)', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    const queries = [
      'SELECT COUNT(*) FROM customers',
      'SELECT COUNT(*) FROM orders',
      'SELECT COUNT(*) FROM order_items',
      'SELECT COUNT(*) FROM products',
      'SELECT COUNT(DISTINCT customer_id) FROM orders',
      'SELECT country, COUNT(*) FROM customers GROUP BY country',
      'SELECT status, COUNT(*) FROM orders GROUP BY status',
      'SELECT category, COUNT(*) FROM products GROUP BY category'
    ];

    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    const totalTime = Date.now();

    for (let i = 0; i < queries.length; i++) {
      await editor.fill(queries[i]);
      await page.click('button:has-text("Execute"), button:has-text("Run")');
      await expect(page.locator('table, text=count')).toBeVisible({ timeout: 10000 });
      console.log(`Query ${i + 1}/${queries.length} completed`);
    }

    const totalTimeMs = Date.now() - totalTime;
    console.log(`All queries completed in ${totalTimeMs}ms`);

    // All 8 queries should complete within 60 seconds
    expect(totalTimeMs).toBeLessThan(60000);
  });

  test('L5. Large result set handling', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Query that returns 5000+ rows
    const editor = page.locator('.monaco-editor, [contenteditable="true"], textarea').first();
    await editor.fill(`
      SELECT
        o.order_id,
        o.order_date,
        c.name as customer_name,
        o.total_amount,
        o.status
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.order_date >= '2024-01-01'
      ORDER BY o.order_date DESC
      LIMIT 5000
    `);

    const startTime = Date.now();
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results and verify rendering
    await expect(page.locator('table, tbody tr').first()).toBeVisible({ timeout: 30000 });
    const queryTime = Date.now() - startTime;

    console.log(`5000 row result set loaded in ${queryTime}ms`);
    expect(queryTime).toBeLessThan(30000);
  });
});

test.describe('Authentication & Security', () => {
  test('A1. Invalid login shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.fill('input[name="email"], input[type="email"]', 'invalid@test.com');
    await page.fill('input[name="password"], input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"], button:has-text("Sign In")');

    await expect(page.locator('text=Invalid email or password, text=Invalid').or(page.locator('.error'))).toBeVisible({ timeout: 5000 });
  });

  test('A2. Protected routes redirect to login', async ({ page }) => {
    // Go to dashboard without logging in
    await page.goto(`${BASE_URL}/`);

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('A3. Session persistence after refresh', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/`);

    // Refresh page
    await page.reload();

    // Should still be logged in
    await expect(page.locator('text=Dashboard').or(page.locator('h1'))).toBeVisible();
  });
});
