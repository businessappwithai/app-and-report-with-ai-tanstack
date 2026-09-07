/**
 * Trigger.dev Task Definitions
 * Replaces BullMQ workers with trigger.dev tasks
 */

import { task } from "@trigger.dev/sdk/v3";
import { exportQueryData } from "./workers/export-worker";
import { generateReport } from "./workers/report-worker";
import { sendEmailBatch } from "./workers/email-batch-worker";
import { executeMonitoringEvaluation } from "./workers/monitoring-worker";
import type { MonitoringEvaluatePayload } from "@/types/monitoring";
import type {
  ReportJobData,
  ChartJobData,
  ExportJobData,
  ScheduledRefreshData,
} from "./queue/types";

/**
 * Report Generation Task
 */
export const reportGenerationTask = task({
  id: "report:generate",
  run: async (payload: ReportJobData) => {
    const startTime = Date.now();
    try {
      const result = await generateReport(payload);
      return {
        success: true,
        outputLocation: result.outputLocation,
        rowCount: result.rowCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Report generation failed",
      };
    }
  },
});

/**
 * Data Export Task
 */
export const dataExportTask = task({
  id: "data:export",
  run: async (payload: ExportJobData) => {
    const startTime = Date.now();
    try {
      const result = await exportQueryData(payload);
      return {
        success: true,
        outputLocation: result.outputLocation,
        rowCount: result.rowCount,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Data export failed",
      };
    }
  },
});

/**
 * Email Batch Task
 */
export const emailBatchTask = task({
  id: "email:batch",
  run: async (payload: {
    type: "email:batch";
    batchId: string;
    userId: string;
    recipients: string[];
    subject: string;
    template: string;
  }) => {
    const startTime = Date.now();
    try {
      await sendEmailBatch(
        payload.batchId,
        payload.recipients,
        payload.subject,
        payload.template
      );
      return {
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Email batch failed",
      };
    }
  },
});

/**
 * Scheduled Refresh Task
 */
export const scheduledRefreshTask = task({
  id: "scheduled:refresh",
  run: async (payload: ScheduledRefreshData) => {
    const startTime = Date.now();
    try {
      // Trigger refresh based on target type
      let result: any;
      if (payload.targetType === "report") {
        result = await generateReport({
          type: "report:generate",
          reportId: payload.targetId,
          userId: payload.userId,
        });
      } else if (payload.targetType === "chart") {
        // Chart refresh logic
        result = { success: true };
      } else if (payload.targetType === "dashboard") {
        // Dashboard refresh logic
        result = { success: true };
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Scheduled refresh failed",
      };
    }
  },
});

/**
 * Monitoring Evaluation Task
 * Executes a monitoring rule: runs the report SQL, evaluates the threshold,
 * dispatches alerts on breach, and records the execution result.
 *
 * Retry strategy: 3 attempts with exponential backoff (5s → 10s → 20s).
 * maxDuration: 5 minutes per execution (covers slow external DB queries).
 */
export const monitoringEvaluateTask = task({
  id: "monitoring:evaluate",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload: MonitoringEvaluatePayload) => {
    const startTime = Date.now();
    try {
      const result = await executeMonitoringEvaluation(payload);
      return {
        success: result.status !== "ERROR",
        status: result.status,
        metricValue: result.metricValue,
        duration: Date.now() - startTime,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Monitoring evaluation failed",
      };
    }
  },
});
