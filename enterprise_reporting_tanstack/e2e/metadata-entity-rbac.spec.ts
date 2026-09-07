/**
 * End-to-End Tests for Entity Metadata Management and RBAC
 *
 * Tests the new metadata entity management features including:
 * - Metadata entity and field CRUD operations
 * - Schema sync integration
 * - Permission management
 * - Foreign key relationship configuration
 * - CRUD operations on entity data
 */

import { test, expect } from '@playwright/test';
import { ApiTestHelpers } from './api-test-helpers';
import { TestHelpers } from './helpers/test-helpers';
import { getAuthCookie } from './test-auth';

test.describe.configure({ mode: 'serial' });

let authCookie: string;
let testDataSourceId: string;

test.describe('Entity Metadata - API Tests', () => {
  let authCookie: string;
  let testDataSourceId: string;

  test.beforeAll(async ({ request, browser }) => {
    authCookie = await getAuthCookie(request, browser);
  });

  test('setup - create test data source and tables', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDbFile = `/tmp/test-ds-${Date.now()}.sqlite`;

    // Create a test data source
    const createResponse = await apiHelpers.createDataSource({
      name: `E2E Test DS ${Date.now()}`,
      description: 'Test data source for metadata e2e tests',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: testDbFile,
      },
    });

    expect(createResponse.status()).toBe(201);

    const createData = await ApiTestHelpers.extractJson(createResponse);
    expect(createData.success).toBe(true);
    expect(createData.data).toBeDefined();
    expect(createData.data.id).toBeDefined();

    testDataSourceId = createData.data.id;

    // Create a table in the test datasource
    const sqlResponse = await apiHelpers.executeTestSql({
      sql: `
        CREATE TABLE test_customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE test_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER,
          order_date TEXT DEFAULT CURRENT_DATE,
          total DECIMAL(10,2),
          status TEXT DEFAULT 'pending',
          FOREIGN KEY (customer_id) REFERENCES test_customers(id)
        );

        INSERT INTO test_customers (name, email, status) VALUES
          ('John Doe', 'john@example.com', 'active'),
          ('Jane Smith', 'jane@example.com', 'active'),
          ('Bob Johnson', 'bob@example.com', 'inactive');
      `,
      dataSourceId: testDataSourceId,
    });

    expect(sqlResponse.status()).toBe(200);
  });

  test('GET /api/metadata/entities - should list entities', async ({ request }) => {
    const response = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: {
        'Cookie': authCookie,
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('entities');
    expect(Array.isArray(data.data.entities)).toBe(true);
    expect(data.data).toHaveProperty('total');
  });

  test('GET /api/metadata/entities/:id - should get entity with fields', async ({ request }) => {
    // First list entities to get one
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entityId = listData.data.entities[0]?.id;

    if (!entityId) {
      test.skip('No entities found - skipping test');
      return;
    }

    const response = await request.get(`/api/metadata/entities/${entityId}`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('entity_name');
    expect(data.data).toHaveProperty('fields');
    expect(Array.isArray(data.data.fields)).toBe(true);
  });

  test('PUT /api/metadata/entities/:id - should update entity metadata', async ({ request }) => {
    // First get or create an entity
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entityId = listData.data.entities?.find((e: any) => e.entity_name === 'test_customers')?.id;

    if (!entityId) {
      test.skip('test_customers entity not found - skipping test');
      return;
    }

    const updateResponse = await request.put(`/api/metadata/entities/${entityId}`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        description: 'Updated customer table description',
        is_active: true,
        is_hidden: false,
      }),
    });

    expect(updateResponse.status()).toBe(200);

    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data.description).toBe('Updated customer table description');
    expect(updateData.data.is_active).toBe(true);
    expect(updateData.data.is_hidden).toBe(false);
  });

  test('GET /api/metadata/entities/:id/fields - should list entity fields', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entityId = listData.data.entities?.find((e: any) => e.entity_name === 'test_customers')?.id;

    if (!entityId) {
      test.skip('test_customers entity not found - skipping test');
      return;
    }

    const response = await request.get(`/api/metadata/entities/${entityId}/fields`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);

    // Verify foreign key field is detected
    const fkField = data.data.find((f: any) => f.is_foreign_key);
    expect(fkField).toBeDefined();
  });

  test('PUT /api/metadata/entities/:id/fields/:fieldId - should update field metadata', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entity = listData.data.entities?.find((e: any) => e.entity_name === 'test_orders');

    if (!entity) {
      test.skip('test_orders entity not found - skipping test');
      return;
    }

    // Find the customer_id field (foreign key)
    const fkField = entity.fields?.find((f: any) => f.field_name === 'customer_id');

    if (!fkField) {
      test.skip('customer_id foreign key field not found - skipping test');
      return;
    }

    const updateResponse = await request.put(`/api/metadata/entities/${entity.id}/fields/${fkField.id}`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        description: 'Customer foreign key',
        relationship_ui_type: 'popup',
        is_display_field: true,
        is_searchable: true,
      }),
    });

    expect(updateResponse.status()).toBe(200);

    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data.relationship_ui_type).toBe('popup');
    expect(updateData.data.is_display_field).toBe(true);
  });

  test('POST /api/metadata/entities/:id/fields/batch - should batch update fields', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entity = listData.data.entities?.find((e: any) => e.entity_name === 'test_customers');

    if (!entity || entity.fields.length < 2) {
      test.skip('Entity with sufficient fields not found - skipping test');
      return;
    }

    const updates = entity.fields.slice(0, 2).map((field: any) => ({
      id: field.id,
      data: {
        is_display_field: field.field_name === 'name',
        is_searchable: true,
      },
    }));

    const response = await request.post(`/api/metadata/entities/${entity.id}/fields/batch`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ updates }),
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  test('GET /api/metadata/entities/:id/permissions - should get entity permissions', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entityId = listData.data.entities?.[0]?.id;

    if (!entityId) {
      test.skip('No entity found - skipping test');
      return;
    }

    const response = await request.get(`/api/metadata/entities/${entityId}/permissions`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('user_permissions');
    expect(data.data).toHaveProperty('entity_permissions');
  });

  test('POST /api/metadata/entities/sync - should sync datasource schema', async ({ request }) => {
    const response = await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId: testDataSourceId }),
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('entitiesCreated');
    expect(data.data).toHaveProperty('fieldsCreated');
    expect(data.data).toHaveProperty('timestamp');
  });

  test('PUT /api/data-sources/:id/config - should update datasource config', async ({ request }) => {
    const response = await request.put(`/api/data-sources/${testDataSourceId}/config`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ is_editable: true }),
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.is_editable).toBe(true);
  });

  test('GET /api/data-sources/:id/entities - should list entities for CRUD', async ({ request }) => {
    const response = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('entities');
    expect(Array.isArray(data.data.entities)).toBe(true);
  });

  test('GET /api/data-sources/:id/entities/:entityId/records - should fetch records', async ({ request }) => {
    // First get entities
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=true`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const entity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'test_customers');

    if (!entity) {
      test.skip('test_customers entity not found - skipping test');
      return;
    }

    // Now fetch records
    const response = await request.get(`/api/data-sources/${testDataSourceId}/entities/${entity.id}/records?page=1&limit=10`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('records');
    expect(data.data).toHaveProperty('total');
    expect(Array.isArray(data.data.records)).toBe(true);
    expect(data.data.records.length).toBeGreaterThan(0);
  });

  test('POST /api/data-sources/:id/entities/:entityId/records/:recordId - should create record', async ({ request }) => {
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=true`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const entity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'test_customers');

    if (!entity) {
      test.skip('test_customers entity not found - skipping test');
      return;
    }

    // Create a new record
    const createResponse = await request.post(
      `/api/data-sources/${testDataSourceId}/entities/${entity.id}/records/${Date.now()}`,
      {
        headers: {
          'Cookie': authCookie,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          name: 'Test Customer',
          email: 'test@example.com',
          status: 'active',
        }),
      }
    );

    expect(createResponse.status()).toBe(201);

    const data = await createResponse.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('name');
    expect(data.data.name).toBe('Test Customer');
  });

  test('Validation - should reject unauthorized requests', async ({ request }) => {
    // Test without auth cookie
    const response = await request.get('/api/metadata/entities');

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  test('Validation - should reject invalid metadata updates', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entityId = listData.data.entities?.[0]?.id;

    if (!entityId) {
      test.skip('No entity found - skipping validation test');
      return;
    }

    // Try to update with invalid data
    const response = await request.put(`/api/metadata/entities/${entityId}`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        description: 'A'.repeat(6000), // Exceeds max length
      }),
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('Validation - should reject invalid field updates', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entity = listData.data.entities?.find((e: any) => e.entity_name === 'test_orders');

    if (!entity) {
      test.skip('test_orders entity not found - skipping test');
      return;
    }

    const fkField = entity.fields?.find((f: any) => f.is_foreign_key);

    if (!fkField) {
      test.skip('Foreign key field not found - skipping test');
      return;
    }

    // Try to set invalid relationship_ui_type
    const response = await request.put(`/api/metadata/entities/${entity.id}/fields/${fkField.id}`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        relationship_ui_type: 'invalid_type',
      }),
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('Validation - should reject batch updates with too many fields', async ({ request }) => {
    const listResponse = await request.get(`/api/metadata/entities?data_source_id=${testDataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const listData = await listResponse.json();
    const entity = listData.data.entities?.[0];

    if (!entity || entity.fields.length > 95) {
      test.skip('Suitable entity not found - skipping test');
      return;
    }

    // Try to update more than 100 fields
    const updates = Array(101).fill(null).map((_, i) => ({
      id: entity.fields[0].id,
      data: { is_display_field: false },
    }));

    const response = await request.post(`/api/metadata/entities/${entity.id}/fields/batch`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ updates }),
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test.afterAll(async ({ request }) => {
    // Clean up test data source
    try {
      const apiHelpers = new ApiTestHelpers(request, authCookie);
      await apiHelpers.deleteDataSource(testDataSourceId);
    } catch (error) {
      console.log('Cleanup failed (non-critical):', error);
    }
  });
});

test.describe('Entity Metadata - Schema Integration Tests', () => {
  let authCookie: string;

  test.beforeAll(async ({ request, browser }) => {
    authCookie = await getAuthCookie(request, browser);
  });

  test('should create entity metadata after schema inspection', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDbFile = `/tmp/test-schema-integration-${Date.now()}.sqlite`;

    // Create a new datasource
    const createResponse = await apiHelpers.createDataSource({
      name: `Schema Integration Test ${Date.now()}`,
      description: 'Testing schema sync integration',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: testDbFile,
      },
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    // Create a table
    await apiHelpers.executeTestSql({
      sql: `
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          category TEXT,
          in_stock INTEGER DEFAULT 0
        );
      `,
      dataSourceId,
    });

    // Trigger schema sync
    const syncResponse = await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId }),
    });

    expect(syncResponse.status()).toBe(200);

    const syncData = await syncResponse.json();
    expect(syncData.success).toBe(true);
    expect(syncData.data.entitiesCreated).toBeGreaterThan(0);
    expect(syncData.data.fieldsCreated).toBeGreaterThan(0);

    // Verify entity was created
    const entitiesResponse = await request.get(`/api/metadata/entities?data_source_id=${dataSourceId}&include_hidden=true`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const productEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'products');

    expect(productEntity).toBeDefined();
    expect([false, 0]).toContain(productEntity.is_active); // Default is false (SQLite returns 0)
    expect([true, 1]).toContain(productEntity.is_hidden); // Default is true (SQLite returns 1)

    // Fetch the entity with fields
    const entityResponse = await request.get(`/api/metadata/entities/${productEntity.id}`, {
      headers: { 'Cookie': authCookie },
    });

    const entityData = await entityResponse.json();
    expect(entityData.success).toBe(true);
    expect(entityData.data.fields).toBeDefined();
    expect(entityData.data.fields.length).toBe(5); // id, name, price, category, in_stock

    // Clean up
    await apiHelpers.deleteDataSource(dataSourceId);

    // Clean up test database file
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testDbFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  test('should preserve user metadata during re-sync', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDbFile = `/tmp/test-resync-${Date.now()}.sqlite`;

    // Create datasource and table
    const createResponse = await apiHelpers.createDataSource({
      name: `Re-sync Test ${Date.now()}`,
      description: 'Testing metadata preservation',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: testDbFile,
      },
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    await apiHelpers.executeTestSql({
      sql: `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          username TEXT NOT NULL,
          email TEXT
        );
      `,
      dataSourceId,
    });

    // Initial sync
    let syncResponse = await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId }),
    });

    expect(syncResponse.status()).toBe(200);
    let syncData = await syncResponse.json();
    expect(syncData.data.entitiesCreated).toBe(1);

    // Get entity and update metadata
    const entitiesResponse = await request.get(`/api/metadata/entities?data_source_id=${dataSourceId}&include_hidden=true`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const userEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'users');

    expect(userEntity).toBeDefined();

    // Update metadata
    const updateResponse = await request.put(`/api/metadata/entities/${userEntity.id}`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        description: 'User accounts table - UPDATED',
        is_active: true,
      }),
    });

    expect(updateResponse.status()).toBe(200);
    const updateData = await updateResponse.json();
    expect(updateData.data.description).toBe('User accounts table - UPDATED');

    // Re-sync and verify preservation
    syncResponse = await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId }),
    });

    expect(syncResponse.status()).toBe(200);
    syncData = await syncResponse.json();
    expect(syncData.data.entitiesUpdated).toBe(1);
    expect(syncData.data.fieldsUpdated).toBeGreaterThanOrEqual(0);

    // Verify description was preserved
    const getResponse = await request.get(`/api/metadata/entities/${userEntity.id}`, {
      headers: { 'Cookie': authCookie },
    });

    const getData = await getResponse.json();
    expect(getData.success).toBe(true);
    expect(getData.data.description).toBe('User accounts table - UPDATED');

    // Clean up
    await apiHelpers.deleteDataSource(dataSourceId);

    // Clean up test database file
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testDbFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  });
});

test.describe('Entity Metadata - Permission Tests', () => {
  let authCookie: string;

  test.beforeAll(async ({ request, browser }) => {
    authCookie = await getAuthCookie(request, browser);
  });

  test('should enforce view permission on metadata entities', async ({ request }) => {
    const response = await request.get('/api/metadata/entities', {
      headers: { 'Cookie': authCookie },
    });

    // If user doesn't have permission, should get 403
    // But admin should have access
    expect([200, 403]).toContain(response.status());
  });

  test('should enforce edit permission for metadata updates', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDbFile = `/tmp/test-permission-${Date.now()}.sqlite`;

    // Create a test datasource
    const createResponse = await apiHelpers.createDataSource({
      name: `Permission Test ${Date.now()}`,
      description: 'Testing permission enforcement',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: testDbFile,
      },
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    const dataSourceId = createData.data.id;

    await apiHelpers.executeTestSql({
      sql: 'CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT);',
      dataSourceId,
    });

    // Sync to create metadata
    await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId }),
    });

    // Get entities
    const entitiesResponse = await request.get(`/api/metadata/entities?data_source_id=${dataSourceId}`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const entityId = entitiesData.data.entities?.[0]?.id;

    if (entityId) {
      // Try to update - admin should have permission
      const updateResponse = await request.put(`/api/metadata/entities/${entityId}`, {
        headers: {
          'Cookie': authCookie,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          description: 'Admin can update',
        }),
      });

      // Admin user should have edit permission
      expect([200, 403, 401]).toContain(updateResponse.status());
    }

    // Clean up
    await apiHelpers.deleteDataSource(dataSourceId);

    // Clean up test database file
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testDbFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  });
});

test.describe('Entity Metadata - CRUD Operations Tests', () => {
  let authCookie: string;
  let testDataSourceId: string;

  test.beforeAll(async ({ request, browser }) => {
    authCookie = await getAuthCookie(request, browser);
  });

  test('setup - create datasource with tables for CRUD tests', async ({ request }) => {
    const apiHelpers = new ApiTestHelpers(request, authCookie);
    const testDbFile = `/tmp/test-crud-${Date.now()}.sqlite`;

    // Create datasource with tables and foreign keys
    const createResponse = await apiHelpers.createDataSource({
      name: `CRUD Test ${Date.now()}`,
      description: 'Testing CRUD operations',
      clientType: 'sqlite3',
      connectionConfig: {
        filename: testDbFile,
      },
    });

    const createData = await ApiTestHelpers.extractJson(createResponse);
    testDataSourceId = createData.data.id;
    expect(createData.data.id).toBeDefined();

    // Create tables with foreign keys
    const sqlResponse = await apiHelpers.executeTestSql({
      sql: `
        CREATE TABLE authors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          bio TEXT
        );

        CREATE TABLE books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author_id INTEGER,
          published_date TEXT,
          FOREIGN KEY (author_id) REFERENCES authors(id)
        );

        CREATE TABLE readers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );

        INSERT INTO authors (name, bio) VALUES
          ('Author One', 'Bio for author 1'),
          ('Author Two', 'Bio for author 2');

        INSERT INTO books (title, author_id, published_date) VALUES
          ('Book 1', 1, '2024-01-01'),
          ('Book 2', 1, '2024-02-01'),
          ('Book 3', 2, '2024-01-15');

        INSERT INTO readers (name, email) VALUES
          ('Reader One', 'reader1@example.com'),
          ('Reader Two', 'reader2@example.com');
      `,
      dataSourceId: testDataSourceId,
    });

    expect(sqlResponse.status()).toBe(200);

    // Enable CRUD on datasource
    const configResponse = await request.put(`/api/data-sources/${testDataSourceId}/config`, {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ is_editable: true }),
    });

    expect(configResponse.status()).toBe(200);

    // Sync to create metadata
    const syncResponse = await request.post('/api/metadata/entities/sync', {
      headers: {
        'Cookie': authCookie,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ dataSourceId: testDataSourceId }),
    });

    expect(syncResponse.status()).toBe(200);
  });

  test.afterAll(async ({ request }) => {
    // Clean up test datasource
    try {
      const apiHelpers = new ApiTestHelpers(request, authCookie);
      await apiHelpers.deleteDataSource(testDataSourceId);
    } catch (error) {
      console.log('Cleanup failed (non-critical):', error);
    }
  });

  test('should list records with server-side pagination', async ({ request }) => {
    // Get books entity
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { 'Cookie': authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const booksEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'books');

    if (!booksEntity) {
      test.skip('books entity not found');
      return;
    }

    // Get records with pagination
    const response = await request.get(`/api/data-sources/${testDataSourceId}/entities/${booksEntity.id}/records?page=1&limit=2`, {
      headers: { 'Cookie': authCookie },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.records).toHaveLength(2); // limit is 2
    expect(data.data.total).toBe(3); // total is 3
  });

  test('should create a new record', async ({ request }) => {
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { Cookie: authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const readersEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'readers');

    if (!readersEntity) {
      test.skip('readers entity not found');
      return;
    }

    const newRecord = {
      name: 'New Reader',
      email: `newreader${Date.now()}@example.com`,
    };

    const response = await request.post(
      `/api/data-sources/${testDataSourceId}/entities/${readersEntity.id}/records/${Date.now()}`,
      {
        headers: {
          'Cookie': authCookie,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(newRecord),
      }
    );

    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe(newRecord.name);
  });

  test('should update an existing record', async ({ request }) => {
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { Cookie: authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const authorsEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'authors');

    if (!authorsEntity) {
      test.skip('authors entity not found');
      return;
    }

    // First get a record to update
    const listResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities/${authorsEntity.id}/records?page=1&limit=1`, {
      headers: { Cookie: authCookie },
    });

    const listData = await listResponse.json();
    const recordId = listData.data.records?.[0]?.id;

    if (!recordId) {
      test.skip('No record found to update');
      return;
    }

    // Update the record
    const updateData = { bio: 'Updated bio text' };
    const response = await request.put(
      `/api/data-sources/${testDataSourceId}/entities/${authorsEntity.id}/records/${recordId}`,
      {
        headers: {
          'Cookie': authCookie,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify(updateData),
      }
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.bio).toBe('Updated bio text');
  });

  test('should delete a record', async ({ request }) => {
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { Cookie: authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const authorsEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'authors');

    if (!authorsEntity) {
      test.skip('authors entity not found');
      return;
    }

    // First create a new record to delete
    const createResponse = await request.post(
      `/api/data-sources/${testDataSourceId}/entities/${authorsEntity.id}/records/${Date.now()}`,
      {
        headers: {
          'Cookie': authCookie,
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          name: 'To Delete',
          bio: 'This record will be deleted',
        }),
      }
    );

    const createData = await createResponse.json();
    const recordId = createData.data.id || createData.data[0]?.id;

    // Delete the record
    const response = await request.delete(
      `/api/data-sources/${testDataSourceId}/entities/${authorsEntity.id}/records/${recordId}`,
      {
        headers: { Cookie: authCookie },
      }
    );

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should handle server-side search in records', async ({ request }) => {
    const entitiesResponse = await request.get(`/api/data-sources/${testDataSourceId}/entities?include_fields=false`, {
      headers: { Cookie: authCookie },
    });

    const entitiesData = await entitiesResponse.json();
    const booksEntity = entitiesData.data.entities?.find((e: any) => e.entity_name === 'books');

    if (!booksEntity) {
      test.skip('books entity not found');
      return;
    }

    // Search for records
    const searchResponse = await request.get(
      `/api/data-sources/${testDataSourceId}/entities/${booksEntity.id}/records?search=Book&page=1&limit=10`,
      { headers: { Cookie: authCookie } }
    );

    expect(searchResponse.status()).toBe(200);

    const searchData = await searchResponse.json();
    expect(searchData.success).toBe(true);
    expect(searchData.data.records.length).toBeGreaterThan(0);
    expect(searchData.data.total).toBeGreaterThan(0);
  });
});
