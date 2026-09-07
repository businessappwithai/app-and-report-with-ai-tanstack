/**
 * Workflow Service
 * Handles workflow triggering and status tracking
 */

import type {
  IWorkflowService,
  TriggerWorkflowPayload,
  WorkflowOptions,
  WorkflowRunResult,
  WorkflowStatus,
} from "./workflow.types.js";

/**
 * Workflow service implementation
 * This service is responsible for:
 * - Triggering workflows on entity changes
 * - Tracking workflow status
 * - Managing workflow runs
 */
export class WorkflowService implements IWorkflowService {
  private options: WorkflowOptions;
  private runs: Map<string, WorkflowRunResult> = new Map();

  constructor(options: WorkflowOptions) {
    this.options = {
      enabled: true,
      timeout: 300, // 5 minutes default
      ...options,
    };
  }

  /**
   * Trigger a workflow for an entity lifecycle event
   */
  async trigger(payload: TriggerWorkflowPayload): Promise<string> {
    if (!this.options.enabled) {
      // Workflow engine disabled, skip
      return "disabled";
    }

    // Create workflow run ID
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store run in memory (TODO: persist to database)
    this.runs.set(runId, {
      id: runId,
      status: "draft",
      createdAt: new Date(),
      inputPayload: payload,
    });

    // TODO: Fire Trigger.dev webhook/task
    // For now, we'll simulate it
    // In production, this would call:
    // await triggerClient.emitEvent('entity-lifecycle-workflow', payload);

    return runId;
  }

  /**
   * Get workflow status
   */
  async getStatus(runId: string): Promise<WorkflowRunResult> {
    const run = this.runs.get(runId);

    if (!run) {
      throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${runId}`);
    }

    return run;
  }

  /**
   * Retry a failed workflow
   */
  async retry(workflowRunId: string): Promise<string> {
    const run = this.runs.get(workflowRunId);

    if (!run?.inputPayload) {
      throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${workflowRunId}`);
    }

    // Trigger new workflow run with same payload
    return await this.trigger(run.inputPayload as TriggerWorkflowPayload);
  }

  /**
   * Set workflow status on entity
   */
  async setEntityStatus(
    _entityName: string,
    _entityId: string,
    _status: WorkflowStatus,
    _workflowRunId?: string
  ): Promise<void> {
    // TODO: Persist entity workflow status to database
    // For now, this is a no-op
  }

  /**
   * Complete workflow (called by Trigger.dev worker)
   */
  async completeWorkflow(params: {
    runId: string;
    status: "success" | "error";
    outputPayload?: unknown;
    mutationsApplied?: unknown;
    errorDetails?: string;
    durationMs?: number;
  }): Promise<void> {
    const { runId, status, outputPayload, mutationsApplied, errorDetails, durationMs } = params;

    const run = this.runs.get(runId);

    if (!run) {
      throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${runId}`);
    }

    // Update workflow run record
    run.status = status;
    run.outputPayload = outputPayload;
    run.mutationsApplied = mutationsApplied;
    run.error = errorDetails;
    run.durationMs = durationMs;
    run.completedAt = new Date();
  }

  /**
   * Get pending workflows
   */
  async getPendingWorkflows(limit: number = 100): Promise<Record<string, unknown>[]> {
    // TODO: Query pending workflows from database
    // For now, return empty array
    return Array.from(this.runs.values())
      .filter((run) => run.status === "draft")
      .slice(0, limit)
      .map((run) => ({
        id: run.id,
        status: run.status,
        inputPayload: run.inputPayload,
      }));
  }

  /**
   * Get workflows by entity
   */
  async getEntityWorkflows(
    _entityName: string,
    _entityId: string,
    _limit: number = 10
  ): Promise<Record<string, unknown>[]> {
    // TODO: Query entity workflows from database
    // For now, return empty array
    return [];
  }

  /**
   * Timeout stuck workflows (background job)
   */
  async timeoutStuckWorkflows(timeoutSeconds: number = 300): Promise<number> {
    const timeoutDate = new Date(Date.now() - timeoutSeconds * 1000);
    let count = 0;

    for (const [runId, run] of this.runs.entries()) {
      if (
        run.status === "draft" &&
        run.createdAt &&
        run.createdAt.getTime() < timeoutDate.getTime()
      ) {
        await this.completeWorkflow({
          runId,
          status: "error",
          errorDetails: `Workflow timeout after ${timeoutSeconds} seconds`,
        });
        count++;
      }
    }

    return count;
  }
}

/**
 * Create workflow service
 */
export function createWorkflowService(options: WorkflowOptions): WorkflowService {
  return new WorkflowService(options);
}
