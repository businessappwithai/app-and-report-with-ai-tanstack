import { logAudit } from "@/lib/security/audit";
import type { SessionUser } from "@/lib/auth/session";

export interface ErrorContext {
  user?: SessionUser;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export class ServerFunctionError extends Error {
  constructor(
    message: string,
    public code: string = "INTERNAL_ERROR",
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ServerFunctionError";
  }
}

export class ValidationError extends ServerFunctionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 422, details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ServerFunctionError {
  constructor(message: string = "Not authorized") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends ServerFunctionError {
  constructor(resourceType: string, resourceId?: string) {
    const msg = resourceId
      ? `${resourceType} not found: ${resourceId}`
      : `${resourceType} not found`;
    super(msg, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export async function withErrorHandler<T>(
  handler: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  try {
    return await handler();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    // Log audit trail for all errors
    if (context.user) {
      const errorMessage =
        error instanceof ServerFunctionError ? error.message : error.message.substring(0, 200);

      await logAudit({
        userId: context.user.id,
        action: "execute",
        resourceType: context.resourceType as any,
        resourceId: context.resourceId,
        details: {
          error: errorMessage,
          code: error instanceof ServerFunctionError ? error.code : "UNHANDLED_ERROR",
          action: context.action,
          ...context.details,
        },
      }).catch((logErr) => {
        console.error("[Audit Log Failure]", logErr);
      });
    }

    // Re-throw to allow TanStack Start to serialize to client
    if (error instanceof ServerFunctionError) {
      throw error;
    }

    // Wrap unhandled errors to prevent stack traces leaking to client
    const safeMessage = context.user ? error.message : "Internal server error";
    throw new ServerFunctionError(safeMessage, "INTERNAL_ERROR", 500, {
      originalError: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
