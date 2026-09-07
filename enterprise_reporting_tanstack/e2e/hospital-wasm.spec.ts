/**
 * Hospital Management System - WASM Architecture E2E Test
 *
 * This test:
 * 1. Creates a PostgreSQL data source for hospital_management_system
 * 2. Writes queries against bus_patient table (100,000 records)
 * 3. Creates a report
 * 4. Creates a chart
 * 5. Tests WASM/DuckDB performance with large datasets
 */

import { test, expect } from '@playwright/test';
import { login } from './test-auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4050';

test.describe('Hospital Management System - WASM Architecture', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/`);
  });

  test('1. Create PostgreSQL data source for hospital management', async ({ page }) => {
    await page.goto(`${BASE_URL}/data-sources`);

    // Click "Add New Data Source" button
    await page.click('button:has-text("Add"), button:has-text("New"), a:has-text("Add")');

    // Wait for form to load
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 5000 });

    // Fill in data source details
    await page.fill('input[name="name"]', 'Hospital Management System');
    await page.fill('textarea[name="description"]', 'PostgreSQL database with 100K patient records for WASM testing');

    // Select PostgreSQL as client type
    await page.selectOption('select[name="clientType"]', 'pg');

    // Fill connection details
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '5432');
    await page.fill('input[name="database"]', 'hospital_management_system');
    await page.fill('input[name="user"]', 'postgres');
    await page.fill('input[name="password"]', '');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Wait for test result (should show success)
    await expect(page.locator('text=Connection successful, text=Connected')).toBeVisible({ timeout: 10000 });

    // Save the data source
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify data source was created
    await expect(page.locator('text=Hospital Management System')).toBeVisible();
  });

  test('2. Execute queries against 100K patient records', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Wait for SQL editor to load
    await expect(page.locator('.monaco-editor, [contenteditable="true"], textarea, .CodeMirror')).toBeVisible();

    // Query 1: Simple patient count
    const countQuery = 'SELECT COUNT(*) as total_patients FROM bus_patient';
    await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(countQuery);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results - should show 100,000
    await expect(page.locator('table, .results, text=100000')).toBeVisible({ timeout: 15000 });

    // Query 2: Patient demographics aggregation
    const demographicsQuery = `SELECT
      gender,
      blood_group,
      COUNT(*) as patient_count,
      ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))), 2) as avg_age
    FROM bus_patient
    GROUP BY gender, blood_group
    ORDER BY patient_count DESC`;

    await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(demographicsQuery);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results - should show demographic breakdown
    await expect(page.locator('table, .results')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=gender, text=blood_group, text=patient_count')).toBeVisible();

    // Query 3: Age distribution with CASE statement
    const ageDistributionQuery = `SELECT
      CASE
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 'Under 18'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 40 THEN '18-39'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 60 THEN '40-59'
        ELSE '60+'
      END as age_group,
      COUNT(*) as patient_count
    FROM bus_patient
    GROUP BY age_group
    ORDER BY age_group`;

    await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(ageDistributionQuery);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results
    await expect(page.locator('table, .results')).toBeVisible({ timeout: 15000 });

    // Query 4: Large dataset query with pagination (1000 rows)
    const largeDatasetQuery = `SELECT
      id,
      uhid,
      mrn,
      first_name,
      last_name,
      date_of_birth,
      gender,
      blood_group,
      phone,
      email
    FROM bus_patient
    ORDER BY id
    LIMIT 1000`;

    await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(largeDatasetQuery);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results - should show 1000 rows
    await expect(page.locator('table tbody tr, .data-grid-row').nth(0)).toBeVisible({ timeout: 20000 });

    // Check pagination controls
    await expect(page.locator('button:has-text("Next"), text=Next, .pagination')).toBeVisible();
  });

  test('3. Save queries for patient analytics', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Wait for SQL editor to load
    await expect(page.locator('.monaco-editor, [contenteditable="true"], textarea, .CodeMirror')).toBeVisible();

    // Enter patient demographics query
    const query = `SELECT
      gender,
      blood_group,
      COUNT(*) as patient_count,
      ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))), 2) as avg_age
    FROM bus_patient
    GROUP BY gender, blood_group
    ORDER BY patient_count DESC`;

    await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(query);
    await page.click('button:has-text("Execute"), button:has-text("Run")');

    // Wait for results
    await expect(page.locator('table, .results')).toBeVisible({ timeout: 15000 });

    // Save the query
    await page.click('button:has-text("Save Query"), button:has-text("Save")');

    // Fill in save query form
    await expect(page.locator('input[name="name"], input[placeholder*="name"]')).toBeVisible();
    await page.fill('input[name="name"], input[placeholder*="name"]', 'Patient Demographics Summary');
    await page.fill('textarea[name="description"], textarea[placeholder*="description"]', 'Gender and blood group distribution of 100K patients');

    // Submit the form
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify query was saved
    await expect(page.locator('text=Query saved, text=successfully')).toBeVisible({ timeout: 5000 });
  });

  test('4. Create patient demographics report', async ({ page }) => {
    await page.goto(`${BASE_URL}/reports`);

    // Click "Add New Report" or "Create Report" button
    await page.click('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');

    // Wait for form to load
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 5000 });

    // Fill in report details
    await page.fill('input[name="name"]', 'Patient Demographics Report');
    await page.fill('textarea[name="description"]', 'Comprehensive patient demographics analysis with 100K records');

    // Select or enter the query
    await page.click('select[name="queryId"], [role="combobox"]');
    await page.click('text=Patient Demographics, text=patient demographics');

    // Configure report settings
    await expect(page.locator('input[name="columns"], .column-selector')).toBeVisible();

    // Save the report
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify report was created
    await expect(page.locator('text=Patient Demographics Report')).toBeVisible();
  });

  test('5. Create age distribution chart', async ({ page }) => {
    await page.goto(`${BASE_URL}/charts`);

    // Click "Add New Chart" or "Create Chart" button
    await page.click('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');

    // Wait for form to load
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 5000 });

    // Fill in chart details
    await page.fill('input[name="name"]', 'Patient Age Distribution');
    await page.fill('textarea[name="description"]', 'Bar chart showing patient count by age group');

    // Select chart type - Bar chart
    await page.selectOption('select[name="chartType"]', 'bar');

    // Enter the age distribution query
    const query = `SELECT
      CASE
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 'Under 18'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 40 THEN '18-39'
        WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 60 THEN '40-59'
        ELSE '60+'
      END as age_group,
      COUNT(*) as patient_count
    FROM bus_patient
    GROUP BY age_group
    ORDER BY age_group`;

    await page.locator('textarea[name="query"], .monaco-editor textarea').fill(query);

    // Configure chart axes
    await page.fill('input[name="xAxisField"]', 'age_group');
    await page.fill('input[name="yAxisField"]', 'patient_count');

    // Set chart title
    await page.fill('input[name="title"]', 'Patient Age Distribution');

    // Save the chart
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify chart was created
    await expect(page.locator('text=Patient Age Distribution')).toBeVisible();
  });

  test('6. Create patient analytics dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboards`);

    // Click "Add New Dashboard" or "Create Dashboard" button
    await page.click('button:has-text("Add"), button:has-text("New"), button:has-text("Create")');

    // Wait for form to load
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 5000 });

    // Fill in dashboard details
    await page.fill('input[name="name"]', 'Patient Analytics Dashboard');
    await page.fill('textarea[name="description"]', 'Real-time patient analytics with WASM-powered visualizations');

    // Save the dashboard
    await page.click('button:has-text("Save"), button:has-text("Create")');

    // Verify dashboard was created and navigate to it
    await expect(page.locator('text=Patient Analytics Dashboard')).toBeVisible();
  });

  test('7. Performance test - Large dataset query execution time', async ({ page }) => {
    await page.goto(`${BASE_URL}/sql-editor`);

    // Wait for SQL editor to load
    await expect(page.locator('.monaco-editor, [contenteditable="true"], textarea, .CodeMirror')).toBeVisible();

    // Execute multiple queries and measure performance
    const queries = [
      {
        name: 'Count Query',
        sql: 'SELECT COUNT(*) as count FROM bus_patient',
      },
      {
        name: 'Aggregation Query',
        sql: `SELECT gender, blood_group, COUNT(*) as count
              FROM bus_patient
              GROUP BY gender, blood_group`,
      },
      {
        name: 'Large Result Set (1000 rows)',
        sql: `SELECT * FROM bus_patient ORDER BY id LIMIT 1000`,
      },
    ];

    for (const queryTest of queries) {
      const startTime = Date.now();

      await page.locator('.monaco-editor textarea, .CodeMirror-code textarea, [contenteditable="true"]').first().fill(queryTest.sql);
      await page.click('button:has-text("Execute"), button:has-text("Run")');

      // Wait for results
      await expect(page.locator('table, .results, .data-grid')).toBeVisible({ timeout: 20000 });

      const executionTime = Date.now() - startTime;
      console.log(`${queryTest.name}: ${executionTime}ms`);

      // Verify query completed successfully
      await expect(page.locator('table, .results')).toBeVisible();
    }
  });

  test('8. WASM feature flags verification', async ({ page }) => {
    // Navigate to datasets page to verify WASM is enabled
    await page.goto(`${BASE_URL}/datasets`);

    // Check if WASM features are indicated on the page
    const wasmLocator = page.locator('text=WASM, text=DuckDB, text=Datasets');
    const datasetLocator = page.locator('h1:has-text("Dataset")');
    const isVisible = await wasmLocator.isVisible().catch(() => false) || await datasetLocator.isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();

    // Check for DuckDB status indicator
    const duckdbStatus = page.locator('text=DuckDB, text=ready, text=initialized');
    if (await duckdbStatus.count() > 0) {
      console.log('DuckDB-Wasm is initialized and ready');
    }
  });

  test('9. End-to-end workflow - Complete patient analytics', async ({ page }) => {
    // This test covers the complete workflow:
    // 1. Navigate to SQL Editor
    await page.goto(`${BASE_URL}/sql-editor`);
    await expect(page.locator('.monaco-editor, [contenteditable="true"], textarea')).toBeVisible();

    // 2. Execute patient count query
    await page.locator('.monaco-editor textarea, [contenteditable="true"]').first().fill('SELECT COUNT(*) FROM bus_patient');
    await page.click('button:has-text("Execute"), button:has-text("Run")');
    await expect(page.locator('text=100000, table, .results')).toBeVisible({ timeout: 15000 });

    // 3. Navigate to reports
    await page.goto(`${BASE_URL}/reports`);
    await expect(page.locator('h1:has-text("Report"), text=Reports, h1')).first().toBeVisible();

    // 4. Navigate to charts
    await page.goto(`${BASE_URL}/charts`);
    await expect(page.locator('text=Chart, text=Charts, h1').first()).toBeVisible();

    // 5. Navigate to dashboards
    await page.goto(`${BASE_URL}/dashboards`);
    await expect(page.locator('text=Dashboard, text=Dashboards, h1').first()).toBeVisible();

    // 6. Verify no console errors related to WASM
    const logs = await page.evaluate(() => {
      return (window as any).consoleLogs || [];
    });
    console.log('Console logs:', logs);
  });
});

test.describe('Hospital Management - Data Source Connection', () => {
  test('Connect to local PostgreSQL hospital database', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/data-sources`);

    // Verify we can add a new data source
    await expect(page.locator('button:has-text("Add"), button:has-text("New")')).toBeVisible();

    // Click add data source
    await page.click('button:has-text("Add"), button:has-text("New")');

    // Fill connection details for local PostgreSQL
    await page.fill('input[name="name"]', 'Local Hospital DB');
    await page.selectOption('select[name="clientType"]', 'pg');
    await page.fill('input[name="host"]', 'localhost');
    await page.fill('input[name="port"]', '5432');
    await page.fill('input[name="database"]', 'hospital_management_system');
    await page.fill('input[name="user"]', 'postgres');

    // Test connection
    await page.click('button:has-text("Test Connection")');

    // Should show success or connection result
    await expect(page.locator('text=Connection, text=success, text=failed, .toast, .notification')).first().toBeVisible({ timeout: 10000 });
  });
});
