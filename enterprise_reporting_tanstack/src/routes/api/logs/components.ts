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

export const Route = createFileRoute("/api/logs/components")({
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
          const isAdmin = sessionRoles.some((r: string) => r.toLowerCase().includes('admin'));

          // Only return component list for admins; return empty for non-admins
          if (!isAdmin) {
            return json({
              success: true,
              data: [],
            });
          }

          // Get unique components from logs
          const components = await db
            .selectFrom("logs")
            .select("component")
            .distinct()
            .orderBy("component")
            .execute();

          return json({
            success: true,
            data: components.map((c) => c.component),
          });
        } catch (error) {
          console.error("[LOGS COMPONENTS ERROR]", error);
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
