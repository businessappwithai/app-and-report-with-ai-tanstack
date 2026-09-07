import { createFileRoute } from "@tanstack/react-router";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";
import { json } from "@/lib/server/response";
import { sqlEditorConfig, validatePageSize } from "@/lib/config/pagination";
import { generateId } from "@/lib/utils";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/logs/")({
  server: {
    handlers: {
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
            level: "info" | "warn" | "error" | "debug";
            message: string;
            component: string;
            metadata?: Record<string, unknown>;
            errorStack?: string;
          };

          const db = getDb();

          await db
            .insertInto("logs")
            .values({
              id: generateId(),
              timestamp: new Date().toISOString(),
              level: body.level,
              message: body.message,
              component: body.component,
              user_id: session.user.id as any,
              metadata: body.metadata ? JSON.stringify(body.metadata) : null,
              error_stack: body.errorStack,
            })
            .execute();

          return json({ success: true });
        } catch (error) {
          console.error("[LOGS API ERROR]", error);
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

      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const url = new URL(request.url);
          const level = url.searchParams.get("level");
          const component = url.searchParams.get("component");
          const userId = url.searchParams.get("userId");
          const limit = validatePageSize(parseInt(url.searchParams.get("limit") || "100", 10));
          const offset = parseInt(url.searchParams.get("offset") || "0", 10);

          const db = getDb();

          // Determine admin status from session roles (roles are stored as strings)
          const sessionRoles: string[] = (session.user as any).roles ?? [];
          const isAdmin = sessionRoles.some((r) => r.toLowerCase().includes("admin"));

          // Non-admins can only see their own logs
          const filterByUserId = userId && isAdmin ? userId : session.user.id;

          // ── 1. application logs (SQL editor executions) ──────────────────────
          let query = db
            .selectFrom("logs")
            .selectAll()
            .where("user_id", "=", filterByUserId as any);

          if (level && level !== "info") {
            query = query.where("level", "=", level);
          }
          if (component) {
            query = query.where("component", "=", component);
          }

          const appLogs = await query
            .orderBy("timestamp", "desc")
            .limit(limit)
            .offset(offset)
            .execute();

          // ── 2. audit log entries (resource create/update/delete) ─────────────
          let auditQuery = db
            .selectFrom("audit_log")
            .selectAll()
            .where("user_id", "=", filterByUserId as any);

          if (component) {
            auditQuery = auditQuery.where("resource_type", "=", component as any);
          }

          const auditLogs = await auditQuery.orderBy("created_at", "desc").limit(limit).execute();

          // Map audit_log rows to the Log shape expected by LogsViewer
          const auditAsLogs = auditLogs.map((a) => ({
            id: `audit-${a.id}`,
            timestamp: a.created_at,
            level: "info" as const,
            message: `${a.action} ${a.resource_type}${a.resource_id ? ` (${a.resource_id.slice(0, 8)}…)` : ""}`,
            component: a.resource_type,
            user_id: a.user_id ?? null,
            user_email: null as string | null,
            metadata: a.details ?? null,
            error_stack: null as string | null,
          }));

          // Merge, sort by time desc, slice to page
          const merged = [
            ...appLogs.map((l) => ({ ...l, user_email: null as string | null })),
            ...auditAsLogs,
          ]
            .sort((a, b) => {
              const ta = new Date(a.timestamp).getTime();
              const tb = new Date(b.timestamp).getTime();
              return tb - ta;
            })
            .slice(offset, offset + limit);

          const totalCount = appLogs.length + auditLogs.length;

          // Enrich with user email
          const userCache = new Map<string, string>();
          const logsWithEmail = await Promise.all(
            merged.map(async (log) => {
              if (!log.user_id) return { ...log, user_email: "system" };
              const uid = String(log.user_id);
              if (!userCache.has(uid)) {
                const user = await db
                  .selectFrom("users")
                  .select(["id", "email"])
                  .where("id", "=", uid as any)
                  .executeTakeFirst();
                userCache.set(uid, user?.email ?? "unknown");
              }
              return { ...log, user_email: userCache.get(uid) ?? "unknown" };
            })
          );

          return json({
            success: true,
            data: {
              logs: logsWithEmail,
              pagination: {
                limit,
                offset,
                totalCount,
                hasMore: offset + merged.length < totalCount,
              },
            },
          });
        } catch (error) {
          console.error("[LOGS GET ERROR]", error);
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
