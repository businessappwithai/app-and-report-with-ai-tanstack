/**
 * llama.cpp provider for Mastra
 *
 * llama-server exposes an OpenAI-compatible API. Mastra accepts an
 * OpenAICompatibleConfig object as a model, so no extra packages are needed.
 *
 * Env vars (set in .env):
 *   LLAMA_CPP_BASE_URL   default: http://127.0.0.1:8080/v1
 *   LLAMA_CPP_MODEL      default: local  (llama-server ignores the name, but it must be set)
 */

import type { OpenAICompatibleConfig } from "@mastra/core/llm";

export function getLlamaModel(modelOverride?: string): OpenAICompatibleConfig {
  const baseUrl = process.env.LLAMA_CPP_BASE_URL ?? "http://127.0.0.1:8080/v1";
  const modelId = modelOverride ?? process.env.LLAMA_CPP_MODEL ?? "local";

  return {
    providerId: "llamacpp",
    modelId,
    url: baseUrl,
    // llama-server doesn't require an API key; send a dummy to satisfy clients that check
    apiKey: process.env.LLAMA_CPP_API_KEY ?? "not-required",
  };
}

/** Convenience: the default llama.cpp model instance */
export const llamaModel = getLlamaModel();
