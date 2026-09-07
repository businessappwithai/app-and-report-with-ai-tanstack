/**
 * Getting a model into the vector store.
 *
 * Called whenever a project's `.mmd` changes — on import, and on save from the
 * design and logic steps. Re-ingesting a whole model rather than patching the
 * changed part is deliberate: chunks reference each other (an entity chunk
 * lists the processes that write to it), so editing one workflow can change the
 * correct text of several entity chunks. Working out which is more code and
 * more ways to be subtly wrong than rebuilding two dozen chunks.
 */

import type { Embedder } from "./embedder";
import { ingestChunks, SPEC_PROJECT_ID } from "./store";

/**
 * Chunk and store a project's model.
 *
 * Takes the document rather than a parsed model so callers do not each have to
 * know how to parse one, and so a document that fails to parse fails here —
 * where it can be reported against the save that caused it — rather than
 * silently leaving stale chunks behind.
 */
export async function ingestProjectModel(
  projectId: string,
  eml: string,
  options: { name?: string; embed?: Embedder } = {}
): Promise<{ ingested: number; entities: number }> {
  const { parseModel, chunkModel, extractEnums } = await import("@appwithai/generator");

  const parsed = parseModel(eml);

  const chunks = chunkModel(
    {
      name: options.name,
      entities: parsed.entities,
      relationships: parsed.relationships,
      categories: parsed.categories,
      enums: extractEnums(eml),
      rules: parsed.rules.map((rule) => ({
        name: rule.name,
        entity: rule.entity,
        tableName: rule.tableName,
        event: rule.event,
        operation: rule.operation,
        priority: rule.priority,
        jdmContent: rule.jdmContent,
      })),
      sagas: parsed.sagas,
      workflows: parsed.workflows.map((workflow) => ({
        name: workflow.name,
        entity: workflow.entity,
        // The compiler models a status as an object; retrieval only needs its name.
        states: workflow.states?.map((state) => state.name),
      })),
    },
    options.name ?? "model"
  );

  const { ingested } = await ingestChunks(projectId, chunks, options.embed);
  return { ingested, entities: parsed.entities.length };
}

/**
 * Store the EML specification once, for every project to retrieve.
 *
 * Without it the assistant writes directives that read plausibly and do not
 * parse — it has seen a lot of Mermaid and no EML. Stored under a reserved
 * project id so every query picks it up alongside the project's own model.
 */
export async function ingestLanguageSpec(
  specs: { source: string; markdown: string }[],
  options: { embed?: Embedder } = {}
): Promise<{ ingested: number }> {
  const { chunkMarkdown } = await import("@appwithai/generator");

  const chunks = specs.flatMap((spec) => chunkMarkdown(spec.markdown, spec.source));
  return ingestChunks(SPEC_PROJECT_ID, chunks, options.embed);
}
