import { getLogger } from "@appwithai/core/logging";
import { createFileRoute } from "@tanstack/react-router";
import { withRequestLogging } from "@/lib/request-logging";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: withRequestLogging("/api/auth/logout", async ({ request }) => {
        const log = getLogger("auth");
        const { getAuthService, getCurrentUser, getSessionToken, clearSessionCookie } =
          await import("@/lib/auth-server");

        // Read before the session is destroyed: afterwards there is nothing
        // left to say who signed out, and "somebody signed out" is not an
        // audit trail.
        const user = await getCurrentUser(request);
        const token = await getSessionToken(request);

        if (token) {
          try {
            const authService = await getAuthService();
            await authService.logout(token);
          } catch (err) {
            // The cookie is cleared regardless — a sign-out that cannot reach
            // the session store must still sign this browser out — but this was
            // a bare `catch {}`, so a store that had stopped accepting deletions
            // looked exactly like a clean sign-out while every token it had
            // issued stayed valid.
            log.event("auth.signout.failed", { userId: user?.id ?? null, err });
          }
        }

        log.event("auth.signout", { userId: user?.id ?? null });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearSessionCookie(),
          },
        });
      }),
    },
  },
});
