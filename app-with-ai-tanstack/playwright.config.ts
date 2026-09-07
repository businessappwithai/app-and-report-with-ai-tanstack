import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the modelling tool — the application in `packages/web`.
 *
 * The generated applications have their own suites: a `node:test` project the
 * generator emits (`appwithai generate … --run-tests`), and `tests/e2e/wasm/`
 * for the browser stack. This config is only for the tool that writes them.
 *
 * ## The port
 *
 * One value, `E2E_PORT`, feeds both the base URL and the server Playwright
 * starts. It used to be two: the runner script started a dev server on 3000
 * while `baseURL` pointed at 5000, so every test in this directory navigated to
 * a port nothing was listening on. They had never run.
 *
 * ## The server
 *
 * Playwright starts it, waits for `/api/health`, and stops it — rather than the
 * bash script that used to do it, which had `set -e` above a `$?` check, so its
 * teardown and its failure branch were both unreachable.
 *
 * It starts `bun run dev`, which also builds the workspace packages the web app
 * imports (see `scripts/ensure-packages-built.ts`), so a cold checkout works.
 *
 * The production server (`bun run build && bun run start`) would be the better
 * target — it is the artefact a deployment runs — and this config should move to
 * it once it works. Today it does not, for a reason that predates this suite and
 * has nothing to do with it: with a reachable `DATABASE_URL`, the built server
 * loads `@ag-ui/mcp-apps-middleware`, which reaches
 * `@modelcontextprotocol/sdk/dist/cjs/client/sse.js`, which `require()`s
 * `eventsource` — an ESM-only package Bun refuses to `require`. The server then
 * answers 204 to everything, `/api/health` included. Reproduced on `main` with
 * the environment passed explicitly, so it is neither this branch's doing nor a
 * configuration mistake here.
 *
 * `reuseExistingServer` is on outside CI, so a developer with the app already
 * running iterates against it instead of paying for a start per run.
 */

const PORT = Number(process.env.E2E_PORT ?? 3000);

/**
 * Where the suite points.
 *
 * Exported because the specs build their own request contexts — a signed-in
 * stranger, a read-only member, an anonymous caller — and a context created
 * without a base URL sends its requests nowhere. Reading it from here rather
 * than from `test.info()` means a helper can create one outside a test body.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

/** The sign-in limit the suite runs the server with. See `webServer.env`. */
export const AUTH_LOGIN_MAX_PER_MINUTE = Number(process.env.AUTH_LOGIN_MAX_PER_MINUTE ?? 60);

/** The registration limit the suite runs the server with. */
export const AUTH_REGISTER_MAX_PER_MINUTE = Number(process.env.AUTH_REGISTER_MAX_PER_MINUTE ?? 60);

export default defineConfig({
  testDir: "./tests/e2e",
  // `wasm/` has its own config and its own server, so it is not part of this run.
  testMatch: ["**/*.e2e.spec.ts"],
  testIgnore: ["**/node_modules/**", "**/wasm/**"],

  // Sequential. These tests share one database and one signed-in session, and
  // ordering is part of what they assert.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,

  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["junit", { outputFile: "test-results/results.xml" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "bun run dev",
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !process.env.CI,
        // Generous: a cold checkout builds core, generator and ai first.
        timeout: 300_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          PORT: String(PORT),
          // Synchronous logging, so a line the suite asserts on has reached the
          // pipe by the time the request that produced it returned.
          LOG_SYNC: "true",
          // Every test comes from one IP, so the suite's own sign-ins exhaust
          // the production limit of 10/minute and later specs fail with a 429
          // that has nothing to do with what they assert. Raised here, and
          // `09-rate-limiting` reads the same value so it still proves the
          // limiter engages at whatever it is configured to.
          AUTH_LOGIN_MAX_PER_MINUTE: String(AUTH_LOGIN_MAX_PER_MINUTE),
          // Same reason: the authorization suite registers a fresh "stranger"
          // per case, and the production limit is 3 per minute per IP.
          AUTH_REGISTER_MAX_PER_MINUTE: String(AUTH_REGISTER_MAX_PER_MINUTE),
        },
      },
});
