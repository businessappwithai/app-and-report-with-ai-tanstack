import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/workflows/$workflowId/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const caller = await requireUser(request, `workflow-run:${params.workflowId}`);
        if (caller.response) return caller.response;

        try {
          const { getDatabase } = await import("@appwithai/core/services");
          const workflowId = params.workflowId as string;
          const db = await getDatabase();
          const workflow = await db
            .selectFrom("workflows")
            .selectAll()
            .where("id", "=", workflowId)
            .executeTakeFirst();

          if (!workflow) {
            return new Response(JSON.stringify({ error: "Workflow not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify(workflow), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching workflow:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch workflow" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
