/**
 * Mastra Supervisor Agent
 *
 * Coordinator agent that orchestrates the monitoring pipeline build.
 * Implements the supervisor-agent pattern:
 *   - Receives user intent
 *   - Delegates to specialist agents via tool calls
 *   - Enforces guardrails at each delegation step
 *   - Aggregates and validates final output
 *
 * This file runs in the Mastra Bun server context (not the TanStack app).
 * It does NOT use @/ path aliases — all imports are bare or relative.
 */

import { z } from "zod";

// ─── Guardrail Schemas ────────────────────────────────────────────────────────

export const IntentGuardrail = z.object({
  intent_type: z.enum(["monitoring_rule", "report_generate", "alert_create", "ambiguous"]),
  confidence: z.number().min(0).max(1),
  metric: z.string().optional(),
  data_hint: z.string().optional(),
  schedule_natural: z.string().optional(),
  schedule_cron: z.string().optional(),
  threshold_operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "between"]).optional(),
  threshold_value: z.number().optional(),
  alert_channels: z.array(z.string()).optional(),
});

export const ReportDefinitionGuardrail = z.object({
  sql: z.string().min(1),
  metric_column: z.string().default(""),
  explanation: z.string(),
  confidence: z.number(),
  warnings: z.array(z.string()),
});

export const MonitoringRuleGuardrail = z.object({
  name: z.string().min(1),
  description: z.string(),
  threshold_operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "between"]),
  threshold_value: z.number(),
  escalation_threshold_pct: z.number().default(20),
  alert_channels: z.array(z.enum(["email", "in_app", "webhook"])),
  notify_on_pass: z.boolean().default(false),
  notify_on_no_data: z.boolean().default(true),
});

export const ScheduleGuardrail = z.object({
  cron_expression: z
    .string()
    .regex(
      /^[\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+$/,
      "Must be a valid 5-field cron expression",
    ),
  timezone: z.string().default("UTC"),
  description: z.string(),
  next_run_at: z.string().optional(),
});

// ─── LLM Call Helper ─────────────────────────────────────────────────────────

const NL2SQL_BASE =
  process.env.AI_NL2SQL_BASE_URL ??
  `${process.env.LLAMA_REASONING_URL ?? "http://localhost:8080"}/v1`;
const NL2SQL_MODEL =
  process.env.AI_NL2SQL_MODEL ?? process.env.LLAMA_REASONING_MODEL ?? "qwen3.6";
const NL2SQL_API_KEY =
  process.env.AI_NL2SQL_API_KEY ?? process.env.LLAMA_REASONING_API_KEY ?? "none";
const NL2SQL_IS_LOCAL =
  NL2SQL_BASE.includes("localhost") || NL2SQL_BASE.includes("127.0.0.1");

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const payload: Record<string, unknown> = {
    model: NL2SQL_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
  };
  // chat_template_kwargs is Qwen3/llama.cpp specific — skip for cloud providers
  if (NL2SQL_IS_LOCAL) payload.chat_template_kwargs = { enable_thinking: false };

  const res = await fetch(`${NL2SQL_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(NL2SQL_API_KEY !== "none" ? { Authorization: `Bearer ${NL2SQL_API_KEY}` } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`LLM call failed: HTTP ${res.status}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Extracts the first complete JSON object from an LLM response, tolerating
 * markdown code fences and surrounding prose.
 */
function extractJSON(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in LLM response");
  return JSON.parse(match[0]);
}

// ─── Specialist Agent: Intent Classifier ─────────────────────────────────────

const INTENT_SYSTEM = `You are an intent classification specialist for an enterprise monitoring system.
Your ONLY job is to extract structured intent from the user's natural language request.
Respond with ONLY a JSON object. No markdown, no explanation outside the JSON.

CRON MAPPING (use these exact values):
- "every monday" / "weekly" → "0 8 * * 1"
- "every day" / "daily"    → "0 8 * * *"
- "every hour" / "hourly"  → "0 * * * *"
- "every month" / "monthly"→ "0 8 1 * *"
- "every friday"           → "0 8 * * 5"
- "every weekday"          → "0 8 * * 1-5"

GUARDRAILS:
- intent_type MUST be one of: monitoring_rule, report_generate, alert_create, ambiguous
- confidence MUST be 0.0–1.0
- threshold_operator MUST be one of: gt, gte, lt, lte, eq, neq, between
- Only include fields you are confident about`;

export async function runIntentClassifierAgent(
  nlRequest: string,
): Promise<z.infer<typeof IntentGuardrail>> {
  const userPrompt = `Classify this monitoring request and extract structured intent:

"${nlRequest}"

Respond with JSON:
{
  "intent_type": "monitoring_rule|report_generate|alert_create|ambiguous",
  "confidence": 0.95,
  "metric": "the metric to monitor (e.g. total_revenue, patient_count)",
  "data_hint": "keywords about relevant tables (e.g. orders, revenue, sales)",
  "schedule_natural": "human description of schedule",
  "schedule_cron": "cron expression",
  "threshold_operator": "lt|gt|lte|gte|eq|neq|between",
  "threshold_value": 50000,
  "alert_channels": ["email", "in_app"]
}`;

  const response = await callLLM(INTENT_SYSTEM, userPrompt);
  const raw = extractJSON(response);
  return IntentGuardrail.parse(raw);
}

// ─── Specialist Agent: Schedule Builder ──────────────────────────────────────

const SCHEDULE_SYSTEM = `You are a cron schedule specialist. Extract a valid cron expression from the schedule description.
Respond with ONLY a JSON object.
GUARDRAILS:
- cron_expression MUST be valid 5-field cron format (five space-separated fields)
- timezone MUST be a valid IANA timezone string
- Default timezone is UTC`;

export async function runScheduleAgent(
  scheduleNatural: string,
  timezone?: string,
): Promise<z.infer<typeof ScheduleGuardrail>> {
  const userPrompt = `Convert this schedule description to a cron expression:
"${scheduleNatural}"

Timezone preference: ${timezone ?? "UTC"}

Respond with JSON:
{
  "cron_expression": "0 8 * * 1",
  "timezone": "UTC",
  "description": "Every Monday at 08:00 UTC"
}`;

  try {
    const response = await callLLM(SCHEDULE_SYSTEM, userPrompt);
    const raw = extractJSON(response);
    return ScheduleGuardrail.parse(raw);
  } catch {
    // Safe fallback: every Monday 08:00 UTC
    return {
      cron_expression: "0 8 * * 1",
      timezone: timezone ?? "UTC",
      description: scheduleNatural,
    };
  }
}

// ─── Specialist Agent: Report Definition Builder ──────────────────────────────

const REPORT_SYSTEM = `You are a SQL generation specialist for enterprise reports.
Given a natural language request and database schema, generate optimal PostgreSQL SELECT SQL.
GUARDRAILS:
- SQL must be SELECT-only (no INSERT, UPDATE, DELETE, DROP, TRUNCATE)
- Use the exact table and column names from the schema — do NOT invent or assume column names
- Use PostgreSQL syntax ONLY: use NOW() - INTERVAL '7 days' NOT DATE_SUB; use EXTRACT(YEAR FROM col) for year; use :: for casting
- CRITICAL: The schema includes MULTI-HOP JOIN PATHS — follow them EXACTLY for cross-table joins
- CRITICAL: If a column does not exist in a table per the schema, use the multi-hop path to reach it through an intermediate table
- NEVER assume a column exists. Only use columns listed under that table in the DATABASE SCHEMA
- TIME FILTERS: Only add WHERE clauses on date/time columns if the Time context explicitly mentions a period. If the time context says "all time" or does not mention a period, do NOT add any date filter
- metric_column: for aggregation queries (COUNT, SUM, AVG etc.) set this to the aggregated column alias. For listing/detail queries with no aggregation, set metric_column to the first column alias in the SELECT.
- Respond with ONLY a JSON object`;

export async function runReportBuilderAgent(
  metric: string,
  dataHint: string,
  schemaText: string,
  timeWindow?: string,
): Promise<z.infer<typeof ReportDefinitionGuardrail>> {
  const userPrompt = `Generate SQL for this report request: "${metric}"
Data hints: ${dataHint}
Time context: ${timeWindow ?? "current period / last 7 days"}

DATABASE SCHEMA:
${schemaText}

EXAMPLES:

Aggregation query example (metric has COUNT/SUM/AVG):
{
  "sql": "SELECT d.name AS department_name, COUNT(*) AS total_admissions FROM bus_admission a JOIN bus_department d ON a.department_id::uuid = d.id GROUP BY d.name ORDER BY total_admissions DESC",
  "metric_column": "total_admissions",
  "explanation": "Counts admissions grouped by department",
  "confidence": 0.92,
  "warnings": []
}

Listing query example (no aggregation, just rows):
{
  "sql": "SELECT u.id AS user_id, u.email, u.created_at FROM users u ORDER BY u.created_at DESC",
  "metric_column": "user_id",
  "explanation": "Lists all users with their account creation dates",
  "confidence": 0.95,
  "warnings": []
}

Now generate SQL for the request above. Respond with ONLY a JSON object:`;

  const response = await callLLM(REPORT_SYSTEM, userPrompt);
  console.log("[ReportBuilder] LLM raw response (first 500 chars):", response.slice(0, 500));
  const raw = extractJSON(response);
  console.log("[ReportBuilder] Extracted JSON:", JSON.stringify(raw));
  return ReportDefinitionGuardrail.parse(raw);
}

// ─── Specialist Agent: Monitoring Rule Builder ────────────────────────────────

const RULE_SYSTEM = `You are a monitoring rule configuration specialist.
Convert the user's alert intent into a structured monitoring rule configuration.
GUARDRAILS:
- threshold_operator MUST be one of: gt, gte, lt, lte, eq, neq, between
- alert_channels MUST only contain: email, in_app, webhook
- name must be concise and descriptive (max 100 chars)
- Respond with ONLY a JSON object`;

export async function runMonitoringRuleAgent(
  nlRequest: string,
  metric: string,
  thresholdOperator?: string,
  thresholdValue?: number,
): Promise<z.infer<typeof MonitoringRuleGuardrail>> {
  const userPrompt = `Create a monitoring rule configuration for:
Request: "${nlRequest}"
Metric: ${metric}
Detected threshold: ${thresholdOperator ?? "lt"} ${thresholdValue ?? 0}

Respond with JSON:
{
  "name": "Weekly Revenue Alert",
  "description": "Alerts when weekly revenue drops below threshold",
  "threshold_operator": "lt",
  "threshold_value": 50000,
  "escalation_threshold_pct": 20,
  "alert_channels": ["email", "in_app"],
  "notify_on_pass": false,
  "notify_on_no_data": true
}`;

  try {
    const response = await callLLM(RULE_SYSTEM, userPrompt);
    const raw = extractJSON(response);
    return MonitoringRuleGuardrail.parse(raw);
  } catch {
    // Fallback: synthesise a rule from the intent fields we already have
    return {
      name: `Monitor: ${metric}`.slice(0, 100),
      description: `Monitoring rule for ${metric}`,
      threshold_operator: (thresholdOperator as z.infer<typeof MonitoringRuleGuardrail>["threshold_operator"]) ?? "lt",
      threshold_value: thresholdValue ?? 0,
      escalation_threshold_pct: 20,
      alert_channels: ["email", "in_app"],
      notify_on_pass: false,
      notify_on_no_data: true,
    };
  }
}

// ─── Supervisor Coordinator ───────────────────────────────────────────────────

export interface SupervisorInput {
  nlRequest: string;
  userId: string;
  dataSourceId: string;
  dataSourceType: string;
  schemaText: string;
  allowedTableNames: string[];
  rbacSnapshot: unknown;
  sessionId?: string;
}

export interface SupervisorOutput {
  success: boolean;
  intent: z.infer<typeof IntentGuardrail>;
  reportDefinition: z.infer<typeof ReportDefinitionGuardrail>;
  monitoringRule: z.infer<typeof MonitoringRuleGuardrail>;
  schedule: z.infer<typeof ScheduleGuardrail>;
  clarificationNeeded?: boolean;
  clarificationPrompt?: string;
  error?: string;
}

/** Empty/fallback values used when a specialist agent stage fails hard */
const EMPTY_REPORT: z.infer<typeof ReportDefinitionGuardrail> = {
  sql: "",
  metric_column: "",
  explanation: "",
  confidence: 0,
  warnings: [],
};

const EMPTY_RULE: z.infer<typeof MonitoringRuleGuardrail> = {
  name: "",
  description: "",
  threshold_operator: "lt",
  threshold_value: 0,
  escalation_threshold_pct: 20,
  alert_channels: [],
  notify_on_pass: false,
  notify_on_no_data: true,
};

const DEFAULT_SCHEDULE: z.infer<typeof ScheduleGuardrail> = {
  cron_expression: "0 8 * * 1",
  timezone: "UTC",
  description: "Every Monday at 08:00 UTC",
};

/**
 * Runs the full supervisor-agent pipeline.
 *
 * Stage 1  : Intent classification (serial — required before stages 2–4)
 * Stages 2–4: Schedule, report SQL, and rule config (parallel)
 * Final    : Supervisor guardrail — validate combined output
 */
export async function runSupervisorAgent(input: SupervisorInput): Promise<SupervisorOutput> {
  const { nlRequest, schemaText } = input;

  // ── Stage 1: Intent classification ────────────────────────────────────────
  let intent: z.infer<typeof IntentGuardrail>;
  try {
    intent = await runIntentClassifierAgent(nlRequest);
  } catch (err) {
    return {
      success: false,
      intent: { intent_type: "ambiguous", confidence: 0 },
      reportDefinition: EMPTY_REPORT,
      monitoringRule: EMPTY_RULE,
      schedule: DEFAULT_SCHEDULE,
      error: `Intent classification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Supervisor guardrail: require confidence ≥ 0.5 and a concrete intent type
  if (intent.confidence < 0.5 || intent.intent_type === "ambiguous") {
    return {
      success: false,
      intent,
      reportDefinition: EMPTY_REPORT,
      monitoringRule: EMPTY_RULE,
      schedule: DEFAULT_SCHEDULE,
      clarificationNeeded: true,
      clarificationPrompt:
        "I need more detail to set up monitoring. Please specify: " +
        "what metric to track, the threshold (e.g. 'if revenue drops below $50,000'), " +
        "and when to check (e.g. 'every Monday').",
    };
  }

  // ── Stages 2–4: Specialist agents run sequentially (single LLM server) ───────
  const scheduleSettled = await runScheduleAgent(intent.schedule_natural ?? "every Monday").then(
    (v) => ({ status: "fulfilled" as const, value: v }),
    (e) => ({ status: "rejected" as const, reason: e }),
  );

  const reportSettled = await runReportBuilderAgent(
    intent.metric ?? "value",
    intent.data_hint ?? "",
    schemaText,
    intent.schedule_natural,
  ).then(
    (v) => ({ status: "fulfilled" as const, value: v }),
    (e) => ({ status: "rejected" as const, reason: e }),
  );

  const ruleSettled = await runMonitoringRuleAgent(
    nlRequest,
    intent.metric ?? "value",
    intent.threshold_operator,
    intent.threshold_value,
  ).then(
    (v) => ({ status: "fulfilled" as const, value: v }),
    (e) => ({ status: "rejected" as const, reason: e }),
  );

  const schedule =
    scheduleSettled.status === "fulfilled"
      ? scheduleSettled.value
      : { ...DEFAULT_SCHEDULE, description: intent.schedule_natural ?? "Every Monday" };

  const reportDefinition =
    reportSettled.status === "fulfilled"
      ? reportSettled.value
      : {
          ...EMPTY_REPORT,
          metric_column: intent.metric ?? "value",
          warnings: ["SQL generation failed"],
        };

  const monitoringRule =
    ruleSettled.status === "fulfilled"
      ? ruleSettled.value
      : {
          name: `Monitor: ${intent.metric ?? "metric"}`.slice(0, 100),
          description: nlRequest,
          threshold_operator:
            (intent.threshold_operator as z.infer<typeof MonitoringRuleGuardrail>["threshold_operator"]) ??
            "lt",
          threshold_value: intent.threshold_value ?? 0,
          escalation_threshold_pct: 20,
          alert_channels: ((intent.alert_channels ?? ["email", "in_app"]) as z.infer<
            typeof MonitoringRuleGuardrail
          >["alert_channels"]),
          notify_on_pass: false,
          notify_on_no_data: true,
        };

  // ── Supervisor guardrail: validate combined output ─────────────────────────
  const hasValidSql = reportDefinition.sql.length > 0;
  const hasValidThreshold = monitoringRule.threshold_value !== undefined;

  return {
    success: hasValidSql && hasValidThreshold,
    intent,
    reportDefinition,
    monitoringRule,
    schedule,
    error: !hasValidSql
      ? "Could not generate valid SQL for the requested metric"
      : undefined,
  };
}
