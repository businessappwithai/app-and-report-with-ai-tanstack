import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/server/response";
import { auth } from "@/lib/auth/config";
import { getDb } from "@/lib/db/config";

async function getSession(request: Request) {
  return auth(request);
}

export const Route = createFileRoute("/api/dashboards/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const { searchParams } = new URL(request.url);
          const page = parseInt(searchParams.get("page") || "0", 10);
          const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

          const db = getDb();

          const dashboards = await db
            .selectFrom("dashboard_layouts")
            .selectAll()
            .orderBy("created_at", "desc")
            .limit(pageSize)
            .offset(page * pageSize)
            .execute();

          const countResult = await db
            .selectFrom("dashboard_layouts")
            .select(db.fn.count<number>("id").as("count"))
            .executeTakeFirstOrThrow();
          const total = Number(countResult.count);

          return json({
            success: true,
            data: {
              items: dashboards,
              meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
            },
          });
        } catch (error) {
          console.error("Error fetching dashboards:", error);
          return json(
            {
              success: false,
              error: { code: "SERVER_ERROR", message: "Failed to fetch dashboards" },
            },
            { status: 500 }
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const session = await getSession(request);
          if (!session?.user) {
            return json(
              { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
              { status: 401 }
            );
          }

          const body = (await request.json()) as {
            name: string;
            description?: string;
            layout?: object;
            layoutConfig?: object;
            isPublic?: boolean;
            is_public?: boolean;
          };

          // Accept both layout and layoutConfig from clients
          const resolvedLayout = body.layout ?? body.layoutConfig;

          if (!body.name || !resolvedLayout) {
            return json(
              { success: false, error: { message: "Missing required fields" } },
              { status: 400 }
            );
          }

          const resolvedIsPublic = body.is_public ?? body.isPublic ?? false;

          const { randomUUID } = await import("node:crypto");
          const db = getDb();
          const id = randomUUID();
          const now = new Date().toISOString();

          await db
            .insertInto("dashboard_layouts")
            .values({
              id,
              name: body.name,
              description: body.description || null,
              layout_config: JSON.stringify(resolvedLayout),
              is_public: resolvedIsPublic,
              created_by: session.user.id,
              created_at: now,
              updated_at: now,
            })
            .executeTakeFirstOrThrow();

          return json(
            {
              success: true,
              data: { id },
            },
            { status: 201 }
          );
        } catch (error) {
          console.error("Error creating dashboard:", error);
          return json(
            {
              success: false,
              error: { code: "SERVER_ERROR", message: "Failed to create dashboard" },
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
