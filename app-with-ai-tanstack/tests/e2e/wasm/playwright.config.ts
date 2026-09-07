/**
 * The WASM build's own Playwright project.
 *
 * Separate from the root config for one reason: the root suite drives the
 * modelling tool on port 5000, and this one drives a static folder — the guide
 * in `html/`, served by the generator's own `serve` command. Sharing a config
 * would mean sharing a `webServer`, and the two servers have nothing to do with
 * each other.
 *
 *   bun run test:wasm
 *   bunx playwright test --config tests/e2e/wasm/playwright.config.ts --grep @cli
 *
 * The suite covers both halves of the stack, because the stack is both halves:
 * `cli.e2e.spec.ts` runs `appwithai-wasm` and inspects what it wrote, and
 * `browser.e2e.spec.ts` drives the hosted page through the same generation and
 * into the running application. A change that breaks one usually breaks the
 * other, and until now only the second had a test.
 */

import { defineConfig, devices } from "@playwright/test";

/** Off the ports the modelling tool (3000), a generated app (4000/4001) and the root suite (5000) use. */
export const WASM_TEST_PORT = Number(process.env.WASM_TEST_PORT ?? 4300);

export default defineConfig({
  testDir: ".",
  testMatch: ["**/*.e2e.spec.ts"],
  // The application under test keeps its database in one browser profile's
  // IndexedDB, and the CLI specs write into one scratch directory. Both are
  // shared state, so these run one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Booting PostgreSQL-on-WebAssembly is ten seconds on a warm cache and worse
  // on a cold one; generating and installing in the CLI specs is longer still.
  timeout: 240_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: `http://localhost:${WASM_TEST_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 45_000,
  },

  webServer: {
    // The generator's own static server, not a third-party one: it is what sets
    // `Service-Worker-Allowed` and deliberately omits COEP, and a test that used
    // a different server would not be testing the thing that ships.
    command: `bun packages/generator/src/cli-wasm/generate.ts serve html --port ${WASM_TEST_PORT}`,
    url: `http://localhost:${WASM_TEST_PORT}/run-in-browser.html`,
    cwd: new URL("../../../", import.meta.url).pathname,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Sandboxes and containers often carry a Chromium that Playwright did
        // not download and cannot find. Pointing at it is a one-line escape
        // that beats failing with "run npx playwright install" in an
        // environment where that is the wrong answer.
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } }
          : {}),
      },
    },
  ],
});
