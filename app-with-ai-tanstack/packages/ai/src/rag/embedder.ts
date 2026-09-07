/**
 * Turning chunk text into vectors.
 *
 * Kept behind a one-function interface so the store and the ingest path do not
 * know or care where embeddings come from. That matters for two reasons: the
 * endpoint is swappable through config like every other model call in this
 * project, and tests can substitute a deterministic embedder and still exercise
 * the real Postgres round trip rather than mocking the database.
 */

import { AI_API_KEY, AI_BASE_URL, AI_EMBEDDING_DIMENSIONS, AI_EMBEDDING_MODEL } from "../config";

/** Embed a batch of texts, in order. One vector out per text in. */
export type Embedder = (texts: string[]) => Promise<number[][]>;

/**
 * The default embedder: the OpenAI-compatible `/v1/embeddings` endpoint.
 *
 * Batched in one request per call because embedding endpoints charge and cost
 * per request as much as per token, and a model with 24 chunks should not make
 * 24 round trips.
 */
export const remoteEmbedder: Embedder = async (texts) => {
  if (!texts.length) return [];

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL });

  const response = await client.embeddings.create({
    model: AI_EMBEDDING_MODEL,
    input: texts,
    // Asked for explicitly because the SDK otherwise negotiates base64 and
    // decodes it as float32. An endpoint that answers with a plain JSON array
    // regardless — which OpenAI-compatible servers commonly do — then gets read
    // four values to one, and the vectors are silently a quarter of the width
    // and entirely wrong.
    encoding_format: "float",
  });

  // The API does not promise response order matches input order; it promises an
  // index on each item. Sorting by it is cheap and removes the question.
  const ordered = [...response.data].sort((a, b) => a.index - b.index);
  const vectors = ordered.map((item) => item.embedding as number[]);

  const width = vectors[0]?.length;
  if (width && width !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model "${AI_EMBEDDING_MODEL}" returned ${width}-dimension vectors but the ` +
        `index expects ${AI_EMBEDDING_DIMENSIONS}. Set LOCAL_AI_EMBEDDING_DIMENSIONS=${width} ` +
        "and re-ingest, or point LOCAL_AI_EMBEDDING_MODEL at a matching model."
    );
  }

  return vectors;
};

/**
 * A deterministic embedder with no model behind it.
 *
 * Not a mock of the vector store — the store is real in the tests that use
 * this. It exists so the ingest and retrieval paths can be exercised without a
 * model server: same text always yields the same vector, and different text
 * yields a different one, which is all the plumbing needs to be proved.
 *
 * Useless for semantic similarity. Never wire it into a running application.
 */
export function hashEmbedder(dimensions = AI_EMBEDDING_DIMENSIONS): Embedder {
  return async (texts) =>
    texts.map((text) => {
      const vector = new Array<number>(dimensions).fill(0);
      for (let index = 0; index < text.length; index++) {
        const code = text.charCodeAt(index);
        // Spread each character over the vector rather than one slot, so two
        // texts differing late still differ in most dimensions.
        const slot = (code * 31 + index) % dimensions;
        vector[slot] = (vector[slot] ?? 0) + (code % 17) / 16;
      }
      const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
      return vector.map((value) => value / magnitude);
    });
}
