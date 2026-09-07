#!/usr/bin/env bun
/**
 * Prove `html/checker.js` and `html/fixer.js` still say what the CLI says.
 *
 * `--check` on the build script proves the bundles are not stale. It does not
 * prove they *run* — the Node builtins they are bundled against are stubs, and a
 * stub that throws where the real thing returned would turn every check into an
 * exception the page reports as "invalid model". That failure looks exactly like
 * a broken document, which is the worst way for it to present.
 *
 * So this loads the built files the way a page loads them and checks every
 * example model twice: once through the bundle, once through `language/checker.ts`
 * directly. Any disagreement in errors, warnings, infos or the diagnostic codes
 * themselves fails the run.
 *
 *   bun scripts/ci/language-tools-smoke.ts
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { checkSource } from "../../language/checker";

const ROOT = resolve(import.meta.dir, "../..");

const bundleChecker = await import(join(ROOT, "html/checker.js"));
const bundleFixer = await import(join(ROOT, "html/fixer.js"));

const dir = join(ROOT, "language/examples");
const models = (await readdir(dir)).filter((name) => name.endsWith(".mmd"));
if (models.length === 0) {
  console.error("✖ no example models to check against");
  process.exit(1);
}

let failed = 0;

for (const name of models) {
  const source = await readFile(join(dir, name), "utf-8");
  const direct = checkSource(source);
  const viaBundle = bundleChecker.check(source);

  const mine = `${direct.errors}/${direct.warnings}/${direct.infos}`;
  const theirs = `${viaBundle.counts.errors}/${viaBundle.counts.warnings}/${viaBundle.counts.infos}`;
  const directCodes = direct.issues
    .map((i) => i.code)
    .sort()
    .join(",");
  const bundleCodes = viaBundle.issues
    .map((i: { code: string }) => i.code)
    .sort()
    .join(",");

  if (mine !== theirs || directCodes !== bundleCodes) {
    console.error(
      `✖ ${name}: bundle says ${theirs} [${bundleCodes}], checker.ts says ${mine} [${directCodes}]`
    );
    failed++;
    continue;
  }
  console.log(`✓ ${name} — ${theirs} errors/warnings/infos, agreed`);
}

// The fixer's loop, on a document that needs exactly one of its five repairs.
const needsAName = "erDiagram\n    THING {\n        string id PK\n    }\n";
const fixed = bundleFixer.checkAndFix(needsAName);
if (!fixed.repaired || !fixed.source.includes("%%meta name:")) {
  console.error("✖ fixer.js did not apply EML001 to a document missing its name");
  failed++;
} else if (!fixed.ok) {
  console.error(
    `✖ fixer.js repaired the document but it still fails: ${fixed.counts.errors} error(s)`
  );
  failed++;
} else {
  console.log("✓ fixer.js repaired a missing %%meta name and the result re-checks clean");
}

if (failed > 0) {
  console.error(`\n${failed} disagreement(s). Run: bun run build:language-tools`);
  process.exit(1);
}
console.log(`\n✓ html/checker.js and html/fixer.js agree with the CLI on ${models.length} models`);
