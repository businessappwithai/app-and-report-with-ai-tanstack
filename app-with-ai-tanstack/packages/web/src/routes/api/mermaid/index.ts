/**
 * The mermaid library — diagrams saved out of the design step, kept as files.
 *
 * Every entry carries the project it was saved from, and that is what decides
 * who may see it. The listing used to serve the whole directory to anybody:
 * unauthenticated, unscoped, and filtered by `projectId` only when the caller
 * chose to pass one — so a diagram was readable by anyone who asked for the
 * list, whichever project it came from.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { accessibleProjectIds, requireProjectAccess } from "@/lib/project-access";
import { requireUser } from "@/lib/require-user";

const MERMAID_DIR = path.join(process.cwd(), "generated-projects", ".mermaid-library");

async function ensureDir() {
  await fs.mkdir(MERMAID_DIR, { recursive: true });
}

export const Route = createFileRoute("/api/mermaid/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const projectId = url.searchParams.get("projectId");

        // Named a project: the ordinary check. Named none: the caller gets the
        // projects they can reach and nothing else — an admin screen listing
        // "everything" is still listing everything *they* may see.
        const caller = projectId
          ? await requireProjectAccess(request, projectId)
          : await requireUser(request, "mermaid-library");
        if (caller.response) return caller.response;

        try {
          await ensureDir();
          const type = url.searchParams.get("type");

          const entries = await fs.readdir(MERMAID_DIR, { withFileTypes: true });
          const metaFiles = entries
            .filter((e) => e.isFile() && e.name.endsWith(".meta.json"))
            .map((e) => e.name);

          const files = await Promise.all(
            metaFiles.map(async (metaFile) => {
              try {
                const raw = await fs.readFile(path.join(MERMAID_DIR, metaFile), "utf-8");
                return JSON.parse(raw);
              } catch {
                return null;
              }
            })
          );

          let filtered = files.filter(Boolean);

          if (projectId) {
            filtered = filtered.filter((f) => f.projectId === projectId);
          } else {
            const reachable = await accessibleProjectIds(caller.user.id);
            // A file with no project on it belongs to nobody and is shown to
            // nobody: the alternative is a hole that opens by writing a file
            // without the field.
            filtered = filtered.filter((f) => f.projectId && reachable.has(String(f.projectId)));
          }
          if (type) {
            filtered = filtered.filter((f) => f.type === type);
          }

          const canonicalParam = url.searchParams.get("canonical");
          if (canonicalParam === "true") {
            filtered = filtered.filter((f) => f.canonical === true);
          }

          filtered.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          return new Response(JSON.stringify({ files: filtered }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Failed to list files" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },

      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          projectId?: string;
          projectName?: string;
          filename?: string;
          type?: "erd" | "rules";
          content?: string;
          canonical?: boolean;
        };

        const { projectId, projectName, filename, type, content, canonical } = body;

        if (!projectId || !filename || !content) {
          return new Response(
            JSON.stringify({ error: "projectId, filename, and content are required" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        // Saving a diagram writes into the project's library, so it takes the
        // same permission as any other edit of that project.
        const access = await requireProjectAccess(request, projectId, "read_write");
        if (access.response) return access.response;

        try {
          await ensureDir();

          // If marking as canonical, clear previous canonical entries for this project
          if (canonical === true) {
            const entries = await fs.readdir(MERMAID_DIR, { withFileTypes: true });
            const metaFiles = entries
              .filter((e) => e.isFile() && e.name.endsWith(".meta.json"))
              .map((e) => e.name);

            for (const metaFile of metaFiles) {
              try {
                const raw = await fs.readFile(path.join(MERMAID_DIR, metaFile), "utf-8");
                const existingMeta = JSON.parse(raw);
                if (existingMeta.projectId === projectId && existingMeta.canonical === true) {
                  existingMeta.canonical = false;
                  await fs.writeFile(
                    path.join(MERMAID_DIR, metaFile),
                    JSON.stringify(existingMeta, null, 2),
                    "utf-8"
                  );
                }
              } catch {
                // skip unreadable files
              }
            }
          }

          const safeFilename = filename.replace(/[^a-z0-9._-]/gi, "_");
          const contentPath = path.join(MERMAID_DIR, safeFilename);
          const metaPath = path.join(MERMAID_DIR, `${safeFilename}.meta.json`);

          await fs.writeFile(contentPath, content, "utf-8");

          const meta = {
            filename: safeFilename,
            type: type ?? "erd",
            projectId,
            projectName,
            content,
            createdAt: new Date().toISOString(),
            canonical: canonical ?? false,
            downloadUrl: `/api/mermaid/${encodeURIComponent(safeFilename)}`,
          };

          await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

          return new Response(JSON.stringify({ success: true, file: meta }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Failed to save file" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});
