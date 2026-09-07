import { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Helper class for API testing with authentication
 */
export class ApiTestHelpers {
  constructor(private request: APIRequestContext, private authCookie: string) {}

  /**
   * Make an authenticated API request
   */
  private async authenticatedRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<APIResponse> {
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': this.authCookie,
    };

    const url = `${endpoint}`;

    switch (method) {
      case 'GET':
        return await this.request.get(url, { headers });
      case 'POST':
        return await this.request.post(url, { headers, data: body });
      case 'PUT':
        return await this.request.put(url, { headers, data: body });
      case 'PATCH':
        return await this.request.patch(url, { headers, data: body });
      case 'DELETE':
        return await this.request.delete(url, { headers });
    }
  }

  /**
   * Get all data sources
   */
  async getDataSources() {
    return await this.authenticatedRequest('GET', '/api/data-sources');
  }

  /**
   * Create a new data source
   */
  async createDataSource(data: {
    name: string;
    description?: string;
    clientType: string;
    connectionConfig: any;
  }) {
    return await this.authenticatedRequest('POST', '/api/data-sources', data);
  }

  /**
   * Get data source by ID
   */
  async getDataSource(id: string) {
    return await this.authenticatedRequest('GET', `/api/data-sources/${id}`);
  }

  /**
   * Update data source
   */
  async updateDataSource(id: string, data: {
    name?: string;
    description?: string;
    clientType?: string;
    connectionConfig?: any;
  }) {
    return await this.authenticatedRequest('PATCH', `/api/data-sources/${id}`, data);
  }

  /**
   * Delete data source
   */
  async deleteDataSource(id: string) {
    return await this.authenticatedRequest('DELETE', `/api/data-sources/${id}`);
  }

  /**
   * Test data source connection
   */
  async testDataSource(data: {
    clientType: string;
    connectionConfig: any;
  }) {
    return await this.authenticatedRequest('POST', '/api/data-sources/test', data);
  }

  /**
   * Get active data sources
   */
  async getActiveDataSources() {
    return await this.authenticatedRequest('GET', '/api/data-sources/active');
  }

  /**
   * Get saved queries
   */
  async getQueries(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/queries${queryString}`);
  }

  /**
   * Create a saved query
   */
  async createQuery(data: {
    name: string;
    description?: string;
    dataSourceId: string;
    sqlContent: string;
    parametersSchema?: any;
  }) {
    return await this.authenticatedRequest('POST', '/api/queries', data);
  }

  /**
   * Get query by ID
   */
  async getQuery(id: string) {
    return await this.authenticatedRequest('GET', `/api/queries/${id}`);
  }

  /**
   * Update query
   */
  async updateQuery(id: string, data: {
    name?: string;
    description?: string;
    dataSourceId?: string;
    sqlContent?: string;
    parametersSchema?: any;
  }) {
    return await this.authenticatedRequest('PATCH', `/api/queries/${id}`, data);
  }

  /**
   * Delete query
   */
  async deleteQuery(id: string) {
    return await this.authenticatedRequest('DELETE', `/api/queries/${id}`);
  }

  /**
   * Execute query
   */
  async executeQuery(id: string) {
    return await this.authenticatedRequest('POST', `/api/queries/${id}/execute`);
  }

  /**
   * Execute SQL
   */
  async executeSql(data: {
    sql: string;
    dataSourceId: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.authenticatedRequest('POST', '/api/sql/execute', data);
  }

  /**
   * Execute SQL for testing (allows DDL statements like CREATE TABLE, INSERT, etc.)
   * This is a test-only endpoint that bypasses the read-only query restriction
   */
  async executeTestSql(data: {
    sql: string;
    dataSourceId: string;
  }) {
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': this.authCookie,
      'x-test-mode': 'true',
    };

    return await this.request.post('/api/test/sql/execute', {
      headers,
      data: JSON.stringify(data),
    });
  }

  /**
   * Validate SQL
   */
  async validateSql(data: { sql: string }) {
    return await this.authenticatedRequest('POST', '/api/sql/validate', data);
  }

  /**
   * Get SQL schema for data source
   */
  async getSqlSchema(dataSourceId: string) {
    return await this.authenticatedRequest('GET', `/api/sql/schema/${dataSourceId}`);
  }

  /**
   * Get reports
   */
  async getReports(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/reports${queryString}`);
  }

  /**
   * Create a report
   */
  async createReport(data: {
    name: string;
    description?: string;
    savedQueryId: string;
  }) {
    return await this.authenticatedRequest('POST', '/api/reports', data);
  }

  /**
   * Get report by ID
   */
  async getReport(id: string) {
    return await this.authenticatedRequest('GET', `/api/reports/${id}`);
  }

  /**
   * Update report
   */
  async updateReport(id: string, data: {
    name?: string;
    description?: string;
    savedQueryId?: string;
  }) {
    return await this.authenticatedRequest('PATCH', `/api/reports/${id}`, data);
  }

  /**
   * Delete report
   */
  async deleteReport(id: string) {
    return await this.authenticatedRequest('DELETE', `/api/reports/${id}`);
  }

  /**
   * Export report
   */
  async exportReport(id: string, format: 'pdf' | 'xlsx' | 'csv') {
    return await this.authenticatedRequest('POST', `/api/reports/${id}/export`, { format });
  }

  /**
   * Get charts
   */
  async getCharts(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/charts${queryString}`);
  }

  /**
   * Create a chart
   */
  async createChart(data: {
    name: string;
    description?: string;
    savedQueryId: string;
    chartType: string;
    config: any;
  }) {
    return await this.authenticatedRequest('POST', '/api/charts', data);
  }

  /**
   * Get dashboards
   */
  async getDashboards(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/dashboards${queryString}`);
  }

  /**
   * Create a dashboard
   */
  async createDashboard(data: {
    name: string;
    description?: string;
    isPublic?: boolean;
  }) {
    return await this.authenticatedRequest('POST', '/api/dashboards', data);
  }

  /**
   * Get filters
   */
  async getFilters(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/filters${queryString}`);
  }

  /**
   * Create a filter
   */
  async createFilter(data: {
    name: string;
    description?: string;
    type: 'single' | 'multi';
    options: any[];
  }) {
    return await this.authenticatedRequest('POST', '/api/filters', data);
  }

  /**
   * Get jobs
   */
  async getJobs(params?: { page?: number; pageSize?: number }) {
    const queryString = params ? `?page=${params.page}&pageSize=${params.pageSize}` : '';
    return await this.authenticatedRequest('GET', `/api/jobs${queryString}`);
  }

  /**
   * Create a job definition
   */
  async createJob(data: {
    name: string;
    description?: string;
    savedQueryId: string;
    schedule: string;
    recipients?: any[];
  }) {
    // Transform the request body to match API expectations
    const requestBody = {
      name: data.name,
      description: data.description,
      target_id: data.savedQueryId,  // Map savedQueryId to target_id
      schedule_cron: data.schedule,   // Map schedule to schedule_cron
    };
    return await this.authenticatedRequest('POST', '/api/jobs', requestBody);
  }

  /**
   * Run job
   */
  async runJob(jobDefinitionId: string) {
    return await this.authenticatedRequest('POST', `/api/jobs/${jobDefinitionId}/run`);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return await this.authenticatedRequest('GET', `/api/jobs/status?jobId=${jobId}`);
  }

  /**
   * Pause job
   */
  async pauseJob(jobDefinitionId: string) {
    return await this.authenticatedRequest('POST', `/api/jobs/pause`, { jobDefinitionId });
  }

  /**
   * Resume job
   */
  async resumeJob(jobDefinitionId: string) {
    return await this.authenticatedRequest('POST', `/api/jobs/resume`, { jobDefinitionId });
  }

  /**
   * Get admin users
   */
  async getAdminUsers() {
    return await this.authenticatedRequest('GET', '/api/admin/users');
  }

  /**
   * Create admin user
   */
  async createAdminUser(data: {
    name: string;
    email: string;
    password: string;
    roleIds?: string[];
  }) {
    return await this.authenticatedRequest('POST', '/api/admin/users', data);
  }

  /**
   * Update admin user
   */
  async updateAdminUser(id: string, data: {
    name?: string;
    email?: string;
    isActive?: boolean;
  }) {
    return await this.authenticatedRequest('PATCH', `/api/admin/users/${id}`, data);
  }

  /**
   * Delete admin user
   */
  async deleteAdminUser(id: string) {
    return await this.authenticatedRequest('DELETE', `/api/admin/users/${id}`);
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string) {
    return await this.authenticatedRequest('GET', `/api/admin/users/${userId}/roles`);
  }

  /**
   * Update user roles
   */
  async updateUserRoles(userId: string, roleIds: string[]) {
    return await this.authenticatedRequest('PATCH', `/api/admin/users/${userId}/roles`, { roleIds });
  }

  /**
   * Get roles
   */
  async getRoles() {
    return await this.authenticatedRequest('GET', '/api/admin/roles');
  }

  /**
   * Create role
   */
  async createRole(data: {
    name: string;
    description?: string;
    permissions?: string[];
  }) {
    return await this.authenticatedRequest('POST', '/api/admin/roles', data);
  }

  /**
   * Get health status
   */
  async getHealth() {
    return await this.authenticatedRequest('GET', '/api/health');
  }

  /**
   * List data sources (alias for getDataSources)
   */
  async listDataSources() {
    return this.getDataSources();
  }

  /**
   * Inspect datasource schema
   */
  async inspectSchema(dataSourceId: string) {
    return await this.authenticatedRequest('POST', `/api/data-sources/${dataSourceId}/inspect`);
  }

  /**
   * Get metadata entities for a datasource
   */
  async getMetadataEntities(dataSourceId: string, params?: {
    include_hidden?: boolean;
    is_active?: boolean;
  }) {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return await this.authenticatedRequest('GET', `/api/metadata/entities${queryString}`);
  }

  /**
   * Reset inspection state for testing
   */
  async resetInspectionState(dataSourceId: string) {
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': this.authCookie,
      'x-test-mode': 'true',
    };

    return await this.request.post('/api/test/sql/execute', {
      headers,
      data: JSON.stringify({
        sql: `UPDATE data_sources SET is_inspected = 0 WHERE id = '${dataSourceId}'`,
        dataSourceId,
      }),
    });
  }

  /**
   * Clear metadata entities for testing
   */
  async clearMetadataEntities(dataSourceId: string) {
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': this.authCookie,
      'x-test-mode': 'true',
    };

    return await this.request.post('/api/test/sql/execute', {
      headers,
      data: JSON.stringify({
        sql: `DELETE FROM metadata_entity_field WHERE entity_header_id IN (SELECT id FROM metadata_entity_header WHERE data_source_id = '${dataSourceId}'); DELETE FROM metadata_entity_header WHERE data_source_id = '${dataSourceId}'`,
        dataSourceId,
      }),
    });
  }

  /**
   * Helper to extract response data
   */
  static async extractJson<T = any>(response: APIResponse): Promise<T> {
    return await response.json() as Promise<T>;
  }

  /**
   * Helper to check if response is successful
   */
  static isSuccess(response: APIResponse): boolean {
    return response.status() >= 200 && response.status() < 300;
  }
}
