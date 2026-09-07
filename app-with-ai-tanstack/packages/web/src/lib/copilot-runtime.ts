/**
 * The CopilotKit runtime, shared by both `/api/copilotkit` routes.
 *
 * This used to build an `AnthropicAdapter` around `ANTHROPIC_API_KEY` with the
 * model id `claude-sonnet-4-20250514` written into the file. Two things were
 * wrong with that. The project does not call the Anthropic API any more — the
 * key is dead config, so the assistant answered every message with an auth
 * error — and a hard-coded model string is exactly what `packages/ai/src/config.ts`
 * exists to prevent: changing models meant editing route files.
 *
 * The adapter now points at the same local OpenAI-compatible endpoint every
 * agent uses, resolved from that one config module.
 */

import { CopilotRuntime, OpenAIAdapter } from "@copilotkit/runtime";

/** One runtime for the process; it holds no per-request state. */
export const copilotRuntime = new CopilotRuntime();

/**
 * Build the service adapter.
 *
 * Per request rather than once at module load: the OpenAI client captures the
 * base URL when it is constructed, and building it lazily means a dev server
 * that starts before the model server does not need restarting once it is up.
 */
export async function makeServiceAdapter() {
  const { default: OpenAI } = await import("openai");

  const apiKey = process.env.LOCAL_AI_API_KEY ?? "local";
  const baseURL = process.env.LOCAL_AI_BASE_URL ?? "http://127.0.0.1:8000/v1";
  const model = process.env.LOCAL_AI_MODEL ?? "mlx-community/Qwen3.8-27B-4bit";

  return new OpenAIAdapter({
    openai: new OpenAI({ apiKey, baseURL }) as never,
    model,
  });
}

/**
 * Handle one CopilotKit request.
 *
 * `endpoint` has to match the route the browser posts to, or the runtime's
 * generated GraphQL URLs point somewhere that does not exist.
 */
export async function handleCopilotRequest(request: Request, endpoint: string): Promise<Response> {
  const { copilotRuntimeNodeHttpEndpoint } = await import("@copilotkit/runtime");

  const handler = copilotRuntimeNodeHttpEndpoint({
    runtime: copilotRuntime,
    serviceAdapter: await makeServiceAdapter(),
    endpoint,
  });

  return handler(request) as Promise<Response>;
}

/** Turn a thrown error into a response rather than a dead socket. */
export function copilotError(error: unknown, method: string): Response {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`[copilotkit] ${method} failed:`, error);
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
