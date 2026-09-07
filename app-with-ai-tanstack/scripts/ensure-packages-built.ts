#!/usr/bin/env bun
/**
 * Build the workspace packages the web app imports, if they are not built yet.
 *
 * `packages/web` reaches `@appwithai/core`, `@appwithai/generator` and
 * `@appwithai/ai` by bare specifier, and their `exports` maps point at `dist/`.
 * On a fresh clone that directory does not exist, so on a tree that has never
 * been built `bun run dev` started a server whose every API route answered 500 —
 * `Cannot find module '@appwithai/core/services'` — with nothing on the page to
 * say why. It was reproducible, undocumented, and cost everyone who met it the
 * same half hour.
 *
 * So `dev` runs this first. It builds only what is missing, which makes the
 * first run work and every run after it cost one `existsSync` per package.
 *
 *   bun scripts/ensure-packages-built.ts          build what is missing
 *   bun scripts/ensure-packages-built.ts --force  build everything regardless
 *
 * This is deliberately not a watcher. Editing `packages/core` during a dev
 * session still needs `bun run build:core` — Vite watches `packages/web`, not
 * the built output of its dependencies.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

/**
 * Each package, and one file that only exists once it has been built.
 *
 * The marker is a subpath the web app actually imports rather than the
 * directory itself: a `dist/` left behind by an interrupted or older build can
 * exist while the entry point the app needs does not.
 */
const PACKAGES = [
  { name: "core", script: "build:core", marker: "packages/core/dist/index.js" },
  { name: "generator", script: "build:generator", marker: "packages/generator/dist/index.js" },
  { name: "ai", script: "build:ai", marker: "packages/ai/dist/index.js" },
] as const;

const force = process.argv.includes("--force");
const missing = PACKAGES.filter((pkg) => force || !existsSync(join(ROOT, pkg.marker)));

if (missing.length === 0) {
  process.exit(0);
}

console.log(
  `Building ${missing.map((pkg) => pkg.name).join(", ")} — the web app imports ${
    missing.length === 1 ? "it" : "them"
  } and ${missing.length === 1 ? "it is" : "they are"} not built yet.`
);

for (const pkg of missing) {
  const result = Bun.spawnSync(["bun", "run", pkg.script], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (result.exitCode !== 0) {
    console.error(
      `\nFailed to build @appwithai/${pkg.name}. Run "bun run ${pkg.script}" to see why.`
    );
    process.exit(result.exitCode ?? 1);
  }
}
