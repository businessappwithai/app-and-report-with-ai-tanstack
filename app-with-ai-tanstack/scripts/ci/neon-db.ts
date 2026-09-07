#!/usr/bin/env bun
/**
 * Neon Postgres helper for the GitHubNeon workflow.
 *
 * Everything that has to touch the connection string lives here rather than in
 * shell, so the URL is never interpolated into a command line where it could
 * end up in a log or a process listing. Each command reads it from
 * DATABASE_URL and hands back only non-secret output.
 *
 * Commands:
 *   check                 Connect and report server version + database name.
 *   reset                 Drop and recreate the public schema (destructive).
 *   report [--assert]     Table + row-count summary. --assert fails the run
 *                         when the schema or the seed data is missing.
 *   write-env <file>      Write a backend .env pointing at this database.
 *
 * Usage:
 *   DATABASE_URL=postgresql://… bun scripts/ci/neon-db.ts check
 */

import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { Pool } from "pg";

// ---------------------------------------------------------------------------
// Connection string
// ---------------------------------------------------------------------------

/**
 * Read DATABASE_URL and make sure it will actually reach Neon.
 *
 * Neon refuses plaintext connections, and the `pg` driver only negotiates TLS
 * when the connection string asks it to — a URL copied without `sslmode` fails
 * with a bare "connection is insecure". Adding the parameter here means the
 * caller can paste whichever form the Neon console gave them.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Provide the Neon connection string via the " +
        "NEON_DATABASE_URL secret or the database_url workflow input."
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL (expected postgresql://user:pass@host/db).");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error(`DATABASE_URL must use postgres:// or postgresql://, got "${url.protocol}//".`);
  }
  if (!url.hostname) throw new Error("DATABASE_URL has no host.");
  if (url.pathname.replace(/^\//, "") === "") throw new Error("DATABASE_URL names no database.");

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
}

/** Host and database only — safe to print. */
function describeTarget(connectionString: string): string {
  const url = new URL(connectionString);
  return `${url.hostname}/${url.pathname.replace(/^\//, "")}`;
}

function openPool(): { pool: Pool; target: string } {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  return {
    pool: new Pool({ connectionString, max: 2, connectionTimeoutMillis: 20_000 }),
    target: describeTarget(connectionString),
  };
}

// ---------------------------------------------------------------------------
// Step summary
// ---------------------------------------------------------------------------

function appendSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  appendFileSync(file, `${markdown}\n`);
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

async function check(): Promise<void> {
  const { pool, target } = openPool();
  try {
    const { rows } = await pool.query<{
      version: string;
      database: string;
      username: string;
    }>("SELECT version() AS version, current_database() AS database, current_user AS username");

    const row = rows[0];
    if (!row) throw new Error("The database returned no rows for the connectivity probe.");

    console.log(`✓ Connected to ${target}`);
    console.log(`  Database: ${row.database}`);
    console.log(`  User:     ${row.username}`);
    console.log(`  Server:   ${row.version.split(",")[0]}`);
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

/**
 * Drop everything in the public schema.
 *
 * Only reachable behind the workflow's `reset_schema` input, which defaults to
 * false: the migrations are idempotent, so a rerun does not need this, and the
 * connection string may well point at a database someone cares about.
 */
async function reset(): Promise<void> {
  const { pool, target } = openPool();
  try {
    console.log(`⚠️  Dropping and recreating the public schema on ${target}…`);
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
    await pool.query("CREATE SCHEMA public");
    console.log("✓ Schema reset — the database is empty.");
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

interface TableCount {
  table: string;
  rows: number;
}

async function collectCounts(pool: Pool): Promise<TableCount[]> {
  const { rows: tables } = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );

  const counts: TableCount[] = [];
  for (const { table_name } of tables) {
    // Identifiers cannot be parameterised; the names come from
    // information_schema, so quoting them is enough to keep this safe.
    const quoted = `"public"."${table_name.replace(/"/g, '""')}"`;
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${quoted}`
    );
    counts.push({ table: table_name, rows: Number(rows[0]?.count ?? 0) });
  }
  return counts;
}

async function report(assert: boolean): Promise<void> {
  const { pool, target } = openPool();
  try {
    const counts = await collectCounts(pool);

    const groups = {
      sys: counts.filter((c) => c.table.startsWith("sys_")),
      bus: counts.filter((c) => c.table.startsWith("bus_")),
      other: counts.filter((c) => !c.table.startsWith("sys_") && !c.table.startsWith("bus_")),
    };
    const totalRows = counts.reduce((sum, c) => sum + c.rows, 0);
    const busRows = groups.bus.reduce((sum, c) => sum + c.rows, 0);

    console.log(`\n📊 Seed report for ${target}\n`);
    console.log(
      `   Tables: ${counts.length} (sys ${groups.sys.length}, bus ${groups.bus.length}, other ${groups.other.length})`
    );
    console.log(`   Rows:   ${totalRows} (business rows: ${busRows})\n`);
    for (const { table, rows } of counts) {
      console.log(`   ${table.padEnd(44)} ${String(rows).padStart(8)}`);
    }

    const lines = [
      "### Neon database after seeding",
      "",
      `Target: \`${target}\``,
      "",
      "| Table | Rows |",
      "| --- | ---: |",
      ...counts.map(({ table, rows }) => `| \`${table}\` | ${rows} |`),
      "",
      `**${counts.length} tables, ${totalRows} rows** (${busRows} business rows).`,
    ];
    appendSummary(lines.join("\n"));

    if (!assert) return;

    const problems: string[] = [];
    if (counts.length === 0)
      problems.push("the public schema has no tables — migrations did not run");
    if (groups.sys.length === 0) problems.push("no sys_* dictionary tables were created");
    if (groups.bus.length === 0) problems.push("no bus_* business tables were created");
    if (groups.sys.every((c) => c.rows === 0)) problems.push("no dictionary rows were seeded");
    if (busRows === 0) problems.push("no business rows were seeded");

    if (problems.length > 0) {
      console.error("\n❌ Seed verification failed:");
      for (const problem of problems) console.error(`   • ${problem}`);
      process.exit(1);
    }

    console.log("\n✓ Seed verification passed.");
  } finally {
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// write-env
// ---------------------------------------------------------------------------

/**
 * Write the generated backend's `.env`.
 *
 * The generated `migrate.ts` and `seed.ts` load this file with dotenv's
 * `override: true`, so the file — not the exported shell environment — decides
 * which database they talk to. Writing it before install/migrate/seed is what
 * points the whole generated app at Neon.
 */
async function writeEnv(target: string): Promise<void> {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const file = path.resolve(target);

  const port = process.env.APP_BACKEND_PORT ?? "4001";
  const frontendPort = process.env.APP_FRONTEND_PORT ?? "4000";
  const adminEmail = process.env.APP_ADMIN_EMAIL ?? "admin@admin.com";
  const adminPassword = process.env.APP_ADMIN_PASSWORD ?? "admin";
  // better-auth refuses to start without a secret. CI runs are throwaway, so a
  // fresh random one per run is both sufficient and safer than a fixed string.
  const authSecret = process.env.APP_AUTH_SECRET || randomBytes(32).toString("hex");

  const contents = `# Generated by scripts/ci/neon-db.ts for the GitHubNeon workflow.
# Do not commit — it holds the Neon connection string.

PORT=${port}
HOST=127.0.0.1
NODE_ENV=production
LOG_LEVEL=info

# Neon PostgreSQL
DATABASE_URL=${connectionString}

# CORS / auth origins
CORS_ORIGIN=http://localhost:${frontendPort}
BETTER_AUTH_URL=http://localhost:${port}
BETTER_AUTH_SECRET=${authSecret}

# Bootstrap administrator (created by src/main.ts on first start)
ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPassword}

# CI runs drive the API far harder than a person does. NODE_ENV=production
# would otherwise cap the app at 100 requests per window. TTL is milliseconds.
THROTTLE_TTL=60000
THROTTLE_LIMIT=1000000

# No immudb sidecar on a GitHub runner.
IMMUDB_ENABLED=false
`;

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, { mode: 0o600 });
  console.log(`✓ Wrote ${file} → ${describeTarget(connectionString)}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "check":
      await check();
      return;
    case "reset":
      await reset();
      return;
    case "report":
      await report(rest.includes("--assert"));
      return;
    case "write-env": {
      const target = rest[0];
      if (!target) throw new Error("write-env needs a target file path.");
      await writeEnv(target);
      return;
    }
    default:
      console.error(
        `Unknown command "${command ?? ""}".\n` +
          "Usage: bun scripts/ci/neon-db.ts <check|reset|report|write-env>"
      );
      process.exit(1);
  }
}

/**
 * Render an error usefully.
 *
 * A failed connection arrives as an AggregateError — one entry per address the
 * host resolved to — and its own `message` is the empty string. Printed naively
 * that produces a bare "❌" with no indication of what went wrong, which is the
 * least helpful thing a CI log can say.
 */
function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = error.errors.map((inner) => describeError(inner));
    return [
      error.message || "Could not connect to the database.",
      ...causes.map((c) => `  • ${c}`),
    ].join("\n");
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code ? `${error.message || code} (${code})` : error.message;
  }
  return String(error);
}

main().catch((error: unknown) => {
  console.error(`❌ ${describeError(error)}`);
  process.exit(1);
});
