/**
 * Workflow Polling Helper
 *
 * Utility functions for polling Trigger.dev workflow execution status.
 * Provides retry logic with exponential backoff and timeout handling.
 *
 * Created by: WORKFLOW-002 ticket
 * Week: 3
 */

import {
  TRIGGER_DEV_CONFIG,
  WORKFLOW_ERROR_CODES,
  WORKFLOW_POLLING,
  WORKFLOW_TIMEOUTS,
} from "@appwithai/core/config";

/**
 * Trigger.dev execution status values (lowercased)
 */
type WorkflowStatus =
  | "pending"
  | "running"
  | "success"
  | "failure"
  | "cancelled"
  | "timeout"
  | "none"
  | "draft"
  | "error";

/**
 * Trigger.dev workflow run status response
 */
interface TriggerDevWorkflowRun {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILURE" | "CANCELLED" | "TIMEOUT";
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Poll result with status and metadata
 */
export interface WorkflowPollResult {
  success: boolean;
  status: WorkflowStatus;
  output?: unknown;
  error?: string;
  errorCode?: string;
  attempts: number;
  durationMs: number;
}

/**
 * Polling options (override defaults)
 */
export interface PollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Calculate backoff delay with jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns {number} Delay with jitter applied
 */
function calculateBackoff(attempt: number, baseDelayMs: number): number {
  const jitter = 1 + (Math.random() * 2 - 1) * 0.25; // +/- 25%
  const backoff = Math.min(
    baseDelayMs * 2 ** attempt,
    WORKFLOW_POLLING.MAX_ATTEMPTS * WORKFLOW_POLLING.INTERVAL_MS
  );
  return Math.floor(backoff * jitter);
}

/**
 * Poll Trigger.dev workflow run status
 *
 * @param runId - Trigger.dev workflow run ID
 * @param options - Polling options (optional)
 * @returns {Promise<WorkflowPollResult>} Poll result with status and output
 *
 * @example
 * ```typescript
 * const result = await pollWorkflowStatus("run_abc123");
 * if (result.success && result.status === "success") {
 *   console.log("Workflow output:", result.output);
 * }
 * ```
 */
export async function pollWorkflowStatus(
  runId: string,
  options: PollingOptions = {}
): Promise<WorkflowPollResult> {
  const startTime = Date.now();

  // Merge options with defaults
  const intervalMs = options.intervalMs ?? WORKFLOW_POLLING.INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? WORKFLOW_POLLING.MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? WORKFLOW_POLLING.INITIAL_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? WORKFLOW_TIMEOUTS.POLL_TIMEOUT_MS;

  // Initial delay to allow workflow to start
  if (initialDelayMs > 0) {
    await sleep(initialDelayMs);
  }

  let lastError: Error | null = null;
  let attempts = 0;

  for (attempts = 0; attempts < maxAttempts; attempts++) {
    // Check timeout
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs > timeoutMs) {
      return {
        success: false,
        status: "timeout",
        error: `Workflow polling timeout after ${elapsedMs}ms`,
        errorCode: WORKFLOW_ERROR_CODES.POLL_TIMEOUT,
        attempts,
        durationMs: elapsedMs,
      };
    }

    try {
      // Fetch workflow run status from Trigger.dev
      const run = await fetchWorkflowRun(runId);

      // Check if workflow has reached a terminal state
      if (isTerminalStatus(run.status)) {
        const elapsedMs = Date.now() - startTime;

        if (run.status === "SUCCESS") {
          return {
            success: true,
            status: "success",
            output: run.output,
            attempts: attempts + 1,
            durationMs: elapsedMs,
          };
        }

        // Workflow failed or was cancelled
        return {
          success: false,
          status: run.status.toLowerCase() as WorkflowStatus,
          error: run.error?.message ?? `Workflow ${run.status}`,
          errorCode: run.error?.code,
          output: run.output,
          attempts: attempts + 1,
          durationMs: elapsedMs,
        };
      }

      // Workflow still running, wait before next poll
      if (attempts < maxAttempts - 1) {
        const backoffDelay = calculateBackoff(attempts, intervalMs);
        await sleep(backoffDelay);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log error but continue polling (transient network issues)
      if (TRIGGER_DEV_CONFIG.ENABLED && process.env.NODE_ENV !== "test") {
        console.error(`[WorkflowPolling] Poll attempt ${attempts + 1} failed:`, lastError.message);
      }

      // Wait before retry (with backoff)
      if (attempts < maxAttempts - 1) {
        const backoffDelay = calculateBackoff(attempts, intervalMs);
        await sleep(backoffDelay);
      }
    }
  }

  // Max attempts reached without terminal status
  const elapsedMs = Date.now() - startTime;

  return {
    success: false,
    status: "timeout",
    error: `Polling timeout after ${maxAttempts} attempts (${elapsedMs}ms)`,
    errorCode: WORKFLOW_ERROR_CODES.POLL_TIMEOUT,
    attempts,
    durationMs: elapsedMs,
  };
}

/**
 * Fetch workflow run from Trigger.dev API
 *
 * @param runId - Workflow run ID
 * @returns {Promise<TriggerDevWorkflowRun>} Workflow run data
 * @throws {Error} If API request fails
 */
async function fetchWorkflowRun(runId: string): Promise<TriggerDevWorkflowRun> {
  const apiUrl = `${TRIGGER_DEV_CONFIG.API_URL}/api/v1/runs/${runId}`;

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TRIGGER_DEV_CONFIG.API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(WORKFLOW_TIMEOUTS.POLL_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Trigger.dev API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as TriggerDevWorkflowRun;
}

/**
 * Check if workflow status is terminal (no further updates)
 *
 * @param status - Trigger.dev workflow status
 * @returns {boolean} True if status is terminal
 */
function isTerminalStatus(status: TriggerDevWorkflowRun["status"]): boolean {
  return ["SUCCESS", "FAILURE", "CANCELLED", "TIMEOUT"].includes(status);
}

/**
 * Sleep utility for polling delays
 *
 * @param ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll multiple workflow runs in parallel
 *
 * @param runIds - Array of workflow run IDs
 * @param options - Polling options (optional)
 * @returns {Promise<WorkflowPollResult[]>} Array of poll results
 *
 * @example
 * ```typescript
 * const results = await pollMultipleWorkflows(["run_abc", "run_def"]);
 * const allSuccess = results.every((r) => r.success);
 * ```
 */
export async function pollMultipleWorkflows(
  runIds: string[],
  options: PollingOptions = {}
): Promise<WorkflowPollResult[]> {
  const promises = runIds.map((runId) => pollWorkflowStatus(runId, options));
  return Promise.all(promises);
}

/**
 * Create a polling promise that can be awaited or cancelled
 *
 * @param runId - Workflow run ID
 * @param options - Polling options (optional)
 * @returns {object} Poll controller with promise and cancel method
 *
 * @example
 * ```typescript
 * const controller = createPollingController("run_abc123");
 * const result = await controller.promise;
 *
 * // Or cancel after timeout:
 * const controller = createPollingController("run_abc123");
 * setTimeout(() => controller.cancel(), 5000);
 * const result = await controller.promise;
 * ```
 */
export function createPollingController(
  runId: string,
  options: PollingOptions = {}
): {
  promise: Promise<WorkflowPollResult>;
  cancel: () => void;
} {
  let cancelled = false;

  const promise = (async () => {
    const intervalMs = options.intervalMs ?? WORKFLOW_POLLING.INTERVAL_MS;
    const maxAttempts = options.maxAttempts ?? WORKFLOW_POLLING.MAX_ATTEMPTS;
    const initialDelayMs = options.initialDelayMs ?? WORKFLOW_POLLING.INITIAL_DELAY_MS;

    if (initialDelayMs > 0) {
      await sleep(initialDelayMs);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (cancelled) {
        return {
          success: false,
          status: "cancelled" as WorkflowStatus,
          error: "Polling cancelled by user",
          attempts: attempt,
          durationMs: 0,
        };
      }

      try {
        const run = await fetchWorkflowRun(runId);

        if (isTerminalStatus(run.status)) {
          if (run.status === "SUCCESS") {
            return {
              success: true,
              status: "success" as WorkflowStatus,
              output: run.output,
              attempts: attempt + 1,
              durationMs: 0,
            };
          }

          return {
            success: false,
            status: run.status.toLowerCase() as WorkflowStatus,
            error: run.error?.message ?? `Workflow ${run.status}`,
            errorCode: run.error?.code,
            attempts: attempt + 1,
            durationMs: 0,
          };
        }

        const backoffDelay = calculateBackoff(attempt, intervalMs);
        await sleep(backoffDelay);
      } catch (_error) {
        const backoffDelay = calculateBackoff(attempt, intervalMs);
        await sleep(backoffDelay);
      }
    }

    return {
      success: false,
      status: "timeout" as WorkflowStatus,
      error: "Polling timeout",
      errorCode: WORKFLOW_ERROR_CODES.POLL_TIMEOUT,
      attempts: maxAttempts,
      durationMs: 0,
    };
  })();

  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}

export default {
  pollWorkflowStatus,
  pollMultipleWorkflows,
  createPollingController,
};
