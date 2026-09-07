import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

async function getSession(request: Request) {
  const { auth } = await import("@/lib/auth/config");
  return auth(request);
}

export const Route = createFileRoute("/api/charts/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const { id } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();
          const chart = await db
            .selectFrom("chart_definitions")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();

          if (!chart) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Chart not found" } },
              { status: 404 }
            );
          }

          return json({ success: true, data: chart });
        } catch (error) {
          console.error("Error fetching chart:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to fetch chart" } },
            { status: 500 }
          );
        }
      },

      PUT: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const { id } = params;
          const body = await request.json();
          const {
            name,
            description,
            chart_type,
            chart_config,
            data_mapping,
            saved_query_id,
            data_source_id,
            refresh_interval,
          } = body;

          const { getDb } = await import("@/lib/db/config");
          const { logAudit } = await import("@/lib/security/audit");
          const db = getDb();
          const existing = await db
            .selectFrom("chart_definitions")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();

          if (!existing) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Chart not found" } },
              { status: 404 }
            );
          }

          await db
            .updateTable("chart_definitions")
            .set({
              name: name ?? existing.name,
              description: description !== undefined ? description : existing.description,
              chart_type: chart_type ?? existing.chart_type,
              chart_config: chart_config ? JSON.stringify(chart_config) : existing.chart_config,
              data_mapping: data_mapping ? JSON.stringify(data_mapping) : existing.data_mapping,
              saved_query_id:
                saved_query_id !== undefined ? saved_query_id : existing.saved_query_id,
              data_source_id: data_source_id ?? existing.data_source_id,
              refresh_interval: refresh_interval ?? existing.refresh_interval,
              updated_at: new Date().toISOString(),
            })
            .where("id", "=", id)
            .execute();

          await logAudit({
            userId: session.user.id,
            action: "update",
            resourceType: "chart",
            resourceId: id,
          });

          const chart = await db
            .selectFrom("chart_definitions")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();
          return json({ success: true, data: chart });
        } catch (error) {
          console.error("Error updating chart:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to update chart" } },
            { status: 500 }
          );
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const { id } = params;
          const { getDb } = await import("@/lib/db/config");
          const { logAudit } = await import("@/lib/security/audit");
          const db = getDb();

          await db.deleteFrom("chart_definitions").where("id", "=", id).execute();

          await logAudit({
            userId: session.user.id,
            action: "delete",
            resourceType: "chart",
            resourceId: id,
          });

          return json({ success: true });
        } catch (error) {
          console.error("Error deleting chart:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to delete chart" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
