import type { AuthUsersTable } from "@appwithai/core/config/db.types";

let _authService: any = null;
let _dbReady = false;

async function ensureDb() {
  if (!_dbReady) {
    _dbReady = true;
    const { runMigrations } = await import("@appwithai/core/services");
    await runMigrations().catch((err) => console.error("[Auth] Migration error:", err));
  }
}

export async function getAuthService(): Promise<any> {
  await ensureDb();
  if (!_authService) {
    const { AuthService } = await import("@appwithai/core/auth");
    const { getDatabase } = await import("@appwithai/core/services");
    const secret =
      process.env.BETTER_AUTH_SECRET ||
      process.env.SESSION_SECRET ||
      "appwithai-default-secret-key-change-in-production-32chars";
    _authService = new AuthService({
      db: getDatabase(),
      secret,
      baseURL: process.env.VITE_APP_URL || "http://localhost:3000",
    });
  }
  return _authService;
}

export const AUTH_COOKIE = "appwithai-session";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  return match ? (match[1] ?? null) : null;
}

export function setSessionCookie(token: string): string {
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getCurrentUser(request: Request): Promise<AuthUsersTable | null> {
  await ensureDb();
  const token = getSessionToken(request);
  if (!token) return null;

  const { getDatabase } = await import("@appwithai/core/services");
  const db = getDatabase();
  const now = new Date().toISOString();

  const session = await db
    .selectFrom("auth_sessions")
    .selectAll()
    .where("token", "=", token)
    .where("expiresAt", ">", now)
    .executeTakeFirst();

  if (!session) return null;

  const user = await db
    .selectFrom("auth_users")
    .selectAll()
    .where("id", "=", session.userId)
    .executeTakeFirst();

  return (user as AuthUsersTable | undefined) ?? null;
}
