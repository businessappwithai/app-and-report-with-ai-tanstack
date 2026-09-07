/**
 * Queue Manager
 * Main queue management class for BullMQ operations
 */

import { type Job, Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { DEFAULT_QUEUE_CONFIG, QUEUE_NAME } from "./config";
import type { JobData, JobOptions, JobResult, QueueStatus, ScheduledJobOptions } from "./types";

let queueInstance: Queue<JobData, JobResult> | null = null;
let queueEventsInstance: QueueEvents | null = null;
let redisConnection: Redis | null = null;

/**
 * Initialize the Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

/**
 * Get or create the queue instance
 */
export function getQueue(): Queue<JobData, JobResult> {
  if (!queueInstance) {
    const connection = getRedisConnection();
    queueInstance = new Queue<JobData, JobResult>(QUEUE_NAME, {
      connection: connection as any,
      ...DEFAULT_QUEUE_CONFIG.defaultJobOptions,
    });
  }
  return queueInstance;
}

/**
 * Get or create the queue events instance
 */
export function getQueueEvents(): QueueEvents {
  if (!queueEventsInstance) {
    const connection = getRedisConnection();
    queueEventsInstance = new QueueEvents(QUEUE_NAME, {
      connection: connection as any,
    });
  }
  return queueEventsInstance;
}

/**
 * Add a job to the queue
 */
export async function addJob(
  data: JobData,
  options?: JobOptions
): Promise<Job<JobData, JobResult>> {
  const queue = getQueue();
  return queue.add(data.type, data, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  });
}

/**
 * Add a scheduled (repeatable) job
 */
export async function addScheduledJob(
  data: JobData,
  cronExpression: string,
  options?: ScheduledJobOptions
): Promise<Job<JobData, JobResult>> {
  const queue = getQueue();
  return queue.add(data.type, data, {
    repeat: {
      pattern: cronExpression,
      tz: options?.timezone || "UTC",
    },
    jobId: options?.jobId,
  });
}

/**
 * Remove a scheduled job
 */
export async function removeScheduledJob(jobId: string): Promise<boolean> {
  const queue = getQueue();
  return queue.removeRepeatableByKey(jobId);
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job<JobData, JobResult> | undefined> {
  const queue = getQueue();
  return queue.getJob(jobId);
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<QueueStatus> {
  const queue = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get jobs by status
 */
export async function getJobs(
  status: "waiting" | "active" | "completed" | "failed" | "delayed",
  start: number = 0,
  end: number = 20
) {
  const queue = getQueue();
  return queue.getJobs([status], start, end);
}

/**
 * Clean old jobs
 */
export async function cleanOldJobs(grace: number = 1000, limit: number = 1000) {
  const queue = getQueue();
  await queue.clean(grace, limit, "completed");
  await queue.clean(grace, limit, "failed");
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  const queue = getQueue();
  await queue.pause();
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = getQueue();
  await queue.resume();
}

/**
 * Obliterate the queue (remove all jobs)
 */
export async function obliterateQueue(): Promise<void> {
  const queue = getQueue();
  await queue.obliterate();
}

/**
 * Close connections
 */
export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
  if (queueEventsInstance) {
    await queueEventsInstance.close();
    queueEventsInstance = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

/**
 * Check if queue is paused
 */
export async function isQueuePaused(): Promise<boolean> {
  const queue = getQueue();
  return queue.isPaused();
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (job) {
    await job.retry();
  }
}

/**
 * Remove a job
 */
export async function removeJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (job) {
    await job.remove();
  }
}
