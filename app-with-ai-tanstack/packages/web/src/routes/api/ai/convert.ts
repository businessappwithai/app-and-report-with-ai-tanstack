import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/ai/convert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "ai:convert", "write");
        if (caller.response) return caller.response;

        try {
          const body = await request.json();
          const { description } = body;

          if (!description || typeof description !== "string") {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Description is required",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          const { convertToMermaid } = await import("@appwithai/ai");
          const mermaidSyntax = await convertToMermaid(description);

          if (!mermaidSyntax) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "Failed to generate Mermaid syntax",
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              mermaidSyntax,
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("AI conversion error:", error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
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
