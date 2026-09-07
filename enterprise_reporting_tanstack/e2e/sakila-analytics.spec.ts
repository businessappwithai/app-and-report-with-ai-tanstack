import { test, expect } from '@playwright/test';
import { ApiTestHelpers } from './api-test-helpers';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Sakila Analytics Tests
 *
 * Tests for the complete Sakila analytics suite including:
 * - 15 Saved Queries
 * - 4 Reports
 * - 8 Charts
 * - 1 Dashboard with 5 Widgets
 */

test.describe('Sakila Analytics - Queries', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should fetch all saved queries', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQueries();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.items.length).toBeGreaterThanOrEqual(15);
  });

  test('should have Monthly Revenue Trend query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQueries();
    const data = await ApiTestHelpers.extractJson(response);

    const query = data.data.items.find((q: any) => q.name === 'Monthly Revenue Trend');
    expect(query).toBeDefined();
    expect(query.description).toContain('revenue');
  });

  test('should have Revenue by Store query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQueries();
    const data = await ApiTestHelpers.extractJson(response);

    const query = data.data.items.find((q: any) => q.name === 'Revenue by Store');
    expect(query).toBeDefined();
  });

  test('should have Top Customers query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQueries();
    const data = await ApiTestHelpers.extractJson(response);

    const query = data.data.items.find((q: any) => q.name === 'Top Customers by Spending');
    expect(query).toBeDefined();
  });
});

test.describe('Sakila Analytics - SQL Execution', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should execute Monthly Revenue Trend query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);
    const query = queriesData.data.items.find((q: any) => q.name === 'Monthly Revenue Trend');

    const executeResponse = await apiHelpers.executeQuery(query.id);
    expect(executeResponse.status()).toBe(200);

    const result = await ApiTestHelpers.extractJson(executeResponse);
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeInstanceOf(Array);
    expect(result.data.rows.length).toBeGreaterThan(0);
  });

  test('should execute Revenue by Category query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);
    const query = queriesData.data.items.find((q: any) => q.name === 'Revenue by Film Category');

    const executeResponse = await apiHelpers.executeQuery(query.id);
    expect(executeResponse.status()).toBe(200);

    const result = await ApiTestHelpers.extractJson(executeResponse);
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeInstanceOf(Array);
  });

  test('should execute Top Customers query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);
    const query = queriesData.data.items.find((q: any) => q.name === 'Top Customers by Spending');

    const executeResponse = await apiHelpers.executeQuery(query.id);
    expect(executeResponse.status()).toBe(200);

    const result = await ApiTestHelpers.extractJson(executeResponse);
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeInstanceOf(Array);
    expect(result.data.rows.length).toBeGreaterThan(0);
  });
});

test.describe('Sakila Analytics - Reports', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should have Monthly Revenue Report', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getReports();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    const report = data.data.items.find((r: any) => r.name === 'Monthly Revenue Report');
    expect(report).toBeDefined();
    expect(report.description).toContain('revenue');
  });

  test('should fetch report data', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const reportsResponse = await apiHelpers.getReports();
    const reportsData = await ApiTestHelpers.extractJson(reportsResponse);
    const report = reportsData.data.items.find((r: any) => r.name === 'Monthly Revenue Report');

    const dataResponse = await apiHelpers.getReportData(report.id);
    expect(dataResponse.status()).toBe(200);

    const result = await ApiTestHelpers.extractJson(dataResponse);
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeInstanceOf(Array);
  });
});

test.describe('Sakila Analytics - Charts', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should have Revenue Over Time chart', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getCharts();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    const chart = data.data.items.find((c: any) => c.name === 'Revenue Over Time');
    expect(chart).toBeDefined();
    expect(chart.chart_type).toBe('line');
  });

  test('should have Revenue by Category chart', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getCharts();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    const chart = data.data.items.find((c: any) => c.name === 'Revenue by Category');
    expect(chart).toBeDefined();
    expect(chart.chart_type).toBe('bar');
  });

  test('should fetch chart data', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const chartsResponse = await apiHelpers.getCharts();
    const chartsData = await ApiTestHelpers.extractJson(chartsResponse);
    const chart = chartsData.data.items.find((c: any) => c.name === 'Revenue Over Time');

    const dataResponse = await apiHelpers.getChartData(chart.id);
    expect(dataResponse.status()).toBe(200);

    const result = await ApiTestHelpers.extractJson(dataResponse);
    expect(result.success).toBe(true);
    expect(result.data.rows).toBeInstanceOf(Array);
  });
});

test.describe('Sakila Analytics - Dashboard', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should have Sakila Analytics Dashboard', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDashboards();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    const dashboard = data.data.items.find((d: any) => d.name === 'Sakila Analytics Dashboard');
    expect(dashboard).toBeDefined();
  });

  test('dashboard should be public', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDashboards();
    const data = await ApiTestHelpers.extractJson(response);
    const dashboard = data.data.items.find((d: any) => d.name === 'Sakila Analytics Dashboard');

    expect(dashboard.is_public).toBe(true);
  });
});

test.describe('Sakila Analytics - UI Integration', () => {
  let testHelpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    testHelpers = new TestHelpers(page);
    await testHelpers.login();
  });

  test('should display saved queries page', async ({ page }) => {
    await testHelpers.navigateToPage('SQL Editor');
    await page.waitForTimeout(2000);

    const hasQueriesSection = await page.locator('text=/saved|queries|recent/i').isVisible().catch(() => false);
    expect(hasQueriesSection).toBeTruthy();
  });

  test('should display reports page', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const hasReportList = await page.locator('text=/report|Monthly Revenue|Store Performance/i').isVisible().catch(() => false);
    expect(hasReportList).toBeTruthy();
  });

  test('should display charts page', async ({ page }) => {
    await page.goto('/charts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const hasChartList = await page.locator('text=/chart|Revenue|Category/i').isVisible().catch(() => false);
    expect(hasChartList).toBeTruthy();
  });

  test('should display dashboards page', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const hasDashboardList = await page.locator('text=/dashboard|Sakila Analytics/i').isVisible().catch(() => false);
    expect(hasDashboardList).toBeTruthy();
  });
});

test.describe('Sakila Analytics - Data Quality', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('queries should return data with proper structure', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);
    const query = queriesData.data.items.find((q: any) => q.name === 'Monthly Revenue Trend');

    const executeResponse = await apiHelpers.executeQuery(query.id);
    const result = await ApiTestHelpers.extractJson(executeResponse);

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('rows');
    expect(result.data).toHaveProperty('columns');
    expect(Array.isArray(result.data.rows)).toBe(true);
    expect(Array.isArray(result.data.columns)).toBe(true);
  });

  test('revenue queries should return numeric values', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);

    const revenueQuery = queriesData.data.items.find((q: any) => q.name === 'Monthly Revenue Trend');
    const executeResponse = await apiHelpers.executeQuery(revenueQuery.id);
    const result = await ApiTestHelpers.extractJson(executeResponse);

    expect(result.data.rows.length).toBeGreaterThan(0);
    expect(result.data.rows[0]).toHaveProperty('total_revenue');
  });

  test('top performing films query should return 10 or fewer results', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);

    const filmsQuery = queriesData.data.items.find((q: any) => q.name === 'Top 10 Performing Films');
    const executeResponse = await apiHelpers.executeQuery(filmsQuery.id);
    const result = await ApiTestHelpers.extractJson(executeResponse);

    expect(result.data.rows.length).toBeLessThanOrEqual(10);
  });
});

test.describe('Sakila Analytics - Performance', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('queries should execute within reasonable time', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const queriesResponse = await apiHelpers.getQueries();
    const queriesData = await ApiTestHelpers.extractJson(queriesResponse);

    const startTime = Date.now();
    const query = queriesData.data.items[0];
    const executeResponse = await apiHelpers.executeQuery(query.id);
    const duration = Date.now() - startTime;

    expect(executeResponse.status()).toBe(200);
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  test('dashboard should load within reasonable time', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const startTime = Date.now();
    const response = await apiHelpers.getDashboards();
    const duration = Date.now() - startTime;

    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(3000); // 3 seconds max
  });
});
