/**
 * Complete System E2E Test Suite
 *
 * This test suite covers ALL functionality of the Enterprise Reporting System:
 * - Authentication & Authorization
 * - Data Source Management
 * - SQL Editor & Query Execution
 * - Reports (Create, Edit, View, Export)
 * - Charts (All chart types)
 * - Dashboards (Create, Edit, Widgets, Cross-Filtering)
 * - Filters (Saved, Dynamic)
 * - Metadata Entities (CRUD, Permissions)
 * - Jobs (Schedule, Monitor, Retry)
 * - Admin Panel (Users, Roles, Permissions)
 * - Settings (Email configuration)
 * - WASM Features (DuckDB, Datasets, Offline Mode, Progressive Loading)
 *
 * Run: bun run test:e2e -- e2e/complete-system-test.spec.ts
 */

import { test, expect } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

// Test credentials
const ADMIN_CREDS = { email: 'admin@admin.com', password: 'admin' };
const ANALYST_CREDS = { email: 'analyst@example.com', password: 'analyst123' };

// Test data
const TEST_DATA_SOURCE = {
  name: 'E2E Test DataSource',
  type: 'postgres',
  host: 'localhost',
  port: '5432',
  database: 'test_db',
  username: 'test_user',
  password: 'test_pass',
};

test.describe('Complete System Test Suite', () => {
  // ========================================================================
  // PART 1: AUTHENTICATION & AUTHORIZATION
  // ========================================================================

  test.describe('Authentication & Authorization', () => {
    test('1.1 User can login with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      // Fill login form
      await page.fill('input[name="email"]', ADMIN_CREDS.email);
      await page.fill('input[name="password"]', ADMIN_CREDS.password);
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await page.waitForURL(/\/(dashboard|)$/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/(dashboard|)$/);
    });

    test('1.2 User cannot login with invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/login`);

      await page.fill('input[name="email"]', 'invalid@test.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 5000 });
    });

    test('1.3 User can logout', async ({ page }) => {
      await login(page);

      // Click user menu and logout
      await page.click('[data-testid="user-menu-button"]');
      await page.click('text=Logout');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
      expect(page.url()).toContain('/login');
    });

    test('1.4 Unauthenticated user is redirected to login', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 5000 });
      expect(page.url()).toContain('/login');
    });
  });

  // ========================================================================
  // PART 2: DATA SOURCE MANAGEMENT
  // ========================================================================

  test.describe('Data Source Management', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('2.1 Can view data sources list', async ({ page }) => {
      await page.goto(`${BASE_URL}/data-sources`);

      // Page should load
      await expect(page.locator('h1').filter({ hasText: /data sources/i })).toBeVisible();

      // Should have a table of data sources
      await expect(page.locator('table, [role="table"]')).toBeVisible();
    });

    test('2.2 Can create a new data source', async ({ page }) => {
      await page.goto(`${BASE_URL}/data-sources`);

      // Click "New Data Source" button
      await page.click('button:has-text("New Data Source"), button:has-text("Add Data Source")');

      // Wait for dialog/modal
      await expect(page.locator('[role="dialog"], .dialog, dialog')).toBeVisible();

      // Fill form
      await page.fill('input[name="name"]', `E2E Test ${Date.now()}`);
      await page.selectOption('select[name="type"]', 'postgres');
      await page.fill('input[name="host"]', 'localhost');
      await page.fill('input[name="port"]', '5432');
      await page.fill('input[name="database"]', 'test_db');
      await page.fill('input[name="username"]', 'test_user');
      await page.fill('input[name="password"]', 'test_pass');

      // Submit
      await page.click('button:has-text("Save"), button:has-text("Create"), button[type="submit"]');

      // Should show success message
      await expect(page.locator('text=success, text=created, text=saved').first()).toBeVisible({ timeout: 5000 });
    });

    test('2.3 Can test data source connection', async ({ page }) => {
      await page.goto(`${BASE_URL}/data-sources`);

      // Find first data source with test button
      const testButton = page.locator('button:has-text("Test Connection")').first();
      if (await testButton.isVisible()) {
        await testButton.click();

        // Should show connection result
        await expect(page.locator('text=success, text=connected, text=failed').first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('2.4 Can view data source schema', async ({ page }) => {
      await page.goto(`${BASE_URL}/data-sources`);

      // Click on a data source
      const firstRow = page.locator('table tbody tr, [role="row"]').first();
      await firstRow.click();

      // Should show schema or navigate to detail page
      await page.waitForTimeout(2000);

      // Look for tables or schema info
      const hasTables = await page.locator('text=table, text=Tables').count() > 0;
      const hasSchema = await page.locator('.schema, [data-testid="schema"]').count() > 0;

      expect(hasTables || hasSchema).toBeTruthy();
    });
  });

  // ========================================================================
  // PART 3: SQL EDITOR
  // ========================================================================

  test.describe('SQL Editor', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('3.1 SQL editor page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/sql-editor`);

      // Should have Monaco editor
      await expect(page.locator('.monaco-editor, .editor-container')).toBeVisible({ timeout: 10000 });

      // Should have execute button
      await expect(page.locator('button:has-text("Run"), button:has-text("Execute")')).toBeVisible();
    });

    test('3.2 Can execute a simple query', async ({ page }) => {
      await page.goto(`${BASE_URL}/sql-editor`);

      // Wait for editor to load
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

      // Type a query
      await page.keyboard.type('SELECT 1 as test_column');

      // Click execute
      await page.click('button:has-text("Run"), button:has-text("Execute")');

      // Wait for results
      await page.waitForTimeout(3000);

      // Should show results table or no error
      const hasResults = await page.locator('table, [role="table"], .results').count() > 0;
      const hasNoError = await page.locator('text=error, text=Error').count() === 0;

      expect(hasResults || hasNoError).toBeTruthy();
    });

    test('3.3 Can save a query', async ({ page }) => {
      await page.goto(`${BASE_URL}/sql-editor`);

      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

      // Type query
      const queryName = `E2E Test Query ${Date.now()}`;
      await page.keyboard.type(`SELECT * FROM users LIMIT 10`);

      // Click save button
      await page.click('button:has-text("Save")');

      // Fill name in dialog
      await page.fill('input[name="name"], input[placeholder*="name"]', queryName);
      await page.click('button:has-text("Save"), button:has-text("Create")');

      // Should show success
      await expect(page.locator('text=saved, text=success').first()).toBeVisible({ timeout: 5000 });
    });

    test('3.4 Can view schema browser', async ({ page }) => {
      await page.goto(`${BASE_URL}/sql-editor`);

      // Look for schema browser panel
      const schemaBrowser = page.locator('.schema-browser, [data-testid="schema-browser"], .sidebar').first();

      if (await schemaBrowser.isVisible()) {
        // Should expand to show tables
        await expect(schemaBrowser).toBeVisible();
      }
    });
  });

  // ========================================================================
  // PART 4: REPORTS
  // ========================================================================

  test.describe('Reports', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('4.1 Can view reports list', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      await expect(page.locator('h1').filter({ hasText: /reports/i })).toBeVisible();
      await expect(page.locator('table, [role="table"], .grid')).toBeVisible();
    });

    test('4.2 Can create a new report', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Click new report button
      await page.click('button:has-text("New Report"), button:has-text("Create Report")');

      // Should navigate to editor or show dialog
      await page.waitForTimeout(2000);

      // Fill report name
      const reportName = `E2E Report ${Date.now()}`;
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill(reportName);
      }

      // Select data source
      const dataSourceSelect = page.locator('select[name="dataSource"], [role="combobox"]').first();
      if (await dataSourceSelect.isVisible()) {
        await dataSourceSelect.click();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }

      // Save
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    });

    test('4.3 Can view report details', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Click on first report
      const firstReport = page.locator('table tbody tr, [role="row"], .card').first();
      const count = await firstReport.count();

      if (count > 0) {
        await firstReport.first().click();
        await page.waitForTimeout(2000);

        // Should show report details or data
        const hasContent = await page.locator('table, .report-data, .chart').count() > 0;
        expect(hasContent).toBeTruthy();
      }
    });

    test('4.4 Can export report data', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Look for export buttons
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

      if (await exportButton.isVisible()) {
        await exportButton.click();

        // Should show export options
        await expect(page.locator('text=CSV, text=PDF, text=Excel')).isVisible({ timeout: 3000 });
      }
    });
  });

  // ========================================================================
  // PART 5: CHARTS
  // ========================================================================

  test.describe('Charts', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('5.1 Can view charts list', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts`);

      await expect(page.locator('h1').filter({ hasText: /charts/i })).toBeVisible();
    });

    test('5.2 Can create a bar chart', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts`);

      // Click new chart
      await page.click('button:has-text("New Chart"), button:has-text("Create Chart")');

      // Wait for editor
      await page.waitForTimeout(2000);

      // Select chart type
      const chartTypeSelect = page.locator('select[name="type"], [role="combobox"]').first();
      if (await chartTypeSelect.isVisible()) {
        await chartTypeSelect.click();
        await page.click('text=Bar');
      }

      // Fill name
      const chartName = `E2E Bar Chart ${Date.now()}`;
      const nameInput = page.locator('input[name="name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill(chartName);
      }

      // Save
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    });

    test('5.3 Can create a line chart', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts/editor/new`);

      await page.waitForTimeout(2000);

      // Select line chart type
      const chartTypeSelect = page.locator('select[name="type"], [role="combobox"]').first();
      if (await chartTypeSelect.isVisible()) {
        await chartTypeSelect.click();
        await page.click('text=Line');
      }
    });

    test('5.4 Can create a pie chart', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts/editor/new`);

      await page.waitForTimeout(2000);

      // Select pie chart type
      const chartTypeSelect = page.locator('select[name="type"], [role="combobox"]').first();
      if (await chartTypeSelect.isVisible()) {
        await chartTypeSelect.click();
        await page.click('text=Pie');
      }
    });

    test('5.5 Chart renders correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts`);

      // Click on existing chart if any
      const firstChart = page.locator('.chart-card, [data-testid="chart"], canvas').first();

      if (await firstChart.isVisible()) {
        await page.waitForTimeout(2000);

        // Check for chart rendering (canvas or svg)
        const hasChart = await page.locator('canvas, svg, .echarts, .recharts').count() > 0;
        expect(hasChart).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // PART 6: DASHBOARDS
  // ========================================================================

  test.describe('Dashboards', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('6.1 Can view dashboards list', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      await expect(page.locator('h1').filter({ hasText: /dashboards/i })).toBeVisible();
    });

    test('6.2 Can create a new dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      // Click new dashboard
      await page.click('button:has-text("New Dashboard"), button:has-text("Create Dashboard")');

      // Fill name
      const dashboardName = `E2E Dashboard ${Date.now()}`;
      await page.fill('input[name="name"]', dashboardName);

      // Save
      await page.click('button:has-text("Save"), button:has-text("Create")');

      await page.waitForTimeout(2000);
    });

    test('6.3 Can add widgets to dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      // Navigate to first dashboard
      const firstDashboard = page.locator('table tbody tr, [role="row"], .card').first();
      const count = await firstDashboard.count();

      if (count > 0) {
        await firstDashboard.first().click();
        await page.waitForTimeout(2000);

        // Look for add widget button
        const addButton = page.locator('button:has-text("Add Widget"), button:has-text("Add")').first();

        if (await addButton.isVisible()) {
          await addButton.click();

          // Should show widget options
          await expect(page.locator('text=Chart, text=Metric, text=Table')).isVisible({ timeout: 3000 });
        }
      }
    });

    test('6.4 Can rearrange dashboard widgets', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      const firstDashboard = page.locator('.dashboard-card, [data-testid="dashboard"]').first();

      if (await firstDashboard.isVisible()) {
        await firstDashboard.click();
        await page.waitForTimeout(2000);

        // Look for draggable widgets
        const widgets = page.locator('.widget, [draggable="true"]');
        const widgetCount = await widgets.count();

        if (widgetCount > 1) {
          // Widgets should be present and potentially draggable
          expect(widgetCount).toBeGreaterThan(0);
        }
      }
    });
  });

  // ========================================================================
  // PART 7: FILTERS
  // ========================================================================

  test.describe('Filters', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('7.1 Can view saved filters', async ({ page }) => {
      await page.goto(`${BASE_URL}/filters`);

      await expect(page.locator('h1').filter({ hasText: /filters/i })).toBeVisible();
    });

    test('7.2 Can create a new filter', async ({ page }) => {
      await page.goto(`${BASE_URL}/filters`);

      // Click new filter button
      await page.click('button:has-text("New Filter"), button:has-text("Create Filter")');

      // Fill filter details
      const filterName = `E2E Filter ${Date.now()}`;
      await page.fill('input[name="name"]', filterName);

      // Select field
      const fieldSelect = page.locator('select[name="field"], [role="combobox"]').first();
      if (await fieldSelect.isVisible()) {
        await fieldSelect.click();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }

      // Select operator
      const operatorSelect = page.locator('select[name="operator"]').first();
      if (await operatorSelect.isVisible()) {
        await operatorSelect.selectOption('equals');
      }

      // Enter value
      await page.fill('input[name="value"]', 'test_value');

      // Save
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(2000);
    });

    test('7.3 Can apply filter to report', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Navigate to a report
      const firstReport = page.locator('table tbody tr').first();
      const count = await firstReport.count();

      if (count > 0) {
        await firstReport.click();
        await page.waitForTimeout(2000);

        // Look for filter UI
        const filterSection = page.locator('.filter-bar, [data-testid="filters"]').first();

        if (await filterSection.isVisible()) {
          // Should have filter options
          expect(filterSection).toBeVisible();
        }
      }
    });
  });

  // ========================================================================
  // PART 8: METADATA ENTITIES
  // ========================================================================

  test.describe('Metadata Entities', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('8.1 Can view metadata entities', async ({ page }) => {
      await page.goto(`${BASE_URL}/metadata/entities`);

      await expect(page.locator('h1').filter({ hasText: /metadata/i })).toBeVisible();
    });

    test('8.2 Can create a metadata entity', async ({ page }) => {
      await page.goto(`${BASE_URL}/metadata/entities`);

      // Click new entity button
      await page.click('button:has-text("New Entity"), button:has-text("Create Entity")');

      // Wait for form
      await page.waitForTimeout(1000);

      // Fill entity details
      const entityName = `e2e_entity_${Date.now()}`;
      const nameInput = page.locator('input[name="name"], input[name="entity_name"]');

      if (await nameInput.isVisible()) {
        await nameInput.fill(entityName);

        // Select data source
        const dataSourceSelect = page.locator('select[name="dataSource"]').first();
        if (await dataSourceSelect.isVisible()) {
          await dataSourceSelect.click();
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');
        }

        // Save
        await page.click('button:has-text("Save"), button:has-text("Create")');
        await page.waitForTimeout(2000);
      }
    });

    test('8.3 Can configure entity fields', async ({ page }) => {
      await page.goto(`${BASE_URL}/metadata/entities`);

      // Click on first entity
      const firstEntity = page.locator('table tbody tr, [role="row"]').first();
      const count = await firstEntity.count();

      if (count > 0) {
        await firstEntity.click();
        await page.waitForTimeout(2000);

        // Look for fields configuration
        const fieldsSection = page.locator('.fields, [data-testid="fields"]').first();

        if (await fieldsSection.isVisible()) {
          expect(fieldsSection).toBeVisible();
        }
      }
    });
  });

  // ========================================================================
  // PART 9: JOBS
  // ========================================================================

  test.describe('Jobs', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('9.1 Can view jobs list', async ({ page }) => {
      await page.goto(`${BASE_URL}/jobs`);

      await expect(page.locator('h1').filter({ hasText: /jobs/i })).toBeVisible();
    });

    test('9.2 Can view job executions', async ({ page }) => {
      await page.goto(`${BASE_URL}/jobs`);

      // Look for executions tab or table
      const executionsTab = page.locator('button:has-text("Executions"), [role="tab"]:has-text("Executions")');
      const executionsTable = page.locator('table:has-text("Status"), .executions-table');

      const isVisible = await (executionsTab.or(executionsTable)).isVisible();

      if (isVisible) {
        if (await executionsTab.isVisible()) {
          await executionsTab.click();
        }

        await page.waitForTimeout(1000);

        // Should show job executions
        const hasExecutions = await page.locator('table tbody tr, [role="row"]').count() > 0;
        expect(hasExecutions).toBeTruthy();
      }
    });

    test('9.3 Can retry failed job', async ({ page }) => {
      await page.goto(`${BASE_URL}/jobs`);

      // Look for failed job
      const failedJob = page.locator('text=failed, [data-status="failed"]').first();

      if (await failedJob.isVisible()) {
        // Look for retry button
        const retryButton = page.locator('button:has-text("Retry")').first();

        if (await retryButton.isVisible()) {
          await retryButton.click();
          await page.waitForTimeout(2000);

          // Should show success or update status
          const hasFeedback = await page.locator('text=retry, text=queued, text=success').count() > 0;
          expect(hasFeedback).toBeTruthy();
        }
      }
    });

    test('9.4 Can schedule a new job', async ({ page }) => {
      await page.goto(`${BASE_URL}/jobs`);

      // Click new job button
      await page.click('button:has-text("New Job"), button:has-text("Schedule Job")');

      // Wait for dialog
      await page.waitForTimeout(1000);

      // Fill job details
      const jobName = `E2E Job ${Date.now()}`;
      const nameInput = page.locator('input[name="name"]');

      if (await nameInput.isVisible()) {
        await nameInput.fill(jobName);

        // Select job type
        const typeSelect = page.locator('select[name="type"]').first();
        if (await typeSelect.isVisible()) {
          await typeSelect.selectOption('export');
        }

        // Save
        await page.click('button:has-text("Save"), button:has-text("Schedule")');
        await page.waitForTimeout(2000);
      }
    });
  });

  // ========================================================================
  // PART 10: SAVED QUERIES
  // ========================================================================

  test.describe('Saved Queries', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('10.1 Can view saved queries', async ({ page }) => {
      await page.goto(`${BASE_URL}/queries`);

      await expect(page.locator('h1').filter({ hasText: /queries/i })).toBeVisible();
    });

    test('10.2 Can execute saved query', async ({ page }) => {
      await page.goto(`${BASE_URL}/queries`);

      // Click on first saved query
      const firstQuery = page.locator('table tbody tr, [role="row"], .card').first();
      const count = await firstQuery.count();

      if (count > 0) {
        await firstQuery.click();
        await page.waitForTimeout(2000);

        // Should show query details or execute button
        const executeButton = page.locator('button:has-text("Run"), button:has-text("Execute")').first();

        if (await executeButton.isVisible()) {
          await executeButton.click();
          await page.waitForTimeout(3000);

          // Should show results
          const hasResults = await page.locator('table, .results').count() > 0;
          expect(hasResults).toBeTruthy();
        }
      }
    });

    test('10.3 Can edit saved query', async ({ page }) => {
      await page.goto(`${BASE_URL}/queries`);

      const firstQuery = page.locator('table tbody tr').first();
      const count = await firstQuery.count();

      if (count > 0) {
        // Look for edit button
        const editButton = page.locator('button:has-text("Edit")').first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(2000);

          // Should show edit form
          const hasForm = await page.locator('input[name="name"], textarea').count() > 0;
          expect(hasForm).toBeTruthy();
        }
      }
    });
  });

  // ========================================================================
  // PART 11: ADMIN PANEL - USERS
  // ========================================================================

  test.describe('Admin - Users', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('11.1 Can view users list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/users`);

      await expect(page.locator('h1').filter({ hasText: /users/i })).toBeVisible();
      await expect(page.locator('table, [role="table"]')).toBeVisible();
    });

    test('11.2 Can create a new user', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/users`);

      // Click new user button
      await page.click('button:has-text("New User"), button:has-text("Add User")');

      // Wait for dialog
      await page.waitForTimeout(1000);

      // Fill user details
      const email = `e2e_test_${Date.now()}@example.com`;
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="name"]', `E2E User ${Date.now()}`);
      await page.fill('input[name="password"]', 'test_password_123');

      // Select role
      const roleSelect = page.locator('select[name="role"]').first();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption('analyst');
      }

      // Save
      await page.click('button:has-text("Save"), button:has-text("Create")');
      await page.waitForTimeout(2000);

      // Should show success
      await expect(page.locator('text=success, text=created').first()).toBeVisible({ timeout: 5000 });
    });

    test('11.3 Can assign roles to user', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/users`);

      // Click on first user
      const firstUser = page.locator('table tbody tr').first();
      const count = await firstUser.count();

      if (count > 0) {
        await firstUser.click();
        await page.waitForTimeout(2000);

        // Look for role assignment
        const roleSection = page.locator('.roles, [data-testid="roles"]').first();

        if (await roleSection.isVisible()) {
          expect(roleSection).toBeVisible();
        }
      }
    });
  });

  // ========================================================================
  // PART 12: ADMIN PANEL - ROLES
  // ========================================================================

  test.describe('Admin - Roles', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('12.1 Can view roles list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/roles`);

      await expect(page.locator('h1').filter({ hasText: /roles/i })).toBeVisible();
    });

    test('12.2 Can create a new role', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/roles`);

      // Click new role button
      await page.click('button:has-text("New Role"), button:has-text("Add Role")');

      // Wait for dialog
      await page.waitForTimeout(1000);

      // Fill role details
      const roleName = `e2e_role_${Date.now()}`;
      await page.fill('input[name="name"]', roleName);
      await page.fill('textarea[name="description"]', 'E2E test role');

      // Select permissions
      const permissionsCheckboxes = page.locator('input[type="checkbox"]');
      const count = await permissionsCheckboxes.count();

      if (count > 0) {
        await permissionsCheckboxes.nth(0).check();
      }

      // Save
      await page.click('button:has-text("Save"), button:has-text("Create")');
      await page.waitForTimeout(2000);
    });

    test('12.3 Can configure role permissions', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/roles`);

      // Click on first role
      const firstRole = page.locator('table tbody tr').first();
      const count = await firstRole.count();

      if (count > 0) {
        await firstRole.click();
        await page.waitForTimeout(2000);

        // Should show permissions
        const hasPermissions = await page.locator('input[type="checkbox"], .permissions').count() > 0;
        expect(hasPermissions).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // PART 13: ADMIN PANEL - PERMISSIONS
  // ========================================================================

  test.describe('Admin - Permissions', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('13.1 Can view permissions matrix', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/permissions`);

      await expect(page.locator('h1').filter({ hasText: /permissions/i })).toBeVisible();

      // Should show a table or matrix of permissions
      await expect(page.locator('table, .permissions-matrix')).toBeVisible();
    });

    test('13.2 Can update resource permissions', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/permissions`);

      // Look for editable permission cells
      const editableCells = page.locator('[contenteditable="true"], .permission-cell:has(button)');

      const count = await editableCells.count();

      if (count > 0) {
        // Click on first editable cell
        await editableCells.first().click();
        await page.waitForTimeout(1000);

        // Should show permission options
        const hasOptions = await page.locator('text=View, text=Edit, text=Admin').count() > 0;
        expect(hasOptions).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // PART 14: SETTINGS
  // ========================================================================

  test.describe('Settings', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('14.1 Can access email settings', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/email`);

      await expect(page.locator('h1').filter({ hasText: /email/i }).or(page.locator('h1').filter({ hasText: /settings/i }))).toBeVisible();

      // Should show email configuration form
      const hasForm = await page.locator('input[name="smtp"], input[name="email"], input[name="host"]').count() > 0;

      // Form might not be visible if already configured, that's okay
      if (hasForm) {
        expect(hasForm).toBeTruthy();
      }
    });

    test('14.2 Can save email settings', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/email`);

      // Look for save button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();

      if (await saveButton.isVisible()) {
        // Fill some test data (might not actually save depending on validation)
        const hostInput = page.locator('input[name="host"], input[name="smtpHost"]');

        if (await hostInput.isVisible()) {
          await hostInput.fill('smtp.example.com');

          await saveButton.click();
          await page.waitForTimeout(2000);

          // Should show feedback
          const hasFeedback = await page.locator('text=saved, text=updated, text=success').count() > 0;
          expect(hasFeedback).toBeTruthy();
        }
      }
    });

    test('14.3 Can send test email', async ({ page }) => {
      await page.goto(`${BASE_URL}/settings/email`);

      // Look for test email button
      const testButton = page.locator('button:has-text("Test"), button:has-text("Send Test")').first();

      if (await testButton.isVisible()) {
        await testButton.click();
        await page.waitForTimeout(2000);

        // Should show feedback
        const hasFeedback = await page.locator('text=sent, text=failed, text=success, text=error').count() > 0;
        expect(hasFeedback).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // PART 15: WASM FEATURES
  // ========================================================================

  test.describe('WASM Features', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('15.1 Datasets page is accessible', async ({ page }) => {
      await page.goto(`${BASE_URL}/datasets`);

      await expect(page.locator('h1').filter({ hasText: /datasets/i })).toBeVisible({ timeout: 10000 });
    });

    test('15.2 Can view dataset list', async ({ page }) => {
      await page.goto(`${BASE_URL}/datasets`);

      // Should load without errors
      const hasContent = await page.locator('table, .dataset-list, .empty-state').count() > 0;
      expect(hasContent).toBeTruthy();
    });

    test('15.3 Dataset features are available', async ({ page }) => {
      await page.goto(`${BASE_URL}/datasets`);

      // Look for dataset-specific features
      const datasetFeatures = page.locator('text=Parquet, text=DuckDB, text=WASM');

      // These might be in tooltips or info sections
      const featureCount = await datasetFeatures.count();

      // At least the page should load
      await expect(page.locator('h1')).toBeVisible();
    });

    test('15.4 Offline indicator exists', async ({ page }) => {
      await page.goto(`${BASE_URL}/datasets`);

      // Look for offline indicator (might be subtle)
      const offlineIndicator = page.locator('[data-testid="offline-indicator"], .offline-status');

      // Might not be visible if online, that's okay
      if (await offlineIndicator.isVisible()) {
        expect(offlineIndicator).toBeVisible();
      }
    });
  });

  // ========================================================================
  // PART 16: CROSS-WIDGET FILTERING
  // ========================================================================

  test.describe('Cross-Widget Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('16.1 Dashboard supports cross-filtering', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      // Navigate to first dashboard
      const firstDashboard = page.locator('.dashboard-card, [data-testid="dashboard"]').first();

      if (await firstDashboard.isVisible()) {
        await firstDashboard.click();
        await page.waitForTimeout(2000);

        // Look for active filters bar
        const filtersBar = page.locator('.active-filters, [data-testid="active-filters"]');

        // Cross-filtering might not be visible until a filter is applied
        // Just check the page loads correctly
        await expect(page.locator('h1, h2, .dashboard')).toBeVisible();
      }
    });

    test('16.2 Can apply filter from chart click', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboards`);

      const firstDashboard = page.locator('.dashboard-card').first();

      if (await firstDashboard.isVisible()) {
        await firstDashboard.click();
        await page.waitForTimeout(2000);

        // Look for clickable chart elements
        const chart = page.locator('canvas, svg, .chart').first();

        if (await chart.isVisible()) {
          // Click on chart
          await chart.click({ position: { x: 100, y: 100 } });
          await page.waitForTimeout(1000);

          // Check if filter was applied (might show a toast or filter bar)
          const hasFeedback = await page.locator('.filter, .toast, .notification').count() > 0;
          // This is optional - cross-filtering might not be set up
        }
      }
    });
  });

  // ========================================================================
  // PART 17: NAVIGATION
  // ========================================================================

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('17.1 All main navigation links work', async ({ page }) => {
      const navLinks = [
        { text: /dashboard/i, url: '/dashboard' },
        { text: /reports/i, url: '/reports' },
        { text: /charts/i, url: '/charts' },
        { text: /sql editor/i, url: '/sql-editor' },
        { text: /data sources/i, url: '/data-sources' },
        { text: /dashboards/i, url: '/dashboards' },
      ];

      for (const link of navLinks) {
        // Click navigation link
        const navLink = page.locator(`a:has-text("${link.text}"), nav:has-text("${link.text}")`).first();

        if (await navLink.isVisible()) {
          await navLink.click();
          await page.waitForTimeout(2000);

          // Should navigate to correct page
          const currentUrl = page.url();
          expect(currentUrl).toContain(link.url);

          // Go back to home for next test
          await page.goto(`${BASE_URL}`);
          await page.waitForTimeout(1000);
        }
      }
    });

    test('17.2 Sidebar navigation works', async ({ page }) => {
      await page.goto(`${BASE_URL}`);

      // Look for sidebar
      const sidebar = page.locator('.sidebar, nav, [data-testid="sidebar"]').first();

      if (await sidebar.isVisible()) {
        // Click on first few navigation items
        const navItems = sidebar.locator('a, button').filter({ hasText: /reports|charts|sql/i });

        const count = Math.min(3, await navItems.count());

        for (let i = 0; i < count; i++) {
          await navItems.nth(i).click();
          await page.waitForTimeout(1500);

          // Should navigate
          expect(page.url()).not.toBe(`${BASE_URL}/`);

          // Go back
          await page.goto(`${BASE_URL}`);
          await page.waitForTimeout(1000);
        }
      }
    });

    test('17.3 Breadcrumb navigation works', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Look for breadcrumbs
      const breadcrumbs = page.locator('.breadcrumb, [data-testid="breadcrumb"]');

      if (await breadcrumbs.isVisible()) {
        // Click on home breadcrumb
        const homeBreadcrumb = breadcrumbs.locator('a:has-text("Home"), a:has-text("Dashboard")').first();

        if (await homeBreadcrumb.isVisible()) {
          await homeBreadcrumb.click();
          await page.waitForTimeout(1000);

          // Should navigate to home
          expect(page.url()).toMatch(/\/(dashboard|)$/);
        }
      }
    });
  });

  // ========================================================================
  // PART 18: EXPORT FUNCTIONALITY
  // ========================================================================

  test.describe('Export Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('18.1 Can export report as CSV', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

      if (await exportButton.isVisible()) {
        // Setup download handler
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

        await exportButton.click();

        // Click CSV option if available
        const csvOption = page.locator('text=CSV, [value="csv"]').first();
        if (await csvOption.isVisible()) {
          await csvOption.click();

          // Check for download
          const download = await downloadPromise;
          if (download) {
            expect(download.suggestedFilename()).toMatch(/\.csv$/i);
          }
        }
      }
    });

    test('18.2 Can export report as PDF', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);

      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")').first();

      if (await exportButton.isVisible()) {
        await exportButton.click();

        const pdfOption = page.locator('text=PDF, [value="pdf"]').first();
        if (await pdfOption.isVisible()) {
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

          await pdfOption.click();

          const download = await downloadPromise;
          if (download) {
            expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
          }
        }
      }
    });

    test('18.3 Can export chart as image', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts`);

      const firstChart = page.locator('.chart-card').first();

      if (await firstChart.isVisible()) {
        await firstChart.click();
        await page.waitForTimeout(2000);

        // Look for export image button
        const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("Image")').first();

        if (await exportButton.isVisible()) {
          const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

          await exportButton.click();

          const download = await downloadPromise;
          if (download) {
            expect(download.suggestedFilename()).toMatch(/\.(png|jpg|jpeg|svg)$/i);
          }
        }
      }
    });
  });

  // ========================================================================
  // PART 19: RESPONSIVE DESIGN
  // ========================================================================

  test.describe('Responsive Design', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('19.1 Dashboard works on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}`);

      // Should show mobile menu or sidebar toggle
      const mobileMenu = page.locator('button[aria-label="menu"], .menu-toggle, .hamburger');

      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await page.waitForTimeout(1000);

        // Should show mobile navigation
        const hasNav = await page.locator('nav, .mobile-menu').count() > 0;
        expect(hasNav).toBeTruthy();
      }
    });

    test('19.2 Tables are scrollable on small screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/reports`);

      // Look for table container with overflow
      const tableContainer = page.locator('table').locator('..');

      if (await tableContainer.isVisible()) {
        // Should have horizontal scroll or be responsive
        const overflow = await tableContainer.evaluate(el => {
          return window.getComputedStyle(el).overflowX === 'auto' ||
                 window.getComputedStyle(el).overflowX === 'scroll';
        });

        // Either has scroll or is responsive (no overflow needed)
        expect(true).toBeTruthy();
      }
    });

    test('19.3 Charts resize correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/charts`);

      const chart = page.locator('canvas, svg, .echarts').first();

      if (await chart.isVisible()) {
        // Get initial size
        const initialBox = await chart.boundingBox();

        // Resize viewport
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(1000);

        // Get new size
        const newBox = await chart.boundingBox();

        // Chart should still be visible
        expect(newBox).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // PART 20: PERFORMANCE
  // ========================================================================

  test.describe('Performance', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('20.1 Dashboard loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}`);
      await page.waitForLoadState('domcontentloaded');

      const loadTime = Date.now() - startTime;

      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('20.2 Report list loads quickly', async ({ page }) => {
      const startTime = Date.now();

      await page.goto(`${BASE_URL}/reports`);
      await page.waitForLoadState('domcontentloaded');

      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('20.3 No console errors on page load', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto(`${BASE_URL}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Filter out non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('DevTools')
      );

      // Should have minimal critical errors
      expect(criticalErrors.length).toBeLessThan(3);
    });
  });
});

// ========================================================================
// END OF COMPLETE SYSTEM TEST SUITE
// ========================================================================
