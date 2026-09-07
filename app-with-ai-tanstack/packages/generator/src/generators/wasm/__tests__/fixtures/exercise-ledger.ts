/**
 * Drive the shipped audit ledger and print what happened, as JSON.
 *
 * Run by `audit-ledger.test.ts` in a child process under Bun rather than inside
 * Vitest. The ledger is a NestJS provider with a parameter decorator, and
 * Vitest's transformer rejects those; Bun runs the file as written. Running the
 * file as written is the point — a test that exercised a rewritten copy would
 * pass against code no generated application contains.
 */

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Kysely, PostgresDialect, sql } from "kysely";
// @ts-expect-error — the WebAssembly `pg`, loaded the way the backend loads it
import { Pool, shutdown } from "../../../../../templates/wasm-overlay/backend/pg-wasm/index.js";

const OVERLAY = join(import.meta.dir, "../../../../../templates/wasm-overlay/backend");

/**
 * Stage the ledger where its own imports resolve.
 *
 * It reaches for `../../database/database.constants`, which exists in a
 * generated application and not in the template tree — the overlay must not
 * ship that file, because it belongs to the application it is overlaying. So
 * the shipped file is *copied* (byte for byte, not rewritten) into a scratch
 * tree that has the one constant it needs beside it.
 */
const SCRATCH = join(import.meta.dir, "../.tmp/backend/src");
mkdirSync(join(SCRATCH, "database"), { recursive: true });
mkdirSync(join(SCRATCH, "modules/audit"), { recursive: true });
writeFileSync(
  join(SCRATCH, "database/database.constants.ts"),
  'export const KYSELY_CONNECTION = "KYSELY_CONNECTION";\n',
  "utf-8"
);
copyFileSync(
  join(OVERLAY, "src/modules/audit/immudb.service.ts"),
  join(SCRATCH, "modules/audit/immudb.service.ts")
);

const { ImmudbService } = await import(join(SCRATCH, "modules/audit/immudb.service.ts"));

process.env.PGLITE_DATA_DIR = "memory://";
process.env.PGLITE_QUIET = "true";

const config = { get: <T>(_key: string, fallback?: T) => fallback } as never;
const db = new Kysely<any>({ dialect: new PostgresDialect({ pool: new Pool({}) }) });
const ledger = new ImmudbService(db, config);

const report: Record<string, unknown> = {};

await ledger.onModuleInit();
report.connected = ledger.isConnected;

report.firstTxId = await ledger.verifiedSet("audit:1:a", JSON.stringify({ action: "CREATE" }));
const second = await ledger.verifiedSet("audit:2:b", JSON.stringify({ action: "UPDATE" }));
await ledger.verifiedSet("audit:3:c", JSON.stringify({ action: "DELETE" }));

report.verifiedByTxId = (await ledger.verifiedGet(second))?.verified;
report.verifiedByKey = (await ledger.verifiedGet("audit:2:b"))?.verified;
report.missing = await ledger.verifiedGet("audit:never");
report.scanned = (await ledger.scan("audit:")).map((entry: { key: string }) => entry.key);
report.chainClean = await ledger.verifyChain();

// Tamper: rewrite an entry the way someone editing history would.
await sql`UPDATE sys_audit_ledger SET value = '{"action":"NOTHING HAPPENED"}' WHERE seq = 2`.execute(
  db
);
report.afterEditEntry = (await ledger.verifiedGet("audit:2:b"))?.verified;
report.afterEditChain = await ledger.verifyChain();

// Tamper: remove it entirely, which breaks the link its successor recorded.
await sql`DELETE FROM sys_audit_ledger WHERE seq = 2`.execute(db);
report.afterDeleteSuccessor = (await ledger.verifiedGet("audit:3:c"))?.verified;
report.afterDeleteChain = await ledger.verifyChain();

console.log(JSON.stringify(report));

await db.destroy();
await shutdown();

// Explicit, because closing an embedded Postgres leaves the runtime with an
// opinion about the exit code that has nothing to do with whether the checks
// above passed. The report is on stdout; that is the result.
process.exit(0);
