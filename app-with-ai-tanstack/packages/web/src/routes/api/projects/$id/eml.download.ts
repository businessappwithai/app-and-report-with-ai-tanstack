/**
 * The project's model, as a file.
 *
 * The `.mmd` document is the source of truth: it is what the generator reads,
 * and it is the thing worth keeping in version control next to the code it
 * produces. Everything the design phase does — drawing an ERD, writing rules,
 * building workflows in the editor — is merged back into this one document, so
 * downloading it at the end of the process gives back exactly what was
 * designed, in the form another tool (or another project) can read again.
 *
 * A round trip is the point: import a `.mmd`, enhance it here, download it, and
 * the result is the same kind of artifact you started with.
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireProjectAccess } from "@/lib/project-access";

/** A filename someone can find again, derived from the project's own name. */
function fileNameFor(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "model";
  return `${slug}.eml.mmd`;
}

export const Route = createFileRoute("/api/projects/$id/eml/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const access = await requireProjectAccess(request, params.id);
          if (access.response) return access.response;

          const { projectDb } = await import("@appwithai/core/services");

          const project = await projectDb.findById(params.id);
          if (!project) {
            return new Response(JSON.stringify({ error: "Project not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const eml = project.erdCode ?? "";
          if (!eml.trim()) {
            return new Response(
              JSON.stringify({ error: "This project has no model to download yet." }),
              { status: 409, headers: { "Content-Type": "application/json" } }
            );
          }

          return new Response(eml, {
            headers: {
              // text/plain rather than a Mermaid type: browsers have no opinion
              // about .mmd, and an unknown type invites a preview rather than a
              // download.
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Disposition": `attachment; filename="${fileNameFor(project.name ?? "model")}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return new Response(JSON.stringify({ error: `Could not read the model: ${message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
