import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/queries/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const db = getDb();
          const query = await db
            .selectFrom("saved_queries")
            .selectAll()
            .where("id", "=", params.id)
            .executeTakeFirst();

          if (!query) {
            return json({ success: false, error: { message: "Query not found" } }, { status: 404 });
          }

          return json({ success: true, data: query });
        } catch (error) {
          console.error("Error fetching query:", error);
          return json(
            { success: false, error: { message: "Failed to fetch query" } },
            { status: 500 }
          );
        }
      },
      PUT: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as {
            name?: string;
            description?: string;
            dataSourceId?: string;
            sqlContent?: string;
          };

          const db = getDb();

          // Verify ownership (admin can edit any query)
          const existingQuery = await db
            .selectFrom("saved_queries")
            .select("created_by")
            .where("id", "=", params.id)
            .executeTakeFirst();

          if (!existingQuery) {
            return json({ success: false, error: { message: "Query not found" } }, { status: 404 });
          }

          const sessionRoles: string[] = (session.user as any).roles ?? [];
          const isAdmin = sessionRoles.some((r: string) => r.toLowerCase().includes("admin"));
          if (!isAdmin && existingQuery.created_by !== session.user.id) {
            return json({ success: false, error: { message: "Unauthorized" } }, { status: 403 });
          }

          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (body.name) updateData.name = body.name;
          if (body.description !== undefined) updateData.description = body.description || null;
          if (body.dataSourceId) updateData.data_source_id = body.dataSourceId;
          if (body.sqlContent) updateData.sql_content = body.sqlContent;

          await db
            .updateTable("saved_queries")
            .set(updateData)
            .where("id", "=", params.id)
            .execute();

          return json({ success: true, data: { id: params.id } });
        } catch (error) {
          console.error("Error updating query:", error);
          return json(
            { success: false, error: { message: "Failed to update query" } },
            { status: 500 }
          );
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const db = getDb();

          // Verify ownership
          const existingQuery = await db
            .selectFrom("saved_queries")
            .select("created_by")
            .where("id", "=", params.id)
            .executeTakeFirst();

          if (!existingQuery) {
            return json({ success: false, error: { message: "Query not found" } }, { status: 404 });
          }

          const deleteRoles: string[] = (session.user as any).roles ?? [];
          const isDeleteAdmin = deleteRoles.some((r: string) => r.toLowerCase().includes("admin"));
          if (!isDeleteAdmin && existingQuery.created_by !== session.user.id) {
            return json({ success: false, error: { message: "Unauthorized" } }, { status: 403 });
          }

          await db.deleteFrom("saved_queries").where("id", "=", params.id).execute();

          return json({ success: true });
        } catch (error) {
          console.error("Error deleting query:", error);
          return json(
            { success: false, error: { message: "Failed to delete query" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
