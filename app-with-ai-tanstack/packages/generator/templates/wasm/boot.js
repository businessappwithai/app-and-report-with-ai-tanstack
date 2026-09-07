/**
 * Starting the application.
 *
 * Four things have to come up in order, and each can fail in a way worth
 * naming: the Service Worker (the HTTP layer), the backend Worker (the server),
 * the wiring between them (a MessagePort), and Postgres itself, which is ten
 * megabytes of WebAssembly and the slowest step by an order of magnitude.
 *
 * So the boot log is the first screen rather than a spinner. A ten-second wait
 * with a running commentary reads as a database starting; the same ten seconds
 * behind a spinner reads as a broken page, and the difference costs nothing to
 * provide.
 */

const BASE = new URL("./", window.location.href).pathname;

const screen = document.getElementById("boot");
const logElement = document.getElementById("boot-log");
const statusElement = document.getElementById("boot-status");

const steps = [];

/**
 * Say what is happening, to whoever is watching.
 *
 * On its own the boot screen is the audience. Embedded — which is how the
 * hosted generator page runs a freshly compiled application — the page around
 * this frame is showing a progress bar for the whole build, and the slowest
 * phases by far are the four in here. Without this it can only report "started
 * the iframe" and then guess for ten seconds.
 *
 * A `postMessage` to a parent that may not exist costs nothing and is refused by
 * nobody, so the report is unconditional rather than a flag someone has to set.
 */
function report(payload) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage({ source: "appwithai-boot", ...payload }, "*");
  } catch {
    // A parent on another origin that refuses messages is not a boot failure.
  }
}

function log(message, tone = "info") {
  steps.push({ message, tone });
  const line = document.createElement("div");
  line.className = `boot-line boot-line--${tone}`;
  line.textContent = message;
  logElement.appendChild(line);
  logElement.scrollTop = logElement.scrollHeight;
  report({ type: "log", message, tone });
}

function status(message) {
  statusElement.textContent = message;
  report({ type: "status", status: message });
}

/**
 * Reclaim the databases the old data-directory prefix left behind.
 *
 * Each run of this application keeps its PostgreSQL in IndexedDB, under
 * `/pglite/appwithai-<slug>`. That prefix used to be `erdwithai-`, and renaming
 * it does not free the old databases — it strands them: never opened again,
 * never collected, and ten megabytes each against an origin quota that a
 * browser will start refusing writes against long before the reader connects
 * the two. Dropping exactly the retired prefix is safe, because nothing reads
 * it any more.
 *
 * Best-effort throughout. `indexedDB.databases()` is unimplemented in some
 * browsers and a delete can be blocked by another tab; neither is a reason to
 * refuse to start.
 */
async function dropRetiredDatabases() {
  const RETIRED = "/pglite/erdwithai-";
  try {
    if (typeof indexedDB.databases !== "function") return;
    const stale = (await indexedDB.databases())
      .map((entry) => entry.name)
      .filter((name) => typeof name === "string" && name.startsWith(RETIRED));
    if (!stale.length) return;

    await Promise.all(
      stale.map(
        (name) =>
          new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = request.onerror = request.onblocked = () => resolve();
          })
      )
    );
    log(`Reclaimed ${stale.length} database(s) from a previous version`, "ok");
  } catch {
    // Storage that will not enumerate is storage we simply leave alone.
  }
}

async function main() {
  status("Starting");

  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "This browser has no Service Worker support, which is what serves this application's API. " +
        "Chrome, Edge, Firefox and Safari all have it; a private window in some browsers does not."
    );
  }

  log(`Application root: ${BASE}`);

  await dropRetiredDatabases();

  // Two ways this page can be reached, and only one of them needs a worker
  // registered here.
  //
  // Served from disk, it registers its own — the ordinary case. Generated
  // inside another page, it is *already* being served by that page's worker,
  // whose scope is wider than this application's: registering again would mean
  // asking a Service Worker to fetch a Service Worker script, which the browser
  // pointedly does not route through it, so the registration would 404 on a
  // file that only exists in the cache.
  const hosted =
    navigator.serviceWorker.controller &&
    !navigator.serviceWorker.controller.scriptURL.endsWith(`${BASE}sw.js`);

  if (hosted) {
    log("Using the host page's HTTP layer", "ok");
  } else {
    log("Registering the HTTP layer (Service Worker)");
    const registration = await navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE });
    await navigator.serviceWorker.ready;

    // A first visit loads before the worker controls the page, and an
    // uncontrolled page's `/api` calls go to the network and 404. Waiting is
    // the difference between "works on reload" and "works".
    if (!navigator.serviceWorker.controller) {
      log("Waiting for the Service Worker to take control");
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        if (registration.active) registration.active.postMessage({ type: "ping" });
        setTimeout(resolve, 3000);
      });
    }
    log("HTTP layer ready", "ok");
  }

  if (!navigator.serviceWorker.controller) {
    throw new Error(
      "No Service Worker took control of this page, so nothing can answer its /api requests. " +
        "This usually means the page was opened from a file:// URL."
    );
  }

  status("Starting the server");
  log("Starting the backend worker (Node-API shim)");
  const worker = new Worker(`${BASE}host/browser-node-host.js`, { type: "module" });

  const ready = new Promise((resolve, reject) => {
    worker.addEventListener("message", (event) => {
      const message = event.data || {};
      if (message.type === "log") log(message.message);
      if (message.type === "ready") resolve(message);
      if (message.type === "error") reject(new Error(`${message.message}\n${message.stack ?? ""}`));
    });
    worker.addEventListener("error", (event) =>
      reject(new Error(event.message || "The backend worker failed to start"))
    );
  });

  /**
   * Open the request pipe: one MessageChannel, one end to the backend worker,
   * the other to the Service Worker that will forward `/api` to it.
   *
   * Re-openable on demand, because the Service Worker is stopped whenever the
   * browser feels like it and its half of every channel dies with it. The
   * backend worker in this page survives that quite happily — so a woken
   * Service Worker asks for a new port rather than reporting an application
   * that is still running as down.
   */
  const attach = () => {
    const channel = new MessageChannel();
    worker.postMessage({ type: "port", port: channel.port1 }, [channel.port1]);
    navigator.serviceWorker.controller?.postMessage(
      { type: "attach", basePath: BASE, port: channel.port2 },
      [channel.port2]
    );
  };

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "reattach" || event.data.basePath !== BASE) return;
    log("Reopening the request pipe after the Service Worker restarted");
    attach();
  });

  attach();
  log("Request pipe attached");

  const ephemeral = new URLSearchParams(window.location.search).has("ephemeral");
  worker.postMessage({
    type: "boot",
    basePath: BASE,
    dataDir: ephemeral ? null : undefined,
  });
  if (ephemeral) log("Running with an in-memory database (?ephemeral)", "warn");

  status("Starting PostgreSQL (WebAssembly)");
  const { project } = await ready;
  log(`${project.name} is up`, "ok");

  status("Loading the interface");
  const { start } = await import(`${BASE}ui/main.js`);
  await start({ basePath: BASE, project });

  report({ type: "running", project: { name: project.name } });
  screen.classList.add("boot--done");
  window.setTimeout(() => screen.remove(), 400);
}

/**
 * Say what actually went wrong.
 *
 * This used to print the `file://` hint after every failure, whichever failure
 * it was. On a page served over https that sentence is not merely unhelpful, it
 * is false — and it is the only advice the reader is given, so a PostgreSQL that
 * aborted inside `callMain` was reported as a protocol mistake the reader had
 * not made. The hint now has to earn its place.
 */
function hintFor(error) {
  if (window.location.protocol === "file:") {
    return (
      "This application needs to be opened over http:// or https:// — a Service Worker cannot be " +
      "registered from a file:// URL. Run `npx serve .` in this directory, or `bun run start`."
    );
  }

  const text = String(error?.message || error);

  // PGlite aborts inside `callMain` when initdb cannot write its data
  // directory, and by far the commonest reason is a full origin: every run of
  // this application leaves a PGlite database of its own in IndexedDB, and
  // browsers with a tight per-origin quota (Safari especially) start refusing
  // the write long before the reader has any idea storage was involved.
  if (/callMain|Aborted|abort\(|RuntimeError|memory access out of bounds/i.test(text)) {
    return (
      "PostgreSQL could not start. This is usually the browser's storage quota for this site: " +
      "each run keeps its database in IndexedDB. Add ?ephemeral to the URL to run without " +
      "persistence, or clear this site's storage and reload."
    );
  }

  if (/[Qq]uota|storage|IndexedDB|IDBDatabase|NotAllowedError|SecurityError/.test(text)) {
    return (
      "The browser refused this site persistent storage. A private window, a storage-blocking " +
      "setting or a full quota will all do it. Add ?ephemeral to the URL to run in memory instead."
    );
  }

  return "Add ?ephemeral to the URL to run without persistence, which rules storage out.";
}

main().catch((error) => {
  console.error(error);
  report({ type: "failed", message: String(error.message || error) });
  status("Could not start");
  screen.classList.add("boot--failed");
  log(String(error.message || error), "error");
  log(hintFor(error), "hint");
});
