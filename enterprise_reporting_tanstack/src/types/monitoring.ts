import type { ColumnDefinition } from "./database";

export type ThresholdOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between";
export type ThresholdStatus = "PASS" | "BREACH" | "ESCALATE" | "NO_DATA" | "ERROR";
export type AlertChannel = "email" | "in_app" | "webhook";
export type BreachSeverity = "WARNING" | "CRITICAL";
export type MonitoringRuleStatus = "active" | "paused" | "error" | "archived";
export type EvaluationPhase = "rbac_check" | "sql_execution" | "threshold_eval" | "alert_dispatch";

export interface AlertRecipient {
  type: "user" | "role";
  id: string;
  email?: string;
}

export interface MonitoringRule {
  id: string;
  name: string;
  description?: string;
  report_definition_id: string;
  job_definition_id?: string;
  data_source_id: string;
  created_by: string;
  metric_column: string;
  threshold_operator: ThresholdOperator;
  threshold_value: number;
  threshold_upper_bound?: number;
  escalation_threshold_pct: number;
  cron_expression: string;
  timezone: string;
  trigger_schedule_id?: string;
  alert_channels: AlertChannel[];
  alert_recipients: AlertRecipient[];
  webhook_url?: string;
  notify_on_pass: boolean;
  notify_on_no_data: boolean;
  rbac_snapshot: RBACWorkflowSnapshot;
  rbac_snapshot_version: number;
  is_active: boolean;
  is_paused: boolean;
  pause_reason?: string;
  original_nl_request?: string;
  adk_intent_id?: string;
  last_executed_at?: string;
  last_execution_status?: ThresholdStatus;
  last_metric_value?: number;
  consecutive_breaches: number;
  total_executions: number;
  total_alerts_sent: number;
  created_at: string;
  updated_at: string;
}

export interface MonitoringExecution {
  id: string;
  monitoring_rule_id: string;
  job_execution_id?: string;
  executed_at: string;
  execution_ms?: number;
  rows_returned?: number;
  sql_executed?: string;
  metric_value?: number;
  previous_metric_value?: number;
  delta_pct?: number;
  evaluation_status: ThresholdStatus;
  evaluation_detail?: string;
  alert_dispatched: boolean;
  alert_channels_used?: AlertChannel[];
  alert_recipients_sent?: string[];
  alert_sent_at?: string;
  error_message?: string;
  error_phase?: EvaluationPhase;
  created_at: string;
}

export interface RBACWorkflowSnapshot {
  userId: string;
  userRoles: string[];
  accessibleDataSources: AccessibleDataSource[];
  resolvedAt: string;
  snapshotVersion: number;
}

export interface AccessibleDataSource {
  id: string;
  name: string;
  allowedTables: string[];
  allowedColumns: Record<string, string[]>;
  rowFilters: Record<string, string>;
}

export interface ThresholdEvaluation {
  status: ThresholdStatus;
  actualValue: number | null;
  thresholdValue: number;
  operator: ThresholdOperator;
  deltaFromPrevious?: number;
  breachSeverity?: BreachSeverity;
  message: string;
}

export interface AlertDispatchResult {
  channel: AlertChannel;
  success: boolean;
  messageId?: string;
  recipientCount: number;
  error?: string;
}

export interface CreateMonitoringRuleInput {
  name: string;
  description?: string;
  reportDefinitionId: string;
  dataSourceId: string;
  metricColumn: string;
  thresholdOperator: ThresholdOperator;
  thresholdValue: number;
  thresholdUpperBound?: number;
  escalationThresholdPct?: number;
  cronExpression: string;
  timezone?: string;
  alertChannels: AlertChannel[];
  alertRecipients: AlertRecipient[];
  webhookUrl?: string;
  notifyOnPass?: boolean;
  notifyOnNoData?: boolean;
  originalNlRequest?: string;
  adkIntentId?: string;
  createdBy: string;
  rbacSnapshot: RBACWorkflowSnapshot;
}

export interface MonitoringEvaluatePayload {
  ruleId: string;
  triggeredBy?: "schedule" | "manual" | "on_premise_cron";
}

export interface RBACDriftResult {
  driftType:
    | "PERMISSION_REVOKED"
    | "PERMISSION_REDUCED"
    | "PERMISSION_EXPANDED"
    | "DATA_SOURCE_DELETED"
    | "NO_DRIFT";
  canProceed: boolean;
  details: string;
}
