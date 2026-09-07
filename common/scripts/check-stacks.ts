#!/usr/bin/env bun
/**
 * Generate from a model with every `--stack` the CLI offers, and assert each
 * one wrote something.
 *
 * This exists for the cross-folder imports. `language/` sits at the repository
 * root and two of its modules reach down into `app-with-ai-tanstack/packages`
 * — the shipped JDM converter and the generator orchestrator — deliberately,
 * so the CLI and the modelling tool cannot disagree about what a rule flow
 * compiles to. Nothing type-checks those two paths: `jdm.ts` imports across a
 * project boundary and `tanstack.ts` resolves the orchestrator at runtime from
 * a non-literal specifier. Moving either file breaks generation and nothing
 * else, which is exactly how it broke when this folder was first promoted.
 *
 * `tanstack-nestjs` is the one that needs `app-with-ai-tanstack` installed;
 * pass --skip-heavy to run only the two self-contained targets.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const MODEL = process.env.CHECK_STACKS_MODEL ?? "language/examples/helpdesk.eml.mmd";
const skipHeavy = process.argv.includes("--skip-heavy");

/** Each target, and the fewest files a run of it may legitimately write. */
const TARGETS: { stack: string; minFiles: number; heavy: boolean }[] = [
  { stack: "node-rest", minFiles: 10, heavy: false },
  { stack: "enterprise-reporting", minFiles: 6, heavy: false },
  { stack: "tanstack-nestjs", minFiles: 200, heavy: true },
];

function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

if (!existsSync(path.join(ROOT, MODEL))) {
  console.error(`Model not found: ${MODEL}`);
  process.exit(1);
}

let failed = 0;

for (const { stack, minFiles, heavy } of TARGETS) {
  if (heavy && skipHeavy) {
    console.log(`  skip  ${stack} (--skip-heavy)`);
    continue;
  }

  const out = mkdtempSync(path.join(tmpdir(), `eml-${stack}-`));
  const run = spawnSync(
    "bun",
    ["language/cli/eml.ts", "generate", "-i", MODEL, "-o", out, "--stack", stack, "--force"],
    { cwd: ROOT, encoding: "utf8" }
  );

  if (run.status !== 0) {
    failed++;
    console.error(`  FAIL  ${stack} exited ${run.status}`);
    console.error(`${run.stdout ?? ""}${run.stderr ?? ""}`.replace(/^/gm, "        "));
    rmSync(out, { recursive: true, force: true });
    continue;
  }

  const written = countFiles(out);
  rmSync(out, { recursive: true, force: true });

  if (written < minFiles) {
    failed++;
    console.error(`  FAIL  ${stack} wrote ${written} file(s), expected at least ${minFiles}`);
  } else {
    console.log(`  ok    ${stack.padEnd(21)} ${written} file(s)`);
  }
}

if (failed) {
  console.error(`\n${failed} stack(s) failed.`);
  process.exit(1);
}
console.log("\nAll stacks generated.");
