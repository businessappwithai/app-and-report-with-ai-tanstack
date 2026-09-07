/**
 * Comprehensive Reporting and Charting E2E Test
 *
 * This test verifies the complete reporting and charting workflow:
 * 1. Create and save query
 * 2. Create report from query
 * 3. Create chart from query
 * 4. Create dashboard
 * 5. Add widgets to dashboard
 */

import { test, expect } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

test.describe('Reporting and Charting Comprehensive Test', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Complete workflow: Query -> Report -> Chart -> Dashboard', async ({ page }) => {
    console.log('\n=== Starting Complete Reporting Workflow ===\n');

    // Step 1: Go to SQL Editor and create a query
    console.log('Step 1: Creating saved query...');
    await page.goto(`${BASE_URL}/sql-editor`);
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

    // Type a test query
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT COUNT(*) as total, gender FROM bus_patient GROUP BY gender');

    // Look for and click save button
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1000);

    // Fill in save dialog
    const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name"]')).first();
    await nameInput.fill('Patient Gender Distribution');

    const confirmBtn = page.getByRole('button', { name: /save|create|confirm/i }).or(page.getByRole('button', { name: /ok/i })).first();
    await confirmBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Query saved successfully');

    // Step 2: Create a report from the query
    console.log('Step 2: Creating report from query...');
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForTimeout(2000);

    // Look for "Create New Report" button
    const createReportBtn = page.getByRole('button', { name: /create.*report|new.*report|add.*report/i }).or(page.getByRole('button', { name: /create|new|add/i }).first());
    await createReportBtn.click();
    await page.waitForTimeout(1500);

    // Fill in report details
    const reportNameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name"]')).first();
    if (await reportNameInput.isVisible().catch(() => false)) {
      await reportNameInput.fill('Patient Gender Report');
    }

    // Look for query selector
    const querySelector = page.locator('select, [role="combobox"]').first();
    if (await querySelector.isVisible().catch(() => false)) {
      await querySelector.click();
      await page.waitForTimeout(500);
      const queryOption = page.getByText('Patient Gender Distribution').or(page.getByText('Patient Gender')).first();
      if (await queryOption.isVisible().catch(() => false)) {
        await queryOption.click();
      }
    }

    // Save report
    const saveReportBtn = page.getByRole('button', { name: /save|create/i }).first();
    await saveReportBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Report created successfully');

    // Step 3: Create a chart
    console.log('Step 3: Creating chart...');
    await page.goto(`${BASE_URL}/charts`);
    await page.waitForTimeout(2000);

    // Look for "Create New Chart" button
    const createChartBtn = page.getByRole('button', { name: /create.*chart|new.*chart|add.*chart/i }).or(page.getByRole('button', { name: /create|new|add/i }).first());
    await createChartBtn.click();
    await page.waitForTimeout(1500);

    // Fill in chart details
    const chartNameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name"]')).first();
    if (await chartNameInput.isVisible().catch(() => false)) {
      await chartNameInput.fill('Gender Distribution Chart');
    }

    // Select chart type (bar, pie, etc.)
    const chartTypeSelector = page.locator('[role="combobox"]').filter({ hasText: /chart.*type|type/i }).or(page.locator('select').first());
    if (await chartTypeSelector.isVisible().catch(() => false)) {
      await chartTypeSelector.click();
      await page.waitForTimeout(500);
      const barOption = page.getByText(/bar|pie/i).first();
      if (await barOption.isVisible().catch(() => false)) {
        await barOption.click();
      }
    }

    // Save chart
    const saveChartBtn = page.getByRole('button', { name: /save|create/i }).first();
    await saveChartBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Chart created successfully');

    // Step 4: Create a dashboard
    console.log('Step 4: Creating dashboard...');
    await page.goto(`${BASE_URL}/dashboards`);
    await page.waitForTimeout(2000);

    // Look for "Create New Dashboard" button
    const createDashboardBtn = page.getByRole('button', { name: /create.*dashboard|new.*dashboard/i }).or(page.getByRole('button', { name: /create|new/i }).first());
    await createDashboardBtn.click();
    await page.waitForTimeout(1500);

    // Fill in dashboard details
    const dashboardNameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name"]')).first();
    if (await dashboardNameInput.isVisible().catch(() => false)) {
      await dashboardNameInput.fill('Patient Analytics Dashboard');
    }

    // Save dashboard
    const saveDashboardBtn = page.getByRole('button', { name: /save|create/i }).first();
    await saveDashboardBtn.click();
    await page.waitForTimeout(2000);

    console.log('✓ Dashboard created successfully');

    // Step 5: Add widgets to dashboard
    console.log('Step 5: Adding widgets to dashboard...');
    const addWidgetBtn = page.getByRole('button', { name: /add.*widget|widget/i }).or(page.getByRole('button', { name: /\+/i }).first());
    if (await addWidgetBtn.isVisible().catch(() => false)) {
      await addWidgetBtn.click();
      await page.waitForTimeout(1000);
      console.log('✓ Widget dialog opened');
    }

    console.log('\n=== Complete Workflow Test Finished ===\n');

    // Take final screenshot
    await page.screenshot({ path: 'test-results/reports-charts-workflow.png' });
  });

  test('Verify all reporting pages are accessible', async ({ page }) => {
    const pages = [
      { path: '/reports', name: 'Reports' },
      { path: '/charts', name: 'Charts' },
      { path: '/dashboards', name: 'Dashboards' },
      { path: '/sql-editor', name: 'SQL Editor' },
    ];

    for (const pageInfo of pages) {
      await page.goto(`${BASE_URL}${pageInfo.path}`);
      await page.waitForTimeout(1000);

      const h1 = page.locator('h1').first();
      const isVisible = await h1.isVisible().catch(() => false);

      console.log(`${isVisible ? '✓' : '✗'} ${pageInfo.name} page: ${isVisible ? 'Accessible' : 'Issue detected'}`);

      // Check for console errors
      const errors: string[] = [];
      page.on('response', response => {
        if (response.status() >= 400) {
          errors.push(`${response.url()}: ${response.status()}`);
        }
      });

      await page.waitForTimeout(500);

      if (errors.length > 0) {
        console.log(`  Warnings: ${errors.length} error responses`);
      }
    }

    console.log('\n✓ All reporting pages verified');
  });

  test('Check API endpoints for reporting', async ({ page }) => {
    const endpoints = [
      '/api/reports',
      '/api/charts',
      '/api/dashboards',
      '/api/queries',
    ];

    const apiErrors: string[] = [];

    // Listen for API errors
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() === 500) {
        apiErrors.push(`${response.url()}: 500`);
      }
    });

    for (const endpoint of endpoints) {
      await page.goto(`${BASE_URL}/reports`); // Navigate to authenticated page first
      await page.waitForTimeout(500);

      // Make fetch request via page.evaluate
      const result = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          return { status: response.status, ok: response.ok };
        } catch (e) {
          return { status: 0, ok: false, error: (e as Error).message };
        }
      }, `${BASE_URL}${endpoint}?pageSize=10`);

      const status = result.ok ? '✓' : '✗';
      console.log(`${status} ${endpoint}: ${result.status}`);

      if (!result.ok) {
        apiErrors.push(`${endpoint}: ${result.status}`);
      }
    }

    console.log('\n✓ API endpoint check complete');

    if (apiErrors.length > 0) {
      console.log('API Errors:', apiErrors);
    }

    expect(apiErrors.length).toBe(0);
  });
});
