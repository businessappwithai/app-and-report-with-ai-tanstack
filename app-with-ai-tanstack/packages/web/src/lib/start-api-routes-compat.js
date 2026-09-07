// Compatibility shim for @tanstack/start-api-routes@1.120 in a Vite-based TanStack Start setup.
// The original module imports 'vinxi/routes' (Vinxi virtual module) which doesn't exist here.
// This shim replicates the API surface without the Vinxi dependency, and also adds the
// TanStack Router Route interface (.update(), .init(), etc.) so routeTree.gen.ts works.

const HTTP_API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

// Creates a minimal TanStack Router-compatible Route-like object for API routes.
// TanStack Router calls .update() during route tree construction and .init() during
// router initialization — both are no-ops for API routes since they're handled server-side.
function makeAPIRouteObject(path, methods) {
  const route = {
    path,
    methods,
    options: {},
    // TanStack Router calls update() to set id/path/getParentRoute options
    update(opts) {
      Object.assign(this.options, opts);
      return this;
    },
    // TanStack Router calls init() during router initialization
    init(opts) {
      this.originalIndex = opts?.originalIndex;
      const options = this.options;
      const parentRoute = options?.getParentRoute?.();
      const routePath = options?.path || path;
      this._path = routePath;
      this._id = options?.id || routePath;
      this._fullPath = parentRoute
        ? `${parentRoute.fullPath ?? ""}${routePath}`.replace(/\/+/g, "/")
        : routePath;
      this._to = this._fullPath;
    },
    // Additional Route interface methods TanStack Router may call
    addChildren(_children) {
      return this;
    },
    _addFileChildren(_children) {
      return this;
    },
    _addFileTypes() {
      return this;
    },
    updateLoader(_opts) {
      return this;
    },
    lazy(_fn) {
      return this;
    },
    get id() {
      return this._id ?? this.options?.id ?? path;
    },
    get fullPath() {
      return this._fullPath ?? path;
    },
    get to() {
      return this._to ?? path;
    },
  };
  return route;
}

export const createAPIFileRoute = (filePath) => (methods) => makeAPIRouteObject(filePath, methods);

export const createAPIRoute = createAPIFileRoute;

export function createStartAPIHandler(cb) {
  return async (event) => {
    const request = event.request ?? event;
    return cb({ request });
  };
}

function findRoute(url, routes) {
  const urlSegments = url.pathname.split("/").filter(Boolean);
  const sorted = [...routes]
    .sort((a, b) => {
      const ap = a.routePath.split("/").filter(Boolean);
      const bp = b.routePath.split("/").filter(Boolean);
      return bp.length - ap.length;
    })
    .filter((r) => {
      const rs = r.routePath.split("/").filter(Boolean);
      return urlSegments.length >= rs.length;
    });
  for (const route of sorted) {
    const routeSegments = route.routePath.split("/").filter(Boolean);
    const params = {};
    let matches = true;
    for (let i = 0; i < routeSegments.length; i++) {
      const rs = routeSegments[i];
      const us = urlSegments[i];
      if (rs.startsWith("$")) {
        if (rs === "$") {
          const wild = urlSegments.slice(i).join("/");
          if (wild !== "") {
            params["*"] = wild;
            params._splat = wild;
          } else {
            matches = false;
            break;
          }
        } else {
          params[rs.slice(1)] = us;
        }
      } else if (rs !== us) {
        matches = false;
        break;
      }
    }
    if (matches) return { routePath: route.routePath, params, payload: route.payload };
  }
  return undefined;
}

export const defaultAPIRoutesHandler =
  (opts) =>
  async ({ request }) => {
    if (!HTTP_API_METHODS.includes(request.method))
      return new Response("Method not allowed", { status: 405 });
    const url = new URL(request.url, "http://localhost:3000");
    const routes = Object.entries(opts.routes).map(([routePath, route]) => ({
      routePath,
      payload: route,
    }));
    const match = findRoute(url, routes);
    if (!match) return new Response("Not found", { status: 404 });
    const handler = match.payload.methods[request.method];
    if (!handler) return new Response("Method not allowed", { status: 405 });
    return handler({ request, params: match.params });
  };

export const defaultAPIFileRouteHandler = async () => new Response("Not found", { status: 404 });
