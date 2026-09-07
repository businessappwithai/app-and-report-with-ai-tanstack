import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { DataSourceService } from "@/lib/services/data-source.service";
import { getDb } from "@/lib/db/config";
import { closeConnection } from "@/lib/db/connection-manager";
import { logAudit } from "@/lib/security/audit";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

function checkPermission(session: any, createdBy: string | null): boolean {
  const userRoles: string[] = session.user.roles || [];
  const isAdmin = userRoles.some((r) => r.toLowerCase().includes('admin'));
  const isOwner = createdBy === session.user.id;
  return isAdmin || isOwner;
}

export const Route = createFileRoute("/api/data-sources/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const dataSource = await DataSourceService.getById(params.id, true);

          if (!dataSource) {
            return json(
              { error: { message: "Data source not found" } },
              { status: 404 }
            );
          }

          logAudit({
            userId: session.user.id,
            action: "view",
            resourceType: "data_source",
            resourceId: params.id,
            details: { operation: "getDataSource", name: dataSource.name },
          }).catch((err) => {
            console.error("Audit log error:", err);
          });

          return json(dataSource);
        } catch (error) {
          console.error("Data source get error:", error);
          return json(
            {
              error: {
                message: error instanceof Error ? error.message : "Internal server error",
              },
            },
            { status: 500 }
          );
        }
      },

      PUT: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const db = getDb();
          const existing = await db
            .selectFrom("data_sources")
            .select(["id", "created_by"])
            .where("id", "=", params.id)
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          if (!existing) {
            return json(
              { error: { message: "Data source not found" } },
              { status: 404 }
            );
          }

          if (!checkPermission(session, existing.created_by)) {
            return json(
              { error: { message: "Forbidden" } },
              { status: 403 }
            );
          }

          const body = await request.json();
          if (body.connection_config && !body.connectionConfig) {
            body.connectionConfig = body.connection_config;
          }

          await DataSourceService.update(params.id, body, session.user.id);
          await closeConnection(params.id);

          return json({ success: true });
        } catch (error) {
          console.error("Data source update error:", error);
          return json(
            {
              error: {
                message: error instanceof Error ? error.message : "Internal server error",
              },
            },
            { status: 500 }
          );
        }
      },

      PATCH: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const db = getDb();
          const existing = await db
            .selectFrom("data_sources")
            .select(["id", "created_by"])
            .where("id", "=", params.id)
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          if (!existing) {
            return json(
              { error: { message: "Data source not found" } },
              { status: 404 }
            );
          }

          if (!checkPermission(session, existing.created_by)) {
            return json(
              { error: { message: "Forbidden" } },
              { status: 403 }
            );
          }

          const body = await request.json();

          await DataSourceService.update(params.id, body, session.user.id);

          return json({ success: true });
        } catch (error) {
          console.error("Data source update error:", error);
          return json(
            {
              error: {
                message: error instanceof Error ? error.message : "Internal server error",
              },
            },
            { status: 500 }
          );
        }
      },

      DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const db = getDb();
          const existing = await db
            .selectFrom("data_sources")
            .select(["id", "created_by"])
            .where("id", "=", params.id)
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          if (!existing) {
            return json(
              { error: { message: "Data source not found" } },
              { status: 404 }
            );
          }

          if (!checkPermission(session, existing.created_by)) {
            return json(
              { error: { message: "Forbidden" } },
              { status: 403 }
            );
          }

          await DataSourceService.softDelete(params.id, session.user.id);

          return json({ success: true });
        } catch (error) {
          console.error("Data source delete error:", error);
          return json(
            {
              error: {
                message: error instanceof Error ? error.message : "Internal server error",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
