import type {
  ChartDefinition,
  ColumnDefinition,
  DashboardLayout,
  DashboardWidget,
  DataSource,
  JobDefinition,
  JobExecution,
  ReportDefinition,
  SavedQuery,
  User,
} from "./database";

// Generic API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiMeta {
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: Required<ApiMeta>;
}

// SQL Validation Types
export interface SQLValidationRequest {
  sql: string;
  dialect?: string;
  dataSourceId?: string;
}

export interface SQLValidationResponse {
  isValid: boolean;
  errors: SQLError[];
  warnings: SQLWarning[];
  ast?: unknown;
  estimatedCost?: QueryCost;
}

export interface SQLError {
  message: string;
  line?: number;
  column?: number;
  offset?: number;
}

export interface SQLWarning {
  message: string;
  line?: number;
  column?: number;
  type: "performance" | "security" | "style";
}

export interface QueryCost {
  estimatedRows?: number;
  estimatedCost?: number;
  explanation?: string;
}

// SQL Execution Types
export interface SQLExecutionRequest {
  sql: string;
  dataSourceId: string;
  parameters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  timeout?: number;
}

export interface QueryPagination {
  limit: number;
  offset: number;
  hasMore: boolean;
  totalRows?: number;
  serverSide?: boolean;
  maxClientRows?: number;
}

export interface SQLExecutionResponse {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows?: number;
  executionTime: number;
  truncated?: boolean;
  pagination?: QueryPagination;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean;
}

// Schema Introspection Types
export interface SchemaInfo {
  tables: TableInfo[];
  views: ViewInfo[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeyInfo[];
  indexes?: IndexInfo[];
}

export interface ViewInfo {
  name: string;
  schema?: string;
  columns: ColumnSchema[];
  definition?: string;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: unknown;
  isPrimaryKey?: boolean;
  comment?: string;
}

export interface ForeignKeyInfo {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

// Data Source Types
export type DataSourceListResponse = ApiResponse<PaginatedResponse<DataSource>>;
export type DataSourceResponse = ApiResponse<DataSource>;

export interface CreateDataSourceRequest {
  name: string;
  description?: string;
  clientType: string;
  connectionConfig: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    filename?: string;
    ssl?: boolean;
  };
}

export interface UpdateDataSourceRequest {
  name?: string;
  description?: string;
  connectionConfig?: CreateDataSourceRequest["connectionConfig"];
  isActive?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latency?: number;
}

// Query Types
export type SavedQueryListResponse = ApiResponse<PaginatedResponse<SavedQuery>>;
export type SavedQueryResponse = ApiResponse<SavedQuery>;

export interface CreateQueryRequest {
  name: string;
  description?: string;
  dataSourceId: string;
  sqlContent: string;
  parametersSchema?: Record<string, unknown>;
}

export interface UpdateQueryRequest {
  name?: string;
  description?: string;
  sqlContent?: string;
  parametersSchema?: Record<string, unknown>;
}

// Report Types
export type ReportListResponse = ApiResponse<PaginatedResponse<ReportDefinition>>;
export type ReportResponse = ApiResponse<ReportDefinition>;

export interface CreateReportRequest {
  name: string;
  description?: string;
  savedQueryId?: string;
  columnConfig: ColumnDefinition[];
  filterConfig?: FilterConfiguration;
  sortConfig?: SortConfiguration;
  paginationConfig?: PaginationConfiguration;
  exportFormats?: string[];
}

export interface UpdateReportRequest {
  name?: string;
  description?: string;
  savedQueryId?: string;
  columnConfig?: ColumnDefinition[];
  filterConfig?: FilterConfiguration;
  sortConfig?: SortConfiguration;
  paginationConfig?: PaginationConfiguration;
  exportFormats?: string[];
}

export interface FilterConfiguration {
  filters: FilterDefinition[];
  defaultFilters?: Record<string, unknown>;
}

export interface FilterDefinition {
  field: string;
  type: "text" | "number" | "date" | "select" | "multiselect" | "boolean";
  label?: string;
  operators?: string[];
  options?: Array<{ label: string; value: unknown }>;
}

export interface SortConfiguration {
  defaultSort?: Array<{ field: string; direction: "asc" | "desc" }>;
  sortableColumns?: string[];
}

export interface PaginationConfiguration {
  defaultPageSize: number;
  pageSizeOptions: number[];
  showPagination: boolean;
}

export interface ReportDataRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
}

export interface ReportDataResponse {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  meta: Required<ApiMeta>;
}

export interface ReportExportRequest {
  format: "csv" | "xlsx" | "pdf";
  filters?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  includeHeaders?: boolean;
}

// Chart Types
export type ChartListResponse = ApiResponse<PaginatedResponse<ChartDefinition>>;
export type ChartResponse = ApiResponse<ChartDefinition>;

export interface CreateChartRequest {
  name: string;
  description?: string;
  savedQueryId?: string;
  chartType: string;
  chartConfig: Record<string, unknown>;
  dataMapping: Record<string, unknown>;
  refreshInterval?: number;
}

export interface UpdateChartRequest {
  name?: string;
  description?: string;
  savedQueryId?: string;
  chartType?: string;
  chartConfig?: Record<string, unknown>;
  dataMapping?: Record<string, unknown>;
  refreshInterval?: number;
}

export interface ChartDataResponse {
  data: Record<string, unknown>[];
  meta?: {
    executionTime: number;
    rowCount: number;
  };
}

export interface ChartExportRequest {
  format: "png" | "svg";
  width?: number;
  height?: number;
}

// Dashboard Types
export type DashboardListResponse = ApiResponse<PaginatedResponse<DashboardLayout>>;
export type DashboardResponse = ApiResponse<DashboardLayout & { widgets: DashboardWidget[] }>;

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layoutConfig: Record<string, unknown>;
  themeConfig?: Record<string, unknown>;
  refreshConfig?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layoutConfig?: Record<string, unknown>;
  themeConfig?: Record<string, unknown>;
  refreshConfig?: Record<string, unknown>;
  isPublic?: boolean;
}

export interface AddWidgetRequest {
  widgetType: "report" | "chart" | "metric" | "text";
  reportId?: string;
  chartId?: string;
  positionConfig: { x: number; y: number; w: number; h: number };
  widgetConfig?: Record<string, unknown>;
}

export interface UpdateWidgetRequest {
  positionConfig?: { x: number; y: number; w: number; h: number };
  widgetConfig?: Record<string, unknown>;
}

// Job Types
export type JobListResponse = ApiResponse<PaginatedResponse<JobDefinition>>;
export type JobResponse = ApiResponse<JobDefinition>;
export type JobExecutionListResponse = ApiResponse<PaginatedResponse<JobExecution>>;

export interface CreateJobRequest {
  name: string;
  jobType: "report" | "chart" | "export";
  targetId: string;
  scheduleCron?: string;
  parameters?: Record<string, unknown>;
  notificationConfig?: {
    email?: string;
    webhookUrl?: string;
  };
}

export interface UpdateJobRequest {
  name?: string;
  scheduleCron?: string;
  parameters?: Record<string, unknown>;
  notificationConfig?: {
    email?: string;
    webhookUrl?: string;
  };
  isActive?: boolean;
}

export interface QueueJobRequest {
  jobDefinitionId?: string;
  jobType: "report" | "chart" | "export";
  targetId: string;
  parameters?: Record<string, unknown>;
  priority?: number;
}

export interface QueueJobResponse {
  jobId: string;
  status: string;
  position?: number;
}

// User Types (for admin)
export type UserListResponse = ApiResponse<PaginatedResponse<Omit<User, "password_hash">>>;
export type UserResponse = ApiResponse<Omit<User, "password_hash">>;

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  roleIds?: string[];
}

export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  isActive?: boolean;
  roleIds?: string[];
}
