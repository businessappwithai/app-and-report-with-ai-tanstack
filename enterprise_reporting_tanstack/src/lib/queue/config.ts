/**
 * Queue Configuration
 * Centralized configuration for the BullMQ queue system
 */

import type { QueueConfig } from "./types";

export const QUEUE_NAME = "reporting" as const;

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  connection: process.env.REDIS_URL || "redis://localhost:6379",
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 60 * 60, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
};

export const WORKER_CONCURRENCY = parseInt(process.env.MAX_CONCURRENT_JOBS || "5", 10);

export const RATE_LIMITER = {
  max: 100,
  duration: 60000, // 1 minute
};

// Bull Board configuration
export const BULL_BOARD_CONFIG = {
  routePrefix: "/admin/queues",
  username: process.env.BULL_BOARD_USER || "admin",
  password: process.env.BULL_BOARD_PASSWORD || "admin",
};
