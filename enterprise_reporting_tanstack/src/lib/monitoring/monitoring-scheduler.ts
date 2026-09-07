/**
 * Monitoring Scheduler
 *
 * Manages the lifecycle of monitoring rule schedules.  Two backends are
 * supported and are selected automatically:
 *
 *   1. Trigger.dev (self-hosted) — used when TRIGGER_API_URL is set and the
 *      SDK can reach the local Trigger.dev instance.  Fully open-source;
 *      self-hosted on-premise via docker-compose.
 *
 *   2. On-premise cron runner (built-in fallback) — a pure-Bun interval loop
 *      that polls monitoring_rules every minute, parses each rule's
 *      cron_expression with a lightweight matcher, and directly calls
 *      executeMonitoringEvaluation.  Zero external dependencies.  Activated
 *      automatically when Trigger.dev is unavailable.
 *
 * All functions degrade gracefully — a scheduler failure never blocks rule
 * creation or deletion.
 */

import { schedules } from "@trigger.dev/sdk/v3";
import { getDb } from "@/lib/db/config";
import type { MonitoringRule, MonitoringEvaluatePayload } from "@/types/monitoring";

// ────────────────────────────────────────────────────────────────────────────
// scheduleMonitoringRule
// ────────────────────────────────────────────────────────────────────────────

/**
 * Creates a Trigger.dev schedule for a monitoring rule.
 * Stores the returned schedule ID in monitoring_rules.trigger_schedule_id.
 * Returns null when Trigger.dev is unavailable (graceful degradation).
 */
export async function scheduleMonitoringRule(rule: MonitoringRule): Promise<string | null> {
  const payload: MonitoringEvaluatePayload = {
    ruleId: rule.id,
    triggeredBy: "schedule",
  };

  let scheduleId: string | null = null;

  try {
    const created = await schedules.create({
      task: "monitoring:evaluate",
      cron: rule.cron_expression,
      timezone: rule.timezone ?? "UTC",
      // @ts-expect-error — SDK v3 schedule payload passthrough
      payload,
      externalId: `monitoring-${rule.id}`,
    });

    scheduleId = created.id ?? null;
  } catch (err) {
    console.warn(
      `[monitoring-scheduler] schedules.create failed for rule ${rule.id} — Trigger.dev may not be configured in this environment:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }

  if (scheduleId) {
    try {
      const db = getDb();
      await (db as any)
        .updateTable("monitoring_rules")
        .set({
          trigger_schedule_id: scheduleId,
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", rule.id)
        .execute();
    } catch (dbErr) {
      console.error(
        `[monitoring-scheduler] Failed to persist trigger_schedule_id for rule ${rule.id}:`,
        dbErr instanceof Error ? dbErr.message : String(dbErr)
      );
      // Return the schedule ID anyway — the caller can retry persisting if needed
    }
  }

  return scheduleId;
}

// ────────────────────────────────────────────────────────────────────────────
// unscheduleMonitoringRule
// ────────────────────────────────────────────────────────────────────────────

/**
 * Deletes the Trigger.dev schedule for a rule and clears the stored schedule ID.
 * Returns false on failure (Trigger.dev unavailable or schedule already gone).
 */
export async function unscheduleMonitoringRule(
  ruleId: string,
  triggerScheduleId: string
): Promise<boolean> {
  try {
    await schedules.del(triggerScheduleId);
  } catch (err) {
    console.warn(
      `[monitoring-scheduler] schedules.del failed for schedule ${triggerScheduleId} (rule ${ruleId}):`,
      err instanceof Error ? err.message : String(err)
    );
    // Still attempt to clear the DB record so the stale reference is removed
  }

  try {
    const db = getDb();
    await (db as any)
      .updateTable("monitoring_rules")
      .set({
        trigger_schedule_id: null,
        updated_at: new Date().toISOString(),
      })
      .where("id", "=", ruleId)
      .execute();
  } catch (dbErr) {
    console.error(
      `[monitoring-scheduler] Failed to clear trigger_schedule_id for rule ${ruleId}:`,
      dbErr instanceof Error ? dbErr.message : String(dbErr)
    );
    return false;
  }

  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// pauseSchedule
// ────────────────────────────────────────────────────────────────────────────

/**
 * Deactivates a Trigger.dev schedule (stops future invocations without deleting it).
 */
export async function pauseSchedule(triggerScheduleId: string): Promise<boolean> {
  try {
    await schedules.deactivate(triggerScheduleId);
    return true;
  } catch (err) {
    console.warn(
      `[monitoring-scheduler] schedules.deactivate failed for ${triggerScheduleId}:`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// resumeSchedule
// ────────────────────────────────────────────────────────────────────────────

/**
 * Reactivates a previously paused Trigger.dev schedule.
 */
export async function resumeSchedule(triggerScheduleId: string): Promise<boolean> {
  try {
    await schedules.activate(triggerScheduleId);
    return true;
  } catch (err) {
    console.warn(
      `[monitoring-scheduler] schedules.activate failed for ${triggerScheduleId}:`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// On-Premise Cron Runner (built-in fallback — zero external dependencies)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Minimal 5-field cron matcher.
 *
 * Supports: exact values (5), wildcard (*), comma lists (1,3,5),
 *           step expressions (* /15), and ranges (1-5).
 * This is intentionally simple — production deployments with complex cron
 * expressions should use Trigger.dev self-hosted instead.
 */
function matchesCronField(value: number, field: string): boolean {
  if (field === "*") return true;
  for (const part of field.split(",")) {
    if (part.includes("/")) {
      const [range, step] = part.split("/");
      const stepN = parseInt(step, 10);
      let start = 0;
      let end = 59;
      if (range !== "*") {
        const [s, e] = range.split("-").map(Number);
        start = s;
        end = e ?? s;
      }
      if (value >= start && value <= end && (value - start) % stepN === 0) return true;
    } else if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) return true;
    } else if (parseInt(part, 10) === value) {
      return true;
    }
  }
  return false;
}

function cronMatches(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    matchesCronField(date.getUTCMinutes(), minute) &&
    matchesCronField(date.getUTCHours(), hour) &&
    matchesCronField(date.getUTCDate(), dom) &&
    matchesCronField(date.getUTCMonth() + 1, month) &&
    matchesCronField(date.getUTCDay(), dow)
  );
}

/**
 * Timezone-aware cron matching.
 *
 * Converts the current UTC time to the rule's configured timezone using
 * Intl.DateTimeFormat, then evaluates the cron expression against the
 * local time components. Falls back to UTC if the timezone is invalid.
 */
function cronMatchesWithTimezone(cron: string, dateUtc: Date, timezone: string): boolean {
  if (!timezone || timezone === "UTC") return cronMatches(cron, dateUtc);

  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(dateUtc);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

    const localMinute = get("minute");
    const localHour = get("hour") === 24 ? 0 : get("hour");
    const localDay = get("day");
    const localMonth = get("month");
    // Day of week: reconstruct from the local date
    const localDate = new Date(get("year"), localMonth - 1, localDay);
    const localDow = localDate.getDay();

    const cronParts = cron.trim().split(/\s+/);
    if (cronParts.length !== 5) return false;

    return (
      matchesCronField(localMinute, cronParts[0]) &&
      matchesCronField(localHour, cronParts[1]) &&
      matchesCronField(localDay, cronParts[2]) &&
      matchesCronField(localMonth, cronParts[3]) &&
      matchesCronField(localDow, cronParts[4])
    );
  } catch {
    // Invalid timezone — fall back to UTC
    return cronMatches(cron, dateUtc);
  }
}

let _onPremiseRunnerHandle: ReturnType<typeof setInterval> | null = null;
let _onPremiseRunnerActive = false;

/**
 * Starts the on-premise cron runner.
 *
 * Polls active, non-paused monitoring_rules every 60 seconds.
 * For each rule whose cron_expression matches the current UTC minute,
 * calls executeMonitoringEvaluation directly (in-process, no external queue).
 *
 * Call this from the server startup path (e.g., src/lib/jobs/worker-runner.ts)
 * when Trigger.dev self-hosted is not configured.
 */
export function startOnPremiseCronRunner(): void {
  if (_onPremiseRunnerActive) return;
  _onPremiseRunnerActive = true;

  console.log("[on-premise-cron] Starting monitoring cron runner (poll interval: 60s)");

  const tick = async () => {
    const now = new Date();
    // Align to the start of the current minute for consistent matching
    now.setUTCSeconds(0, 0);

    // ── Monitoring Rules ──
    let rules: {
      id: string;
      cron_expression: string;
      timezone: string;
      is_paused: number | boolean;
    }[] = [];
    try {
      const db = getDb();
      rules = await (db as any)
        .selectFrom("monitoring_rules")
        .where("is_active", "=", true)
        .where("is_paused", "=", false)
        .select(["id", "cron_expression", "timezone", "is_paused"])
        .execute();
    } catch (err) {
      console.error("[on-premise-cron] Failed to load monitoring rules:", err);
    }

    const dueRules = rules.filter((r) => {
      try {
        return cronMatchesWithTimezone(r.cron_expression, now, r.timezone ?? "UTC");
      } catch {
        return false;
      }
    });

    if (dueRules.length > 0) {
      console.log(
        `[on-premise-cron] ${dueRules.length} monitoring rule(s) due at ${now.toISOString()}`
      );

      const { executeMonitoringEvaluation } = await import("@/lib/jobs/workers/monitoring-worker");

      await Promise.allSettled(
        dueRules.map(async (rule) => {
          try {
            const result = await executeMonitoringEvaluation({
              ruleId: rule.id,
              triggeredBy: "on_premise_cron",
            });
            console.log(
              `[on-premise-cron] rule=${rule.id} status=${result.status} value=${result.metricValue ?? "n/a"}`
            );
          } catch (err) {
            console.error(`[on-premise-cron] rule=${rule.id} error:`, err);
          }
        })
      );
    }

    // ── Scheduled Report Definitions ──
    let reportDefs: {
      id: string;
      schedule_cron: string;
      schedule_timezone: string;
      last_run_status: string | null;
    }[] = [];
    try {
      const db = getDb();
      reportDefs = await (db as any)
        .selectFrom("nl_report_definitions")
        .where("schedule_enabled", "=", true)
        .whereRef("schedule_cron", "is not", null)
        .select(["id", "schedule_cron", "schedule_timezone", "last_run_status"])
        .execute();
    } catch {
      // Table may not exist yet — gracefully skip
    }

    const dueReports = reportDefs.filter((r) => {
      if (r.last_run_status === "running") return false;
      try {
        return cronMatchesWithTimezone(r.schedule_cron, now, r.schedule_timezone ?? "UTC");
      } catch {
        return false;
      }
    });

    if (dueReports.length > 0) {
      console.log(
        `[on-premise-cron] ${dueReports.length} scheduled report(s) due at ${now.toISOString()}`
      );

      const { executeReportGeneration } = await import(
        "@/lib/report-generation/report-generation-worker"
      );

      await Promise.allSettled(
        dueReports.map(async (def) => {
          try {
            const result = await executeReportGeneration({
              reportDefinitionId: def.id,
              triggeredBy: "scheduled",
            });
            console.log(
              `[on-premise-cron] report=${def.id} status=${result.status} rows=${result.rowCount}`
            );
          } catch (err) {
            console.error(`[on-premise-cron] report=${def.id} error:`, err);
          }
        })
      );
    }

    // ── Nightly Artifact Retention Cleanup (runs at 02:00 UTC) ──
    if (now.getUTCHours() === 2 && now.getUTCMinutes() === 0) {
      try {
        const { cleanupExpiredReportArtifacts } = await import(
          "@/lib/report-generation/report-cleanup"
        );
        const result = await cleanupExpiredReportArtifacts();
        if (result.deletedRecords > 0) {
          console.log(
            `[on-premise-cron] Artifact cleanup: ${result.deletedFiles} files, ${result.deletedRecords} records deleted`
          );
        }
      } catch (err) {
        console.error("[on-premise-cron] Artifact cleanup failed:", err);
      }
    }
  };

  // Run once immediately in case the server started mid-minute on a due cron
  tick().catch(console.error);

  // Then poll every 60 seconds
  _onPremiseRunnerHandle = setInterval(() => {
    tick().catch(console.error);
  }, 60_000);
}

/**
 * Stops the on-premise cron runner (e.g., during graceful shutdown).
 */
export function stopOnPremiseCronRunner(): void {
  if (_onPremiseRunnerHandle !== null) {
    clearInterval(_onPremiseRunnerHandle);
    _onPremiseRunnerHandle = null;
  }
  _onPremiseRunnerActive = false;
  console.log("[on-premise-cron] Monitoring cron runner stopped");
}
