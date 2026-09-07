/**
 * The example models are checked in twice, and the copies have to agree.
 *
 * `language/examples/*.eml.mmd` is where a model is authored and where the
 * checker's own suite reads it from. `html/models/*.eml.mmd` is what the two
 * hosted pages offer a reader — they are static files served beside the page,
 * so they cannot be a symlink or an import.
 *
 * They drifted. The CRM example gained a `%%rbac … .read` rule per entity, which
 * is what gives each seeded role its own set of windows; the copy under `html/`
 * was not updated, so the page demonstrated per-role visibility using a model
 * that no longer declared it, and nothing failed. A sentence in CLAUDE.md is not
 * a mechanism. This is.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../../..");
const PUBLISHED = join(ROOT, "html/models");

/* Authored models live in two directories — `language/examples` for the ones the
   language suite reads, `examples` for the ones CI generates applications from —
   and which of the two a model is in is history rather than meaning. Look in
   both rather than making the page's copy the thing that decides. */
const AUTHORED = [join(ROOT, "language/examples"), join(ROOT, "examples")];

function authoredCopy(name: string): string {
  for (const directory of AUTHORED) {
    const candidate = join(directory, name);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`html/models/${name} has no authored copy in ${AUTHORED.join(" or ")}`);
}

describe("the example models the hosted pages offer", () => {
  const published = readdirSync(PUBLISHED).filter((name) => name.endsWith(".eml.mmd"));

  it("finds the models the pages load", () => {
    expect(published.length).toBeGreaterThan(0);
  });

  for (const name of published) {
    it(`${name} is byte-identical to its copy in language/examples`, () => {
      expect(readFileSync(join(PUBLISHED, name), "utf-8")).toBe(
        readFileSync(authoredCopy(name), "utf-8")
      );
    });
  }
});
