import { createFileRoute } from "@tanstack/react-router";
import { sql as kyselySql } from "kysely";
import { json } from "@/lib/server/response";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const { auth } = await import("@/lib/auth/config");
  return auth(request);
}

export const Route = createFileRoute("/api/charts/$id/data")({
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

          const { id: chartId } = params;
          const { getDb } = await import("@/lib/db/config");
          const db = getDb();

          const chart = await db
            .selectFrom("chart_definitions")
            .selectAll()
            .where("id", "=", chartId)
            .executeTakeFirst();

          if (!chart) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Chart not found" } },
              { status: 404 }
            );
          }

          if (!chart.saved_query_id) {
            return json({
              success: true,
              data: { rows: [], totalRows: 0, pageIndex: 0, pageSize: 1000 },
            });
          }

          const savedQuery = await db
            .selectFrom("saved_queries")
            .selectAll()
            .where("id", "=", chart.saved_query_id)
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

          const url = new URL(request.url);
          const pageSize = parseInt(url.searchParams.get("pageSize") || "1000");

          const rawSql = savedQuery.sql_content.trim().replace(/;$/, "");
          const limitedSql = /\bLIMIT\s+\d+/i.test(rawSql) ? rawSql : `${rawSql} LIMIT ${pageSize}`;

          const { rows } = await kyselySql.raw(limitedSql).execute(connection);
          const typedRows = rows as Record<string, unknown>[];

          return json({
            success: true,
            data: {
              rows: typedRows,
              totalRows: typedRows.length,
              pageIndex: 0,
              pageSize,
            },
          });
        } catch (error) {
          console.error("Error fetching chart data:", error);
          return json(
            {
              success: false,
              error: {
                code: "SERVER_ERROR",
                message: error instanceof Error ? error.message : "Failed to fetch chart data",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
