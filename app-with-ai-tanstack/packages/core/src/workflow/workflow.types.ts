/**
 * Workflow Types
 * Types for workflow automation using Trigger.dev
 */

import type { EntityOperation } from "../auth/auth.types.js";
import type { RuleEvaluationResult } from "../rules/rules.types.js";

// Re-export for consumers that import from workflow module
export type { EntityOperation, RuleEvaluationResult };

/**
 * Workflow status
 */
export type WorkflowStatus = "none" | "draft" | "success" | "error";

/**
 * Workflow run state
 */
export type WorkflowRunState = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

/**
 * Trigger workflow payload
 */
export interface TriggerWorkflowPayload {
  entityName: string;
  entityId: string;
  operation: EntityOperation;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow run result
 */
export interface WorkflowRunResult {
  id: string;
  status: WorkflowStatus;
  createdAt?: Date;
  completedAt?: Date;
  error?: string;
  durationMs?: number;
  inputPayload?: unknown;
  outputPayload?: unknown;
  mutationsApplied?: unknown;
}

/**
 * Workflow service interface
 */
export interface IWorkflowService {
  /**
   * Trigger a workflow for an entity lifecycle event
   */
  trigger(payload: TriggerWorkflowPayload): Promise<string>; // Returns run ID

  /**
   * Get workflow status
   */
  getStatus(runId: string): Promise<WorkflowRunResult>;

  /**
   * Retry a failed workflow
   */
  retry(workflowRunId: string): Promise<string>; // Returns new run ID

  /**
   * Set workflow status on entity
   */
  setEntityStatus(entityName: string, entityId: string, status: WorkflowStatus): Promise<void>;
}

/**
 * Workflow configuration options
 */
export interface WorkflowOptions {
  /**
   * Trigger.dev project ID
   */
  projectId: string;

  /**
   * Trigger.dev API key
   */
  apiKey: string;

  /**
   * Trigger.dev API URL
   */
  apiUrl?: string;

  /**
   * Enable workflow engine
   */
  enabled?: boolean;

  /**
   * Timeout in seconds
   */
  timeout?: number;
}

/**
 * Entity context for workflow execution
 */
export interface EntityContext {
  entity: Record<string, unknown>;
  relations: Record<string, Record<string, unknown>[]>;
  metadata: {
    entityName: string;
    entityId: string;
    operation: EntityOperation;
    userId?: string;
  };
}

/**
 * Workflow task options
 */
export interface WorkflowTaskOptions {
  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Retry backoff in seconds
   */
  retryBackoff?: number;

  /**
   * Timeout in seconds
   */
  timeout?: number;
}
