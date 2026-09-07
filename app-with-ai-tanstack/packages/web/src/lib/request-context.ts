/**
 * Reading the incoming request from code that runs on both sides.
 *
 * A route's `beforeLoad` runs on the server for the first paint and in the
 * browser for every navigation after it. On the server the session cookie has
 * to be forwarded by hand — there is no browser to attach it — and the fetch
 * needs an absolute URL. In the browser both are automatic.
 *
 * Importing `@tanstack/react-start/server` to get at that request is what the
 * bundler's import protection exists to stop: the specifier appears in a file
 * that is part of the client graph, and a production build fails on it even
 * when the call is guarded by a `typeof window` check. `createIsomorphicFn`
 * is the supported way to say "these are two different implementations", and it
 * leaves the server one out of the client bundle entirely.
 *
 * The server half reaches the module through `await import()`, not `require()`.
 * The SSR bundle is ESM, so `require` is not a binding there at all: the call
 * threw `ReferenceError` on the first line of every `beforeLoad`, the `catch`
 * below swallowed it, and the fallback sent the API call with no cookie. Every
 * guarded route answered 307 to /login on first paint — deep links and reloads
 * bounced to the project list — while client-side navigation, which never runs
 * this branch, worked. That is what makes an async context object worth the
 * `await` at each call site.
 */

import { createIsomorphicFn } from "@tanstack/react-start";

export interface RequestContext {
  /** Origin to prefix API paths with. Empty in the browser, where relative works. */
  baseUrl: string;
  /** Fetch options carrying the caller's cookies. Empty in the browser. */
  fetchInit: RequestInit;
}

const EMPTY: RequestContext = { baseUrl: "", fetchInit: {} };

/**
 * What a same-origin API call from a loader needs in order to be authenticated.
 *
 * Falls back to `VITE_APP_URL` when there is no ambient request — prerendering
 * and tests both call loaders with nothing in flight, and returning a relative
 * URL there produces a fetch against the process's cwd.
 */
export const requestContext = createIsomorphicFn()
  .client(async (): Promise<RequestContext> => EMPTY)
  .server(async (): Promise<RequestContext> => {
    try {
      // Imported lazily: this module is imported by client code too, and the
      // server entry should not be pulled in merely by importing the helper.
      // The specifier stays inside the `.server()` body so the client build
      // drops it with the rest of this branch.
      const { getRequest } = await import("@tanstack/react-start/server");
      const request = getRequest() as Request | undefined;
      if (!request) return fallback();

      const cookie = request.headers.get("cookie") ?? "";
      return {
        baseUrl: new URL(request.url).origin,
        fetchInit: cookie ? { headers: { cookie } } : {},
      };
    } catch (err) {
      // A miss here silently downgrades every guarded route to "logged out",
      // which is invisible in dev and looks like an auth bug. Say so.
      console.error("[requestContext] could not read the ambient request:", err);
      return fallback();
    }
  });

function fallback(): RequestContext {
  return {
    baseUrl: process.env.VITE_APP_URL ?? "http://localhost:3000",
    fetchInit: {},
  };
}
