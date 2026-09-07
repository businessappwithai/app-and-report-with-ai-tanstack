/**
 * Central AI model configuration.
 *
 * All agents and API routes must import from here — never hard-code model
 * strings or base URLs in individual files.
 *
 * Runtime env vars (set in .env):
 *   LOCAL_AI_BASE_URL   — OpenAI-compatible base URL (default: http://127.0.0.1:8000/v1)
 *   LOCAL_AI_MODEL      — model identifier          (default: mlx-community/Qwen3.8-27B-4bit)
 *   LOCAL_AI_API_KEY    — API key for the endpoint  (default: local)
 */

export const AI_BASE_URL = process.env.LOCAL_AI_BASE_URL ?? "http://127.0.0.1:8000/v1";

export const AI_MODEL = process.env.LOCAL_AI_MODEL ?? "mlx-community/Qwen3.8-27B-4bit";

export const AI_API_KEY = process.env.LOCAL_AI_API_KEY ?? "local";

/**
 * Mastra `OpenAICompatibleConfig` — pass directly as the `model` field of any Agent.
 */
export const mastraModelConfig = {
  id: `openai/${AI_MODEL}` as `${string}/${string}`,
  url: AI_BASE_URL,
  apiKey: AI_API_KEY,
} as const;

/**
 * Embeddings for retrieval.
 *
 * Served from the same OpenAI-compatible endpoint as everything else, so there
 * is one base URL to point at a different machine and one key to rotate. A
 * separate local embedding runtime would be a second thing to install and keep
 * running for no gain — the endpoint already speaks `/v1/embeddings`.
 */
export const AI_EMBEDDING_MODEL = process.env.LOCAL_AI_EMBEDDING_MODEL ?? "bge-small-en-v1.5";

/**
 * Vector width of `AI_EMBEDDING_MODEL`.
 *
 * pgvector fixes the column width when the index is created, so this has to be
 * known up front rather than discovered from the first response. Changing the
 * embedding model means changing this and re-ingesting — a mismatch is rejected
 * at insert time, which is the right place for it to fail.
 */
export const AI_EMBEDDING_DIMENSIONS = Number(process.env.LOCAL_AI_EMBEDDING_DIMENSIONS ?? 384);
