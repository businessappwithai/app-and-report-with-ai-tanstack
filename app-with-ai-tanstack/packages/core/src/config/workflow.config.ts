/**
 * Workflow Configuration Constants
 *
 * Centralized configuration for Trigger.dev workflow execution.
 * These constants control timeouts, retries, polling behavior, and error handling.
 *
 * Created by: CORE-003 ticket
 * Week: 1
 */

/**
 * Workflow execution timeouts (in milliseconds)
 */
export const WORKFLOW_TIMEOUTS = {
  /**
   * Maximum time for a single workflow run to complete
   * Default: 5 minutes
   */
  RUN_TIMEOUT_MS: 5 * 60 * 1000,

  /**
   * Maximum time for rule evaluation within a workflow
   * Default: 30 seconds
   */
  RULE_EVALUATION_TIMEOUT_MS: 30 * 1000,

  /**
   * Maximum time for database transaction in workflow
   * Default: 10 seconds
   */
  DB_TRANSACTION_TIMEOUT_MS: 10 * 1000,

  /**
   * Maximum time for workflow status polling
   * Default: 2 minutes
   */
  POLL_TIMEOUT_MS: 2 * 60 * 1000,
} as const;

/**
 * Workflow retry configuration
 */
export const WORKFLOW_RETRY = {
  /**
   * Maximum number of retry attempts for failed workflows
   */
  MAX_ATTEMPTS: 3,

  /**
   * Initial backoff delay (exponential backoff)
   * Default: 1 second
   */
  INITIAL_BACKOFF_MS: 1000,

  /**
   * Maximum backoff delay between retries
   * Default: 30 seconds
   */
  MAX_BACKOFF_MS: 30 * 1000,

  /**
   * Backoff multiplier for exponential backoff
   * Default: 2x
   */
  BACKOFF_MULTIPLIER: 2,

  /**
   * Jitter factor to prevent thundering herd
   * Adds random +/- 25% to backoff delay
   */
  JITTER_FACTOR: 0.25,
} as const;

/**
 * Workflow status polling configuration
 */
export const WORKFLOW_POLLING = {
  /**
   * Polling interval for workflow status checks
   * Default: 500ms
   */
  INTERVAL_MS: 500,

  /**
   * Maximum number of poll attempts before timeout
   * With 500ms interval and 2min timeout: 240 attempts
   */
  MAX_ATTEMPTS: Math.ceil(WORKFLOW_TIMEOUTS.POLL_TIMEOUT_MS / 500),

  /**
   * Initial delay before first poll (allows workflow to start)
   * Default: 100ms
   */
  INITIAL_DELAY_MS: 100,
} as const;

/**
 * Trigger.dev configuration
 */
export const TRIGGER_DEV_CONFIG = {
  /**
   * Trigger.dev API key (from environment variable)
   */
  API_KEY: process.env.TRIGGER_API_KEY ?? "",

  /**
   * Trigger.dev API endpoint
   */
  API_URL: process.env.TRIGGER_API_URL ?? "https://api.trigger.dev",

  /**
   * Job name prefix for all rules engine workflows
   */
  JOB_NAME_PREFIX: "rules-engine-",

  /**
   * Enable/disable Trigger.dev workflow execution
   * Set via environment variable: ENABLE_TRIGGER_WORKFLOWS=true
   */
  ENABLED: process.env.ENABLE_TRIGGER_WORKFLOWS === "true",
} as const;

/**
 * Feature flags for workflow behavior
 */
export const WORKFLOW_FEATURE_FLAGS = {
  /**
   * Enable workflow execution logging
   */
  ENABLE_LOGGING: process.env.WORKFLOW_ENABLE_LOGGING !== "false",

  /**
   * Enable workflow execution tracing
   */
  ENABLE_TRACING: process.env.WORKFLOW_ENABLE_TRACING === "true",

  /**
   * Enable workflow metrics collection
   */
  ENABLE_METRICS: process.env.WORKFLOW_ENABLE_METRICS !== "false",

  /**
   * Enable detailed error reporting in workflow responses
   */
  DETAILED_ERRORS: process.env.WORKFLOW_DETAILED_ERRORS === "true",
} as const;

/**
 * Workflow error codes (mapped to sys_error_codes table)
 */
export const WORKFLOW_ERROR_CODES = {
  DISPATCH_FAILED: "WORKFLOW_DISPATCH_FAILED",
  POLL_TIMEOUT: "WORKFLOW_STATUS_POLL_TIMEOUT",
  TRANSACTION_FAILED: "WORKFLOW_TRANSACTION_FAILED",
  RULE_NOT_FOUND: "RULE_NOT_FOUND",
  RULE_EVALUATION_FAILED: "RULE_EVALUATION_FAILED",
} as const;

/**
 * Workflow status values (match Trigger.dev status enum)
 */
export const WORKFLOW_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  FAILURE: "failure",
  CANCELLED: "cancelled",
  TIMEOUT: "timeout",
} as const;

/**
 * Validate workflow configuration
 *
 * @throws {Error} If required configuration is missing or invalid
 */
export function validateWorkflowConfig(): void {
  const errors: string[] = [];

  // Check Trigger.dev configuration
  if (TRIGGER_DEV_CONFIG.ENABLED) {
    if (!TRIGGER_DEV_CONFIG.API_KEY) {
      errors.push("TRIGGER_API_KEY is required when ENABLE_TRIGGER_WORKFLOWS=true");
    }

    if (!TRIGGER_DEV_CONFIG.API_URL) {
      errors.push("TRIGGER_API_URL is required");
    }
  }

  // Validate timeout values
  if (WORKFLOW_TIMEOUTS.RUN_TIMEOUT_MS < 1000) {
    errors.push("RUN_TIMEOUT_MS must be at least 1000ms (1 second)");
  }

  if (WORKFLOW_TIMEOUTS.RULE_EVALUATION_TIMEOUT_MS < 100) {
    errors.push("RULE_EVALUATION_TIMEOUT_MS must be at least 100ms");
  }

  // Validate retry configuration
  if (WORKFLOW_RETRY.MAX_ATTEMPTS < 1) {
    errors.push("MAX_ATTEMPTS must be at least 1");
  }

  if (WORKFLOW_RETRY.INITIAL_BACKOFF_MS < 100) {
    errors.push("INITIAL_BACKOFF_MS must be at least 100ms");
  }

  if (WORKFLOW_RETRY.BACKOFF_MULTIPLIER < 1) {
    errors.push("BACKOFF_MULTIPLIER must be at least 1");
  }

  if (errors.length > 0) {
    throw new Error(`CONFIGURATION_INVALID: Workflow configuration errors:\n${errors.join("\n")}`);
  }
}

/**
 * Get full workflow configuration object
 *
 * @returns {object} Merged workflow configuration
 */
export function getWorkflowConfig() {
  return {
    timeouts: WORKFLOW_TIMEOUTS,
    retry: WORKFLOW_RETRY,
    polling: WORKFLOW_POLLING,
    triggerDev: TRIGGER_DEV_CONFIG,
    featureFlags: WORKFLOW_FEATURE_FLAGS,
    errorCodes: WORKFLOW_ERROR_CODES,
    status: WORKFLOW_STATUS,
  };
}

export default {
  WORKFLOW_TIMEOUTS,
  WORKFLOW_RETRY,
  WORKFLOW_POLLING,
  TRIGGER_DEV_CONFIG,
  WORKFLOW_FEATURE_FLAGS,
  WORKFLOW_ERROR_CODES,
  WORKFLOW_STATUS,
  validateWorkflowConfig,
  getWorkflowConfig,
};
