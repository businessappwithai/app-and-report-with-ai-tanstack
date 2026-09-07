import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

async function getSession(_request: Request) {
  const { getAuthSession } = await import("@/lib/auth/config");
  return getAuthSession();
}

export const Route = createFileRoute("/api/reports/$id/filters/$filterLinkId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const body = await request.json();
          const { target_column, filter_order } = body;

          const updateData: Record<string, unknown> = {};
          if (target_column !== undefined) updateData.target_column = target_column;
          if (filter_order !== undefined) updateData.filter_order = filter_order;

          const { id: reportId, filterLinkId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          // Check existence first
          const existing = await db
            .selectFrom("report_filters")
            .select("id")
            .where("id", "=", filterLinkId)
            .where("report_id", "=", reportId)
            .executeTakeFirst();

          if (!existing) {
            return json({ error: "Report filter not found" }, { status: 404 });
          }

          await db
            .updateTable("report_filters")
            .set(updateData)
            .where("id", "=", filterLinkId)
            .where("report_id", "=", reportId)
            .execute();

          return json({ success: true });
        } catch (error) {
          console.error("Error updating report filter:", error);
          return json({ error: "Failed to update report filter" }, { status: 500 });
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const { id: reportId, filterLinkId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          // Check existence first
          const existing = await db
            .selectFrom("report_filters")
            .select("id")
            .where("id", "=", filterLinkId)
            .where("report_id", "=", reportId)
            .executeTakeFirst();

          if (!existing) {
            return json({ error: "Report filter not found" }, { status: 404 });
          }

          await db
            .deleteFrom("report_filters")
            .where("id", "=", filterLinkId)
            .where("report_id", "=", reportId)
            .execute();

          return json({ success: true });
        } catch (error) {
          console.error("Error deleting report filter:", error);
          return json({ error: "Failed to delete report filter" }, { status: 500 });
        }
      },
    },
  },
});
