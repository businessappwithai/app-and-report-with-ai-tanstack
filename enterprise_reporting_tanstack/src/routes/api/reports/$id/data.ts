import { createFileRoute } from "@tanstack/react-router";
import { sql as kyselySql } from "kysely";
import { json } from "@/lib/server/response";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const { auth } = await import("@/lib/auth/config");
  return auth(request);
}

export const Route = createFileRoute("/api/reports/$id/data")({
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

          const { id: reportId } = params;
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get("page") || "0");
          const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "50"), 1000);

          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          const report = await db
            .selectFrom("report_definitions")
            .selectAll()
            .where("id", "=", reportId)
            .executeTakeFirst();

          if (!report) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Report not found" } },
              { status: 404 }
            );
          }

          if (!report.saved_query_id) {
            return json({
              success: true,
              data: { rows: [], totalRows: 0, pageIndex: page, pageSize },
            });
          }

          const savedQuery = await db
            .selectFrom("saved_queries")
            .selectAll()
            .where("id", "=", report.saved_query_id)
            .executeTakeFirst();

          if (!savedQuery) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Saved query not found" } },
              { status: 404 }
            );
          }

          const dataSource = await db
            .selectFrom("data_sources")
            .selectAll()
            .where("id", "=", savedQuery.data_source_id)
            .where("is_active", "=", true)
            .executeTakeFirst();

          if (!dataSource) {
            return json(
              {
                success: false,
                error: { code: "NOT_FOUND", message: "Data source not found or inactive" },
              },
              { status: 404 }
            );
          }

          const { getConnection } = await import("@/lib/db/connection-manager");
          const connection = await getConnection(dataSource as unknown as DataSource);

          // Get total row count
          let totalRows = 0;
          try {
            const cleanSql = savedQuery.sql_content.trim().replace(/;$/, "");
            const { rows: countRows } = await kyselySql
              .raw(`SELECT COUNT(*) as total FROM (${cleanSql}) as count_query`)
              .execute(connection);
            totalRows = Number((countRows[0] as Record<string, unknown>)?.total) || 0;
          } catch {
            // count failed, continue without total
          }

          // Execute with pagination
          let querySql = savedQuery.sql_content.trim().replace(/;$/, "");
          const offset = page * pageSize;
          if (!/\bLIMIT\s+\d+/i.test(querySql)) {
            querySql = `${querySql} LIMIT ${pageSize} OFFSET ${offset}`;
          }

          const { rows } = await kyselySql.raw(querySql).execute(connection);

          return json({
            success: true,
            data: {
              rows: rows as Record<string, unknown>[],
              totalRows,
              pageIndex: page,
              pageSize,
            },
          });
        } catch (error) {
          console.error("Error fetching report data:", error);
          return json(
            {
              success: false,
              error: {
                code: "SERVER_ERROR",
                message: error instanceof Error ? error.message : "Failed to fetch report data",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
