/**
 * Auth Middleware for API Routes
 *
 * Provides authentication and authorization checks for API routes.
 * Integrates with better-auth for session management.
 * Uses standard Web Request/Response APIs (compatible with Vinxi/TanStack Start).
 *
 * Created by: WEB-001 ticket
 * Week: 2
 */

/**
 * Auth error types
 */
export enum AuthErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  FORBIDDEN_OPERATION = "FORBIDDEN_OPERATION",
}

/**
 * Auth error response shape (JSON payload)
 */
export interface AuthErrorPayload {
  error: string;
  code: AuthErrorCode;
  details?: string;
}

/**
 * Check if request is authenticated
 *
 * @param request - Standard Web Request object
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function isAuthenticated(request: Request): Promise<boolean> {
  // Check for session cookie from the Cookie header
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionToken = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("appwithai-session="))
    ?.split("=")[1];

  if (!sessionToken) {
    return false;
  }

  // Validate session exists and hasn't expired
  try {
    const { getDatabase } = await import("@appwithai/core/services");
    const db = getDatabase();
    const now = new Date().toISOString();

    const session = await db
      .selectFrom("auth_sessions")
      .selectAll()
      .where("token", "=", sessionToken)
      .where("expiresAt", ">", now)
      .executeTakeFirst();

    return !!session;
  } catch {
    return false;
  }
}

/**
 * Get current user from request
 *
 * @param request - Standard Web Request object
 * @returns {Promise<{ id: string; email?: string; role?: string } | null>} User object or null
 */
export async function getCurrentUser(_request: Request): Promise<{
  id: string;
  email?: string;
  role?: string;
} | null> {
  // TODO: Implement with better-auth
  // For now, return null (unauthenticated)
  // In production:
  // const session = await authClient.getSession({ headers: request.headers });
  // return session?.user || null;

  return null;
}

/**
 * Require authentication middleware
 *
 * Use this at the start of any route handler that requires authentication.
 *
 * @param request - Standard Web Request object
 * @throws {Response} Throws 401 response if not authenticated
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   await requireAuth(request); // Throws 401 if not authenticated
 *   // ... rest of handler
 * }
 * ```
 */
export async function requireAuth(request: Request): Promise<void> {
  const authenticated = await isAuthenticated(request);

  if (!authenticated) {
    throw AuthError.unauthorized();
  }
}

/**
 * Require role middleware
 *
 * Checks if current user has required role.
 *
 * @param request - Standard Web Request object
 * @param allowedRoles - Array of allowed roles
 * @throws {Response} Throws 401 or 403 response if not authorized
 */
export async function requireRole(request: Request, allowedRoles: string[]): Promise<void> {
  await requireAuth(request);

  const user = await getCurrentUser(request);

  if (!user?.role) {
    throw AuthError.permissionDenied("access this resource");
  }

  if (!allowedRoles.includes(user.role)) {
    throw AuthError.forbiddenOperation("insufficient role privileges");
  }
}

/**
 * Auth error class
 */
export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public details?: string
  ) {
    super(message);
    this.name = "AuthError";
  }

  /**
   * Create unauthorized error (401)
   */
  static unauthorized(): Response {
    return Response.json(
      {
        error: "Authentication required",
        code: AuthErrorCode.UNAUTHORIZED,
        details: "Please log in to access this resource",
      } as AuthErrorPayload,
      { status: 401 }
    );
  }

  /**
   * Create permission denied error (403)
   */
  static permissionDenied(resource?: string): Response {
    return Response.json(
      {
        error: "Permission denied",
        code: AuthErrorCode.PERMISSION_DENIED,
        details: resource
          ? `Insufficient privileges to ${resource}`
          : "You don't have permission to perform this action",
      } as AuthErrorPayload,
      { status: 403 }
    );
  }

  /**
   * Create forbidden operation error (403)
   */
  static forbiddenOperation(reason?: string): Response {
    return Response.json(
      {
        error: "Operation not allowed",
        code: AuthErrorCode.FORBIDDEN_OPERATION,
        details: reason || "This operation is not permitted",
      } as AuthErrorPayload,
      { status: 403 }
    );
  }

  /**
   * Convert to Response
   */
  toResponse(): Response {
    return Response.json(
      {
        error: this.message,
        code: this.code,
        details: this.details,
      } as AuthErrorPayload,
      { status: this.getStatusCode() }
    );
  }

  /**
   * Get HTTP status code for error code
   */
  private getStatusCode(): number {
    switch (this.code) {
      case AuthErrorCode.UNAUTHORIZED:
        return 401;
      case AuthErrorCode.PERMISSION_DENIED:
      case AuthErrorCode.FORBIDDEN_OPERATION:
        return 403;
      default:
        return 401;
    }
  }
}

/**
 * Wrapper for route handlers that require authentication
 *
 * @param handler - Route handler function
 * @returns Wrapped handler that checks authentication first
 *
 * @example
 * ```typescript
 * export const GET = withAuth(async (request) => {
 *   return Response.json({ data: "protected" });
 * });
 * ```
 */
export function withAuth<T extends unknown[]>(
  handler: (request: Request, ...args: T) => Promise<Response>
): (request: Request, ...args: T) => Promise<Response> {
  return async (request: Request, ...args: T): Promise<Response> => {
    try {
      await requireAuth(request);
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return error.toResponse();
      }
      if (error instanceof Response) {
        return error; // Re-throw Response (auth errors)
      }
      throw error; // Re-throw other errors
    }
  };
}

/**
 * Wrapper for route handlers that require specific role
 *
 * @param allowedRoles - Array of allowed roles
 * @param handler - Route handler function
 * @returns Wrapped handler that checks authentication and role
 *
 * @example
 * ```typescript
 * export const POST = withRole(["admin"], async (request) => {
 *   return Response.json({ data: "admin-only" });
 * });
 * ```
 */
export function withRole<T extends unknown[]>(
  allowedRoles: string[],
  handler: (request: Request, ...args: T) => Promise<Response>
): (request: Request, ...args: T) => Promise<Response> {
  return async (request: Request, ...args: T): Promise<Response> => {
    try {
      await requireRole(request, allowedRoles);
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return error.toResponse();
      }
      if (error instanceof Response) {
        return error;
      }
      throw error;
    }
  };
}

export default {
  isAuthenticated,
  getCurrentUser,
  requireAuth,
  requireRole,
  AuthError,
  withAuth,
  withRole,
};
