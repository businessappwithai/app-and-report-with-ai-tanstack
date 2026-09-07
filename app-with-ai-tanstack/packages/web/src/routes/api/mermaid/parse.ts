// POST /api/mermaid/parse
// Converts Mermaid erDiagram or flowchart TD → structured definitions via TypeScript AST parsers.
// No AI involved — pure deterministic parsing.

import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

export const Route = createFileRoute("/api/mermaid/parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "mermaid:parse");
        if (caller.response) return caller.response;

        try {
          const { code } = (await request.json()) as { code: string };

          if (!code?.trim()) {
            return new Response(JSON.stringify({ error: "Mermaid code is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { parseMermaid } = await import("@/lib/mermaid");
          const result = parseMermaid(code);

          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Parse failed" }),
            { status: 422, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
