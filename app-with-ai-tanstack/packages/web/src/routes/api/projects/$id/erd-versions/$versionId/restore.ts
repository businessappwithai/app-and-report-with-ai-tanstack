import { createFileRoute } from "@tanstack/react-router";
import { requireProjectAccess } from "@/lib/project-access";

export const Route = createFileRoute("/api/projects/$id/erd-versions/$versionId/restore")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string, "read_write");
        if (access.response) return access.response;

        try {
          const { erdVersionDb } = await import("@appwithai/core/services");
          const versionId = params.versionId as string;

          // Scoped to the project in the URL, not resolved by version id alone:
          // the id says which version, the path says whose.
          const version = await erdVersionDb.setCurrentVersion(versionId, params.id as string);

          if (!version) {
            return new Response(JSON.stringify({ error: "Version not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ version }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error restoring ERD version:", error);
          return new Response(JSON.stringify({ error: "Failed to restore ERD version" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      DELETE: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string, "read_write");
        if (access.response) return access.response;

        try {
          const { erdVersionDb } = await import("@appwithai/core/services");
          const versionId = params.versionId as string;

          const removed = await erdVersionDb.delete(versionId, params.id as string);
          if (!removed) {
            return new Response(JSON.stringify({ error: "Version not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error deleting ERD version:", error);
          return new Response(JSON.stringify({ error: "Failed to delete ERD version" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
