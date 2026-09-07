import { getLogger } from "@appwithai/core/logging";
import { createFileRoute } from "@tanstack/react-router";
import { withRequestLogging } from "@/lib/request-logging";

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: withRequestLogging("/api/auth/login", async ({ request }) => {
        const log = getLogger("auth");
        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null;
        const { AUTH_LOGIN_LIMIT, enforceRateLimit } = await import("@/lib/rate-limit");

        // Brute-force protection: 10 attempts per minute per IP.
        const limited = enforceRateLimit(request, "auth:login", AUTH_LOGIN_LIMIT);
        if (limited) return limited;

        const { setSessionCookie } = await import("@/lib/auth-server");
        const { getDatabase } = await import("@appwithai/core/services");
        const { hashPassword } = await import("@/lib/password");
        try {
          const body = await request.json();
          const { email, password } = body as { email: string; password: string };

          if (!email || !password) {
            return new Response(JSON.stringify({ error: "Email and password are required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const db = getDatabase();

          const user = await db
            .selectFrom("auth_users")
            .selectAll()
            .where("email", "=", email)
            .executeTakeFirst();

          if (!user) {
            log.event("auth.signin.failed", { email, ip: clientIp, reason: "no-such-account" });
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const status = user.status || "approved";
          const role = user.role || "user";

          if (status === "pending") {
            log.event("auth.signin.failed", { email, ip: clientIp, reason: "pending-approval" });
            return new Response(
              JSON.stringify({
                error: "PENDING_APPROVAL",
                message:
                  "Your account is pending admin approval. Please wait for an administrator to review your registration.",
              }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          if (status === "rejected") {
            log.event("auth.signin.failed", { email, ip: clientIp, reason: "account-rejected" });
            return new Response(
              JSON.stringify({
                error: "ACCOUNT_REJECTED",
                message: "Your account has been rejected. Please contact an administrator.",
              }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          // Verify password
          const passwordHash = await hashPassword(password);
          const storedPasswordHash = user.passwordHash;

          if (!storedPasswordHash) {
            log.event("auth.signin.failed", { email, ip: clientIp, reason: "no-credential-set" });
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (passwordHash !== storedPasswordHash) {
            log.event("auth.signin.failed", { email, ip: clientIp, reason: "bad-password" });
            return new Response(JSON.stringify({ error: "Invalid email or password" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Create a session
          const sessionId = crypto.randomUUID();
          const sessionToken = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          await db
            .insertInto("auth_sessions")
            .values({
              id: sessionId,
              userId: user.id,
              token: sessionToken,
              expiresAt,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .execute();

          log.event("auth.signin.succeeded", { email, userId: user.id, ip: clientIp });

          return new Response(
            JSON.stringify({
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role,
                status,
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Set-Cookie": setSessionCookie(sessionToken),
              },
            }
          );
        } catch (error) {
          log.event("auth.signin.failed", {
            email: null,
            ip: clientIp,
            reason: "sign-in raised",
            err: error,
          });
          const message = error instanceof Error ? error.message : "Login failed";
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }),
    },
  },
});
