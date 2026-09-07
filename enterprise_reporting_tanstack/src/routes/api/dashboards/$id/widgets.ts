import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

async function getSession(request: Request) {
  const { auth } = await import("@/lib/auth/config");
  return auth(request);
}

export const Route = createFileRoute("/api/dashboards/$id/widgets")({
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

          // Verify dashboard exists
          const dashboard = await db
            .selectFrom("dashboard_layouts")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

          if (!dashboard) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Dashboard not found" } },
              { status: 404 }
            );
          }

          const widgets = await db
            .selectFrom("dashboard_widgets")
            .selectAll()
            .where("dashboard_id", "=", id)
            .execute();

          return json({ success: true, data: { items: widgets } });
        } catch (error) {
          console.error("Error fetching dashboard widgets:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to fetch dashboard widgets" } },
            { status: 500 }
          );
        }
      },

      POST: async ({ request, params }) => {
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

          // Verify dashboard exists
          const dashboard = await db
            .selectFrom("dashboard_layouts")
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

          if (!dashboard) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Dashboard not found" } },
              { status: 404 }
            );
          }

          const body = await request.json();
          const { widgetType, reportId, chartId, positionConfig, widgetConfig } = body;

          if (!widgetType) {
            return json(
              { success: false, error: { code: "VALIDATION_ERROR", message: "widgetType is required" } },
              { status: 400 }
            );
          }

          const now = new Date().toISOString();
          const widgetId = randomUUID();

          await db
            .insertInto("dashboard_widgets")
            .values({
              id: widgetId,
              dashboard_id: id,
              widget_type: widgetType,
              report_id: reportId ?? null,
              chart_id: chartId ?? null,
              position_config: JSON.stringify(positionConfig ?? {}),
              widget_config: widgetConfig ? JSON.stringify(widgetConfig) : null,
              created_at: now,
              updated_at: now,
            })
            .execute();

          const widget = await db
            .selectFrom("dashboard_widgets")
            .selectAll()
            .where("id", "=", widgetId)
            .executeTakeFirst();

          return json({ success: true, data: widget }, { status: 201 });
        } catch (error) {
          console.error("Error adding dashboard widget:", error);
          return json(
            { success: false, error: { code: "SERVER_ERROR", message: "Failed to add widget" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
