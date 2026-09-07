/**
 * The application server.
 *
 * One factory, two hosts. `createServer` knows nothing about how a request
 * reached it or where its files live: the Node host hands it `node:http`
 * requests translated into `Request`, and the browser host hands it requests
 * the Service Worker intercepted. Everything host-shaped — the PGlite module,
 * reading an asset, the console — arrives as a parameter.
 *
 * That is what makes "the same backend" a claim rather than a hope. There is no
 * second implementation of the routes for the browser to drift from; the Node
 * host exists so that the code running in a tab can also be started, exercised
 * and tested from a terminal.
 */

import { Router } from "./lib/router.js";
import { errorResponse, json, notFound } from "./lib/http.js";
import { Database } from "./lib/db.js";
import { resolveSession } from "./lib/auth.js";
import { migrate } from "./migrate.js";
import { authRoutes } from "./modules/auth.routes.js";
import { sysRoutes } from "./modules/sys.routes.js";
import { busRoutes } from "./modules/bus.routes.js";
import { rulesRoutes } from "./modules/rules.routes.js";
import { workflowRoutes } from "./modules/workflow.routes.js";
import { auditRoutes } from "./modules/audit.routes.js";
import { modelRoutes } from "./modules/model.routes.js";

const MIME = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  mmd: "text/plain; charset=utf-8",
  sql: "text/plain; charset=utf-8",
  ico: "image/x-icon",
  png: "image/png",
  woff2: "font/woff2",
  wasm: "application/wasm",
  data: "application/octet-stream",
  gz: "application/gzip",
};

export async function createServer(options) {
  const { PGlite, readAsset, dataDir } = options;
  const log = options.log || ((message) => console.log(`[server] ${message}`));

  const model = JSON.parse(await readAsset("app/model.json"));

  // `auto` means "wherever this application's own data belongs". Resolved here
  // rather than by the host because only the model knows its key, and a host
  // that guessed would put two applications in one database.
  const resolvedDataDir =
    dataDir === "auto" ? `idb://appwithai-${model.project.dataKey || model.project.slug}` : dataDir;

  log(`Opening PostgreSQL (wasm)${resolvedDataDir ? ` at ${resolvedDataDir}` : " in memory"}`);
  const db = await Database.open({ PGlite, dataDir: resolvedDataDir });

  const result = await migrate(db, model, readAsset, log);
  log(result.seeded ? "Database seeded" : "Database ready");

  const api = new Router();

  api.get("/health", async () =>
    json({
      status: "ok",
      project: model.project.name,
      database: await db.value("SELECT version()"),
      entities: model.entities.length,
      runtime: options.runtimeName || "unknown",
    })
  );

  api.mount("/auth", authRoutes(model));
  api.mount("/sys", sysRoutes(model));
  api.mount("/bus", busRoutes(model));
  api.mount("/rules", rulesRoutes(model));
  api.mount("/workflows", workflowRoutes(model));
  api.mount("/audit", auditRoutes());
  api.mount("/model", modelRoutes(model, readAsset));

  // `/workflow-definitions` is what the dictionary screens ask for; keeping the
  // alias here rather than duplicating handlers means one implementation.
  api.mount("/workflow-definitions", (() => {
    const alias = new Router();
    const source = workflowRoutes(model);
    for (const route of source.routes) {
      const pattern = `/${route.parts.join("/")}`;
      if (pattern.startsWith("/definitions")) {
        alias.add(route.method, pattern.replace("/definitions", "/") || "/", route.handler);
      }
    }
    for (const middleware of source.middleware) alias.use(middleware);
    return alias;
  })());

  /** Everything a handler needs, resolved once per request. */
  async function context(request) {
    return { db, model, user: await resolveSession(db, request) };
  }

  async function handleApi(request, pathname) {
    const rewritten = new Request(
      new URL(pathname + new URL(request.url).search, "http://app.local"),
      {
        method: request.method,
        headers: request.headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      }
    );
    return api.handle(rewritten, await context(request));
  }

  /**
   * Serve a file from the application directory.
   *
   * The bytes are read as bytes, never as text: `vendor/pglite/pglite.data` is
   * a 6MB filesystem image, and decoding it as UTF-8 turns every invalid
   * sequence into U+FFFD — the file arrives half again as large and PGlite
   * refuses to boot with `Invalid FS bundle size`. Text files are unharmed by
   * the same treatment, so there is no extension list to keep in step.
   */
  async function handleStatic(pathname) {
    const relative = pathname.replace(/^\/+/, "") || "index.html";
    const candidates = [relative, `${relative}/index.html`, "index.html"];
    for (const candidate of candidates) {
      try {
        const body = await readAsset(candidate, "binary");
        if (body == null) continue;
        const extension = candidate.split(".").pop().toLowerCase();
        return new Response(body, {
          headers: {
            "Content-Type": MIME[extension] || "application/octet-stream",
            // The database lives in the browser; a stale bundle against a fresh
            // schema is the one inconsistency the user cannot fix by reloading.
            "Cache-Control": "no-cache",
          },
        });
      } catch {
        // try the next candidate
      }
    }
    return null;
  }

  /**
   * The one entry point. `basePath` is stripped first so the same server works
   * mounted at `/` (the standalone app) and under a prefix (the generator page
   * running several applications side by side).
   */
  async function handle(request, basePath = "") {
    try {
      const url = new URL(request.url);
      let pathname = url.pathname;
      if (basePath && pathname.startsWith(basePath)) pathname = pathname.slice(basePath.length);
      if (!pathname.startsWith("/")) pathname = `/${pathname}`;

      if (pathname.startsWith("/api/")) return handleApi(request, pathname.slice(4));

      const asset = await handleStatic(pathname);
      if (asset) return asset;
      return errorResponse(notFound(`Nothing at ${pathname}`));
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { handle, db, model, close: () => db.close() };
}
