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

export const Route = createFileRoute("/api/jobs/status")({
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

          const countByStatus = await db
            .selectFrom("job_executions")
            .select(["status", db.fn.count("id").as("count")])
            .groupBy("status")
            .execute();

          const statusMap: Record<string, number> = {};
          for (const row of countByStatus) {
            statusMap[row.status] = Number(row.count);
          }

          return json({
            success: true,
            data: {
              waiting: statusMap.pending ?? 0,
              active: statusMap.running ?? 0,
              completed: statusMap.completed ?? 0,
              failed: statusMap.failed ?? 0,
              delayed: statusMap.cancelled ?? 0,
            },
          });
        } catch (error) {
          console.error("Error fetching job status:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to fetch job status" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
