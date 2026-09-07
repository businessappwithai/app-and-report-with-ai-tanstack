import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/workflows/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await requireUser(request, "workflow-runs");
        if (caller.response) return caller.response;

        try {
          const { getDatabase } = await import("@appwithai/core/services");
          const url = new URL(request.url);
          const status = url.searchParams.get("status");
          const entity = url.searchParams.get("entity");

          const db = await getDatabase();
          let query = db.selectFrom("workflows").selectAll();

          if (status) {
            query = query.where("status", "=", status);
          }

          if (entity) {
            // Note: 'entity' filter may need adjustment based on actual schema
            // The original used entity_name field which doesn't exist in current schema
          }

          const workflows = await query.orderBy("created_at", "desc").limit(100).execute();

          return new Response(JSON.stringify({ workflows }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching workflows:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch workflows" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
