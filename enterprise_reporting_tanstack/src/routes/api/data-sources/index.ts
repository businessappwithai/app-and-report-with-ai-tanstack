import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { DataSourceService } from "@/lib/services/data-source.service";
import { logAudit } from "@/lib/security/audit";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/data-sources/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const url = new URL(request.url);
          const inspectedOnly = url.searchParams.get("inspected") === "true";
          const dataSources = await DataSourceService.list({ inspectedOnly });

          logAudit({
            userId: session.user.id,
            action: "view",
            resourceType: "data_source",
            details: { operation: "listDataSources", count: dataSources.length },
          }).catch((err) => {
            console.error("Audit log error:", err);
          });

          return json({
            success: true,
            data: {
              items: dataSources,
              meta: { total: dataSources.length },
            },
          });
        } catch (error) {
          console.error("Data sources list error:", error);
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

      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ error: { message: "Unauthorized" } }, { status: 401 });
          }

          const body = await request.json();
          const { name, description, clientType, connectionConfig } = body;

          const dataSource = await DataSourceService.create({
            name,
            description,
            clientType,
            connectionConfig,
            userId: session.user.id,
          });

          const { connection_config: _cc, ...safeDataSource } = dataSource;

          return json({ success: true, item: safeDataSource }, { status: 201 });
        } catch (error) {
          console.error("Data sources create error:", error);
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
