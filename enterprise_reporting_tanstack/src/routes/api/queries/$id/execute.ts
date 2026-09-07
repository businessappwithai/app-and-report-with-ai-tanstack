import { createFileRoute } from "@tanstack/react-router";
import { sql as kyselySql } from "kysely";
import { json } from "@/lib/server/response";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const { auth } = await import("@/lib/auth/config");
  return auth(request);
}

export const Route = createFileRoute("/api/queries/$id/execute")({
  server: {
    handlers: {
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

          const query = await db
            .selectFrom("saved_queries")
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();

          if (!query) {
            return json(
              { success: false, error: { code: "NOT_FOUND", message: "Query not found" } },
              { status: 404 }
            );
          }

          const dataSource = await db
            .selectFrom("data_sources")
            .selectAll()
            .where("id", "=", query.data_source_id)
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

          const limitedSql = query.sql_content.trim().replace(/;$/, "");
          const sqlToRun = /\bLIMIT\s+\d+/i.test(limitedSql)
            ? limitedSql
            : `${limitedSql} LIMIT 1000`;

          const { rows } = await kyselySql.raw(sqlToRun).execute(connection);
          const typedRows = rows as Record<string, unknown>[];

          const columns: string[] = typedRows.length > 0 ? Object.keys(typedRows[0]) : [];

          return json({
            success: true,
            data: {
              rows: typedRows,
              columns,
              rowCount: typedRows.length,
            },
          });
        } catch (error) {
          console.error("Error executing query:", error);
          return json(
            {
              success: false,
              error: {
                code: "EXECUTION_ERROR",
                message: error instanceof Error ? error.message : "Failed to execute query",
              },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
