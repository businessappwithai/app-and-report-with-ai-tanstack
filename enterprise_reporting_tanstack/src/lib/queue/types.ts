/**
 * Job Queue Types
 * Centralized type definitions for the modular queue system
 */

export type JobType = "report:generate" | "chart:render" | "data:export" | "scheduled:refresh";

export interface ReportJobData {
  type: "report:generate";
  reportId: string;
  userId: string;
  parameters?: Record<string, unknown>;
  format?: "csv" | "xlsx" | "pdf";
}

export interface ChartJobData {
  type: "chart:render";
  chartId: string;
  userId: string;
  format?: "png" | "svg";
}

export interface ExportJobData {
  type: "data:export";
  queryId: string;
  userId: string;
  format: "csv" | "xlsx" | "pdf";
  parameters?: Record<string, unknown>;
}

export interface ScheduledRefreshData {
  type: "scheduled:refresh";
  targetType: "report" | "chart" | "dashboard";
  targetId: string;
  userId: string;
}

export type JobData = ReportJobData | ChartJobData | ExportJobData | ScheduledRefreshData;

export interface JobResult {
  success: boolean;
  outputLocation?: string;
  rowCount?: number;
  duration: number;
  error?: string;
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  jobId?: string;
}

export interface ScheduledJobOptions {
  jobId?: string;
  timezone?: string;
}

export interface QueueConfig {
  connection:
    | {
        host: string;
        port: number;
        db?: number;
        password?: string;
      }
    | string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: "exponential" | "fixed";
      delay: number;
    };
    removeOnComplete?: {
      count?: number;
      age?: number;
    };
    removeOnFail?: {
      count?: number;
      age?: number;
    };
  };
}
