import { createFileRoute } from "@tanstack/react-router";
import { requireProjectAccess } from "@/lib/project-access";

export const Route = createFileRoute("/api/projects/$id/erd-versions/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string);
        if (access.response) return access.response;

        try {
          const { erdVersionDb } = await import("@appwithai/core/services");
          const id = params.id as string;

          const versions = await erdVersionDb.getVersions(id);

          return new Response(JSON.stringify({ versions }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching ERD versions:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch ERD versions" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string, "read_write");
        if (access.response) return access.response;

        try {
          const { erdVersionDb } = await import("@appwithai/core/services");
          const id = params.id as string;
          const body = await request.json();
          const { mermaidCode, description, createdBy, validationErrors } = body;

          if (!mermaidCode) {
            return new Response(JSON.stringify({ error: "Mermaid code is required" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const version = await erdVersionDb.createVersion({
            project_id: id,
            mermaid_code: mermaidCode,
            description,
            created_by: createdBy,
            validation_errors: validationErrors,
            is_current: true,
          });

          return new Response(JSON.stringify({ version }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error creating ERD version:", error);
          return new Response(JSON.stringify({ error: "Failed to create ERD version" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
