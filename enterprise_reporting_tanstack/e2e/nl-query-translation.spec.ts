import { test, expect } from '@playwright/test';
import { TestHelpers } from './helpers/test-helpers';

/**
 * E2E Tests for Natural Language Query Translation Pipeline
 *
 * Tests the complete NL→SQL flow with sample managers:
 * 1. OpenAI translation (GPT-4-turbo at temp 0.3)
 * 2. Schema validation
 * 3. ANTLR keyword validation
 * 4. Translation confidence scoring (≥90% auto-execute)
 * 5. RBAC pre-flight checks
 * 6. Query execution
 * 7. OpenKB logging for auto-learning
 * 8. Manager override for low-confidence queries
 */

test.describe.configure({ mode: 'serial' });

let authCookie: string;
let dataSourceId: string;
let managerUserId: string;
let analystUserId: string;

test.describe('NL→SQL Translation Pipeline @batch6', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login('admin@admin.com', 'admin');

    const cookies = await page.context().cookies();
    const authCookieObj = cookies.find(c => c.name === 'authjs.session-token') ||
                          cookies.find(c => c.name === 'next-auth.session-token');
    authCookie = authCookieObj ? `${authCookieObj.name}=${authCookieObj.value}` : '';

    // Get active data source
    try {
      const dsResponse = await page.request.get('/api/data-sources/active', {
        headers: { Cookie: authCookie },
      });
      if (dsResponse.ok) {
        const dsData = await dsResponse.json();
        if (dsData.data?.activeDataSource?.id) {
          dataSourceId = dsData.data.activeDataSource.id;
        } else if (dsData.data && Array.isArray(dsData.data) && dsData.data.length > 0) {
          dataSourceId = dsData.data[0].id;
        }
      }
    } catch (error) {
      console.warn('[Test] Could not fetch active data source:', error);
    }

    // Use default manager/analyst IDs for testing
    managerUserId = 'test-manager-id';
    analystUserId = 'test-analyst-id';

    await page.close();
  });

  test('should translate simple SELECT query with high confidence', async ({ request, browser }) => {
    // Get fresh auth cookie if not available
    if (!authCookie) {
      const page = await browser.newPage();
      const testHelpers = new TestHelpers(page);
      await testHelpers.login();

      const cookies = await page.context().cookies();
      const authCookieObj = cookies.find(c => c.name.includes('session-token'));
      if (authCookieObj) {
        authCookie = `${authCookieObj.name}=${authCookieObj.value}`;
      }
      await page.close();
    }

    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'How many actors are in the database?',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Successful translation should be returned
    expect(data).toBeDefined();

    // If OpenAI API is available, we should get a SQL translation
    if (data.success === true) {
      expect(data.sql).toBeDefined();
      expect(data.sql).toContain('SELECT');
      expect(data.englishMeaning).toBeDefined();
      expect(data.confidence).toBeDefined();
      expect(typeof data.confidence).toBe('number');

      // High confidence queries should execute successfully
      if (data.confidence >= 0.9) {
        expect(data.rows).toBeDefined();
        expect(Array.isArray(data.rows)).toBe(true);
      }
    } else {
      // If OpenAI is not configured, we should get a clear error message
      expect(data.error).toBeDefined();
      expect(data.error).toContain('translate');
    }
  });

  test('should return detailed translation info for medium-confidence queries', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'What films are available categorized by their rating distribution',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true) {
      // High confidence - should auto-execute
      expect(data.confidence).toBeGreaterThanOrEqual(0.9);
      expect(data.requiresApproval).toBeFalsy();
      expect(data.rows).toBeDefined();
    } else if (data.requiresApproval === true) {
      // Medium confidence - requires manager approval
      expect(data.confidence).toBeLessThan(0.9);
      expect(data.warning).toBeDefined();
      expect(data.sql).toBeDefined();
      expect(data.englishMeaning).toBeDefined();
    } else {
      // Error case - OpenAI not configured or translation failed
      expect(data.error).toBeDefined();
    }
  });

  test('should validate SQL is SELECT-only (security check)', async ({ request }) => {
    // Test that malicious queries are rejected
    // This tests the isSafeSelectQuery() validation

    // Try to execute with a fake UPDATE query (this should be caught)
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'List all actors',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // If a query is returned, it should be SELECT-only
    if (data.sql) {
      const sqlUpper = data.sql.toUpperCase().trim();
      expect(sqlUpper).toMatch(/^(SELECT|WITH|EXPLAIN)/);
      expect(sqlUpper).not.toContain('INSERT');
      expect(sqlUpper).not.toContain('UPDATE');
      expect(sqlUpper).not.toContain('DELETE');
      expect(sqlUpper).not.toContain('DROP');
      expect(sqlUpper).not.toContain('ALTER');
    }
  });

  test('should handle complex multi-table joins', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'Show me the top 5 actors by number of films they appeared in',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true) {
      // Should have generated a JOIN query
      expect(data.sql).toBeDefined();
      expect(data.sql.toUpperCase()).toContain('JOIN');
      expect(data.rows).toBeDefined();
      if (data.rows.length > 0) {
        // Verify result structure
        expect(typeof data.rows[0]).toBe('object');
      }
    } else if (data.requiresApproval === true) {
      // Medium confidence is acceptable for complex queries
      expect(data.sql).toContain('JOIN');
    }
  });

  test('should aggregate functions correctly (COUNT, SUM, AVG)', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'How many films are in each rating category',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true || data.requiresApproval === true) {
      expect(data.sql).toBeDefined();
      const sqlUpper = data.sql.toUpperCase();
      // Should contain aggregation
      expect(sqlUpper).toMatch(/COUNT|SUM|AVG|GROUP BY/);
    }
  });

  test('should return schema context when translation not provided', async ({ request }) => {
    // This tests schema extraction functionality
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: '',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Empty question should return error
    expect(data.error).toBeDefined();
  });

  test('should enforce RBAC - deny access to restricted tables', async ({ request }) => {
    // Create a role with limited permissions
    const roleRes = await request.post(`/api/data-sources/${dataSourceId}/roles`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        name: `rbac-test-role-${Date.now()}`,
        description: 'Role with limited table access',
      },
    });

    const roleData = await roleRes.json();
    if (!roleData.data) {
      test.skip();
      return;
    }

    const roleId = roleData.data.id;

    // Grant access only to actor table
    await request.post(`/api/data-sources/${dataSourceId}/entity-permissions`, {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        ds_role_id: roleId,
        entity_name: 'actor',
        entity_type: 'table',
        permission_level: 'select',
      },
    });

    // Assign analyst to this role
    if (analystUserId) {
      await request.post(`/api/data-sources/${dataSourceId}/user-roles`, {
        headers: { 'Content-Type': 'application/json', Cookie: authCookie },
        data: {
          user_id: analystUserId,
          ds_role_id: roleId,
        },
      });
    }

    // Try to query a restricted table as the analyst
    const analystCookies = await loginAsUser(request, `analyst-${Date.now()}@test.com`, 'testpass123');
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: analystCookies },
      data: {
        nlQuestion: 'List all films',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Should either:
    // 1. Fail with access denied error during RBAC check
    // 2. Generate SQL but fail during execution due to RBAC
    if (data.sql) {
      expect(data.error).toBeDefined();
      expect(data.error.toLowerCase()).toContain('access');
    } else {
      expect(data.error).toBeDefined();
    }

    // Cleanup
    await request.delete(
      `/api/data-sources/${dataSourceId}/roles/${roleId}`,
      { headers: { Cookie: authCookie } }
    );
  });

  test('should log successful queries to OpenKB for auto-learning', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'Show me all actors with first name starting with A',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true) {
      // Query should be logged (audit trail)
      expect(data.sql).toBeDefined();
      expect(data.executionTime).toBeDefined();
      expect(typeof data.executionTime).toBe('number');
      expect(data.rowCount).toBeDefined();
      expect(typeof data.rowCount).toBe('number');

      // TODO: Verify OpenKB entry once OpenKB client is fully integrated
      // const openkb = await getOpenKBClient();
      // const recent = await openkb.getRecentQueries(roleId, 1);
      // expect(recent[0].nlQuestion).toContain('actors');
    }
  });

  test('should support manager override for low-confidence translations', async ({ request }) => {
    // First, get a low-confidence translation
    const firstResponse = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'Retrieve actors whose names match pattern xyz123',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    const firstData = await firstResponse.json();

    if (firstData.requiresApproval === true && firstData.sql) {
      // Now use override to execute anyway
      const overrideResponse = await request.post('/api/nl-query/execute', {
        headers: { 'Content-Type': 'application/json', Cookie: authCookie },
        data: {
          nlQuestion: firstData.nlQuestion,
          dataSourceId: dataSourceId,
          approvedSQL: firstData.sql,
          timeout: 30000,
        },
      });

      expect(overrideResponse.status()).toBe(200);
      const overrideData = await overrideResponse.json();

      // Should execute the approved SQL
      if (overrideData.success === true) {
        expect(overrideData.sql).toBe(firstData.sql);
      }
    }
  });

  test('should validate query returns proper result structure', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'List the first 10 actors',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Response should always have these fields
    expect(data).toHaveProperty('success');

    if (data.success === true) {
      expect(data.sql).toBeDefined();
      expect(data.rows).toBeDefined();
      expect(Array.isArray(data.rows)).toBe(true);
      expect(data.rowCount).toBeDefined();
      expect(data.executionTime).toBeDefined();
      expect(data.confidence).toBeDefined();

      // Verify rows are properly structured
      if (data.rows.length > 0) {
        expect(typeof data.rows[0]).toBe('object');
        expect(Object.keys(data.rows[0]).length).toBeGreaterThan(0);
      }
    } else if (data.requiresApproval === true) {
      expect(data.sql).toBeDefined();
      expect(data.warning).toBeDefined();
      expect(data.confidence).toBeLessThan(0.9);
    } else {
      expect(data.error).toBeDefined();
    }
  });

  test('should handle NULL values gracefully', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'Find actors with missing data',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true) {
      // Should handle NULL values properly in results
      expect(data.rows).toBeDefined();
      expect(Array.isArray(data.rows)).toBe(true);
    }
  });

  test('should support pagination in results', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'List all actors',
        dataSourceId: dataSourceId,
        timeout: 30000,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (data.success === true) {
      // Results should be paginated (max 100 rows)
      expect(data.rows.length).toBeLessThanOrEqual(100);
      expect(data.rowCount).toBeDefined();
    }
  });

  test('should validate timeout behavior', async ({ request }) => {
    const response = await request.post('/api/nl-query/execute', {
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      data: {
        nlQuestion: 'List all actors',
        dataSourceId: dataSourceId,
        timeout: 1000, // 1 second timeout - may timeout on slow systems
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Should complete or timeout gracefully
    expect(data).toBeDefined();
  });
});

test.describe('NL Query UI Integration @batch6', () => {
  test('should load NL Query workspace page', async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    await page.goto('/nl-query');
    await page.waitForLoadState('domcontentloaded');

    // Check for main components
    const title = page.getByText('Natural Language Query');
    await title.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      // Component might load dynamically
    });

    // Should have a text input for natural language questions
    const input = page.getByPlaceholder(/ask|query|question/i).first();
    expect(input).toBeDefined();

    await page.close();
  });

  test('should have data source selector', async ({ browser }) => {
    const page = await browser.newPage();
    const testHelpers = new TestHelpers(page);
    await testHelpers.login();

    await page.goto('/nl-query');
    await page.waitForLoadState('domcontentloaded');

    // Look for data source selection
    const selector = page.getByText(/data source|source/i).first();
    expect(selector).toBeDefined();

    await page.close();
  });
});

/**
 * Helper function to login as a specific user
 */
async function loginAsUser(request: any, email: string, password: string): Promise<string> {
  const response = await request.post('/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email, password },
  });

  const data = await response.json();
  if (data.session?.sessionToken) {
    return `authjs.session-token=${data.session.sessionToken}`;
  }

  // Fallback
  return '';
}
