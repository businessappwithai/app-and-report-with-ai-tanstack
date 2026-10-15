#!/usr/bin/env bun
/**
 * Put what the two run pages load beside `html/`, so `run-in-browser.html` and
 * `run-real-stack.html` run from this tree.
 *
 * The pages are copies of `app-with-ai-tanstack`'s, and since its "no CDN
 * anywhere" change they fetch nothing from a third-party host: PGlite, the
 * WebContainer API and the stack templates are served beside the page or the
 * page says what is missing. None of the three is checked in — PGlite alone is
 * seventeen megabytes — so this runs that repository's own vendoring scripts in
 * its checkout and copies what they wrote. Nothing here decides which files a
 * page needs; the scripts that wrote the pages do.
 *
 *   ./deps.sh --install && cd common && bun run vendor:guide
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const PRODUCT = path.resolve(ROOT, "..", "app-with-ai-tanstack");
const TO = path.join(ROOT, "html", "assets");

if (!existsSync(path.join(PRODUCT, "node_modules"))) {
  console.error("app-with-ai-tanstack is not checked out and installed. Run: ./deps.sh --install");
  process.exit(1);
}

for (const script of ["vendor:pglite", "vendor:webcontainer", "build:stack-templates"]) {
  const run = spawnSync("bun", ["run", script], { cwd: PRODUCT, stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`bun run ${script} failed in app-with-ai-tanstack`);
    process.exit(run.status ?? 1);
  }
}

mkdirSync(TO, { recursive: true });
cpSync(path.join(PRODUCT, "html", "assets", "vendor"), path.join(TO, "vendor"), {
  recursive: true,
});
cpSync(
  path.join(PRODUCT, "html", "assets", "stack-templates.json"),
  path.join(TO, "stack-templates.json")
);
console.log("✓ PGlite, the WebContainer API and the stack templates are beside html/");
