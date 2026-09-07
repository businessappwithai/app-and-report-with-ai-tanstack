/**
 * Intent Classifier
 *
 * Calls the Mastra LLM endpoint to extract a structured ADKIntent from raw
 * natural language text.  Uses strict Zod validation as a guardrail on the
 * LLM output — any field that doesn't conform is dropped or replaced with a
 * safe default rather than propagating bad data downstream.
 *
 * Schedule → cron mapping (applied as a post-processing step so the LLM
 * doesn't need to know cron syntax):
 *
 *   "every monday" / "weekly"    → "0 8 * * 1"
 *   "every day"    / "daily"     → "0 8 * * *"
 *   "every hour"   / "hourly"    → "0 * * * *"
 *   "every month"  / "monthly"   → "0 8 1 * *"
 *   "every friday"               → "0 8 * * 5"
 *   "every weekday"              → "0 8 * * 1-5"
 *   "every tuesday"              → "0 8 * * 2"
 *   "every wednesday"            → "0 8 * * 3"
 *   "every thursday"             → "0 8 * * 4"
 *   "every saturday"             → "0 8 * * 6"
 *   "every sunday"               → "0 8 * * 0"
 */

import { z } from "zod";
import type { ADKIntent, ADKIntentType } from "@/types/adk";
import type { AlertChannel, ThresholdOperator } from "@/types/monitoring";

// ─── LLM Response Schema ──────────────────────────────────────────────────────

const LLMIntentResponse = z.object({
  intent_type: z
    .enum(["monitoring_rule", "report_generate", "alert_create", "ambiguous"])
    .catch("ambiguous"),
  confidence: z.number().min(0).max(1).catch(0),
  metric: z.string().optional().catch(undefined),
  data_hint: z.string().optional().catch(undefined),
  schedule_natural: z.string().optional().catch(undefined),
  schedule_cron: z.string().optional().catch(undefined),
  threshold_operator: z
    .enum(["gt", "gte", "lt", "lte", "eq", "neq", "between"])
    .optional()
    .catch(undefined),
  threshold_value: z.number().optional().catch(undefined),
  threshold_upper_bound: z.number().optional().catch(undefined),
  alert_channels: z
    .array(z.enum(["email", "in_app", "webhook"]))
    .optional()
    .catch(undefined),
});

// ─── Schedule Normalisation ───────────────────────────────────────────────────

/**
 * Maps common human schedule descriptions to 5-field cron expressions.
 * Matching is case-insensitive and substring-based.
 */
function normaliseCron(natural?: string, llmCron?: string): string | undefined {
  if (!natural && !llmCron) return undefined;

  const text = (natural ?? "").toLowerCase();

  if (text.includes("every sunday") || text.includes("sun")) return "0 8 * * 0";
  if (text.includes("every monday") || text.includes("weekly") || text.includes("mon")) return "0 8 * * 1";
  if (text.includes("every tuesday") || text.includes("tue")) return "0 8 * * 2";
  if (text.includes("every wednesday") || text.includes("wed")) return "0 8 * * 3";
  if (text.includes("every thursday") || text.includes("thu")) return "0 8 * * 4";
  if (text.includes("every friday") || text.includes("fri")) return "0 8 * * 5";
  if (text.includes("every saturday") || text.includes("sat")) return "0 8 * * 6";
  if (text.includes("every weekday") || text.includes("weekday")) return "0 8 * * 1-5";
  if (text.includes("every hour") || text.includes("hourly")) return "0 * * * *";
  if (text.includes("every month") || text.includes("monthly")) return "0 8 1 * *";
  if (text.includes("every day") || text.includes("daily")) return "0 8 * * *";

  // Validate LLM-provided cron — accept if it looks like a 5-field expression
  if (llmCron && /^[\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+ [\d*\/,\-]+$/.test(llmCron.trim())) {
    return llmCron.trim();
  }

  return undefined;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classification specialist for an enterprise monitoring system.
Your ONLY job is to extract structured intent from the user's natural language request.
Respond with ONLY a valid JSON object. No markdown fences, no commentary outside the JSON.

INTENT TYPES:
- monitoring_rule : user wants to set up automated threshold-based alerting
- report_generate : user wants a one-time or scheduled report without alerts
- alert_create    : user wants to configure alert channels / escalation only
- ambiguous       : request is unclear or lacks enough information

FIELD RULES:
- confidence MUST be a float 0.0–1.0 reflecting how certain you are of the intent
- metric      : the column alias or expression name to measure (e.g. "total_revenue", "patient_count")
- data_hint   : space-separated keywords hinting at relevant DB tables (e.g. "orders revenue sales")
- schedule_natural : human-readable schedule (e.g. "every Monday at 8am")
- schedule_cron    : best-effort 5-field cron expression
- threshold_operator MUST be one of: gt gte lt lte eq neq between
- threshold_value   : numeric threshold for the alert condition
- alert_channels    : subset of ["email", "in_app", "webhook"]

ONLY include optional fields you have evidence for — omit rather than guess.`;

// ─── Classifier ───────────────────────────────────────────────────────────────

export async function classifyIntent(
  nlRequest: string,
  userId: string,
  dataSourceId?: string,
): Promise<{ intent: ADKIntent; classificationMs: number }> {
  const startMs = Date.now();
  const intentId = crypto.randomUUID();
  const now = new Date().toISOString();

  const mastraUrl = process.env.MASTRA_URL ?? "http://localhost:4111";

  const userPrompt = `Classify this monitoring request and extract structured intent:

"${nlRequest}"

${dataSourceId ? `Data source context: ${dataSourceId}` : ""}

Respond with a single JSON object containing: intent_type, confidence, metric, data_hint, schedule_natural, schedule_cron, threshold_operator, threshold_value, alert_channels`;

  let parsed: z.infer<typeof LLMIntentResponse>;

  try {
    const response = await fetch(`${mastraUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: CLASSIFICATION_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`LLM endpoint returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty LLM response");

    // Extract JSON from the content — the model may wrap it in markdown fences
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object in LLM response");

    const rawJson: unknown = JSON.parse(jsonMatch[0]);

    // Safe parse — .catch() clauses on each field handle bad values gracefully
    parsed = LLMIntentResponse.parse(rawJson);
  } catch (err) {
    // Fallback: return ambiguous intent so the pipeline can ask for clarification
    const classificationMs = Date.now() - startMs;
    const fallbackIntent: ADKIntent = {
      id: intentId,
      userId,
      rawRequest: nlRequest,
      intentType: "ambiguous",
      confidence: 0,
      status: "clarification_needed",
      createdAt: now,
      updatedAt: now,
    };
    return { intent: fallbackIntent, classificationMs };
  }

  // Resolve cron from natural language or LLM output
  const resolvedCron = normaliseCron(parsed.schedule_natural, parsed.schedule_cron);

  const classificationMs = Date.now() - startMs;

  const intent: ADKIntent = {
    id: intentId,
    userId,
    rawRequest: nlRequest,
    intentType: parsed.intent_type as ADKIntentType,
    confidence: parsed.confidence,
    metric: parsed.metric,
    dataHint: parsed.data_hint,
    scheduleNatural: parsed.schedule_natural,
    scheduleCron: resolvedCron,
    thresholdOperator: parsed.threshold_operator as ThresholdOperator | undefined,
    thresholdValue: parsed.threshold_value,
    alertChannels: parsed.alert_channels as AlertChannel[] | undefined,
    status: parsed.confidence >= 0.5 && parsed.intent_type !== "ambiguous"
      ? "classifying"
      : "clarification_needed",
    createdAt: now,
    updatedAt: now,
  };

  return { intent, classificationMs };
}
