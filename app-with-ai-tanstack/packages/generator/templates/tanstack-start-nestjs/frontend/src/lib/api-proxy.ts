/**
 * Forwarding /api/* to the NestJS API, from inside the front end server.
 *
 * The application is two servers, and the browser is only ever told about the
 * first one. Every /api request lands here and is replayed against the second
 * from the server side, so from the browser's point of view there is one origin
 * and one set of cookies.
 *
 * That is not a tidiness preference, it is what makes signing in work. Talking
 * to the API on its own port makes every call cross-origin: the response has to
 * carry an exact Access-Control-Allow-Origin and Access-Control-Allow-Credentials
 * for the session cookie to be stored at all, which in turn means the API has to
 * be told the browser's origin ahead of time. Get it wrong — a different host
 * name, an IP instead of localhost, a port the compose file did not predict —
 * and the sign-in request returns 200 with a perfectly good session that the
 * browser then throws away. The UI says the password is wrong. It is not.
 *
 * Same-origin has none of that: no preflight, no allow-list, no cookie
 * negotiation, and it works unchanged on localhost, on a LAN address, behind a
 * reverse proxy, and over plain HTTP.
 *
 */

import { BACKEND_PORT } from "./app-meta";

/**
 * Where the API is. Both halves in one container is loopback; the split compose
 * deployment sets this to the backend service.
 */
export const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.API_URL ||
  `http://127.0.0.1:${BACKEND_PORT}`
).replace(/\/$/, '')

/**
 * Headers that describe *this* hop and must not be replayed on the next one.
 * `accept-encoding` is dropped as well, deliberately: asking the API for gzip
 * means fetch hands back a decoded body while `content-encoding: gzip` is still
 * on the response, and the browser then fails to decode what is already plain.
 */
const HOP_BY_HOP = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/** Response headers we rebuild rather than copy, for the same reasons. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
])

/** Statuses defined to carry no body. Handing one to `new Response` throws. */
const NO_BODY_STATUSES = new Set([101, 204, 205, 304])

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value)
  })

  // The API's audit trail records who made the request, and after this hop the
  // socket it sees belongs to us. Tell it who was actually on the other end.
  const url = new URL(request.url)
  const client =
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')
  if (!request.headers.get('x-forwarded-for') && client) {
    headers.set('x-forwarded-for', client)
  }
  headers.set('x-forwarded-host', url.host)
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''))

  return headers
}

/**
 * Replay a request against the API and hand the answer straight back.
 *
 * `path` is the part after /api — the splat from the route that called this.
 * Throws only if the API is unreachable; every HTTP status it returns, error
 * statuses included, comes back as an ordinary response.
 */
export async function proxyToBackend(request: Request, path: string): Promise<Response> {
  const incoming = new URL(request.url)
  const target = `${BACKEND_URL}/api/${path}${incoming.search}`

  const init: RequestInit = {
    method: request.method,
    headers: forwardedHeaders(request),
    redirect: 'manual',
  }

  // Read the body rather than streaming it. A streamed request body needs
  // `duplex: 'half'`, which is not supported by every runtime this bundle can
  // end up on, and an API request is small by definition.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  const upstream = await fetch(target, init)

  const headers = new Headers()
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase()
    // Set-Cookie is handled below: a Headers object joins repeated values with
    // a comma, and a session cookie with an Expires date has commas in it, so
    // joining them produces one header that no browser can parse.
    if (name === 'set-cookie') return
    if (!STRIPPED_RESPONSE_HEADERS.has(name)) headers.set(key, value)
  })

  const cookies =
    typeof (upstream.headers as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (upstream.headers as { getSetCookie: () => string[] }).getSetCookie()
      : ([upstream.headers.get('set-cookie')].filter(Boolean) as string[])
  for (const cookie of cookies) headers.append('set-cookie', cookie)

  // The body is passed through as a stream, so server-sent events and other
  // long-lived responses arrive as they are produced rather than at the end.
  const body = NO_BODY_STATUSES.has(upstream.status) ? null : upstream.body
  return new Response(body, { status: upstream.status, headers })
}

/** The API is down, or not up yet. Say so as JSON — the client expects JSON. */
export function apiUnavailable(error: unknown, method: string, path: string): Response {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error(`[api-proxy] ${method} /api/${path} → ${BACKEND_URL}: ${message}`)
  return new Response(
    JSON.stringify({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'The API is not reachable.',
      timestamp: new Date().toISOString(),
      path: `/api/${path}`,
    }),
    { status: 503, headers: { 'content-type': 'application/json' } }
  )
}
