/**
 * The API client.
 *
 * Every call is a relative `/api/…` fetch against the page's own origin, which
 * the Service Worker forwards to the backend Worker.
 *
 * The session travels as a bearer token, not as a cookie, and that is not a
 * style choice. A Service Worker does not see the `Cookie` header on requests it
 * intercepts, and a `Set-Cookie` on a response it synthesises is not stored — so
 * an application hosted this way signs in successfully, gets a session, and then
 * cannot prove it has one. The symptom is a login that works and a first render
 * that bounces straight back to the login screen.
 *
 * The server accepts either, so this same UI works unchanged against the Node
 * host, where cookies are ordinary cookies.
 *
 * The token lives in `sessionStorage`: a reload keeps you signed in, a new tab
 * does not inherit the session, and closing the tab ends it.
 */

const TOKEN_KEY = "appwithai.session";

let base = "/";
let onUnauthorized = () => {};
let token = null;

try {
  token = sessionStorage.getItem(TOKEN_KEY);
} catch {
  // Storage can be denied outright (a locked-down browser, some private modes).
  // An in-memory session still works for as long as the page is open.
}

export function configure(options) {
  base = options.basePath || "/";
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

export function setToken(value) {
  token = value || null;
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // See above — memory is enough.
  }
}

export function hasToken() {
  return !!token;
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed (${status})`);
    this.status = status;
    this.body = body;
    this.detail = body?.detail;
    this.violations = body?.violations;
  }
}

async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${base}api${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      onUnauthorized();
    }
    throw new ApiError(response.status, parsed);
  }
  return parsed;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body ?? {}),
  put: (path, body) => request("PUT", path, body ?? {}),
  patch: (path, body) => request("PATCH", path, body ?? {}),
  delete: (path) => request("DELETE", path),
};

/** `{ a: 1, b: null }` -> `?a=1`, skipping what is not set. */
export function queryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : "";
}
