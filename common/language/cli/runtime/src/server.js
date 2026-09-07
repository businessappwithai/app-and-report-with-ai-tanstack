// Zero-dependency HTTP server generated from the EML model.
// Exposes REST CRUD for every entity plus /health, /openapi.json, /api/_meta,
// and an HTML index. No framework — just node:http.

import { createServer } from "node:http";
import { initDb } from "./db.js";
import { ENUMS, MODEL } from "./model.js";
import { buildOpenApi } from "./openapi.js";
import { services } from "./services.js";
import { stateMachines } from "./workflows.js";

const PORT = Number(process.env.PORT || 3000);

const collections = (MODEL.entities ?? []).map((e) => e.collection);
initDb(collections);

const byCollection = new Map((MODEL.entities ?? []).map((e) => [e.collection, services[e.name]]));

function send(res, status, body, type = "application/json") {
  const payload = type === "application/json" ? JSON.stringify(body, null, 2) : body;
  res.writeHead(status, {
    "Content-Type": type === "application/json" ? "application/json" : type,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 1e6) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, "");
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (url.pathname === "/") return send(res, 200, indexHtml(), "text/html");
    if (url.pathname === "/health")
      return send(res, 200, { status: "ok", uptime: process.uptime() });
    if (url.pathname === "/openapi.json") return send(res, 200, buildOpenApi());
    if (parts[0] === "api" && parts[1] === "_meta") {
      return send(res, 200, {
        name: MODEL.meta?.name,
        entities: MODEL.entities.map((e) => ({
          name: e.name,
          collection: e.collection,
          attributes: e.attributes.length,
        })),
        rules: MODEL.rules.map((r) => ({ name: r.name, entity: r.entity, event: r.event })),
        workflows: MODEL.workflows.map((w) => ({ name: w.name, kind: w.kind, entity: w.entity })),
        stateMachines,
        enums: ENUMS,
      });
    }

    if (parts[0] === "api") {
      const svc = byCollection.get(parts[1]);
      if (!svc) return send(res, 404, { error: `Unknown collection "${parts[1] ?? ""}"` });
      const id = parts[2];

      if (req.method === "GET" && !id) return send(res, 200, await svc.list());
      if (req.method === "POST" && !id)
        return send(res, 201, await svc.create(await readBody(req)));
      if (req.method === "GET" && id) {
        const row = await svc.get(id);
        return row ? send(res, 200, row) : send(res, 404, { error: "Not found" });
      }
      if (req.method === "PUT" && id) {
        const row = await svc.update(id, await readBody(req));
        return row ? send(res, 200, row) : send(res, 404, { error: "Not found" });
      }
      if (req.method === "DELETE" && id) {
        const ok = await svc.remove(id);
        return ok ? send(res, 204, "") : send(res, 404, { error: "Not found" });
      }
      return send(res, 405, { error: "Method not allowed" });
    }

    return send(res, 404, { error: "Not found" });
  } catch (err) {
    const status = err.status ?? 500;
    send(res, status, { error: err.message, details: err.details });
  }
});

server.listen(PORT, () => {
  console.log(`${MODEL.meta?.name ?? "EML App"} listening on http://localhost:${PORT}`);
  console.log(
    `  ${MODEL.entities.length} entities, ${MODEL.rules.length} rules, ${MODEL.workflows.length} workflows`
  );
});

function indexHtml() {
  const rows = MODEL.entities
    .map(
      (e) =>
        `<tr><td><code>${e.name}</code></td><td><code>/api/${e.collection}</code></td><td>${e.attributes.length}</td></tr>`
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${MODEL.meta?.name ?? "EML App"}</title>
<style>body{font:14px system-ui,sans-serif;max-width:820px;margin:40px auto;padding:0 16px;color:#111}
h1{margin-bottom:4px}table{border-collapse:collapse;width:100%;margin:12px 0}
td,th{border:1px solid #ddd;padding:6px 10px;text-align:left}code{background:#f4f4f5;padding:1px 5px;border-radius:4px}
.muted{color:#666}</style></head><body>
<h1>${MODEL.meta?.name ?? "EML App"}</h1>
<p class="muted">Generated from EML. ${MODEL.rules.length} business rule(s), ${MODEL.workflows.length} workflow(s).</p>
<h2>Entities</h2>
<table><tr><th>Entity</th><th>Endpoint</th><th># fields</th></tr>${rows}</table>
<h2>System</h2>
<ul>
<li><a href="/health">/health</a></li>
<li><a href="/openapi.json">/openapi.json</a></li>
<li><a href="/api/_meta">/api/_meta</a></li>
</ul>
</body></html>`;
}
