import { createFileRoute } from "@tanstack/react-router";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";
import { json } from "@/lib/server/response";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/logs/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const db = getDb();

          const sessionRoles: string[] = (session.user as any).roles ?? [];
          const isAdmin = sessionRoles.some((r: string) => r.toLowerCase().includes("admin"));

          // Only return user list for admins; return empty for non-admins
          if (!isAdmin) {
            return json({
              success: true,
              data: [],
            });
          }

          // Get unique users who have logs
          const users = await db
            .selectFrom("logs")
            .distinctOn("user_id")
            .innerJoin("users", "logs.user_id", "users.id")
            .select(["logs.user_id as id", "users.email"])
            .orderBy("logs.user_id")
            .execute();

          return json({
            success: true,
            data: users,
          });
        } catch (error) {
          console.error("[LOGS USERS ERROR]", error);
          return json(
            {
              success: false,
              error: {
                code: "ERROR",
                message: error instanceof Error ? error.message : "Unknown error",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
