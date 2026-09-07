/**
 * What the overlay is allowed to change.
 *
 * The value of `appwithai-wasm` is that it is not a second stack: it runs the
 * same pipeline and then changes the driver and the scripts. That claim is only
 * worth making if something checks it, because the natural drift is for one
 * more file to get "just a small tweak" until the two stacks are two codebases.
 *
 * So this test asserts the shape of the difference rather than its contents:
 * which files may be added, which may be rewritten, and that nothing under
 * `backend/src` moves except the audit ledger — which cannot be substituted,
 * because immudb is a second server rather than a driver behind an interface.
 */

import { describe, expect, it } from "vitest";
import { OVERLAY_ASSETS } from "../overlay-assets.generated";

/** Every file the overlay ships into a generated application. */
const SHIPPED = Object.keys(OVERLAY_ASSETS).sort();

describe("the WASM overlay's footprint", () => {
  it("ships the pg driver, the install config and exactly one replaced source file", () => {
    expect(SHIPPED).toEqual([
      ".npmrc",
      "backend/.npmrc",
      "backend/pg-wasm/index.d.ts",
      "backend/pg-wasm/index.js",
      "backend/pg-wasm/package.json",
      "backend/src/modules/audit/immudb.service.ts",
      "frontend/.npmrc",
    ]);
  });

  it("replaces nothing else under backend/src", () => {
    const sources = SHIPPED.filter((name) => name.startsWith("backend/src/"));
    expect(sources).toEqual(["backend/src/modules/audit/immudb.service.ts"]);
  });

  it("installs itself under the name the backend already imports", () => {
    // `import { Pool } from "pg"` has to keep resolving, or the overlay would
    // have to edit every file that reaches the database.
    const manifest = JSON.parse(OVERLAY_ASSETS["backend/pg-wasm/package.json"] as string);
    expect(manifest.name).toBe("pg");
    expect(manifest.main).toBe("index.js");
  });

  it("keeps the audit ledger's public surface identical to the immudb client's", () => {
    // audit.service.ts and audit.controller.ts are unchanged files; they call
    // these four things and read `isConnected`.
    const ledger = OVERLAY_ASSETS["backend/src/modules/audit/immudb.service.ts"] as string;
    expect(ledger).toContain("export class ImmudbService");
    expect(ledger).toContain("get isConnected()");
    expect(ledger).toContain("async verifiedSet(key: string, value: string): Promise<string>");
    expect(ledger).toContain("async verifiedGet(key: string)");
    expect(ledger).toContain("async scan(prefix: string, limit = 100)");
  });

  it("gets its database connection from the application, not its own pool", () => {
    // A second Kysely would be a second PGlite on the same directory, which is
    // a second Postgres on the same files.
    const ledger = OVERLAY_ASSETS["backend/src/modules/audit/immudb.service.ts"] as string;
    expect(ledger).toContain("KYSELY_CONNECTION");
    expect(ledger).not.toContain("new Pool");
  });

  it("says what the ledger does not protect against", () => {
    // The hash chain lives in the database it protects. That is a real
    // limitation and the file has to keep saying so.
    const ledger = OVERLAY_ASSETS["backend/src/modules/audit/immudb.service.ts"] as string;
    expect(ledger).toMatch(/does not detect a deliberate, informed rewrite/);
  });

  it("refuses cursors rather than pretending to stream", () => {
    const driver = OVERLAY_ASSETS["backend/pg-wasm/index.js"] as string;
    expect(driver).toContain("Cursors are not supported");
  });
});
