/**
 * Queue Module - Public API
 * Modular job queue system using BullMQ with Bull Board UI integration
 */

// Bull Board Integration
export {
  getBullBoardBasePath,
  getBullBoardCredentials,
  isBullBoardAuthEnabled,
} from "./bull-board";
// Config
export {
  BULL_BOARD_CONFIG,
  DEFAULT_QUEUE_CONFIG,
  QUEUE_NAME,
  RATE_LIMITER,
  WORKER_CONCURRENCY,
} from "./config";
// Queue Manager - Main API
export {
  addJob,
  addScheduledJob,
  cleanOldJobs,
  closeQueue,
  getJob,
  getJobs,
  getQueue,
  getQueueEvents,
  getQueueStatus,
  isQueuePaused,
  obliterateQueue,
  pauseQueue,
  removeJob,
  removeScheduledJob,
  resumeQueue,
  retryJob,
} from "./queue-manager";
// Types
export type {
  ChartJobData,
  ExportJobData,
  JobData,
  JobOptions,
  JobResult,
  JobType,
  QueueConfig,
  QueueStatus,
  ReportJobData,
  ScheduledJobOptions,
  ScheduledRefreshData,
} from "./types";
