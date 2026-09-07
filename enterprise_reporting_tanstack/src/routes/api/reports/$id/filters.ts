import { randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";

async function getSession(_request: Request) {
  const { getAuthSession } = await import("@/lib/auth/config");
  return getAuthSession();
}

export const Route = createFileRoute("/api/reports/$id/filters")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const { id: reportId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          const filters = await db
            .selectFrom("report_filters as rf")
            .innerJoin("filter_definitions as fd", "rf.filter_id", "fd.id")
            .select([
              "rf.id",
              "rf.report_id",
              "rf.filter_id",
              "rf.target_column",
              "rf.filter_order",
              "fd.name as filter_name",
              "fd.description",
              "fd.data_source_id",
              "fd.filter_query",
              "fd.display_field",
              "fd.value_field",
            ])
            .where("rf.report_id", "=", reportId)
            .orderBy("rf.filter_order", "asc")
            .execute();

          return json(filters);
        } catch (error) {
          console.error("Error fetching report filters:", error);
          return json({ error: "Failed to fetch report filters" }, { status: 500 });
        }
      },

      POST: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const body = await request.json();
          const { filter_id, target_column } = body;

          if (!filter_id || !target_column) {
            return json({ error: "Missing required fields" }, { status: 400 });
          }

          const { id: reportId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          const report = await db
            .selectFrom("report_definitions")
            .select("id")
            .where("id", "=", reportId)
            .executeTakeFirst();

          if (!report) {
            return json({ error: "Report not found" }, { status: 404 });
          }

          const maxOrderResult = await db
            .selectFrom("report_filters")
            .select(db.fn.max<number>("filter_order").as("max_order"))
            .where("report_id", "=", reportId)
            .executeTakeFirst();
          const nextOrder = ((maxOrderResult?.max_order as number | null) ?? -1) + 1;

          const now = new Date().toISOString();
          const newReportFilter = {
            id: randomUUID(),
            report_id: reportId,
            filter_id,
            target_column,
            filter_order: nextOrder,
            created_at: now,
          };

          await db.insertInto("report_filters").values(newReportFilter).execute();
          return json(newReportFilter, { status: 201 });
        } catch (error) {
          console.error("Error adding report filter:", error);
          return json({ error: "Failed to add report filter" }, { status: 500 });
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session) {
            return json({ error: "Unauthorized" }, { status: 401 });
          }

          const { id: reportId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          await db.deleteFrom("report_filters").where("report_id", "=", reportId).execute();
          return json({ success: true });
        } catch (error) {
          console.error("Error deleting report filters:", error);
          return json({ error: "Failed to delete report filters" }, { status: 500 });
        }
      },
    },
  },
});
