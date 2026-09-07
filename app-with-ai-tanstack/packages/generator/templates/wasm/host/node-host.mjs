/**
 * The Node host.
 *
 * The generated application is meant to run in a browser tab, so this file
 * looks redundant — and it is the reason the browser claim is checkable. It
 * boots the *same* `server/index.js` against the *same* PGlite build, over
 * `node:http` instead of a Service Worker, which means the whole API surface
 * can be exercised from a terminal, in CI, and by the generator's own tests.
 * A backend that can only be reached by clicking through a tab is a backend
 * nothing can test.
 *
 *   node host/node-host.mjs --port 4000 --data ./pgdata
 *
 * `--data` opts into a directory on disk; without it the database is in memory,
 * which is what a test run wants.
 */

import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "../server/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

/**
 * Read a file from the application directory.
 *
 * Normalised and re-checked against the root because this same function serves
 * static requests: a path arriving as `../../etc/passwd` has to be a 404, not a
 * file. The browser host has no filesystem to escape into, so this is the only
 * host where it matters — which is exactly why it is easy to forget.
 *
 * `binary` returns the bytes untouched. The static route asks for it on every
 * file, because reading `vendor/pglite/pglite.data` as UTF-8 corrupts it.
 */
async function readAsset(name, encoding = "utf-8") {
  const target = normalize(join(ROOT, name));
  if (!target.startsWith(ROOT)) throw new Error(`Refusing to read outside the app: ${name}`);
  return encoding === "binary" ? readFile(target) : readFile(target, "utf-8");
}

/**
 * Resolve PGlite: the vendored copy first, so an application generated with
 * `--vendor-pglite` runs with no network and no node_modules at all.
 */
async function loadPGlite() {
  const vendored = join(ROOT, "vendor/pglite/index.js");
  try {
    const module = await import(pathToFileURL(vendored).href);
    if (module.PGlite) return module.PGlite;
  } catch {
    // not vendored — fall through
  }
  const module = await import("@electric-sql/pglite");
  return module.PGlite;
}

/** `node:http` request -> `Request`. */
async function toRequest(incoming, origin) {
  const chunks = [];
  if (!["GET", "HEAD"].includes(incoming.method)) {
    for await (const chunk of incoming) chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value != null) headers.set(key, value);
  }
  return new Request(new URL(incoming.url, origin), {
    method: incoming.method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
}

async function main() {
  const port = Number(argument("port", process.env.PORT || 4000));
  const dataDir = argument("data");

  const app = await createServer({
    PGlite: await loadPGlite(),
    readAsset,
    dataDir,
    runtimeName: `node ${process.version} (host) + PGlite wasm`,
  });

  const server = createHttpServer(async (incoming, outgoing) => {
    try {
      const request = await toRequest(incoming, `http://localhost:${port}`);
      const response = await app.handle(request);

      const headers = {};
      // `Set-Cookie` is the one header that legitimately repeats; collapsing it
      // into a comma-joined string logs the user out on their second request.
      const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      for (const [key, value] of response.headers.entries()) {
        if (key.toLowerCase() === "set-cookie") continue;
        headers[key] = value;
      }
      outgoing.writeHead(response.status, cookies.length ? { ...headers, "Set-Cookie": cookies } : headers);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error("[host]", error);
      outgoing.writeHead(500, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({ message: error.message }));
    }
  });

  server.listen(port, () => {
    console.log(`\n  ${app.model.project.name} is running`);
    console.log(`  http://localhost:${port}`);
    console.log(`  Sign in as ${app.model.project.adminEmail} / ${app.model.project.adminPassword}\n`);
  });

  const stop = async () => {
    server.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
