import { randomUUID } from "node:crypto";
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

export const Route = createFileRoute("/api/jobs")({
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
          const { searchParams } = new URL(request.url);
          const page = parseInt(searchParams.get("page") || "0", 10);
          const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 1000);

          const jobs = await db
            .selectFrom("job_definitions")
            .selectAll()
            .where("is_deleted", "=", false)
            .orderBy("created_at", "desc")
            .limit(pageSize)
            .offset(page * pageSize)
            .execute();

          const totalResult = await db
            .selectFrom("job_definitions")
            .select((eb) => eb.fn.count("id").as("total"))
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          const total = Number(totalResult?.total ?? 0);

          return json({ success: true, data: { items: jobs, meta: { total, page, pageSize } } });
        } catch (error) {
          console.error("Error fetching jobs:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to fetch jobs" } },
            { status: 500 }
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as {
            name?: string;
            job_type?: string;
            target_id?: string;
            schedule_cron?: string;
            parameters?: Record<string, unknown>;
            notification_config?: Record<string, unknown>;
            is_active?: boolean;
          };

          const {
            name,
            job_type = "report",
            target_id,
            schedule_cron,
            parameters,
            notification_config,
            is_active = true,
          } = body;

          if (!name || !target_id) {
            return json(
              {
                success: false,
                error: {
                  code: "INVALID_INPUT",
                  message: "Name and target ID are required",
                },
              },
              { status: 400 }
            );
          }

          const db = getDb();
          const jobId = randomUUID();
          const now = new Date().toISOString();

          await db
            .insertInto("job_definitions")
            .values({
              id: jobId,
              name,
              job_type,
              target_id,
              schedule_cron: schedule_cron ?? null,
              parameters: parameters ? JSON.stringify(parameters) : null,
              notification_config: notification_config ? JSON.stringify(notification_config) : null,
              is_active,
              is_deleted: false,
              deleted_at: null,
              deleted_by: null,
              created_by: session.user.id,
              created_at: now,
              updated_at: now,
            })
            .execute();

          return json({ success: true, data: { id: jobId } }, { status: 201 });
        } catch (error) {
          console.error("Error creating job:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to create job" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
