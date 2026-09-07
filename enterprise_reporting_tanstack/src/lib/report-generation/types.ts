export interface ReportIntent {
  intentType: "report_generation";
  dataSourceHint: string;
  metrics: string[];
  dimensions: string[];
  filters: FilterClause[];
  dateRange?: { from: string; to: string };
  chartType: "bar" | "line" | "pie" | "area" | "none";
  outputFormats: OutputFormat[];
  recipients: RecipientEntry[];
  schedule: string | null;
  reportTitle: string;
}

export type OutputFormat = "excel" | "pdf" | "csv";

export interface FilterClause {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "like" | "in";
  value: string | number;
  value2?: string | number;
}

export interface RecipientEntry {
  type: "email" | "userId";
  value: string;
}

export interface NLReportDefinition {
  id: string;
  title: string;
  created_by: string;
  data_source_id: string;
  nl_query: string;
  generated_sql: string;
  metric_columns: string[];
  dimension_columns: string[];
  filter_config: FilterClause[] | null;
  date_range_from: string | null;
  date_range_to: string | null;
  chart_type: string;
  output_formats: OutputFormat[];
  recipient_config: RecipientEntry[];
  schedule_cron: string | null;
  schedule_timezone: string;
  schedule_enabled: boolean;
  rbac_snapshot: RBACWorkflowSnapshotRef;
  rbac_snapshot_version: number;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface RBACWorkflowSnapshotRef {
  userId: string;
  userRoles: string[];
  accessibleDataSources: {
    id: string;
    name: string;
    allowedTables: string[];
    allowedColumns: Record<string, string[]>;
    rowFilters: Record<string, string>;
  }[];
  resolvedAt: string;
  snapshotVersion: number;
}

export interface ReportArtifact {
  id: string;
  report_definition_id: string;
  execution_id: string;
  created_by: string;
  format: OutputFormat;
  file_path: string;
  file_size_bytes: number | null;
  row_count: number | null;
  chart_type: string | null;
  execution_ms: number | null;
  status: "complete" | "failed";
  error_message: string | null;
  triggered_by: "manual" | "scheduled";
  sql_executed: string | null;
  created_at: string;
}

export interface ReportGenerationResult {
  status: "COMPLETE" | "FAILED" | "PERMISSION_REVOKED" | "NO_DATA" | "ROW_LIMIT_HIT";
  executionId: string;
  artifacts: { format: OutputFormat; filePath: string; fileSizeBytes: number }[];
  rowCount: number;
  executionMs: number;
  errorMessage?: string;
}

export interface ReportHistoryEntry {
  id: string;
  title: string;
  nlQuery: string;
  dataSourceName: string;
  chartType: string;
  createdAt: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  artifactCount: number;
  formats: OutputFormat[];
}

export interface ReportBuilderState {
  phase:
    | "idle"
    | "classifying"
    | "rbac_check"
    | "generating_sql"
    | "preview_ready"
    | "confirmed"
    | "generating"
    | "complete"
    | "error";
  intent?: ReportIntent;
  previewRows?: Record<string, unknown>[];
  previewColumns?: string[];
  generatedSQL?: string;
  reportDefinitionId?: string;
  artifactUrls?: { excel?: string; pdf?: string; csv?: string };
  errorMessage?: string;
  historyReports?: ReportHistoryEntry[];
}
