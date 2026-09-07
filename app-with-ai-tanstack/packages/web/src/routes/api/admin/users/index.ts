import { createFileRoute } from "@tanstack/react-router";
import { getSessionToken } from "@/lib/auth-server";

export const Route = createFileRoute("/api/admin/users/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { getDatabase } = await import("@appwithai/core/services");
          const token = getSessionToken(request);
          if (!token) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
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

          if (!session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const currentUser = await db
            .selectFrom("auth_users")
            .selectAll()
            .where("id", "=", session.userId)
            .executeTakeFirst();

          if (currentUser?.role !== "admin") {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const url = new URL(request.url);
          const statusFilter = url.searchParams.get("status");

          let query = db.selectFrom("auth_users").selectAll();

          if (statusFilter) {
            query = query.where("status", "=", statusFilter);
          }

          const users = await query.orderBy("createdAt", "desc").execute();

          return new Response(
            JSON.stringify({
              users: users.map((u: any) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                status: u.status || "approved",
                role: u.role || "user",
                createdAt: u.createdAt,
              })),
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Failed to fetch users",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
