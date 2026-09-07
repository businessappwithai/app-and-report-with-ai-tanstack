import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/config";
import { getConnection } from "@/lib/db/connection-manager";
import { storeQueryEmbedding } from "@/lib/mastra/rag-store";
import type { DataSource } from "@/types/database";

async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session_token=([^;]+)/);
  const token = match?.[1];
  if (!token) return null;
  return verifySession(token);
}

export const Route = createFileRoute("/api/nl-query/rag-store")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
          }

          const body = await request.json();
          const { data_source_id, natural_language_query, generated_sql, row_count, execution_time_ms } = body;

          if (!data_source_id || !natural_language_query || !generated_sql) {
            return json(
              { success: false, error: { message: "data_source_id, natural_language_query, and generated_sql are required" } },
              { status: 400 },
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
            return json({ success: false, error: { message: "Data source not found" } }, { status: 404 });
          }

          const connection = await getConnection(dataSource as unknown as DataSource);
          await storeQueryEmbedding(
            connection,
            data_source_id,
            natural_language_query,
            generated_sql,
            null,
            row_count ?? null,
            execution_time_ms ?? null,
          );

          return json({ success: true });
        } catch (error) {
          console.error("RAG store error:", error);
          return json(
            { success: false, error: { message: error instanceof Error ? error.message : "Failed to store query" } },
            { status: 500 },
          );
        }
      },
    },
  },
});
