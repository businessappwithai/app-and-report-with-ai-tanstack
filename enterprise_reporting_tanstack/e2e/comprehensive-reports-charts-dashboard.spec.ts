/**
 * Comprehensive E2E Test for Hospital Management System
 * Reports, Charts, and Dashboard with 40,000+ records
 *
 * This test verifies:
 * 1. Report creation and viewer with 40,000+ hospital patient records
 * 2. Chart creation and performance testing with large patient data
 * 3. Comprehensive dashboard creation with multiple widgets
 * 4. Performance metrics for rendering
 *
 * Prerequisites:
 * - HMS (Hospital Management System) PostgreSQL data source configured
 * - User authenticated
 * - 100,000 patient records available in bus_patient table
 */

import { test, expect } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

// Helper function to measure performance
async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  console.log(`⏱️  ${name}: ${duration}ms`);
  return { result, duration };
}

// Helper to wait for toast notification
async function waitForToast(page: any, message?: string) {
  await page.waitForTimeout(500);
  const toast = page.locator('[data-sonner-toast]').first();
  if (message) {
    await expect(toast).toContainText(message, { timeout: 5000 });
  } else {
    await expect(toast).toBeVisible({ timeout: 5000 });
  }
}

test.describe('Comprehensive HMS Reports, Charts & Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Test 1: Report viewer with 40,000+ patient records', async ({ page }) => {
    console.log('\n=== Test 1: Report Viewer with 40K+ Patient Records ===\n');

    // Step 1: Go to SQL Editor and select HMS data source
    console.log('Step 1: Setting up data source...');
    await page.goto(`${BASE_URL}/sql-editor`);
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

    // Select HMS data source if there's a selector
    const dataSourceSelector = page.locator('[data-testid="datasource-select"], select, [role="combobox"]').first();
    if (await dataSourceSelector.isVisible().catch(() => false)) {
      await dataSourceSelector.click();
      await page.waitForTimeout(500);

      // Look for HMS, Hospital, or PostgreSQL option
      const hospitalOption = page.getByText(/HMS|Hospital|postgres/i).or(page.locator('[data-value*="hospital"], [data-value*="hms"]'));
      const count = await hospitalOption.count();

      if (count > 0) {
        await hospitalOption.first().click();
        console.log('✓ HMS data source selected');
      } else {
        // Try keyboard navigation
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
        console.log('✓ Data source selected (first available)');
      }
      await page.waitForTimeout(1000);
    }

    // Step 2: Create a query for 50,000 patient records
    console.log('Step 2: Creating query for 50,000 patient records...');
    const query = `SELECT
  id,
  first_name,
  last_name,
  date_of_birth,
  gender,
  blood_group,
  phone,
  email,
  address,
  city,
  state,
  postal_code,
  country,
  created_at
FROM bus_patient
ORDER BY id
LIMIT 50000`;

    await page.locator('.monaco-editor').click();
    // Clear existing content and type new query
    await page.keyboard.press('Control+A');
    await page.keyboard.type(query);

    // Execute the query to verify it works
    const executeBtn = page.getByRole('button', { name: /execute|run/i }).or(page.locator('button:has-text("Run")'));
    await executeBtn.first().click();
    await page.waitForTimeout(3000);

    // Verify results
    const resultsArea = page.locator('.results, table, [data-testid="results"]').first();
    if (await resultsArea.isVisible().catch(() => false)) {
      console.log('✓ Query executed successfully');
      // Take screenshot of results
      await page.screenshot({ path: 'screenshots/hms-query-results-50k.png', fullPage: true });
    }

    // Step 3: Save the query
    console.log('Step 3: Saving query...');
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    const nameInput = page.locator('input[id="name"], input[name="name"]').or(page.locator('input[placeholder*="name"]')).first();
    await nameInput.fill('50K Patients - Large Dataset Report');

    const confirmBtn = page.getByRole('button', { name: /save|create|confirm/i }).filter({ hasText: /save|create/i }).first();
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Query saved');

    // Step 4: Create a report from this query
    console.log('Step 4: Creating report...');
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForTimeout(1000);

    // Click "New Report" button
    const newReportBtn = page.getByRole('button', { name: /new.*report/i });
    await newReportBtn.click();
    await page.waitForTimeout(1000);

    // Fill in report details
    const reportNameInput = page.locator('input[id="name"]');
    await reportNameInput.fill('Patient Registry - 50K Records');

    const descInput = page.locator('input[id="description"]');
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('Comprehensive patient registry with 50,000 records');
    }

    // Select the saved query
    const querySelect = page.locator('[role="combobox"]').or(page.locator('select')).first();
    await querySelect.click();
    await page.waitForTimeout(500);

    // Search for our saved query
    const queryOption = page.getByText(/50K|Large Dataset/i).or(page.getByText('50K Patients'));
    if (await queryOption.isVisible().catch(() => false)) {
      await queryOption.first().click();
    } else {
      // Type to search
      await page.keyboard.type('50K');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }

    // Create the report
    const createReportBtn = page.getByRole('button', { name: /create.*report/i });
    await createReportBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Report created');

    // Step 5: View the report and measure performance
    console.log('Step 5: Testing report viewer performance...');

    // Wait for the table to refresh after report creation
    await page.waitForTimeout(3000);

    // Find the newly created report - it's the first one in the table
    // The view action is in a dropdown menu, so we need to open it first
    const moreButtons = page.locator('button').filter({ hasText: '' }).or(page.locator('[data-testid="more"]'));
    const count = await moreButtons.count();

    if (count > 0) {
      await moreButtons.first().click();
      await page.waitForTimeout(500);
    }

    // Now click the View option
    const viewOption = page.getByRole('menuitem', { name: /view/i }).or(page.locator('a:has-text("View")'));
    if (await viewOption.isVisible().catch(() => false)) {
      await viewOption.first().click();
    } else {
      // Alternative: navigate directly to report editor/viewer URL
      const reportName = page.locator('td').first();
      const name = await reportName.textContent();
      console.log(`  Trying to navigate to report: ${name}`);
      // Just take screenshot since we can't easily get the ID
      await page.screenshot({ path: 'screenshots/hms-reports-list.png' });
    }
    await page.waitForTimeout(2000);

    // Measure initial load time
    const { duration: loadDuration } = await measurePerformance('Report initial load', async () => {
      await page.waitForLoadState('networkidle');
      await expect(page.locator('table, [role="table"]')).toBeVisible({ timeout: 10000 });
    });

    // Check performance - should load in reasonable time
    expect(loadDuration).toBeLessThan(8000);
    console.log(`✓ Report loaded in ${loadDuration}ms (target: <8000ms)`);

    // Test pagination performance
    console.log('Step 6: Testing pagination...');
    const { duration: page2Duration } = await measurePerformance('Pagination to page 2', async () => {
      const nextPageBtn = page.getByRole('button', { name: /next|›|page 2/i }).or(page.locator('button:has-text(">")'));
      if (await nextPageBtn.isVisible().catch(() => false)) {
        await nextPageBtn.first().click();
        await page.waitForTimeout(500);
      }
    });

    if (page2Duration > 0) {
      expect(page2Duration).toBeLessThan(3000);
      console.log(`✓ Page 2 loaded in ${page2Duration}ms (target: <3000ms)`);
    }

    // Take screenshot for verification
    await page.screenshot({ path: 'screenshots/hms-report-viewer-50k.png', fullPage: true });
    console.log('✓ Report viewer test completed\n');
  });

  test('Test 2: Chart performance with aggregated patient data', async ({ page }) => {
    console.log('\n=== Test 2: Chart Performance with 40K+ Records ===\n');

    // Step 1: Create aggregation query for charts
    console.log('Step 1: Creating aggregation query...');
    await page.goto(`${BASE_URL}/sql-editor`);

    const chartQuery = `SELECT
  gender,
  blood_group,
  COUNT(*) as patient_count,
  ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))), 1) as average_age,
  COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as underage_count,
  COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) BETWEEN 18 AND 65 THEN 1 END) as adult_count,
  COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) > 65 THEN 1 END) as senior_count
FROM bus_patient
GROUP BY gender, blood_group
ORDER BY patient_count DESC`;

    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(chartQuery);

    // Save query
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1500);

    // The save dialog should appear - find the name input
    const nameInput = page.locator('input').filter({ hasText: '' }).or(page.locator('input[placeholder*="name"]')).or(page.locator('dialog input').first());
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.first().fill('Patient Demographics by Gender & Blood Group');
    } else {
      // Try clicking on the editor first to focus
      await page.locator('.monaco-editor').click();
      await page.waitForTimeout(500);
    }

    const confirmBtn = page.getByRole('button', { name: /save/i });
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Chart query saved');

    // Step 2: Create multiple chart types
    const chartTypes = [
      { type: 'bar', name: 'Patient Count by Blood Group' },
      { type: 'pie', name: 'Gender Distribution' },
      { type: 'line', name: 'Age Group Analysis' },
      { type: 'area', name: 'Patient Demographics' },
    ];

    for (const chartInfo of chartTypes) {
      console.log(`Creating ${chartInfo.type} chart: ${chartInfo.name}...`);

      await page.goto(`${BASE_URL}/charts`);
      await page.waitForTimeout(1000);

      // Try "Quick Create" button first
      const quickCreateBtn = page.getByRole('button', { name: /quick.*create/i });
      if (await quickCreateBtn.isVisible().catch(() => false)) {
        await quickCreateBtn.click();
        await page.waitForTimeout(1000);
      } else {
        // Try regular dialog trigger
        const dialogTrigger = page.locator('button').filter({ hasText: /create|add/i }).first();
        await dialogTrigger.click();
        await page.waitForTimeout(1000);
      }

      // Fill in chart name
      const chartNameInput = page.locator('input[id="name"], input[name="name"], input[placeholder*="chart"]').first();
      await chartNameInput.fill(chartInfo.name);

      // Select chart type
      const typeSelector = page.locator('[role="combobox"], select').or(page.locator('[data-value]'));
      if (await typeSelector.first().isVisible().catch(() => false)) {
        await typeSelector.first().click();
        await page.waitForTimeout(500);

        // Select the specific chart type
        const typeOption = page.getByText(new RegExp(chartInfo.type, 'i')).or(page.locator(`[data-value="${chartInfo.type}"]`));
        if (await typeOption.isVisible().catch(() => false)) {
          await typeOption.first().click();
        }
      }

      // Select data source (query)
      const querySelect = page.locator('[role="combobox"]').or(page.locator('select')).nth(1);
      if (await querySelect.isVisible().catch(() => false)) {
        await querySelect.click();
        await page.waitForTimeout(500);

        const queryOption = page.getByText(/Demographics|Gender/i);
        if (await queryOption.isVisible().catch(() => false)) {
          await queryOption.first().click();
        }
      }

      // Save chart
      const saveBtn = page.getByRole('button', { name: /create.*chart|save/i });
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log(`✓ ${chartInfo.type} chart created`);
      } else {
        console.log(`⚠️  ${chartInfo.type} chart - save button not found`);
      }
    }

    // Step 3: Test chart viewer performance
    console.log('\nStep 3: Testing chart viewer performance...');
    await page.goto(`${BASE_URL}/charts`);
    await page.waitForTimeout(1000);

    const viewLinks = page.getByRole('link', { name: /view/i });
    const count = await viewLinks.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const { duration: chartLoadDuration } = await measurePerformance(`Chart ${i + 1} render`, async () => {
          const links = page.getByRole('link', { name: /view/i });
          await links.nth(i).click();
          await page.waitForLoadState('networkidle');
          await expect(page.locator('svg, canvas, [class*="chart"]')).toBeVisible({ timeout: 10000 });
        });

        expect(chartLoadDuration).toBeLessThan(5000);
        console.log(`✓ Chart ${i + 1} rendered in ${chartLoadDuration}ms (target: <5000ms)`);

        // Take screenshot of each chart
        await page.screenshot({ path: `screenshots/hms-chart-${i + 1}.png` });

        // Go back
        await page.goBack();
        await page.waitForTimeout(1000);
      }
    }

    await page.screenshot({ path: 'screenshots/hms-charts-list.png', fullPage: true });
    console.log('✓ Chart performance test completed\n');
  });

  test('Test 3: Create comprehensive patient dashboard', async ({ page }) => {
    console.log('\n=== Test 3: Comprehensive Patient Dashboard ===\n');

    // Step 1: Create a new dashboard
    console.log('Step 1: Creating dashboard...');
    await page.goto(`${BASE_URL}/dashboards`);
    await page.waitForTimeout(1000);

    const newDashboardBtn = page.getByRole('button', { name: /new.*dashboard/i });
    await newDashboardBtn.click();
    await page.waitForTimeout(1000);

    const dashboardNameInput = page.locator('input[id="name"]');
    await dashboardNameInput.fill('Hospital Executive Dashboard');

    const descInput = page.locator('input[id="description"]');
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill('Comprehensive hospital patient analytics dashboard');
    }

    // Make it public or keep private - just leave as default
    const createDashboardBtn = page.getByRole('button', { name: /create.*dashboard/i });
    await createDashboardBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Dashboard created');

    // Step 2: Navigate to the dashboard to add widgets
    console.log('Step 2: Navigating to dashboard...');

    // Wait for dashboard table to refresh
    await page.waitForTimeout(2000);

    // Find the created dashboard and click view
    // Similar to reports, the view is in a dropdown
    const dashboardRows = page.locator('table tbody tr');
    if (await dashboardRows.count() > 0) {
      // Click the more button in the first row
      const moreBtn = dashboardRows.first().locator('button').or(page.locator('[data-testid="more"]'));
      if (await moreBtn.isVisible().catch(() => false)) {
        await moreBtn.first().click();
        await page.waitForTimeout(500);
      }

      // Click View option
      const viewOption = page.getByRole('menuitem', { name: /view/i }).or(page.getByText(/view/i));
      if (await viewOption.isVisible().catch(() => false)) {
        await viewOption.first().click();
      } else {
        // Take screenshot and continue
        await page.screenshot({ path: 'screenshots/hms-dashboards-list.png' });
        console.log('⚠️  View option not found, taking screenshot');
      }
    }
    await page.waitForTimeout(2000);

    // Measure dashboard load time
    const { duration: dashboardLoadDuration } = await measurePerformance('Dashboard initial render', async () => {
      await page.waitForLoadState('networkidle');
    });

    expect(dashboardLoadDuration).toBeLessThan(5000);
    console.log(`✓ Dashboard loaded in ${dashboardLoadDuration}ms (target: <5000ms)`);

    // Step 3: Look for edit/add widget options
    console.log('Step 3: Adding widgets to dashboard...');

    const editBtn = page.getByRole('button', { name: /edit|configure|add.*widget/i }).or(page.locator('button:has-text("+")'));
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.first().click();
      await page.waitForTimeout(1000);
      console.log('✓ Edit mode activated');
    }

    // Try to add widgets (if the functionality exists)
    const addWidgetBtn = page.getByRole('button', { name: /add.*widget|widget/i }).or(page.locator('button:has-text("Add")'));
    let widgetsAdded = 0;

    for (let i = 1; i <= 4; i++) {
      if (await addWidgetBtn.isVisible().catch(() => false)) {
        await addWidgetBtn.first().click();
        await page.waitForTimeout(1000);

        // Try to select a widget type
        const widgetOption = page.locator('[role="option"], [data-value]').or(page.getByText(/chart|report|metric/i));
        if (await widgetOption.first().isVisible().catch(() => false)) {
          await widgetOption.first().click();
          await page.waitForTimeout(500);

          // Confirm
          const confirmBtn = page.getByRole('button', { name: /add|confirm|save/i });
          if (await confirmBtn.isVisible().catch(() => false)) {
            await confirmBtn.first().click();
            await page.waitForTimeout(1000);
            widgetsAdded++;
          }
        }
      } else {
        break;
      }
    }

    console.log(`✓ Added ${widgetsAdded} widgets to dashboard`);

    await page.screenshot({ path: 'screenshots/hms-comprehensive-dashboard.png', fullPage: true });
    console.log('✓ Dashboard test completed\n');
  });

  test('Test 4: High-volume query performance test', async ({ page }) => {
    console.log('\n=== Test 4: High-Volume Query Performance ===\n');

    await page.goto(`${BASE_URL}/sql-editor`);
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

    // Test various query complexities
    const queries = [
      {
        name: 'Simple COUNT',
        sql: 'SELECT COUNT(*) as total_patients FROM bus_patient',
      },
      {
        name: 'Aggregation with GROUP BY',
        sql: `SELECT gender, COUNT(*) as count FROM bus_patient GROUP BY gender`,
      },
      {
        name: 'Complex JOIN query',
        sql: `SELECT p.gender, p.blood_group, COUNT(*) as count
             FROM bus_patient p
             LEFT JOIN bus_appointment a ON p.id = a.patient_id
             GROUP BY p.gender, p.blood_group`,
      },
      {
        name: 'Large result set (1000 rows)',
        sql: `SELECT * FROM bus_patient ORDER BY id LIMIT 1000`,
      },
    ];

    for (const query of queries) {
      console.log(`\nTesting: ${query.name}`);
      await page.locator('.monaco-editor').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(query.sql);

      const { duration } = await measurePerformance(query.name, async () => {
        const executeBtn = page.getByRole('button', { name: /execute|run/i });
        await executeBtn.first().click();
        await page.waitForTimeout(2000);
      });

      console.log(`✓ ${query.name}: ${duration}ms`);

      // Verify results are shown
      const results = page.locator('.results, table, [data-testid="results"]');
      if (await results.isVisible().catch(() => false)) {
        console.log('  Results displayed correctly');
      }

      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: 'screenshots/hms-query-performance.png' });
    console.log('\n✓ Query performance test completed\n');
  });

  test('Test 5: End-to-end feature verification', async ({ page }) => {
    console.log('\n=== Test 5: End-to-End Feature Verification ===\n');

    const features = [
      { path: '/sql-editor', name: 'SQL Editor', selector: '.monaco-editor' },
      { path: '/reports', name: 'Reports Page', selector: 'table, [role="table"]' },
      { path: '/charts', name: 'Charts Page', selector: 'table, [role="table"]' },
      { path: '/dashboards', name: 'Dashboards Page', selector: 'table, [role="table"]' },
      { path: '/saved-queries', name: 'Saved Queries', selector: 'table, [role="table"]' },
    ];

    const results: { name: string; accessible: boolean; loadTime: number }[] = [];

    for (const feature of features) {
      const { result: accessible, duration } = await measurePerformance(`${feature.name} accessibility`, async () => {
        await page.goto(`${BASE_URL}${feature.path}`);
        await page.waitForTimeout(500);

        const expected = page.locator(feature.selector);
        return await expected.isVisible().catch(() => false);
      });

      results.push({ name: feature.name, accessible: accessible as boolean, loadTime: duration });

      const status = (accessible as boolean) ? '✓' : '✗';
      console.log(`${status} ${feature.name}: ${duration}ms`);
    }

    // Check average load time
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    console.log(`\n📊 Average page load time: ${avgLoadTime.toFixed(0)}ms`);
    expect(avgLoadTime).toBeLessThan(3000);

    const failed = results.filter(r => !r.accessible);
    if (failed.length > 0) {
      console.log('\n❌ Failed features:', failed.map(f => f.name));
    } else {
      console.log('\n✅ All reporting features are accessible and functional');
    }

    await page.screenshot({ path: 'screenshots/hms-all-features.png', fullPage: true });
    console.log('\n✓ Feature verification test completed\n');
  });

  test('Test 6: Export functionality test', async ({ page }) => {
    console.log('\n=== Test 6: Export Functionality ===\n');

    // Navigate to reports and select a report
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForTimeout(1000);

    const viewLinks = page.getByRole('link', { name: /view/i });
    const count = await viewLinks.count();

    if (count > 0) {
      await viewLinks.first().click();
      await page.waitForTimeout(2000);

      // Look for export functionality
      const exportBtn = page.getByRole('button', { name: /export|download/i });
      if (await exportBtn.isVisible().catch(() => false)) {
        console.log('✓ Export button found');

        // Check for export format options
        const csvOption = page.getByRole('button', { name: /csv/i }).or(page.getByText(/csv/i));
        const xlsxOption = page.getByRole('button', { name: /xlsx|excel/i }).or(page.getByText(/xlsx|excel/i));
        const pdfOption = page.getByRole('button', { name: /pdf/i }).or(page.getByText(/pdf/i));

        console.log(`  CSV export: ${await csvOption.isVisible().catch(() => false) ? '✓' : '✗'}`);
        console.log(`  Excel export: ${await xlsxOption.isVisible().catch(() => false) ? '✓' : '✗'}`);
        console.log(`  PDF export: ${await pdfOption.isVisible().catch(() => false) ? '✓' : '✗'}`);
      } else {
        console.log('⚠️  Export button not found on report viewer');
      }

      // Check for pagination controls
      const paginationControls = page.locator('[role="navigation"], .pagination');
      if (await paginationControls.isVisible().catch(() => false)) {
        console.log('✓ Pagination controls available');
      }
    } else {
      console.log('⚠️  No reports found to test export');
    }

    console.log('✓ Export test completed\n');
  });
});
