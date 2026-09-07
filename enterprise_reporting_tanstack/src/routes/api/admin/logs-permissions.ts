import { createFileRoute } from "@tanstack/react-router";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";
import { json } from "@/lib/server/response";
import { isAdmin } from "@/lib/permissions/permissions";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/admin/logs-permissions")({
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

          const adminCheck = await isAdmin(session.user.id);
          if (!adminCheck) {
            return json(
              { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
              { status: 403 }
            );
          }

          const db = getDb();
          const setting = await db
            .selectFrom("app_settings")
            .selectAll()
            .where("key", "=", "logs_visible_to_users")
            .executeTakeFirst();

          return json({
            success: true,
            data: {
              logsVisibleToUsers: setting?.value === "true" || true,
            },
          });
        } catch (error) {
          console.error("[LOGS PERMISSIONS GET ERROR]", error);
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

      PUT: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const adminCheck = await isAdmin(session.user.id);
          if (!adminCheck) {
            return json(
              { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
              { status: 403 }
            );
          }

          const body = (await request.json()) as {
            logsVisibleToUsers: boolean;
          };

          const db = getDb();

          await db
            .deleteFrom("app_settings")
            .where("key", "=", "logs_visible_to_users")
            .execute();

          await db
            .insertInto("app_settings")
            .values({
              key: "logs_visible_to_users",
              value: body.logsVisibleToUsers ? "true" : "false",
            })
            .execute();

          return json({ success: true });
        } catch (error) {
          console.error("[LOGS PERMISSIONS UPDATE ERROR]", error);
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
