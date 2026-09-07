/**
 * What a `.mmd` document actually contains.
 *
 * Used before a model is accepted into a project. Someone importing a file
 * wants to know what they are about to get — how many entities, how many rules,
 * which workflows — and, more importantly, to be told *now* if the document is
 * not a model at all, rather than discovering it on the design page with an
 * empty canvas and no explanation.
 *
 * This reads the document; it does not run the full checker. The generator does
 * that at generate time, where a diagnostic can name a line and refuse to
 * proceed. Here the question is narrower: is this a model, and what is in it.
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/require-user";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface EmlSummary {
  ok: boolean;
  entities: string[];
  relationships: number;
  rules: { name: string; entity: string }[];
  workflows: { name: string; entity: string; kind: string }[];
  /** Reasons the document cannot be used as it stands. */
  problems: string[];
}

export const Route = createFileRoute("/api/eml/validate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const caller = await requireUser(request, "eml:validate", "read");
        if (caller.response) return caller.response;

        try {
          const body = (await request.json()) as { eml?: string };
          const eml = typeof body.eml === "string" ? body.eml : "";

          if (!eml.trim()) {
            return json({
              ok: false,
              entities: [],
              relationships: 0,
              rules: [],
              workflows: [],
              problems: ["The file is empty."],
            } satisfies EmlSummary);
          }

          const { parseModel, extractRuleSections, extractWorkflowSections } = await import(
            "@appwithai/generator"
          );

          const problems: string[] = [];
          let entities: string[] = [];
          let relationships = 0;

          try {
            const model = parseModel(eml);
            entities = model.entities.map((entity) => entity.name);
            relationships = model.relationships.length;
          } catch (parseError) {
            const message = parseError instanceof Error ? parseError.message : "Unknown error";
            problems.push(`The ERD could not be read: ${message}`);
          }

          if (entities.length === 0 && problems.length === 0) {
            problems.push(
              "No entities found. An EML document needs an `erDiagram` section describing the data."
            );
          }

          const rules = extractRuleSections(eml).map((rule) => ({
            name: rule.name,
            entity: rule.entity,
          }));
          const workflows = extractWorkflowSections(eml).map((workflow) => ({
            name: workflow.name,
            entity: workflow.entity,
            kind: workflow.kind,
          }));

          return json({
            ok: problems.length === 0,
            entities,
            relationships,
            rules,
            workflows,
            problems,
          } satisfies EmlSummary);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return json({ error: `Could not read the document: ${message}` }, 500);
        }
      },
    },
  },
});
