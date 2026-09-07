import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { executeNlQueryPipeline } from "@/lib/mastra/nl-query-pipeline";
import { storeQueryEmbedding } from "@/lib/mastra/rag-store";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/nl-query/execute")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
          }

          const body = await request.json();
          const { query, data_source_id, generated_sql } = body;

          if (!query || !data_source_id) {
            return json(
              {
                success: false,
                error: { message: "query and data_source_id are required" },
              },
              { status: 400 }
            );
          }

          const db = getDb();

          const dataSource = await db
            .selectFrom("data_sources")
            .selectAll()
            .where("id", "=", data_source_id)
            .where("is_deleted", "=", false)
            .executeTakeFirst();

          if (!dataSource) {
            return json(
              { success: false, error: { message: "Data source not found" } },
              { status: 404 }
            );
          }

          const sql = generated_sql || `SELECT 1;`;

          const result = await executeNlQueryPipeline(
            query,
            sql,
            session.user.id,
            dataSource as unknown as DataSource
          );

          // Store successful query in RAG for future similarity search
          if (result.accessGranted && result.queryResults && !result.error) {
            const ds = dataSource as unknown as DataSource;
            getConnection(ds)
              .then((conn) =>
                storeQueryEmbedding(
                  conn,
                  ds.id,
                  query,
                  result.generatedSql,
                  null,
                  result.queryResults!.totalRows,
                  result.queryResults!.executionTimeMs
                )
              )
              .catch((e) => console.warn("[RAG] Failed to store query embedding:", e));
          }

          return json({
            success: true,
            data: result,
          });
        } catch (error) {
          console.error("NL Query execute error:", error);
          return json(
            {
              success: false,
              error: {
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
