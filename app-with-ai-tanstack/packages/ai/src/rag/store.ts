/**
 * The vector store for model context.
 *
 * One pgvector index holds every project's chunks plus the EML specification,
 * separated by a `projectId` on the metadata rather than by an index each.
 * A per-project index would mean creating and dropping indexes as projects come
 * and go, and would make the specification — which every project needs — either
 * duplicated per project or unreachable from a filtered query.
 *
 * The specification is stored under a reserved project id so a single query can
 * ask for "this project's model and the language spec" without a second round
 * trip.
 */

import { getLogger } from "@appwithai/core/logging";
import { AI_EMBEDDING_DIMENSIONS } from "../config";
import type { Embedder } from "./embedder";
import { remoteEmbedder } from "./embedder";

/** Chunks that belong to the language itself rather than to any one project. */
export const SPEC_PROJECT_ID = "__eml_spec__";

export const MODEL_CONTEXT_INDEX = "model_context";

/** The shape `language/rag.ts` produces. Repeated structurally to avoid the import. */
export interface StoredChunk {
  id: string;
  kind: string;
  name: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  text: string;
  kind: string;
  name: string;
  source: string;
  metadata: Record<string, unknown>;
}

/** Resolved lazily: importing @mastra/pg pulls in `pg`, which is Node-only. */
async function openStore() {
  const { PgVector } = await import("@mastra/pg");
  const connectionString =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
  // `id` names the store instance in Mastra's registry; it is not a database id.
  return new PgVector({ id: "model-context", connectionString });
}

/**
 * Create the index if it is not there.
 *
 * HNSW rather than the default flat scan: retrieval runs on every assistant
 * message, and an exhaustive scan is fine for one model and not for a hundred.
 * `projectId` and `kind` are given metadata indexes because every query filters
 * on the first and most filter on the second.
 */
export async function ensureIndex(): Promise<void> {
  const store = await openStore();
  try {
    await store.createIndex({
      indexName: MODEL_CONTEXT_INDEX,
      dimension: AI_EMBEDDING_DIMENSIONS,
      metric: "cosine",
      indexConfig: { type: "hnsw", hnsw: { m: 16, efConstruction: 64 } },
      metadataIndexes: ["projectId", "kind", "entity"],
    });
  } finally {
    await store.disconnect?.();
  }
}

/**
 * Replace everything stored for one project.
 *
 * Delete-then-insert rather than upsert-by-id: a model that loses an entity
 * should lose its chunk, and an upsert keyed on chunk id would leave the
 * deleted entity's chunk behind to be retrieved as though it still existed.
 * The whole set for a project is small enough that rewriting it is cheaper than
 * working out the difference.
 */
export async function ingestChunks(
  projectId: string,
  chunks: StoredChunk[],
  embed: Embedder = remoteEmbedder
): Promise<{ ingested: number }> {
  await ensureIndex();
  const store = await openStore();

  try {
    await clearProject(projectId);

    if (!chunks.length) return { ingested: 0 };

    const vectors = await embed(chunks.map((chunk) => chunk.text));
    await store.upsert({
      indexName: MODEL_CONTEXT_INDEX,
      vectors,
      // The text rides along in the metadata: a vector store returns metadata,
      // not the source document, and a retrieved chunk the caller then has to
      // go and look up somewhere else is not much use to an agent.
      metadata: chunks.map((chunk) => ({
        ...chunk.metadata,
        projectId,
        chunkId: chunk.id,
        text: chunk.text,
      })),
      ids: chunks.map((chunk) => `${projectId}:${chunk.id}`),
    });

    return { ingested: chunks.length };
  } finally {
    await store.disconnect?.();
  }
}

/**
 * Drop one project's chunks.
 *
 * Issued as SQL because the store's own delete works by vector id, and the ids
 * for a project are exactly what we do not want to have to enumerate.
 */
export async function clearProject(projectId: string): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`DELETE FROM ${MODEL_CONTEXT_INDEX} WHERE metadata->>'projectId' = $1`, [
      projectId,
    ]);
  } catch {
    // The index may not exist yet on a first ingest, which is not a failure.
  } finally {
    await pool.end();
  }
}

/**
 * Retrieve the chunks most relevant to a question.
 *
 * Always searches the project's own model together with the language
 * specification: half the questions asked while designing are about the
 * project ("what writes to CAPA?") and half are about the language ("how do I
 * declare a delete workflow?"), and the assistant cannot know which it has been
 * given before it looks.
 */
export async function retrieve(
  projectId: string,
  query: string,
  options: { topK?: number; kinds?: string[]; embed?: Embedder } = {}
): Promise<RetrievedChunk[]> {
  const { topK = 8, kinds, embed = remoteEmbedder } = options;
  const log = getLogger("ai");
  const startedAt = Date.now();

  const [queryVector] = await embed([query]);
  if (!queryVector) return [];

  const store = await openStore();
  try {
    const filter = {
      projectId: { $in: [projectId, SPEC_PROJECT_ID] },
      ...(kinds?.length ? { kind: { $in: kinds } } : {}),
    };

    const results = await store.query({
      indexName: MODEL_CONTEXT_INDEX,
      queryVector,
      topK,
      // The store's filter type enumerates every operator combination; this
      // shape is one of them, but not one TypeScript can narrow to from here.
      filter: filter as never,
    });

    // The query text is not logged — it is whatever the user typed at the
    // assistant. How many chunks came back and how long it took is what says
    // whether retrieval is working.
    log.event("ai.retrieval.completed", {
      index: MODEL_CONTEXT_INDEX,
      projectId,
      matches: results.length,
      durationMs: Date.now() - startedAt,
    });

    return results.map((result) => ({
      id: String(result.metadata?.chunkId ?? result.id),
      score: result.score,
      text: String(result.metadata?.text ?? ""),
      kind: String(result.metadata?.kind ?? "unknown"),
      name: String(result.metadata?.name ?? ""),
      source: String(result.metadata?.source ?? ""),
      metadata: result.metadata ?? {},
    }));
  } finally {
    await store.disconnect?.();
  }
}
