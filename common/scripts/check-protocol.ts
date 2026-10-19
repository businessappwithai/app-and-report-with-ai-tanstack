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
 * It also holds the directory to what it should contain. `llms.txt` is the only
 * protocol file (GitHub Pages types `.md` as text/markdown, which ChatGPT's reader
 * refuses, so there is no `llms.md`); `llms-reporting.txt` is a separate document
 * about the reporting platform. Nothing else belongs there.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const COMMON = path.resolve(import.meta.dir, "..");
const REPO = path.resolve(COMMON, "..");
const ours = path.join(COMMON, "website", "llmtext");
const upstream = path.join(REPO, "app-with-ai-tanstack", "website", "llmtext", "llms.txt");

let failed = 0;
const ok = (label: string) => console.log(`  ok    ${label}`);
const fail = (label: string, why: string) => {
  failed++;
  console.log(`  FAIL  ${label}\n        ${why}`);
};

if (!existsSync(upstream)) {
  fail("upstream's llms.txt is present", `${upstream} is missing — run ./deps.sh --install first`);
} else {
  readFileSync(path.join(ours, "llms.txt"), "utf-8") === readFileSync(upstream, "utf-8")
    ? ok("llms.txt is a byte copy of the pinned upstream's")
    : fail(
        "llms.txt is a byte copy of the pinned upstream's",
        "common/website/llmtext/llms.txt differs from app-with-ai-tanstack/website/llmtext/llms.txt — " +
          "copy upstream's over it, or move the pin in deps.json to a commit that carries yours"
      );
}

const files = readdirSync(ours).sort();
JSON.stringify(files) === JSON.stringify(["llms-reporting.txt", "llms.txt"])
  ? ok("website/llmtext holds llms.txt and llms-reporting.txt and nothing else")
  : fail("website/llmtext holds llms.txt and llms-reporting.txt and nothing else", `found: ${files.join(", ")}`);

console.log(failed === 0 ? "\nThe protocol document matches upstream." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
