/**
 * Response helpers.
 *
 * The whole backend speaks Web `Request`/`Response` rather than `req`/`res`,
 * because that is the one HTTP vocabulary both hosts share: the Node host wraps
 * `node:http` into it, and the browser host gets it from the Service Worker for
 * free. Choosing Express's shape instead would have meant reimplementing it in
 * the browser, and choosing the browser's would have meant reimplementing it in
 * Node — this way each host writes an adapter once.
 */

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

/** An error a handler can throw to produce a specific status. */
export class HttpError extends Error {
  constructor(status, message, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export const badRequest = (message, detail) => new HttpError(400, message, detail);
export const unauthorized = (message = "Unauthorized") => new HttpError(401, message);
export const forbidden = (message = "Forbidden") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

export function json(body, init = {}) {
  return new Response(JSON.stringify(body ?? null), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });
}

export function noContent(headers = {}) {
  return new Response(null, { status: 204, headers });
}

export function text(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...(init.headers ?? {}) },
  });
}

/**
 * Turn a thrown value into a response.
 *
 * Anything that is not an HttpError becomes a 500 with its message: this runs
 * in the user's own browser against the user's own data, so hiding the message
 * would only make the app harder to debug without protecting anyone.
 */
export function errorResponse(error) {
  const status = error instanceof HttpError ? error.status : 500;
  const body = {
    statusCode: status,
    message: error?.message ?? "Internal error",
    error: status === 500 ? "Internal Server Error" : undefined,
  };
  if (error?.detail !== undefined) body.detail = error.detail;
  if (status === 500) console.error("[server]", error);
  return json(body, { status });
}

/** Parse a JSON body, tolerating an empty one. */
export async function readJson(request) {
  const raw = await request.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Request body is not valid JSON");
  }
}
