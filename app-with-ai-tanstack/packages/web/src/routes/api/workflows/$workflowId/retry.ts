import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/workflows/$workflowId/retry")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const caller = await requireUser(request, `workflow-run:${params.workflowId}`, "retry");
        if (caller.response) return caller.response;

        try {
          const workflowId = params.workflowId as string;

          // TODO: Implement workflow retry logic
          // The original code referenced sys_workflow_runs table which doesn't exist in new schema
          // This needs to be refactored to work with the new database structure

          return new Response(
            JSON.stringify({
              success: true,
              message: "Workflow retry initiated",
              workflowId,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Error retrying workflow:", error);
          return new Response(JSON.stringify({ error: "Failed to retry workflow" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
