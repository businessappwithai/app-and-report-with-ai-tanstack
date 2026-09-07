import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getDatabase } = await import("@appwithai/core/services");
        const { getSessionToken } = await import("@/lib/auth-server");

        try {
          const token = await getSessionToken(request);
          if (!token) {
            return new Response(JSON.stringify({ user: null }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const db = getDatabase();
          const session = await db
            .selectFrom("auth_sessions")
            .selectAll()
            .where("token", "=", token)
            .executeTakeFirst();

          if (!session || new Date(session.expiresAt) < new Date()) {
            return new Response(JSON.stringify({ user: null }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const user = await db
            .selectFrom("auth_users")
            .select(["id", "email", "name", "status", "role"])
            .where("id", "=", session.userId)
            .executeTakeFirst();

          if (!user) {
            return new Response(JSON.stringify({ user: null }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(
            JSON.stringify({
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                status: user.status || "approved",
                role: user.role || "user",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Failed to get session",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
