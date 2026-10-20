#!/usr/bin/env bun
/**
 * Hold the protocol document to upstream's, byte for byte.
 *
 * `common/website/llmtext/llms.txt` is a copy of `app-with-ai-tanstack`'s
 * `website/llmtext/llms.txt` — the pinned checkout, so a local tree and a runner
 * compare against the same commit. Nothing else checks one against the other, and
 * an unchecked copy drifts: the site's copy once documented an exit code upstream's
 * had dropped, and neither repository noticed.
 *
 * `llms.txt` is a short controller and the protocol's detail lives in six chunks
 * it names, which a model fetches only when a step needs them; all seven are
 * copies. It also holds the directory to what it should contain: those seven plus
 * `llms-reporting.txt`, a separate document about the reporting platform. (GitHub
 * Pages types `.md` as text/markdown, which ChatGPT's reader refuses, so there is
 * no `llms.md`.) Nothing else belongs there.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const COMMON = path.resolve(import.meta.dir, "..");
const REPO = path.resolve(COMMON, "..");
const ours = path.join(COMMON, "website", "llmtext");
const upstreamDir = path.join(REPO, "app-with-ai-tanstack", "website", "llmtext");
const CHUNKS = [
  "llms.txt",
  "working-session.txt",
  "eml-syntax.txt",
  "eml-dictionary.txt",
  "eml-reporting.txt",
  "checker-rules.txt",
  "enhancement-examples.txt",
];

let failed = 0;
const ok = (label: string) => console.log(`  ok    ${label}`);
const fail = (label: string, why: string) => {
  failed++;
  console.log(`  FAIL  ${label}\n        ${why}`);
};

for (const name of CHUNKS) {
  const theirs = path.join(upstreamDir, name);
  if (!existsSync(theirs)) {
    fail(`upstream's ${name} is present`, `${theirs} is missing — run ./deps.sh --install first, or move the pin in deps.json to a commit that carries it`);
    continue;
  }
  readFileSync(path.join(ours, name), "utf-8") === readFileSync(theirs, "utf-8")
    ? ok(`${name} is a byte copy of the pinned upstream's`)
    : fail(
        `${name} is a byte copy of the pinned upstream's`,
        `common/website/llmtext/${name} differs from app-with-ai-tanstack/website/llmtext/${name} — ` +
          "copy upstream's over it, or move the pin in deps.json to a commit that carries yours"
      );
}

const files = readdirSync(ours).sort();
const expected = [...CHUNKS, "llms-reporting.txt"].sort();
JSON.stringify(files) === JSON.stringify(expected)
  ? ok("website/llmtext holds the llms.txt controller, its chunks and llms-reporting.txt, and nothing else")
  : fail("website/llmtext holds the llms.txt controller, its chunks and llms-reporting.txt, and nothing else", `found: ${files.join(", ")}`);

console.log(failed === 0 ? "\nThe protocol document matches upstream." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
