import { createFileRoute } from "@tanstack/react-router";
import { getSessionToken } from "@/lib/auth-server";

export const Route = createFileRoute("/api/admin/users/$id/reject")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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
            .where("id", "=", (session as any).userId)
            .executeTakeFirst();

          if (!currentUser || (currentUser as any).role !== "admin") {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const userId = params.id;

          await db
            .updateTable("auth_users")
            .set({ status: "rejected" })
            .where("id", "=", userId)
            .execute();

          const user = await db
            .selectFrom("auth_users")
            .selectAll()
            .where("id", "=", userId)
            .executeTakeFirst();

          return new Response(
            JSON.stringify({
              user: {
                id: (user as any).id,
                email: (user as any).email,
                name: (user as any).name,
                status: (user as any).status,
                role: (user as any).role,
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
              error: error instanceof Error ? error.message : "Failed to reject user",
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
