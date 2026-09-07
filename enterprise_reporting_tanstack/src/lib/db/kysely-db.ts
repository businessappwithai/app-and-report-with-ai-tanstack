/**
 * Kysely Database Configuration
 * Config database: PostgreSQL only (via DATABASE_URL or POSTGRES_* env vars)
 */

import { Kysely, PostgresDialect } from "kysely";
import { Pool as PostgresPool } from "pg";
import { bootstrapSchema } from "./bootstrap";

export interface Database {
  users: UsersTable;
  roles: RolesTable;
  user_roles: UserRolesTable;
  data_sources: DataSourcesTable;
  saved_queries: SavedQueriesTable;
  report_definitions: ReportDefinitionsTable;
  chart_definitions: ChartDefinitionsTable;
  dashboard_layouts: DashboardLayoutsTable;
  dashboard_widgets: DashboardWidgetsTable;
  job_definitions: JobDefinitionsTable;
  job_executions: JobExecutionsTable;
  audit_log: AuditLogTable;
  logs: LogsTable;
  email_templates: EmailTemplatesTable;
  resource_permissions: ResourcePermissionsTable;
  filter_definitions: FilterDefinitionsTable;
  report_filters: ReportFiltersTable;
  chart_filters: ChartFiltersTable;
  ds_roles: DsRolesTable;
  ds_user_roles: DsUserRolesTable;
  ds_entity_permissions: DsEntityPermissionsTable;
  schema_field_instructions: SchemaFieldInstructionsTable;
  schema_table_instructions: SchemaTableInstructionsTable;
  nl_query_context: NLQueryContextTable;
  nl_query_role_stats: NLQueryRoleStatsTable;
  nl_query_feedback: NLQueryFeedbackTable;
  help_articles: HelpArticleRow;
}

export interface UsersTable {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolesTable {
  id: string;
  name: string;
  description: string | null;
  permissions: string; // JSON array
  created_at: string;
}

export interface UserRolesTable {
  user_id: string;
  role_id: string;
  assigned_at: string;
}

export interface DataSourcesTable {
  id: string;
  name: string;
  description: string | null;
  client_type: string;
  connection_config: string; // Encrypted JSON
  is_active: boolean;
  is_editable: boolean | null;
  is_inspected: boolean | null;
  last_inspected_at: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedQueriesTable {
  id: string;
  name: string;
  description: string | null;
  data_source_id: string;
  sql_content: string;
  parameters_schema: string | null; // JSON Schema
  is_validated: boolean;
  validation_result: string | null; // JSON
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDefinitionsTable {
  id: string;
  name: string;
  description: string | null;
  saved_query_id: string | null;
  column_config: string; // JSON
  filter_config: string | null; // JSON
  sort_config: string | null; // JSON
  pagination_config: string | null; // JSON
  export_formats: string; // JSON array
  filename_template: string | null;
  color_theme: string | null; // JSON
  is_public: boolean | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartDefinitionsTable {
  id: string;
  name: string;
  description: string | null;
  saved_query_id: string | null;
  chart_type: string;
  chart_config: string; // JSON
  data_mapping: string; // JSON
  refresh_interval: number | null;
  color_theme: string | null; // JSON
  is_public: boolean | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayoutsTable {
  id: string;
  name: string;
  description: string | null;
  layout_config: string; // JSON
  theme_config: string | null; // JSON
  refresh_config: string | null; // JSON
  is_public: boolean;
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidgetsTable {
  id: string;
  dashboard_id: string;
  widget_type: string;
  report_id: string | null;
  chart_id: string | null;
  position_config: string; // JSON
  widget_config: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export interface JobDefinitionsTable {
  id: string;
  name: string;
  job_type: string;
  target_id: string;
  schedule_cron: string | null;
  parameters: string | null; // JSON
  notification_config: string | null; // JSON
  is_active: boolean;
  is_deleted: boolean | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobsTable {
  id: string;
  name: string;
  description: string | null;
  query_id: string | null;
  report_id: string | null;
  schedule: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobExecutionsTable {
  id: string;
  job_definition_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  result_location: string | null;
  error_message: string | null;
  execution_metadata: string | null; // JSON
  created_at: string;
}

export interface AuditLogTable {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null; // JSON
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface LogsTable {
  id?: string;
  timestamp: string;
  level: string;
  message: string;
  component: string;
  user_id: string | null;
  session_id: string | null;
  metadata: string | null; // JSON
  error_stack: string | null;
  request_id: string | null;
  message_vector: string | null;
}

export interface EmailTemplatesTable {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ResourcePermissionsTable {
  id: string;
  resource_type: string;
  resource_id: string;
  role_id: string;
  permission_level: string;
  created_at: string;
}

export interface FilterDefinitionsTable {
  id: string;
  name: string;
  description: string | null;
  data_source_id: string;
  filter_query: string;
  display_field: string;
  value_field: string;
  field_type: string | null;
  operator: string | null;
  date_validation_config: string | null; // JSON
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportFiltersTable {
  id: string;
  report_id: string;
  filter_id: string;
  target_column: string;
  filter_order: number;
  created_at: string;
}

export interface ChartFiltersTable {
  id: string;
  chart_id: string;
  filter_id: string;
  target_column: string;
  filter_order: number;
  created_at: string;
}

export interface DsRolesTable {
  id: string;
  data_source_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DsUserRolesTable {
  data_source_id: string;
  user_id: string;
  ds_role_id: string;
  assigned_at: string;
}

export interface DsEntityPermissionsTable {
  id: string;
  data_source_id: string;
  ds_role_id: string;
  entity_name: string;
  entity_type: string;
  entity_schema: string | null;
  permission_level: string;
  column_restrictions: string | null; // JSON
  row_filter: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemaFieldInstructionsTable {
  id: string;
  data_source_id: string;
  table_name: string;
  field_name: string;
  field_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_table: string | null;
  foreign_key_field: string | null;
  description: string | null;
  llm_instructions: string | null;
  example_values: string | null;
  constraints: string | null;
  business_meaning: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface SchemaTableInstructionsTable {
  id: string;
  data_source_id: string;
  table_name: string;
  description: string | null;
  llm_instructions: string | null;
  example_queries: string | null;
  business_domain: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface NLQueryContextTable {
  id: string;
  data_source_id: string;
  user_id: string;
  role_name: string;
  nl_question: string;
  generated_sql: string;
  nl_question_embedding: string | null;
  schema_context: string; // JSON
  rbac_context: string; // JSON
  field_instructions: string | null; // JSON
  execution_time_ms: number | null;
  row_count: number | null;
  was_successful: boolean;
  error_message: string | null;
  translation_confidence: number | null;
  llm_confidence: number | null;
  query_type: string | null;
  table_count: number | null;
  join_count: number | null;
  has_aggregation: boolean | null;
  has_window_function: boolean | null;
  created_by: string | null;
  created_at: string;
}

export interface NLQueryRoleStatsTable {
  id: string;
  role_name: string;
  data_source_id: string;
  total_queries: number | null;
  successful_queries: number | null;
  failed_queries: number | null;
  success_rate: number | null;
  avg_execution_time_ms: number | null;
  avg_rows_returned: number | null;
  avg_confidence: number | null;
  common_query_types: string | null; // JSON
  common_tables: string | null; // JSON
  common_joins: string | null; // JSON
  updated_at: string;
}

export interface NLQueryFeedbackTable {
  id: string;
  nl_query_context_id: string;
  feedback_type: string | null;
  user_feedback: string | null;
  corrected_sql: string | null;
  feedback_by: string | null;
  created_at: string;
}

export interface HelpArticleRow {
  id: string;
  category: string;
  icon: string;
  color: string;
  title: string;
  summary: string;
  content: string;
  keywords: string;
  sort_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export type KyselyDB = Kysely<Database>;

let db: KyselyDB | null = null;

function buildConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.POSTGRES_HOST || process.env.PGHOST || "localhost";
  const port = process.env.POSTGRES_PORT || process.env.PGPORT || "5432";
  const database = process.env.POSTGRES_DB || process.env.PGDATABASE || "enterprise_config";
  const user = process.env.POSTGRES_USER || process.env.PGUSER || "enterprise";
  const password = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "";

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function initializeDatabase(): KyselyDB {
  const connectionString = buildConnectionString();
  const safeUrl = connectionString.replace(/:([^@]+)@/, ":***@");
  console.log(`[db] Connecting to PostgreSQL: ${safeUrl}`);

  const pool = new PostgresPool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

let bootstrapPromise: Promise<void> | null = null;

export function getDb(): KyselyDB {
  if (!db) {
    db = initializeDatabase();

    bootstrapPromise = bootstrapSchema(db)
      .then(() => console.log("[db] Database ready"))
      .catch((err) => console.error("[db] Bootstrap failed:", err));

    // biome-ignore lint/suspicious/noExplicitAny: internal bootstrap tracking
    (db as any).__bootstrapPromise = bootstrapPromise;
  }
  return db;
}

export async function waitForDatabaseReady(): Promise<void> {
  getDb();
  if (bootstrapPromise) await bootstrapPromise;
}

export function getConfigDB(): KyselyDB {
  return getDb();
}

export async function closeDb(): Promise<void> {
  if (db) {
    try {
      await db.destroy();
    } catch (err) {
      console.error("[db] Error closing database:", err);
    }
    db = null;
  }
}

/** Always true — config DB is now exclusively PostgreSQL */
export function isPostgres(): boolean {
  return true;
}
