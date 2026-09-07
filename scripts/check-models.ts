#!/usr/bin/env bun
/**
 * Run the checker over every model in the repository root, and hold the two
 * copies of the shared examples to each other.
 *
 * Two things this catches that nothing else does:
 *
 *   1. A language change that makes the checker reject a model that used to
 *      pass. The checker is the contract every authoring surface is held to —
 *      the CLI, the modelling tool, the published `html/checker.js` — so a
 *      model in this repository failing it is the language contradicting its
 *      own examples.
 *   2. `language/examples/*.eml.mmd` and `html/models/*.eml.mmd` drifting.
 *      They are the same files checked in twice: one set is what the CLI
 *      reads, the other is what the published guide serves. Editing one and
 *      not the other is silent until someone downloads the stale copy.
 *
 * The checker always writes a `.error` file beside the model it read. That is
 * its interface, not a side effect to suppress — but it is not something a
 * check should leave in the tree, so any file it creates that git does not
 * already track is removed before this script exits.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const MODEL_DIRS = ["language/examples", "examples"];

function models(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith(".eml.mmd"))
    .sort()
    .map((f) => path.join(dir, f));
}

function tracked(file: string): boolean {
  const r = spawnSync("git", ["ls-files", "--error-unmatch", file], { cwd: ROOT });
  return r.status === 0;
}

let failed = 0;

// --- 1. Every model checks clean ---------------------------------------------
const all = MODEL_DIRS.flatMap(models);
if (all.length === 0) {
  console.error("No models found — check-models is checking nothing, which is worse than failing.");
  process.exit(1);
}

for (const model of all) {
  const errorFile = path.join(ROOT, `${model}.error`);
  const preexisting = existsSync(errorFile) && tracked(`${model}.error`);

  const run = spawnSync("bun", ["language/checker.ts", model], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const verdict = output.trimEnd().split("\n").at(-1)?.trim() ?? "(no output)";

  if (!preexisting && existsSync(errorFile)) rmSync(errorFile);

  if (run.status === 0) {
    console.log(`  ok    ${verdict}`);
  } else {
    failed++;
    console.error(`  FAIL  ${model}  (exit ${run.status})`);
    console.error(output.replace(/^/gm, "        "));
  }
}

// --- 2. The two copies of the shared examples agree ---------------------------
for (const published of models("html/models")) {
  const name = path.basename(published);
  const source = [`language/examples/${name}`, `examples/${name}`].find((p) =>
    existsSync(path.join(ROOT, p))
  );
  if (!source) {
    failed++;
    console.error(`  FAIL  ${published} has no counterpart in language/examples or examples`);
    continue;
  }
  const a = Bun.file(path.join(ROOT, published));
  const b = Bun.file(path.join(ROOT, source));
  if ((await a.text()) === (await b.text())) {
    console.log(`  ok    ${name} identical in html/models and ${path.dirname(source)}`);
  } else {
    failed++;
    console.error(
      `  FAIL  ${published} and ${source} differ — they are the same file checked in twice`
    );
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log(`\n${all.length} model(s) clean.`);
