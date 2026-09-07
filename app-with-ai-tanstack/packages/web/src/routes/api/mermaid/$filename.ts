/**
 * One file from the mermaid library — read it, or remove it.
 *
 * A filename is not a permission. Both verbs used to act on whatever the path
 * named, with no session and no owner check, so a diagram could be downloaded —
 * or deleted — by anyone who could guess or list a name. The file's own
 * `.meta.json` records the project it was saved from, and that is what decides
 * who may reach it: the name says which file, the project says whose.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { type ProjectPermission, requireProjectAccess } from "@/lib/project-access";
import { requireUser } from "@/lib/require-user";

const MERMAID_DIR = path.join(process.cwd(), "generated-projects", ".mermaid-library");

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The same narrowing the writer applies, so a name resolves to one file. */
function safeName(filename: string): string {
  return decodeURIComponent(filename).replace(/[^a-z0-9._-]/gi, "_");
}

/**
 * Resolve the file's project and confirm the caller may act on it.
 *
 * A file whose metadata names no project belongs to no project, and is refused
 * rather than shared: an entry written without the field would otherwise be
 * readable by everyone, which is the hole this check exists to close.
 */
async function guard(
  request: Request,
  safeFilename: string,
  permission: ProjectPermission
): Promise<{ response: Response } | { response?: undefined }> {
  const caller = await requireUser(request, `mermaid:${safeFilename}`, permission);
  if (caller.response) return caller;

  let projectId: string | undefined;
  try {
    const raw = await fs.readFile(path.join(MERMAID_DIR, `${safeFilename}.meta.json`), "utf-8");
    projectId = (JSON.parse(raw) as { projectId?: string }).projectId;
  } catch {
    // No metadata beside it — treated below exactly as a file with no project.
  }

  if (!projectId) return { response: json({ error: "File not found" }, 404) };

  const access = await requireProjectAccess(request, projectId, permission);
  if (access.response) return { response: access.response };
  return {};
}

export const Route = createFileRoute("/api/mermaid/$filename")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const safeFilename = safeName(params.filename);

        const denied = await guard(request, safeFilename, "read");
        if (denied.response) return denied.response;

        try {
          const content = await fs.readFile(path.join(MERMAID_DIR, safeFilename), "utf-8");

          const isJson = safeFilename.endsWith(".json");
          return new Response(content, {
            headers: {
              "Content-Type": isJson ? "application/json" : "text/plain",
              "Content-Disposition": `attachment; filename="${safeFilename}"`,
              "Cache-Control": "no-cache",
            },
          });
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === "ENOENT") return json({ error: "File not found" }, 404);
          return json({ error: err instanceof Error ? err.message : "Failed to read file" }, 500);
        }
      },

      DELETE: async ({ request, params }) => {
        const safeFilename = safeName(params.filename);

        const denied = await guard(request, safeFilename, "read_write");
        if (denied.response) return denied.response;

        try {
          const filePath = path.join(MERMAID_DIR, safeFilename);
          await fs.unlink(filePath).catch(() => undefined);
          await fs.unlink(`${filePath}.meta.json`).catch(() => undefined);

          return json({ success: true }, 200);
        } catch (err) {
          return json({ error: err instanceof Error ? err.message : "Failed to delete file" }, 500);
        }
      },
    },
  },
});
