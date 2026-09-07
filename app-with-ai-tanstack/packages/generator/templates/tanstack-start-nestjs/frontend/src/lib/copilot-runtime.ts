/**
 * The CopilotKit runtime behind the administrator's assistant.
 *
 * Runs in the front end server rather than the NestJS API so the chat stream
 * never crosses the proxy: CopilotKit streams over its own protocol, and
 * forwarding that through the API's request pipeline buys nothing and breaks
 * streaming. The model context the assistant reasons about still comes from the
 * API, over the ordinary endpoints, as a tool the model calls.
 *
 * Points at the same OpenAI-compatible endpoint the rest of the application is
 * configured with, so there is one base URL to repoint and one key to rotate.
 *
 * The client posts to /api/copilotkit exactly — no trailing segment — which a
 * splat route can never match, so the routing lives in the /api/$ route and
 * both shapes land here. `isCopilotPath` is what that route asks.
 *
 */

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:8000/v1'
const AI_API_KEY = process.env.AI_API_KEY || 'local'
const AI_MODEL = process.env.AI_MODEL || 'qwen3.6:27b-mlx'

/** The endpoint the client is configured with, and the path this serves. */
export const COPILOT_ENDPOINT = '/api/copilotkit'

/** Does this /api/* splat belong to the assistant rather than the API? */
export function isCopilotPath(splat: string): boolean {
  return splat === 'copilotkit' || splat.startsWith('copilotkit/')
}

/**
 * One runtime for the process; it holds no per-request state.
 *
 * Imported on first use rather than at module load, and deliberately so. The
 * whole API surface is served by the same bundle, and `@copilotkit/runtime`
 * drags in a large dependency tree — if any of it fails to load, an assistant
 * that answers 500 is a bad afternoon, while an API router that fails to
 * register is every screen in the application at once.
 */
let runtimeSetup: Promise<{
  runtime: unknown
  makeEndpoint: (request: Request) => Promise<Response>
}> | null = null

async function getRuntime() {
  if (!runtimeSetup) {
    runtimeSetup = (async () => {
      const { CopilotRuntime, OpenAIAdapter, copilotRuntimeNodeHttpEndpoint } = await import(
        '@copilotkit/runtime'
      )
      const { default: OpenAI } = await import('openai')
      const runtime = new CopilotRuntime()

      // Built per request rather than once: the OpenAI client captures the base
      // URL when constructed, so building it late means a server that started
      // before the model did does not need restarting once the model is up.
      const makeEndpoint = (request: Request) => {
        const handler = copilotRuntimeNodeHttpEndpoint({
          runtime,
          serviceAdapter: new OpenAIAdapter({
            openai: new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL }) as never,
            model: AI_MODEL,
          }),
          endpoint: COPILOT_ENDPOINT,
        })
        return handler(request) as Promise<Response>
      }

      return { runtime, makeEndpoint }
    })().catch((error) => {
      // Do not cache the failure — a missing model or a slow first import
      // should not disable the assistant for the life of the process.
      runtimeSetup = null
      throw error
    })
  }
  return runtimeSetup
}

/**
 * A thrown error becomes a response rather than a dead socket, and says what
 * went wrong.
 *
 * `instanceof Error` alone is not enough: a module that fails to resolve throws
 * an object bun does not construct from the realm's Error, so the check missed
 * and the browser was told "Unknown error" while the one useful sentence stayed
 * in the server log.
 */
function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

function failed(error: unknown, method: string): Response {
  console.error(`[copilotkit] ${method} ${COPILOT_ENDPOINT} failed:`, error)
  return new Response(JSON.stringify({ error: describe(error) }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}

export async function handleCopilotRequest(request: Request): Promise<Response> {
  try {
    const { makeEndpoint } = await getRuntime()
    return await makeEndpoint(request)
  } catch (error) {
    return failed(error, request.method)
  }
}
