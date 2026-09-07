/**
 * Session Helpers
 * Utility functions for extracting session tokens from HTTP requests
 */

/**
 * Extract session token from request headers or cookies
 *
 * This function handles multiple token sources:
 * 1. Authorization header (Bearer token)
 * 2. Cookie header
 * 3. Custom header (X-Session-Token)
 *
 * @param headers - HTTP request headers
 * @returns Session token or undefined
 */
export function extractSessionToken(headers: {
  authorization?: string;
  cookie?: string;
  "x-session-token"?: string;
}): string | undefined {
  // Try Authorization header first
  const authHeader = headers.authorization;
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (match) {
      return match[1];
    }
  }

  // Try custom header
  const customHeader = headers["x-session-token"];
  if (customHeader) {
    return customHeader;
  }

  // Try cookie
  const cookieHeader = headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    return cookies["better-auth.session_token"];
  }

  return undefined;
}

/**
 * Parse cookies from Cookie header value
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

/**
 * Create session token for response
 * This can be used to set cookies or headers
 */
export interface SessionTokenOptions {
  /**
   * Max age of the cookie in seconds
   * @default 604800 (7 days)
   */
  maxAge?: number;

  /**
   * Cookie domain
   */
  domain?: string;

  /**
   * Cookie path
   * @default "/"
   */
  path?: string;

  /**
   * Secure flag (HTTPS only)
   * @default true in production
   */
  secure?: boolean;

  /**
   * SameSite flag
   * @default "lax"
   */
  sameSite?: "strict" | "lax" | "none";

  /**
   * HttpOnly flag (not accessible via JavaScript)
   * @default true
   */
  httpOnly?: boolean;
}

/**
 * Format Set-Cookie header value
 */
export function formatSetCookie(
  name: string,
  value: string,
  options: SessionTokenOptions = {}
): string {
  const {
    maxAge = 60 * 60 * 24 * 7, // 7 days
    domain,
    path = "/",
    secure = process.env.NODE_ENV === "production",
    sameSite = "lax",
    httpOnly = true,
  } = options;

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (httpOnly) {
    parts.push("HttpOnly");
  }

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  return parts.join("; ");
}

/**
 * Extract user from session token (async wrapper)
 * This is a convenience function that combines token extraction and session validation
 */
export async function getUserFromRequest(
  headers: Record<string, string | undefined>,
  authService: import("./auth.service.js").AuthService
): Promise<{
  user?: import("./auth.types.js").AuthUser;
  session?: import("./auth.types.js").AuthSession;
  error?: string;
}> {
  const token = extractSessionToken(headers);

  if (!token) {
    return { error: "NO_SESSION_TOKEN" };
  }

  try {
    const session = await authService.getSession(token);

    if (!session) {
      return { error: "INVALID_SESSION" };
    }

    return {
      user: session.user,
      session,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    };
  }
}
