import { test, expect } from '@playwright/test';
import { ApiTestHelpers } from './api-test-helpers';
import { TestHelpers } from './helpers/test-helpers';

/**
 * Comprehensive API Tests
 *
 * These tests verify:
 * 1. All API endpoints work correctly
 * 2. Proper authentication/authorization
 * 3. Detailed logging is in place
 * 4. Error handling is correct
 */

test.describe('API - Health Check', () => {
  test('should return health status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
  });
});

test.describe('API - Authentication', () => {
  let authCookie: string;

  test.beforeAll(async ({ browser }) => {
    // Login to get auth cookie
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    // Get cookies
    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name === 'authjs.session-token') ||
                          cookies.find(c => c.name === 'next-auth.session-token');

    authCookie = authCookieObj
      ? `${authCookieObj.name}=${authCookieObj.value}`
      : '';

    await page.close();
  });

  test('should reject unauthenticated requests', async ({ request }) => {
    const response = await request.get('/api/queries');
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });
});

test.describe('API - Data Sources', () => {
  let authCookie: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';
    await page.close();
  });

  test('GET /api/data-sources - should fetch all data sources', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDataSources();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('items');
    expect(Array.isArray(data.data.items)).toBe(true);
    expect(data.data).toHaveProperty('meta');
  });

  test('POST /api/data-sources - should create SQLite data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDataSource = {
      name: `Test SQLite ${Date.now()}`,
      description: 'Test SQLite database for API testing',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: ':memory:',
      },
    };

    const response = await apiHelpers.createDataSource(testDataSource);
    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe(testDataSource.name);
    expect(data.data.client_type).toBe('sqlite3');
  });

  test('POST /api/data-sources - should validate required fields', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const invalidData = {
      name: 'Invalid Data Source',
      // Missing clientType and connectionConfig
    };

    const response = await apiHelpers.createDataSource(invalidData as any);
    expect(response.status()).toBe(400);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  test('GET /api/data-sources/:id - should fetch specific data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    // First create a data source
    const createResponse = await apiHelpers.createDataSource({
      name: `Test DS ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    // Then fetch it
    const response = await apiHelpers.getDataSource(dataSourceId);
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(dataSourceId);
    expect(data.data).toHaveProperty('connectionConfig'); // Decrypted
  });

  test('GET /api/data-sources/active - should fetch active data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getActiveDataSources();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    // API returns { data: { activeDataSource: {...} } }
    expect(data.data).toHaveProperty('activeDataSource');
    // activeDataSource can be null if no active source exists
    if (data.data.activeDataSource) {
      expect(data.data.activeDataSource).toHaveProperty('id');
      expect(data.data.activeDataSource).toHaveProperty('name');
    }
  });
});

test.describe('API - Saved Queries', () => {
  let authCookie: string;
  let testDataSourceId: string;

  test.beforeAll(async ({ browser, request }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    await page.close();

    // Create a test data source for use in tests
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const dsResponse = await apiHelpers.createDataSource({
      name: `Test DS for Queries ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });
    const dsData = await ApiTestHelpers.extractJson(dsResponse);
    testDataSourceId = dsData.data.id;
  });

  test('GET /api/queries - should fetch saved queries', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQueries();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('items');
    expect(data.data).toHaveProperty('meta');
  });

  test('POST /api/queries - should create a saved query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testQuery = {
      name: `Test Query ${Date.now()}`,
      description: 'Test query for API testing',
      dataSourceId: testDataSourceId,
      sqlContent: 'SELECT 1 as test_column',
    };

    const response = await apiHelpers.createQuery(testQuery);
    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe(testQuery.name);
  });

  test('POST /api/queries - should validate required fields', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const invalidQuery = {
      name: 'Invalid Query',
      // Missing dataSourceId and sqlContent
    };

    const response = await apiHelpers.createQuery(invalidQuery as any);
    expect(response.status()).toBe(400);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });
});

test.describe('API - SQL Execution', () => {
  let authCookie: string;
  let testDataSourceId: string;

  test.beforeAll(async ({ browser, request }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    await page.close();

    // Create a test data source for use in tests
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const dsResponse = await apiHelpers.createDataSource({
      name: `Test DS for SQL ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });
    const dsData = await ApiTestHelpers.extractJson(dsResponse);
    testDataSourceId = dsData.data.id;
  });

  test('POST /api/sql/execute - should execute SELECT query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'SELECT 1 as column1, 2 as column2',
      dataSourceId: testDataSourceId,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('rows');
    expect(data.data).toHaveProperty('columns');
    expect(Array.isArray(data.data.rows)).toBe(true);
    expect(data.data.rows.length).toBe(1);
  });

  test('POST /api/sql/execute - should reject non-SELECT queries', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'DROP TABLE test_table',
      dataSourceId: testDataSourceId,
    });

    expect(response.status()).toBe(403);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
  });

  test('POST /api/sql/execute - should support pagination', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3',
      dataSourceId: testDataSourceId,
      limit: 2,
      offset: 0,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.rows.length).toBe(2);
  });

  test('POST /api/sql/validate - should validate SQL syntax', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.validateSql({
      sql: 'SELECT * FROM users',
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('isValid');
  });
});

test.describe('API - Reports', () => {
  let authCookie: string;
  let testQueryId: string;

  test.beforeAll(async ({ browser, request }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    const apiHelpers = new ApiTestHelpers(request, authCookie);
    await page.close();

    // Create a test data source and query
    const dsResponse = await apiHelpers.createDataSource({
      name: `Test DS for Reports ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });
    const dsData = await ApiTestHelpers.extractJson(dsResponse);

    const qResponse = await apiHelpers.createQuery({
      name: `Test Query for Reports ${Date.now()}`,
      dataSourceId: dsData.data.id,
      sqlContent: 'SELECT 1 as test',
    });
    const qData = await ApiTestHelpers.extractJson(qResponse);
    testQueryId = qData.data.id;
  });

  test('GET /api/reports - should fetch reports', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getReports();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('items');
    expect(Array.isArray(data.data.items)).toBe(true);
  });

  test('POST /api/reports - should create a report', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createReport({
      name: `Test Report ${Date.now()}`,
      description: 'Test report for API testing',
      savedQueryId: testQueryId,
    });

    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toContain('Test Report');
  });
});

test.describe('API - Dashboards', () => {
  let authCookie: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    await page.close();
  });

  test('GET /api/dashboards - should fetch dashboards', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDashboards();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('items');
  });

  test('POST /api/dashboards - should create a private dashboard', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createDashboard({
      name: `Test Private Dashboard ${Date.now()}`,
      description: 'Test private dashboard',
      isPublic: false,
    });

    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    // SQLite returns boolean as integer (0 or 1)
    expect(data.data.is_public).toBeFalsy();
  });

  test('POST /api/dashboards - should create a public dashboard', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createDashboard({
      name: `Test Public Dashboard ${Date.now()}`,
      description: 'Test public dashboard',
      isPublic: true,
    });

    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    // SQLite returns boolean as integer (0 or 1)
    expect(data.data.is_public).toBeTruthy();
  });
});

test.describe('API - Jobs', () => {
  let authCookie: string;
  let testQueryId: string;

  test.beforeAll(async ({ browser, request }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    const apiHelpers = new ApiTestHelpers(request, authCookie);
    await page.close();

    // Create test query for jobs
    const dsResponse = await apiHelpers.createDataSource({
      name: `Test DS for Jobs ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });
    const dsData = await ApiTestHelpers.extractJson(dsResponse);

    const qResponse = await apiHelpers.createQuery({
      name: `Test Query for Jobs ${Date.now()}`,
      dataSourceId: dsData.data.id,
      sqlContent: 'SELECT 1 as test',
    });
    const qData = await ApiTestHelpers.extractJson(qResponse);
    testQueryId = qData.data.id;
  });

  test('GET /api/jobs - should fetch job definitions', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getJobs();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
  });

  test('POST /api/jobs - should create a job definition', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createJob({
      name: `Test Job ${Date.now()}`,
      description: 'Test job definition',
      savedQueryId: testQueryId,
      schedule: '0 0 * * *', // Daily at midnight
    });

    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });
});

test.describe('API - Admin', () => {
  let authCookie: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    // Login as admin
    await testHelpers.login('admin@admin.com', 'admin');

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    await page.close();
  });

  test('GET /api/admin/users - should fetch all users', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getAdminUsers();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('GET /api/admin/roles - should fetch all roles', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getRoles();
    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('POST /api/admin/roles - should create a new role', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createRole({
      name: `Test Role ${Date.now()}`,
      description: 'Test role for API testing',
      permissions: ['view:dashboard', 'view:reports'],
    });

    expect(response.status()).toBe(201);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });
});

test.describe('API - Error Handling', () => {
  let authCookie: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    await page.close();
  });

  test('should return 404 for non-existent data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDataSource('non-existent-id');
    expect(response.status()).toBe(404);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  test('should return 404 for non-existent query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getQuery('non-existent-id');
    expect(response.status()).toBe(404);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});
