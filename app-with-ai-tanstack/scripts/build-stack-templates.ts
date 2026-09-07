#!/usr/bin/env bun
/**
 * Put the NestJS stack's templates beside the hosted page.
 *
 * `run-real-stack.html` assembles the real application in a browser tab, which
 * means the generators running there need the same three hundred template files
 * the CLI reads off disk. Unlike the browser runtime — which is small enough to
 * inline into a TypeScript module — these are 1.7MB, and a page that only
 * sometimes boots a WebContainer should not carry that in its JavaScript.
 *
 * So they are written as one JSON file the page fetches, on the same origin, the
 * way `vendor:pglite` puts PostgreSQL there. Gitignored for the same reason: it
 * is a copy of files already in this repository, and checking in a second copy
 * is how the two of them start to differ.
 *
 *   bun run build:stack-templates
 *   bun run build:stack-templates --check    # fail if the copy is stale
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const TEMPLATES = join(ROOT, "packages/generator/templates");
const TARGET = join(ROOT, "html/assets/stack-templates.json");

/** What a generated application needs. `wasm/` is inlined elsewhere. */
const INCLUDE = ["tanstack-start-nestjs", "common", "wasm-overlay"];

/** Fonts are the only binary templates, and a WebContainer install replaces them. */
const BINARY = /\.(woff2?|ttf|eot|png|jpe?g|gif|ico|webp)$/i;

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files: Record<string, string> = {};
let skipped = 0;

for (const subdirectory of INCLUDE) {
  const base = join(TEMPLATES, subdirectory);
  if (!(await stat(base).catch(() => null))) continue;
  for await (const path of walk(base)) {
    if (BINARY.test(path)) {
      skipped += 1;
      continue;
    }
    files[relative(TEMPLATES, path).split("\\").join("/")] = await readFile(path, "utf-8");
  }
}

const json = `${JSON.stringify(files, null, 0)}\n`;
const bytes = Buffer.byteLength(json);

if (process.argv.includes("--check")) {
  const existing = await readFile(TARGET, "utf-8").catch(() => "");
  if (existing !== json) {
    console.error(`${relative(ROOT, TARGET)} is out of date.\nRun: bun run build:stack-templates`);
    process.exit(1);
  }
  console.log(`\u2713 ${relative(ROOT, TARGET)} is up to date`);
} else {
  await writeFile(TARGET, json, "utf-8");
  console.log(
    `\u2713 wrote ${Object.keys(files).length} templates (${(bytes / 1048576).toFixed(1)}MB) ` +
      `to ${relative(ROOT, TARGET)}${skipped ? `, skipping ${skipped} binary files` : ""}`
  );
}
