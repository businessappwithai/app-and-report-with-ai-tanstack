import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';
import { ApiTestHelpers } from './api-test-helpers';

/**
 * End-to-end tests for Natural Language Query with RBAC
 *
 * Tests cover:
 * 1. Data Source RBAC - roles, user assignments, entity permissions
 * 2. NL Query API - schema introspection, query execution, access control
 * 3. NL Query UI - page loads, data source selection, CopilotKit sidebar
 * 4. SQL Parser - entity extraction, access validation
 * 5. Query History - tracking and retrieval
 */

test.describe.configure({ mode: 'serial' });

let authCookie: string;
let dataSourceId: string;
let dsRoleId: string;

test.describe('Data Source RBAC API @batch6', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name === 'authjs.session-token') ||
                          cookies.find(c => c.name === 'next-auth.session-token');
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    // Get the existing data source
    const dsResponse = await page.request.get('/api/data-sources/active', {
      headers: { Cookie: authCookie },
    });
    const dsData = await dsResponse.json();
    if (dsData.data && dsData.data.length > 0) {
      dataSourceId = dsData.data[0].id;
    }

    await page.close();
  });

  test('should reject unauthenticated requests to DS roles', async ({ request }) => {
    const response = await request.get(`/api/data-sources/${dataSourceId}/roles`);
    expect(response.status()).toBe(401);
  });

  test('should create a data source role', async ({ request }) => {
    const response = await request.post(`/api/data-sources/${dataSourceId}/roles`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { name: 'Test Analyst Role', description: 'E2E test role for entity access' },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Test Analyst Role');
    dsRoleId = data.data.id;
  });

  test('should list data source roles', async ({ request }) => {
    const response = await request.get(`/api/data-sources/${dataSourceId}/roles`, {
      headers: { Cookie: authCookie },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
  });

  test('should get a specific data source role', async ({ request }) => {
    const response = await request.get(`/api/data-sources/${dataSourceId}/roles/${dsRoleId}`, {
      headers: { Cookie: authCookie },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test Analyst Role');
  });

  test('should update a data source role', async ({ request }) => {
    const response = await request.put(`/api/data-sources/${dataSourceId}/roles/${dsRoleId}`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { description: 'Updated description for E2E test' },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.description).toBe('Updated description for E2E test');
  });

  test('should prevent duplicate role names for same data source', async ({ request }) => {
    const response = await request.post(`/api/data-sources/${dataSourceId}/roles`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { name: 'Test Analyst Role' },
    });

    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test('should add entity permission to role', async ({ request }) => {
    const response = await request.post(`/api/data-sources/${dataSourceId}/entity-permissions`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        ds_role_id: dsRoleId,
        entity_name: 'actor',
        entity_type: 'table',
        permission_level: 'select',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.entity_name).toBe('actor');
    expect(data.data.permission_level).toBe('select');
  });

  test('should add multiple entity permissions', async ({ request }) => {
    const tables = ['film', 'film_actor', 'category', 'payment'];
    for (const tableName of tables) {
      const response = await request.post(`/api/data-sources/${dataSourceId}/entity-permissions`, {
        headers: { 'Content-Type': 'application/json', Cookie: authCookie },
        data: {
          ds_role_id: dsRoleId,
          entity_name: tableName,
          entity_type: 'table',
          permission_level: 'select',
        },
      });
      expect(response.status()).toBe(201);
    }
  });

  test('should list entity permissions', async ({ request }) => {
    const response = await request.get(
      `/api/data-sources/${dataSourceId}/entity-permissions?ds_role_id=${dsRoleId}`,
      { headers: { Cookie: authCookie } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(5);
  });

  test('should list all entity permissions for data source', async ({ request }) => {
    const response = await request.get(
      `/api/data-sources/${dataSourceId}/entity-permissions`,
      { headers: { Cookie: authCookie } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should assign user to data source role', async ({ request }) => {
    // Get admin user ID
    const usersResponse = await request.get('/api/admin/users', {
      headers: { Cookie: authCookie },
    });
    const usersData = await usersResponse.json();
    const adminUser = usersData.data?.find((u: { id: string; email: string }) => u.email === 'admin@admin.com');

    if (adminUser) {
      const response = await request.post(`/api/data-sources/${dataSourceId}/user-roles`, {
        headers: { 'Content-Type': 'application/json', Cookie: authCookie },
        data: {
          user_id: adminUser.id,
          ds_role_id: dsRoleId,
        },
      });
      expect(response.status()).toBe(201);
    }
  });

  test('should list user-role assignments', async ({ request }) => {
    const response = await request.get(`/api/data-sources/${dataSourceId}/user-roles`, {
      headers: { Cookie: authCookie },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should validate entity permission levels', async ({ request }) => {
    const response = await request.post(`/api/data-sources/${dataSourceId}/entity-permissions`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        ds_role_id: dsRoleId,
        entity_name: 'test_table',
        entity_type: 'table',
        permission_level: 'invalid_level',
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('NL Query Schema API @batch6', () => {
  test('should reject unauthenticated schema requests', async ({ request }) => {
    const response = await request.post('/api/nl-query/schema', {
      headers: { 'Content-Type': 'application/json' },
      data: { data_source_id: dataSourceId },
    });
    expect(response.status()).toBe(401);
  });

  test('should introspect and cache schema', async ({ request }) => {
    const response = await request.post('/api/nl-query/schema', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { data_source_id: dataSourceId },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('tableCount');
    expect(data.data.tableCount).toBeGreaterThan(0);
    expect(data.data).toHaveProperty('tables');
    expect(Array.isArray(data.data.tables)).toBe(true);
  });

  test('should refresh schema cache', async ({ request }) => {
    const response = await request.post('/api/nl-query/schema', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { data_source_id: dataSourceId, refresh: true },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.tableCount).toBeGreaterThan(0);
  });

  test('should return error for non-existent data source', async ({ request }) => {
    const response = await request.post('/api/nl-query/schema', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: { data_source_id: 'non-existent-id' },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe('NL Query Execution API @batch6', () => {
  test('should reject unauthenticated query execution', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json' },
      data: { query: 'show me actors', data_source_id: dataSourceId },
    });
    expect(response.status()).toBe(401);
  });

  test('should require query and data_source_id', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test('should execute NL query with pre-generated SQL', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        query: 'Show me the first 10 actors',
        data_source_id: dataSourceId,
        generated_sql: 'SELECT first_name, last_name FROM actor LIMIT 10',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('accessGranted');
    expect(data.data).toHaveProperty('parsedEntities');
    expect(data.data).toHaveProperty('generatedSql');
  });

  test('should return schema prompt when no SQL provided', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        query: 'Show me all actors',
        data_source_id: dataSourceId,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('prompt');
    expect(data.data).toHaveProperty('schemaText');
    expect(data.data).toHaveProperty('dialect');
  });

  test('should track query in history', async ({ request }) => {
    // Execute a query first
    await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        query: 'Count of films by rating',
        data_source_id: dataSourceId,
        generated_sql: 'SELECT rating, COUNT(*) as count FROM film GROUP BY rating',
      },
    });

    // Check history
    const response = await request.get(
      `/api/nl-query/history?data_source_id=${dataSourceId}&limit=5`,
      { headers: { Cookie: authCookie } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(1);

    const latestQuery = data.data[0];
    expect(latestQuery).toHaveProperty('natural_language_query');
    expect(latestQuery).toHaveProperty('generated_sql');
    expect(latestQuery).toHaveProperty('access_check_result');
  });

  test('should handle invalid SQL gracefully', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        query: 'Test invalid query',
        data_source_id: dataSourceId,
        generated_sql: 'SELECT FROM WHERE INVALID SQL',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    // The pipeline should handle errors gracefully
    expect(data.data).toBeDefined();
  });

  test('should execute multi-table join query', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        query: 'Show actors and their film count',
        data_source_id: dataSourceId,
        generated_sql: `SELECT a.first_name, a.last_name, COUNT(fa.film_id) as film_count
          FROM actor a
          JOIN film_actor fa ON a.actor_id = fa.actor_id
          GROUP BY a.actor_id, a.first_name, a.last_name
          ORDER BY film_count DESC
          LIMIT 10`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.accessGranted).toBe(true);
    expect(data.data.parsedEntities.length).toBeGreaterThanOrEqual(2);
    expect(data.data.queryResults).toBeDefined();
    expect(data.data.queryResults.rows.length).toBeGreaterThan(0);
    expect(data.data.queryResults.columns).toContain('first_name');
  });
});

test.describe('NL Query UI @batch6', () => {
  test('should load the NL Query page', async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    await page.goto('/nl-query');
    await page.waitForLoadState('domcontentloaded');

    // Verify page title
    await expect(page.getByText('Natural Language Query')).toBeVisible({ timeout: 10000 });

    // Verify data source selector
    await expect(page.getByText('Data Source')).toBeVisible();

    await page.close();
  });

  test('should show NL Query in sidebar navigation', async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    // Check sidebar has NL Query link
    await expect(page.getByText('NL Query')).toBeVisible({ timeout: 10000 });

    await page.close();
  });

  test('should navigate to data source permissions page', async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    if (dataSourceId) {
      await page.goto(`/data-sources/${dataSourceId}/permissions`);
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText('Data Source Entity Permissions')).toBeVisible({ timeout: 10000 });
      // Verify tabs are present
      await expect(page.getByText('Roles')).toBeVisible();
      await expect(page.getByText('User Assignments')).toBeVisible();
      await expect(page.getByText('Entity Permissions')).toBeVisible();
    }

    await page.close();
  });
});

test.describe('Data Source RBAC Cleanup @batch6', () => {
  test('should delete entity permissions', async ({ request }) => {
    // Get all permissions for the test role
    const permResponse = await request.get(
      `/api/data-sources/${dataSourceId}/entity-permissions?ds_role_id=${dsRoleId}`,
      { headers: { Cookie: authCookie } }
    );
    const permData = await permResponse.json();

    for (const perm of permData.data || []) {
      const response = await request.delete(
        `/api/data-sources/${dataSourceId}/entity-permissions?permission_id=${perm.id}`,
        { headers: { Cookie: authCookie } }
      );
      expect(response.status()).toBe(200);
    }
  });

  test('should delete data source role', async ({ request }) => {
    if (dsRoleId) {
      const response = await request.delete(
        `/api/data-sources/${dataSourceId}/roles/${dsRoleId}`,
        { headers: { Cookie: authCookie } }
      );
      expect(response.status()).toBe(200);
    }
  });
});
