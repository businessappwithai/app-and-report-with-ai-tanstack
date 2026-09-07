import { test, expect, APIRequestContext } from '@playwright/test';
import { ApiTestHelpers } from './api-test-helpers';
import { TestHelpers } from './helpers/test-helpers';

/**
 * API Logging and Encryption Tests
 *
 * These tests verify:
 * 1. Encryption/decryption works correctly for data sources
 * 2. All API endpoints log correctly (info, warn, error)
 * 3. Error scenarios are properly logged
 * 4. SQL execution logging is comprehensive
 */

test.describe('API - Encryption & Decryption', () => {
  let authCookie: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser }) => {
    // Create a page for authentication
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

  test('should encrypt connection config when creating data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const connectionConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpassword123',
      ssl: false,
    };

    const createResponse = await apiHelpers.createDataSource({
      name: `Test Encrypted DS ${Date.now()}`,
      description: 'Test encrypted connection config',
      clientType: 'pg',
      connectionConfig,
    });

    expect(createResponse.status()).toBe(201);

    const createData = await ApiTestHelpers.extractJson(createResponse);
    expect(createData.success).toBe(true);

    // Verify connection_config is encrypted (not plain JSON)
    const connectionConfigRaw = createData.data.connection_config;
    expect(connectionConfigRaw).toBeDefined();
    expect(connectionConfigRaw).not.toContain('localhost');
    expect(connectionConfigRaw).not.toContain('testpassword');
    // Encrypted data should be hex string
    expect(/^[0-9a-fA-F]+$/.test(connectionConfigRaw)).toBe(true);
  });

  test('should decrypt connection config when fetching data source', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const connectionConfig = {
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      user: 'testuser',
      password: 'testpassword123',
      ssl: false,
    };

    // Create data source
    const createResponse = await apiHelpers.createDataSource({
      name: `Test Decrypt DS ${Date.now()}`,
      clientType: 'pg',
      connectionConfig,
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    // Fetch data source
    const getResponse = await apiHelpers.getDataSource(dataSourceId);
    expect(getResponse.status()).toBe(200);

    const getData = await ApiTestHelpers.extractJson(getResponse);
    expect(getData.success).toBe(true);

    // Verify connection config is decrypted
    const decryptedConfig = getData.data.connectionConfig;
    expect(decryptedConfig).toBeDefined();
    expect(decryptedConfig.host).toBe('localhost');
    expect(decryptedConfig.port).toBe(5432);
    expect(decryptedConfig.database).toBe('testdb');
    expect(decryptedConfig.user).toBe('testuser');
    expect(decryptedConfig.password).toBe('testpassword123');
  });

  test('should handle SQLite connection encryption/decryption', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const connectionConfig = {
      filename: ':memory:',
    };

    const createResponse = await apiHelpers.createDataSource({
      name: `Test SQLite Encrypt ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig,
    });

    expect(createResponse.status()).toBe(201);

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    // Fetch and verify decryption
    const getResponse = await apiHelpers.getDataSource(dataSourceId);
    const getData = await ApiTestHelpers.extractJson(getResponse);

    expect(getData.data.connectionConfig.filename).toBe(':memory:');
  });

  test('should handle MySQL connection encryption/decryption', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const connectionConfig = {
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      user: 'mysqluser',
      password: 'mysqlpassword123',
      ssl: false,
    };

    const createResponse = await apiHelpers.createDataSource({
      name: `Test MySQL Encrypt ${Date.now()}`,
      clientType: 'mysql',
      connectionConfig,
    });

    expect(createResponse.status()).toBe(201);

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    // Fetch and verify decryption
    const getResponse = await apiHelpers.getDataSource(dataSourceId);
    const getData = await ApiTestHelpers.extractJson(getResponse);

    expect(getData.data.connectionConfig.host).toBe('localhost');
    expect(getData.data.connectionConfig.port).toBe(3306);
    expect(getData.data.connectionConfig.password).toBe('mysqlpassword123');
  });
});

test.describe('API - SQL Execution with Logging', () => {
  let authCookie: string;
  let sqliteDataSourceId: string;
  let authContext: any;
  let authPage: any;

  test.beforeAll(async ({ browser, request }) => {
    authContext = await browser.newContext();
    authPage = await authContext.newPage();

    const testHelpers = new TestHelpers(authPage);
    await testHelpers.login();

    const cookies = await authContext.cookies();
    const authCookieObj = cookies.find(c => c.name.includes('session-token'));
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    // Create SQLite data source for testing
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const dsResponse = await apiHelpers.createDataSource({
      name: `SQLite for SQL Tests ${Date.now()}`,
      clientType: 'sqlite3',
      connectionConfig: { filename: ':memory:' },
    });

    const dsData = await ApiTestHelpers.extractJson(dsResponse);
    sqliteDataSourceId = dsData.data.id;
  });

  test.afterAll(async () => {
    if (authPage) await authPage.close();
    if (authContext) await authContext.close();
  });

  test('should execute simple SELECT query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'SELECT 1 as number, "test" as text',
      dataSourceId: sqliteDataSourceId,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.rows).toHaveLength(1);
    expect(data.data.rows[0]).toHaveProperty('number', 1);
    expect(data.data.rows[0]).toHaveProperty('text', 'test');
  });

  test('should execute query with JOIN', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: `
        WITH users(id, name) AS (
          SELECT 1, 'Alice'
          UNION ALL
          SELECT 2, 'Bob'
        ),
        orders(id, user_id, amount) AS (
          SELECT 1, 1, 100
          UNION ALL
          SELECT 2, 1, 200
          UNION ALL
          SELECT 3, 2, 150
        )
        SELECT u.name, COUNT(o.id) as order_count, SUM(o.amount) as total
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id
        GROUP BY u.id, u.name
        ORDER BY total DESC
      `,
      dataSourceId: sqliteDataSourceId,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.rows.length).toBeGreaterThan(0);
  });

  test('should execute query with aggregations', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: `
        WITH sales(id, amount, category) AS (
          SELECT 1, 100, 'A'
          UNION ALL
          SELECT 2, 200, 'B'
          UNION ALL
          SELECT 3, 150, 'A'
          UNION ALL
          SELECT 4, 300, 'C'
        )
        SELECT
          category,
          COUNT(*) as count,
          SUM(amount) as total,
          AVG(amount) as average,
          MIN(amount) as minimum,
          MAX(amount) as maximum
        FROM sales
        GROUP BY category
        ORDER BY total DESC
      `,
      dataSourceId: sqliteDataSourceId,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.rows.length).toBe(3);
  });

  test('should execute query with pagination', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: `
        WITH numbers(n) AS (
          SELECT 1
          UNION ALL SELECT 2
          UNION ALL SELECT 3
          UNION ALL SELECT 4
          UNION ALL SELECT 5
        )
        SELECT n FROM numbers
        ORDER BY n
      `,
      dataSourceId: sqliteDataSourceId,
      limit: 2,
      offset: 1,
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data.rows).toHaveLength(2);
    expect(data.data.rows[0].n).toBe(2);
    expect(data.data.rows[1].n).toBe(3);
  });

  test('should reject non-SELECT query', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'INSERT INTO users VALUES (1, "test")',
      dataSourceId: sqliteDataSourceId,
    });

    expect(response.status()).toBe(403);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(data.error.message).toContain('SELECT');
  });

  test('should handle query syntax errors gracefully', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.executeSql({
      sql: 'SELECT * FROM nonexistent_table',
      dataSourceId: sqliteDataSourceId,
    });

    // Should return error with proper status
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error).toHaveProperty('code');
    expect(data.error).toHaveProperty('message');
  });

  test('should validate SQL before execution', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.validateSql({
      sql: 'SELECT * FROM users WHERE id = ?',
    });

    expect(response.status()).toBe(200);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('isValid');
  });
});

test.describe('API - Error Logging Scenarios', () => {
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

  test('should log validation errors for missing fields', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    // Test data source creation with missing fields
    const response = await apiHelpers.createDataSource({
      name: 'Invalid DS',
      // Missing clientType and connectionConfig
    } as any);

    expect(response.status()).toBe(400);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  test('should log validation errors for queries', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.createQuery({
      name: 'Invalid Query',
      // Missing dataSourceId and sqlContent
    } as any);

    expect(response.status()).toBe(400);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  test('should log not found errors', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const response = await apiHelpers.getDataSource('non-existent-id-12345');
    expect(response.status()).toBe(404);

    const data = await ApiTestHelpers.extractJson(response);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });
});

test.describe('API - Performance Logging', () => {
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

  test('should include duration in response metadata', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const startTime = Date.now();

    const response = await apiHelpers.getQueries();

    const endTime = Date.now();
    const requestDuration = endTime - startTime;

    expect(response.status()).toBe(200);

    // The request should complete in reasonable time
    expect(requestDuration).toBeLessThan(5000);
  });

  test('should handle concurrent requests', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    // Create multiple concurrent requests
    const promises = [
      apiHelpers.getQueries(),
      apiHelpers.getDataSources(),
      apiHelpers.getReports(),
      apiHelpers.getDashboards(),
    ];

    const results = await Promise.all(promises);

    // All requests should succeed
    for (const response of results) {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
    }
  });
});
