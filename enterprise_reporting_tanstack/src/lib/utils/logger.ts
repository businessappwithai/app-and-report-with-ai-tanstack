/**
 * Centralized logging utility for the application
 * Provides structured logging with different levels and context
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  userId?: string;
  requestId?: string;
}

class Logger {
  private static instance: Logger;
  private requestId?: string;

  private constructor() {
    // Generate unique request ID for each server instance
    if (typeof process !== "undefined") {
      this.requestId =
        process.env.REQUEST_ID || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(entry: LogEntry): string {
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const requestIdStr = entry.requestId ? ` [${entry.requestId}]` : "";
    const userIdStr = entry.userId ? ` [User:${entry.userId}]` : "";
    return `[${entry.timestamp}] [${entry.level}]${requestIdStr}${userIdStr} ${entry.message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, userId?: string): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      userId,
      requestId: this.requestId,
    };

    const formattedMessage = this.formatMessage(entry);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    const errorContext = error
      ? {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      : context;
    this.log(LogLevel.ERROR, message, errorContext);
  }

  // API-specific logging methods
  apiRequest(method: string, path: string, _userId?: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { ...context, type: "API_REQUEST" });
  }

  apiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration?: number,
    context?: LogContext
  ): void {
    this.info(`${method} ${path} - ${statusCode}`, {
      ...context,
      type: "API_RESPONSE",
      statusCode,
      duration,
    });
  }

  apiError(
    method: string,
    path: string,
    statusCode: number,
    error?: Error,
    context?: LogContext
  ): void {
    this.error(
      `${method} ${path} - ${statusCode}`,
      {
        ...context,
        type: "API_ERROR",
        statusCode,
      },
      error
    );
  }

  // Database logging methods
  dbQuery(operation: string, table: string, context?: LogContext): void {
    this.debug(`DB Query: ${operation} on ${table}`, { ...context, type: "DB_QUERY" });
  }

  dbError(operation: string, table: string, error?: Error, context?: LogContext): void {
    this.error(
      `DB Error: ${operation} on ${table}`,
      { ...context, type: "DB_ERROR", table, operation },
      error
    );
  }

  // Authentication logging methods
  authEvent(event: string, userId?: string, context?: LogContext): void {
    this.info(`Auth: ${event}`, { ...context, type: "AUTH_EVENT", userId });
  }

  authError(event: string, error?: Error, context?: LogContext): void {
    this.error(`Auth Error: ${event}`, { ...context, type: "AUTH_ERROR" }, error);
  }

  // Encryption logging methods
  encryptionEvent(event: string, context?: LogContext): void {
    this.debug(`Encryption: ${event}`, { ...context, type: "ENCRYPTION_EVENT" });
  }

  encryptionError(event: string, error?: Error, context?: LogContext): void {
    this.error(`Encryption Error: ${event}`, { ...context, type: "ENCRYPTION_ERROR" }, error);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, context?: LogContext, error?: Error) =>
    logger.error(message, context, error),
  apiRequest: (method: string, path: string, userId?: string, context?: LogContext) =>
    logger.apiRequest(method, path, userId, context),
  apiResponse: (
    method: string,
    path: string,
    statusCode: number,
    duration?: number,
    context?: LogContext
  ) => logger.apiResponse(method, path, statusCode, duration, context),
  apiError: (
    method: string,
    path: string,
    statusCode: number,
    error?: Error,
    context?: LogContext
  ) => logger.apiError(method, path, statusCode, error, context),
  dbQuery: (operation: string, table: string, context?: LogContext) =>
    logger.dbQuery(operation, table, context),
  dbError: (operation: string, table: string, error?: Error, context?: LogContext) =>
    logger.dbError(operation, table, error, context),
  authEvent: (event: string, _userId?: string, context?: LogContext) =>
    logger.authEvent(event, undefined, context),
  authError: (event: string, error?: Error, context?: LogContext) =>
    logger.authError(event, error, context),
  encryptionEvent: (event: string, context?: LogContext) => logger.encryptionEvent(event, context),
  encryptionError: (event: string, error?: Error, context?: LogContext) =>
    logger.encryptionError(event, error, context),
};
