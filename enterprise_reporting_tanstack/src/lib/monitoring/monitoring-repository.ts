import { getDb } from "@/lib/db/config";

function isoNow(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
import type {
  MonitoringRule,
  MonitoringExecution,
  CreateMonitoringRuleInput,
  ThresholdStatus,
  AlertChannel,
  AlertRecipient,
  RBACWorkflowSnapshot,
  EvaluationPhase,
} from "@/types/monitoring";
import type { ADKStoredIntent } from "@/types/adk";
import type { ADKIntent } from "@/types/adk";

// ---------------------------------------------------------------------------
// Type helpers for raw DB rows (LONGTEXT JSON columns stored as strings)
// ---------------------------------------------------------------------------

interface RawMonitoringRuleRow {
  id: string;
  name: string;
  description: string | null;
  report_definition_id: string;
  job_definition_id: string | null;
  data_source_id: string;
  created_by: string;
  metric_column: string;
  threshold_operator: string;
  threshold_value: string | number;
  threshold_upper_bound: string | number | null;
  escalation_threshold_pct: string | number;
  cron_expression: string;
  timezone: string;
  trigger_schedule_id: string | null;
  alert_channels: string; // JSON
  alert_recipients: string; // JSON
  webhook_url: string | null;
  notify_on_pass: number | boolean;
  notify_on_no_data: number | boolean;
  rbac_snapshot: string; // JSON
  rbac_snapshot_version: number;
  is_active: number | boolean;
  is_paused: number | boolean;
  pause_reason: string | null;
  original_nl_request: string | null;
  adk_intent_id: string | null;
  last_executed_at: string | null;
  last_execution_status: string | null;
  last_metric_value: string | number | null;
  consecutive_breaches: number;
  total_executions: number;
  total_alerts_sent: number;
  created_at: string;
  updated_at: string;
}

interface RawExecutionRow {
  id: string;
  monitoring_rule_id: string;
  job_execution_id: string | null;
  executed_at: string;
  execution_ms: number | null;
  rows_returned: number | null;
  sql_executed: string | null;
  metric_value: string | number | null;
  previous_metric_value: string | number | null;
  delta_pct: string | number | null;
  evaluation_status: string;
  evaluation_detail: string | null;
  alert_dispatched: number | boolean;
  alert_channels_used: string | null; // JSON
  alert_recipients_sent: string | null; // JSON
  alert_sent_at: string | null;
  error_message: string | null;
  error_phase: string | null;
  created_at: string;
}

interface RawAdkIntentRow {
  id: string;
  user_id: string;
  session_id: string | null;
  raw_nl_request: string;
  request_source: string;
  intent_type: string;
  confidence: string | number | null;
  adk_intent_json: string; // JSON
  pipeline_status: string;
  report_definition_id: string | null;
  monitoring_rule_id: string | null;
  error_message: string | null;
  classification_ms: number | null;
  total_pipeline_ms: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Deserialization helpers
// ---------------------------------------------------------------------------

function deserializeRule(row: RawMonitoringRuleRow): MonitoringRule {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    report_definition_id: row.report_definition_id,
    job_definition_id: row.job_definition_id ?? undefined,
    data_source_id: row.data_source_id,
    created_by: row.created_by,
    metric_column: row.metric_column,
    threshold_operator: row.threshold_operator as MonitoringRule["threshold_operator"],
    threshold_value: Number(row.threshold_value),
    threshold_upper_bound:
      row.threshold_upper_bound !== null ? Number(row.threshold_upper_bound) : undefined,
    escalation_threshold_pct: Number(row.escalation_threshold_pct),
    cron_expression: row.cron_expression,
    timezone: row.timezone,
    trigger_schedule_id: row.trigger_schedule_id ?? undefined,
    alert_channels: JSON.parse(row.alert_channels) as AlertChannel[],
    alert_recipients: JSON.parse(row.alert_recipients) as AlertRecipient[],
    webhook_url: row.webhook_url ?? undefined,
    notify_on_pass: Boolean(row.notify_on_pass),
    notify_on_no_data: Boolean(row.notify_on_no_data),
    rbac_snapshot: JSON.parse(row.rbac_snapshot) as RBACWorkflowSnapshot,
    rbac_snapshot_version: row.rbac_snapshot_version,
    is_active: Boolean(row.is_active),
    is_paused: Boolean(row.is_paused),
    pause_reason: row.pause_reason ?? undefined,
    original_nl_request: row.original_nl_request ?? undefined,
    adk_intent_id: row.adk_intent_id ?? undefined,
    last_executed_at: row.last_executed_at ?? undefined,
    last_execution_status: (row.last_execution_status as ThresholdStatus | null) ?? undefined,
    last_metric_value:
      row.last_metric_value !== null ? Number(row.last_metric_value) : undefined,
    consecutive_breaches: row.consecutive_breaches,
    total_executions: row.total_executions,
    total_alerts_sent: row.total_alerts_sent,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function deserializeExecution(row: RawExecutionRow): MonitoringExecution {
  return {
    id: row.id,
    monitoring_rule_id: row.monitoring_rule_id,
    job_execution_id: row.job_execution_id ?? undefined,
    executed_at: row.executed_at,
    execution_ms: row.execution_ms ?? undefined,
    rows_returned: row.rows_returned ?? undefined,
    sql_executed: row.sql_executed ?? undefined,
    metric_value: row.metric_value !== null ? Number(row.metric_value) : undefined,
    previous_metric_value:
      row.previous_metric_value !== null ? Number(row.previous_metric_value) : undefined,
    delta_pct: row.delta_pct !== null ? Number(row.delta_pct) : undefined,
    evaluation_status: row.evaluation_status as ThresholdStatus,
    evaluation_detail: row.evaluation_detail ?? undefined,
    alert_dispatched: Boolean(row.alert_dispatched),
    alert_channels_used: row.alert_channels_used
      ? (JSON.parse(row.alert_channels_used) as AlertChannel[])
      : undefined,
    alert_recipients_sent: row.alert_recipients_sent
      ? (JSON.parse(row.alert_recipients_sent) as string[])
      : undefined,
    alert_sent_at: row.alert_sent_at ?? undefined,
    error_message: row.error_message ?? undefined,
    error_phase: (row.error_phase as EvaluationPhase | null) ?? undefined,
    created_at: row.created_at,
  };
}

function deserializeAdkIntent(row: RawAdkIntentRow): ADKStoredIntent {
  return {
    id: row.id,
    user_id: row.user_id,
    session_id: row.session_id ?? undefined,
    raw_nl_request: row.raw_nl_request,
    request_source: row.request_source as ADKStoredIntent["request_source"],
    intent_type: row.intent_type,
    confidence: row.confidence !== null ? Number(row.confidence) : undefined,
    adk_intent_json: JSON.parse(row.adk_intent_json) as ADKIntent,
    pipeline_status: row.pipeline_status as ADKStoredIntent["pipeline_status"],
    report_definition_id: row.report_definition_id ?? undefined,
    monitoring_rule_id: row.monitoring_rule_id ?? undefined,
    error_message: row.error_message ?? undefined,
    classification_ms: row.classification_ms ?? undefined,
    total_pipeline_ms: row.total_pipeline_ms ?? undefined,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Monitoring Rule CRUD
// ---------------------------------------------------------------------------

export async function createMonitoringRule(
  input: CreateMonitoringRuleInput
): Promise<MonitoringRule> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = isoNow();

  await (db as any)
    .insertInto("monitoring_rules")
    .values({
      id,
      name: input.name,
      description: input.description ?? null,
      report_definition_id: input.reportDefinitionId,
      job_definition_id: null,
      data_source_id: input.dataSourceId,
      created_by: input.createdBy,
      metric_column: input.metricColumn,
      threshold_operator: input.thresholdOperator,
      threshold_value: input.thresholdValue,
      threshold_upper_bound: input.thresholdUpperBound ?? null,
      escalation_threshold_pct: input.escalationThresholdPct ?? 20.0,
      cron_expression: input.cronExpression,
      timezone: input.timezone ?? "UTC",
      trigger_schedule_id: null,
      alert_channels: JSON.stringify(input.alertChannels),
      alert_recipients: JSON.stringify(input.alertRecipients),
      webhook_url: input.webhookUrl ?? null,
      notify_on_pass: input.notifyOnPass ?? false,
      notify_on_no_data: input.notifyOnNoData ?? true,
      rbac_snapshot: JSON.stringify(input.rbacSnapshot),
      rbac_snapshot_version: input.rbacSnapshot.snapshotVersion,
      is_active: true,
      is_paused: false,
      pause_reason: null,
      original_nl_request: input.originalNlRequest ?? null,
      adk_intent_id: input.adkIntentId ?? null,
      last_executed_at: null,
      last_execution_status: null,
      last_metric_value: null,
      consecutive_breaches: 0,
      total_executions: 0,
      total_alerts_sent: 0,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const created = await getMonitoringRule(id);
  if (!created) {
    throw new Error(`Failed to retrieve newly created monitoring rule ${id}`);
  }
  return created;
}

export async function getMonitoringRule(id: string): Promise<MonitoringRule | null> {
  const db = getDb();
  const row = await (db as any)
    .selectFrom("monitoring_rules")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!row) return null;
  return deserializeRule(row as RawMonitoringRuleRow);
}

export async function listMonitoringRules(
  userId: string,
  isAdmin: boolean,
  page: number,
  pageSize: number
): Promise<{ rules: MonitoringRule[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  let baseQuery = (db as any).selectFrom("monitoring_rules").where("is_active", "=", true);

  if (!isAdmin) {
    baseQuery = baseQuery.where("created_by", "=", userId);
  }

  const countResult = await baseQuery
    .select((eb: any) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  const total = Number((countResult as any)?.count ?? 0);

  const rows = await baseQuery
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(pageSize)
    .offset(offset)
    .execute();

  const rules = (rows as RawMonitoringRuleRow[]).map(deserializeRule);

  return { rules, total };
}

export async function updateMonitoringRule(
  id: string,
  updates: Partial<MonitoringRule>
): Promise<MonitoringRule | null> {
  const db = getDb();
  const now = isoNow();

  // Serialize JSON columns if present in updates
  const serialized: Record<string, unknown> = { updated_at: now };

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === "alert_channels" || key === "alert_recipients" || key === "rbac_snapshot") {
      serialized[key] = JSON.stringify(value);
    } else {
      serialized[key] = value;
    }
  }

  await (db as any)
    .updateTable("monitoring_rules")
    .set(serialized)
    .where("id", "=", id)
    .execute();

  return getMonitoringRule(id);
}

export async function deleteMonitoringRule(id: string): Promise<boolean> {
  const db = getDb();

  // Soft delete by deactivating the rule
  const result = await (db as any)
    .updateTable("monitoring_rules")
    .set({ is_active: false, updated_at: isoNow() })
    .where("id", "=", id)
    .execute();

  return ((result as any)?.numChangedRows ?? (result as any)?.numUpdatedRows ?? 0) > 0;
}

export async function pauseMonitoringRule(
  id: string,
  reason?: string
): Promise<MonitoringRule | null> {
  const db = getDb();
  const now = isoNow();

  await (db as any)
    .updateTable("monitoring_rules")
    .set({
      is_paused: true,
      pause_reason: reason ?? null,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();

  return getMonitoringRule(id);
}

export async function resumeMonitoringRule(id: string): Promise<MonitoringRule | null> {
  const db = getDb();
  const now = isoNow();

  await (db as any)
    .updateTable("monitoring_rules")
    .set({
      is_paused: false,
      pause_reason: null,
      updated_at: now,
    })
    .where("id", "=", id)
    .execute();

  return getMonitoringRule(id);
}

// ---------------------------------------------------------------------------
// Execution records
// ---------------------------------------------------------------------------

export async function recordExecution(
  execution: Omit<MonitoringExecution, "id" | "created_at">
): Promise<MonitoringExecution> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = isoNow();

  await (db as any)
    .insertInto("monitoring_executions")
    .values({
      id,
      monitoring_rule_id: execution.monitoring_rule_id,
      job_execution_id: execution.job_execution_id ?? null,
      executed_at: execution.executed_at,
      execution_ms: execution.execution_ms ?? null,
      rows_returned: execution.rows_returned ?? null,
      sql_executed: execution.sql_executed ?? null,
      metric_value: execution.metric_value ?? null,
      previous_metric_value: execution.previous_metric_value ?? null,
      delta_pct: execution.delta_pct ?? null,
      evaluation_status: execution.evaluation_status,
      evaluation_detail: execution.evaluation_detail ?? null,
      alert_dispatched: execution.alert_dispatched,
      alert_channels_used: execution.alert_channels_used
        ? JSON.stringify(execution.alert_channels_used)
        : null,
      alert_recipients_sent: execution.alert_recipients_sent
        ? JSON.stringify(execution.alert_recipients_sent)
        : null,
      alert_sent_at: execution.alert_sent_at ?? null,
      error_message: execution.error_message ?? null,
      error_phase: execution.error_phase ?? null,
      created_at: now,
    })
    .execute();

  const created = await (db as any)
    .selectFrom("monitoring_executions")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!created) {
    throw new Error(`Failed to retrieve newly created execution record ${id}`);
  }

  return deserializeExecution(created as RawExecutionRow);
}

export async function getExecutionHistory(
  ruleId: string,
  page: number,
  pageSize: number
): Promise<{ executions: MonitoringExecution[]; total: number }> {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  const countResult = await (db as any)
    .selectFrom("monitoring_executions")
    .where("monitoring_rule_id", "=", ruleId)
    .select((eb: any) => eb.fn.countAll().as("count"))
    .executeTakeFirst();

  const total = Number((countResult as any)?.count ?? 0);

  const rows = await (db as any)
    .selectFrom("monitoring_executions")
    .selectAll()
    .where("monitoring_rule_id", "=", ruleId)
    .orderBy("executed_at", "desc")
    .limit(pageSize)
    .offset(offset)
    .execute();

  const executions = (rows as RawExecutionRow[]).map(deserializeExecution);

  return { executions, total };
}

export async function getLastExecution(
  ruleId: string
): Promise<MonitoringExecution | null> {
  const db = getDb();

  const row = await (db as any)
    .selectFrom("monitoring_executions")
    .selectAll()
    .where("monitoring_rule_id", "=", ruleId)
    .orderBy("executed_at", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!row) return null;
  return deserializeExecution(row as RawExecutionRow);
}

/**
 * Update the denormalized last-execution summary columns on the rule itself.
 * Called at the end of each evaluation run to avoid expensive joins on reads.
 */
export async function updateRuleAfterExecution(
  ruleId: string,
  status: ThresholdStatus,
  metricValue: number | null,
  alertDispatched: boolean
): Promise<void> {
  const db = getDb();
  const now = isoNow();

  // Read current counters so we can increment atomically-ish
  const current = await (db as any)
    .selectFrom("monitoring_rules")
    .select(["consecutive_breaches", "total_executions", "total_alerts_sent"])
    .where("id", "=", ruleId)
    .executeTakeFirst();

  if (!current) return;

  const isBreach = status === "BREACH" || status === "ESCALATE";
  const consecutiveBreaches = isBreach ? (current.consecutive_breaches as number) + 1 : 0;
  const totalExecutions = (current.total_executions as number) + 1;
  const totalAlertsSent = alertDispatched
    ? (current.total_alerts_sent as number) + 1
    : (current.total_alerts_sent as number);

  await (db as any)
    .updateTable("monitoring_rules")
    .set({
      last_executed_at: now,
      last_execution_status: status,
      last_metric_value: metricValue,
      consecutive_breaches: consecutiveBreaches,
      total_executions: totalExecutions,
      total_alerts_sent: totalAlertsSent,
      updated_at: now,
    })
    .where("id", "=", ruleId)
    .execute();
}

// ---------------------------------------------------------------------------
// ADK Intent storage
// ---------------------------------------------------------------------------

export async function storeADKIntent(
  intent: Omit<ADKStoredIntent, "id" | "created_at">
): Promise<ADKStoredIntent> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = isoNow();

  await (db as any)
    .insertInto("adk_intents")
    .values({
      id,
      user_id: intent.user_id,
      session_id: intent.session_id ?? null,
      raw_nl_request: intent.raw_nl_request,
      request_source: intent.request_source,
      intent_type: intent.intent_type,
      confidence: intent.confidence ?? null,
      adk_intent_json: JSON.stringify(intent.adk_intent_json),
      pipeline_status: intent.pipeline_status,
      report_definition_id: intent.report_definition_id ?? null,
      monitoring_rule_id: intent.monitoring_rule_id ?? null,
      error_message: intent.error_message ?? null,
      classification_ms: intent.classification_ms ?? null,
      total_pipeline_ms: intent.total_pipeline_ms ?? null,
      created_at: now,
    })
    .execute();

  const created = await (db as any)
    .selectFrom("adk_intents")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!created) {
    throw new Error(`Failed to retrieve newly stored ADK intent ${id}`);
  }

  return deserializeAdkIntent(created as RawAdkIntentRow);
}

export async function updateADKIntent(
  id: string,
  updates: Partial<ADKStoredIntent>
): Promise<void> {
  const db = getDb();
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === "adk_intent_json") {
      serialized[key] = JSON.stringify(value);
    } else {
      serialized[key] = value;
    }
  }

  if (Object.keys(serialized).length === 0) return;

  await (db as any)
    .updateTable("adk_intents")
    .set(serialized)
    .where("id", "=", id)
    .execute();
}
