import { createFileRoute } from "@tanstack/react-router";
import { requireProjectAccess } from "@/lib/project-access";

export const Route = createFileRoute("/api/projects/$id/deployment/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string);
        if (access.response) return access.response;

        try {
          const { deploymentDb } = await import("@appwithai/core/services");
          const id = params.id as string;
          const deployments = await deploymentDb.getAllDeployments(id);
          return new Response(JSON.stringify({ deployments }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error fetching deployment:", error);
          return new Response(JSON.stringify({ error: "Failed to fetch deployment" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },

      POST: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string, "read_write");
        if (access.response) return access.response;

        try {
          const { deploymentDb } = await import("@appwithai/core/services");
          const id = params.id as string;
          const body = await request.json();
          const { status, port } = body;

          if (status === "running") {
            const result = await deploymentDb.upsert({
              project_id: id,
              status: "running",
              port,
            });
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          } else {
            const result = await deploymentDb.upsert({ project_id: id, ...body });
            return new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (error) {
          console.error("Error updating deployment:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Failed to update deployment",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      },

      DELETE: async ({ request, params }) => {
        const access = await requireProjectAccess(request, params.id as string, "read_write");
        if (access.response) return access.response;

        try {
          const { deploymentDb } = await import("@appwithai/core/services");
          const id = params.id as string;
          await deploymentDb.delete(id);
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error stopping deployment:", error);
          return new Response(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Failed to stop deployment",
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
