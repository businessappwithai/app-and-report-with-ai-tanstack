/**
 * The audit ledger, exercised as the generated application exercises it.
 *
 * The overlay replaces exactly one source file — the immudb client becomes a
 * hash chain in the application's own database — and the claim that makes it
 * worth doing is that an altered audit record stops verifying. This runs the
 * shipped file (not a copy, not a rewrite) against a real PGlite and checks
 * that claim, including the two ways history gets rewritten: editing an entry
 * and removing one.
 *
 * It runs in a child process under Bun because the ledger is a NestJS provider
 * with a parameter decorator and Vitest's transformer rejects those. The cost
 * is one process; the alternative was testing a transformed copy of the file,
 * which is a test that can pass while the shipped code is broken.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FIXTURE = join(import.meta.dirname, "fixtures/exercise-ledger.ts");

/**
 * Bun starts PGlite and walks the chain; 120s is slack for a cold wasm start.
 *
 * The child's stderr is surfaced on failure. Without it the suite reports
 * "Command failed: bun …" and nothing else, which is a debugging session rather
 * than a test result.
 */
function exercise(): Record<string, any> {
  try {
    const stdout = execFileSync("bun", [FIXTURE], {
      encoding: "utf-8",
      timeout: 120_000,
      // Vitest runs under `BUN_OPTIONS=--smol`, which is not what a process
      // starting a database wants, and passes its own NODE_ENV through.
      env: { ...process.env, BUN_OPTIONS: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(stdout.trim().split("\n").pop() ?? "");
  } catch (error) {
    const detail = error as { stderr?: Buffer | string; stdout?: Buffer | string };
    throw new Error(
      `The ledger fixture failed.\n--- stderr ---\n${String(detail.stderr ?? "")}` +
        `\n--- stdout ---\n${String(detail.stdout ?? "")}`
    );
  }
}

const report = exercise();

describe("the tamper-evident audit ledger", () => {
  it("comes up against the application's own connection", () => {
    expect(report.connected).toBe(true);
  });

  it("appends entries and verifies them", () => {
    expect(report.firstTxId).toBe("1");
    expect(report.verifiedByTxId).toBe(true);
    // The audit row stores whichever the append returned — a sequence number on
    // success, the original key on failure — so both have to resolve.
    expect(report.verifiedByKey).toBe(true);
    expect(report.chainClean).toEqual({ entries: 3, brokenAt: null });
  });

  it("returns null for a key it never recorded", () => {
    expect(report.missing).toBeNull();
  });

  it("scans by prefix, oldest first", () => {
    expect(report.scanned).toEqual(["audit:1:a", "audit:2:b", "audit:3:c"]);
  });

  it("stops verifying an entry whose contents were edited", () => {
    expect(report.afterEditEntry).toBe(false);
    expect(report.afterEditChain).toEqual({ entries: 3, brokenAt: "2" });
  });

  it("notices an entry that was removed entirely", () => {
    // Its successor recorded the deleted entry's hash; with it gone, the link
    // no longer resolves and the chain reports where it broke.
    expect(report.afterDeleteSuccessor).toBe(false);
    expect(report.afterDeleteChain.brokenAt).toBe("3");
  });
});
