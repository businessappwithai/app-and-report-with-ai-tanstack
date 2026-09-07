import pino from "pino";
import { getDb } from "@/lib/db/config";
import { generateId } from "@/lib/utils";
import { generateLogEmbedding } from "@/lib/embeddings/vector-embeddings";

export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  component: string;
}

let loggerInstance: pino.Logger | null = null;
let dbWriteQueue: Array<{
  timestamp: string;
  level: string;
  message: string;
  component: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  errorStack?: string;
  requestId?: string;
  messageVector?: number[];
}> = [];

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      singleLine: false,
    },
  },
});

function getLogger(): pino.Logger {
  if (!loggerInstance) {
    loggerInstance = pinoLogger;
  }
  return loggerInstance;
}

async function flushLogsToDatabase() {
  if (dbWriteQueue.length === 0) return;

  const logsToWrite = [...dbWriteQueue];
  dbWriteQueue = [];

  try {
    const db = getDb();
    // Insert logs one at a time to avoid serialization issues
    for (const log of logsToWrite) {
      let metadataStr: string | null = null;
      try {
        // Safely serialize metadata, handling circular references
        if (log.metadata) {
          metadataStr = JSON.stringify(log.metadata, (key, value) => {
            // Filter out non-serializable values
            if (typeof value === "function" || typeof value === "symbol") {
              return undefined;
            }
            return value;
          });
        }
      } catch (e) {
        console.error("Failed to serialize metadata:", e);
        metadataStr = null;
      }

      await db
        .insertInto("logs")
        .values({
          id: generateId(),
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          component: log.component,
          user_id: log.userId as any,
          session_id: log.sessionId,
          metadata: metadataStr,
          error_stack: log.errorStack || null,
          request_id: log.requestId || null,
          message_vector: log.messageVector ? JSON.stringify(log.messageVector) : null,
        })
        .execute();
    }
  } catch (error) {
    console.error("Failed to flush logs to database:", error);
    // Only re-queue if we haven't already
    if (dbWriteQueue.length === 0) {
      dbWriteQueue = logsToWrite;
    }
  }
}

// Periodically flush logs to database (server-side only)
if (typeof window === "undefined") {
  // Flush every 2 seconds to ensure logs don't pile up
  const flushInterval = setInterval(async () => {
    try {
      await flushLogsToDatabase();
    } catch (error) {
      console.error("Periodic log flush failed:", error);
    }
  }, 2000);

  // Ensure flush happens on process exit
  process.on("SIGTERM", async () => {
    clearInterval(flushInterval);
    await flushLogsToDatabase();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    clearInterval(flushInterval);
    await flushLogsToDatabase();
    process.exit(0);
  });
}

export function createLogger(context: LogContext) {
  const logger = getLogger();

  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      logger.info(
        {
          component: context.component,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          ...metadata,
        },
        message
      );

      dbWriteQueue.push({
        timestamp: new Date().toISOString(),
        level: "info",
        message,
        component: context.component,
        userId: context.userId,
        sessionId: context.sessionId,
        metadata,
        requestId: context.requestId,
        messageVector: undefined,
      });
    },

    warn: (message: string, metadata?: Record<string, unknown>) => {
      logger.warn(
        {
          component: context.component,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          ...metadata,
        },
        message
      );

      dbWriteQueue.push({
        timestamp: new Date().toISOString(),
        level: "warn",
        message,
        component: context.component,
        userId: context.userId,
        sessionId: context.sessionId,
        metadata,
        requestId: context.requestId,
        messageVector: undefined,
      });
    },

    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
      logger.error(
        {
          component: context.component,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          errorStack: error?.stack,
          ...metadata,
        },
        message
      );

      dbWriteQueue.push({
        timestamp: new Date().toISOString(),
        level: "error",
        message,
        component: context.component,
        userId: context.userId,
        sessionId: context.sessionId,
        metadata,
        errorStack: error?.stack,
        requestId: context.requestId,
        messageVector: undefined,
      });
    },

    debug: (message: string, metadata?: Record<string, unknown>) => {
      logger.debug(
        {
          component: context.component,
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          ...metadata,
        },
        message
      );
    },
  };
}

export function getCloudLogger() {
  return getLogger();
}

export async function flushAllLogs() {
  await flushLogsToDatabase();
}
