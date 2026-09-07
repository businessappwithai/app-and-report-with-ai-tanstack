import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/workflows/$workflowId/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const caller = await requireUser(request, `workflow-run:${params.workflowId}`);
        if (caller.response) return caller.response;

        try {
          const workflowId = params.workflowId as string;

          // TODO: Implement workflow polling with actual Trigger.dev integration
          // For now, return placeholder response
          return new Response(
            JSON.stringify({
              success: true,
              status: "pending",
              workflowId,
              attempts: 0,
              durationMs: 0,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Error polling workflow status:", error);
          return new Response(
            JSON.stringify({
              error: "Failed to poll workflow status",
              details: error instanceof Error ? error.message : "Unknown error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },
    },
  },
});
