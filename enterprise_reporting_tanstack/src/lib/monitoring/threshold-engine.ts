import type {
  MonitoringRule,
  ThresholdEvaluation,
  ThresholdOperator,
  ThresholdStatus,
  BreachSeverity,
} from "@/types/monitoring";

/**
 * Extract a numeric metric value from the first row of a query result set.
 * Column name matching is case-insensitive.
 * Returns null when the result set is empty, the column is absent, or the
 * value cannot be coerced to a finite number.
 */
export function extractMetricValue(
  rows: Record<string, unknown>[],
  metricColumn: string
): number | null {
  if (rows.length === 0) return null;

  const firstRow = rows[0];
  const normalizedTarget = metricColumn.toLowerCase();

  // Find matching key (case-insensitive)
  const matchingKey = Object.keys(firstRow).find((key) => key.toLowerCase() === normalizedTarget);

  if (matchingKey === undefined) return null;

  const raw = firstRow[matchingKey];

  if (raw === null || raw === undefined) return null;

  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * Apply a comparison operator between an actual value and threshold value(s).
 * The `upper` parameter is only relevant for the "between" operator.
 */
export function applyOperator(
  actual: number,
  operator: ThresholdOperator,
  value: number,
  upper?: number
): boolean {
  switch (operator) {
    case "gt":
      return actual > value;
    case "gte":
      return actual >= value;
    case "lt":
      return actual < value;
    case "lte":
      return actual <= value;
    case "eq":
      return actual === value;
    case "neq":
      return actual !== value;
    case "between":
      if (upper === undefined) {
        throw new Error("threshold_upper_bound is required for the 'between' operator");
      }
      return actual >= value && actual <= upper;
    default: {
      // Exhaustiveness check — TypeScript will warn if a case is missed
      const _exhaustive: never = operator;
      throw new Error(`Unknown threshold operator: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Evaluate a monitoring rule against a query result set.
 *
 * Logic:
 *  1. If rows are empty or the metric column is not found → NO_DATA
 *  2. If the threshold condition is breached:
 *     a. Compute delta from previousValue when available
 *     b. If |delta| >= escalation_threshold_pct → ESCALATE (CRITICAL)
 *     c. Otherwise → BREACH (WARNING)
 *  3. If the threshold condition passes → PASS
 */
export function evaluateThreshold(
  rows: Record<string, unknown>[],
  rule: Pick<
    MonitoringRule,
    | "metric_column"
    | "threshold_operator"
    | "threshold_value"
    | "threshold_upper_bound"
    | "escalation_threshold_pct"
  >,
  previousValue?: number
): ThresholdEvaluation {
  const actualValue = extractMetricValue(rows, rule.metric_column);

  if (actualValue === null) {
    const reason =
      rows.length === 0
        ? "Query returned no rows."
        : `Metric column '${rule.metric_column}' not found or is non-numeric.`;

    return {
      status: "NO_DATA",
      actualValue: null,
      thresholdValue: rule.threshold_value,
      operator: rule.threshold_operator,
      message: `No data available. ${reason}`,
    };
  }

  // Compute percentage delta from previous value when available
  let deltaFromPrevious: number | undefined;
  if (previousValue !== undefined && previousValue !== 0) {
    deltaFromPrevious = ((actualValue - previousValue) / Math.abs(previousValue)) * 100;
  } else if (previousValue === 0 && actualValue !== 0) {
    // Avoid division by zero; treat as infinite change
    deltaFromPrevious = actualValue > 0 ? Infinity : -Infinity;
  }

  let breached: boolean;
  try {
    breached = applyOperator(
      actualValue,
      rule.threshold_operator,
      rule.threshold_value,
      rule.threshold_upper_bound
    );
  } catch (err) {
    return {
      status: "NO_DATA" as ThresholdStatus,
      actualValue,
      thresholdValue: rule.threshold_value,
      operator: rule.threshold_operator,
      deltaFromPrevious,
      message: `Threshold evaluation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!breached) {
    const deltaMsg =
      deltaFromPrevious !== undefined && Number.isFinite(deltaFromPrevious)
        ? ` (Δ ${deltaFromPrevious >= 0 ? "+" : ""}${deltaFromPrevious.toFixed(2)}%)`
        : "";

    return {
      status: "PASS",
      actualValue,
      thresholdValue: rule.threshold_value,
      operator: rule.threshold_operator,
      deltaFromPrevious,
      message: `Metric value ${actualValue} passed the ${rule.threshold_operator} ${rule.threshold_value} threshold${deltaMsg}.`,
    };
  }

  // Determine whether this breach qualifies as an escalation
  let status: ThresholdStatus = "BREACH";
  let breachSeverity: BreachSeverity = "WARNING";

  if (
    deltaFromPrevious !== undefined &&
    Math.abs(deltaFromPrevious) >= rule.escalation_threshold_pct
  ) {
    status = "ESCALATE";
    breachSeverity = "CRITICAL";
  }

  const thresholdDesc =
    rule.threshold_operator === "between"
      ? `between ${rule.threshold_value} and ${rule.threshold_upper_bound}`
      : `${rule.threshold_operator} ${rule.threshold_value}`;

  const deltaMsg =
    deltaFromPrevious !== undefined && Number.isFinite(deltaFromPrevious)
      ? ` (Δ ${deltaFromPrevious >= 0 ? "+" : ""}${deltaFromPrevious.toFixed(2)}% from previous value ${previousValue})`
      : "";

  const escalationMsg =
    status === "ESCALATE"
      ? ` Escalation threshold of ${rule.escalation_threshold_pct}% exceeded.`
      : "";

  return {
    status,
    actualValue,
    thresholdValue: rule.threshold_value,
    operator: rule.threshold_operator,
    deltaFromPrevious,
    breachSeverity,
    message: `[${breachSeverity}] Metric value ${actualValue} breached threshold (${thresholdDesc})${deltaMsg}.${escalationMsg}`,
  };
}
