/**
 * The models that ship with the application.
 *
 * Starting a project should not require having a `.mmd` to hand. These are the
 * bundled examples — the same files in `examples/` and `language/examples/` —
 * offered as a starting point, with uploading your own still the other option.
 *
 * In a container the interesting directory is usually a mount: point
 * `EXAMPLE_MODELS_DIR` at it (colon-separated for several) and whatever is
 * mounted there is offered alongside the built-in set.
 *
 * GET /api/models/examples          → the list
 * GET /api/models/examples?id=<id>  → one model's content
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

/** Directories searched, in order. Missing ones are skipped, not an error. */
function searchPaths(): string[] {
  const cwd = process.cwd();
  const configured = (process.env.EXAMPLE_MODELS_DIR ?? "")
    .split(":")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [
    ...configured,
    // `/models` is where the compose file mounts them, and it is read-only
    // there — offering it is safe even when it is somebody else's directory.
    "/models",
    path.join(cwd, "examples"),
    path.join(cwd, "language", "examples"),
  ];
}

interface ExampleModel {
  /** Stable identifier: the file's basename. Also what `?id=` takes. */
  id: string;
  /** "drug-discovery" — the filename without its extensions. */
  name: string;
  /** A human label: "Drug Discovery". */
  label: string;
  /** Entity count, so the list says how big each model is. */
  entities: number;
  bytes: number;
}

function labelFor(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Entities in an ERD section, counted cheaply.
 *
 * Parsing the document properly would be more accurate and much slower for a
 * list that exists to help someone choose. A block opener at the start of an
 * indented line is close enough, and a wrong count here costs nothing.
 */
function countEntities(source: string): number {
  const matches = source.match(/^\s{2,}[A-Za-z_][\w]*\s*\{/gm);
  return matches ? matches.length : 0;
}

async function collect(): Promise<{ models: ExampleModel[]; byId: Map<string, string> }> {
  const models: ExampleModel[] = [];
  const byId = new Map<string, string>();

  for (const directory of searchPaths()) {
    let entries: string[];
    try {
      entries = await fs.readdir(directory);
    } catch {
      continue; // not mounted, not present — either way, nothing to offer
    }

    for (const entry of entries.sort()) {
      if (!entry.endsWith(".mmd")) continue;
      // The same example can appear in more than one search path; first wins,
      // which is why configured directories are searched before the built-ins.
      if (byId.has(entry)) continue;

      const full = path.join(directory, entry);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
        const source = await fs.readFile(full, "utf8");
        const name = entry.replace(/\.(eml|erd)?\.?mmd$/i, "");

        byId.set(entry, full);
        models.push({
          id: entry,
          name,
          label: labelFor(name),
          entities: countEntities(source),
          bytes: stat.size,
        });
      } catch {
        // An unreadable file is not worth failing the whole list over.
      }
    }
  }

  // Biggest first: the substantial examples are the ones worth starting from.
  models.sort((a, b) => b.entities - a.entities || a.name.localeCompare(b.name));
  return { models, byId };
}

export const Route = createFileRoute("/api/models/examples")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const caller = await requireUser(request, "models:examples", "read");
        if (caller.response) return caller.response;

        const json = (body: unknown, status = 200): Response =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        try {
          const id = new URL(request.url).searchParams.get("id");
          const { models, byId } = await collect();

          if (!id) return json({ models });

          // Resolved through the map rather than by joining the id onto a
          // directory: an id that is not a key is simply not a model we offer,
          // so `../../etc/passwd` cannot name a file at all.
          const file = byId.get(id);
          if (!file) return json({ error: `No bundled model named "${id}"` }, 404);

          const eml = await fs.readFile(file, "utf8");
          const model = models.find((candidate) => candidate.id === id);
          return json({ id, name: model?.name ?? id, label: model?.label, eml });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return json({ error: `Could not read the bundled models: ${message}` }, 500);
        }
      },
    },
  },
});
