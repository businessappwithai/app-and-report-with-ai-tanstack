/**
 * DATABASE CONFIGURATION — single place to change DB connection.
 *
 * Supported env vars:
 *   DATABASE_URL   postgresql://user:pass@host:5432/dbname  (takes precedence)
 *   PGHOST         default: localhost
 *   PGPORT         default: 5432
 *   PGUSER         default: current OS user
 *   PGPASSWORD     default: (empty)
 *   PGDATABASE     default: appwithai
 *   PGSSLMODE      disable | require | verify-full — overrides what the URL says
 *
 * Hosted Postgres (Neon, Supabase, RDS) requires TLS and will refuse the
 * connection outright without it, so `sslConfig` below decides when to ask for
 * it. See the note there about why `sslmode` in the URL is not enough.
 */

import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { getLogger } from "../logging/index.js";
import type { Database } from "./db.types.js";

export type { Database };

/** Loopback, where TLS is pointless and usually unavailable. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * Whether a host is somewhere TLS is worth asking for.
 *
 * A hosted database is always a public DNS name, and one thing every public
 * name has that a private one does not is a dot. Container and compose
 * hostnames are single labels — `postgres`, `db`, `drug-discovery-db` — and
 * those servers usually have no certificate at all, so asking for TLS there
 * does not degrade, it fails the connection outright.
 */
function looksRemote(host: string | undefined): boolean {
  if (!host) return false;
  const name = host.toLowerCase();
  if (LOOPBACK.has(name)) return false;
  return name.includes(".");
}

/**
 * The `ssl` value for a connection, or undefined to leave it off.
 *
 * `pg` reads `sslmode` from a connection string, but only far enough to turn
 * TLS on — for `require` it also demands a CA it can chain to, and Neon's
 * certificate is signed by a root that is not in every image's trust store.
 * The result is a `SELF_SIGNED_CERT_IN_CHAIN` failure on a string that works
 * fine in psql. So the decision is made here instead:
 *
 *   verify-full → verify the chain, as asked
 *   require     → encrypt without demanding a verifiable chain (what psql does)
 *   disable     → no TLS
 *
 * With nothing specified, a remote host gets `require` and a local one gets
 * nothing, which is the right default in both directions.
 */
function sslConfig(host: string | undefined, urlMode?: string): pg.PoolConfig["ssl"] {
  const mode = (process.env.PGSSLMODE ?? urlMode ?? "").toLowerCase();

  if (mode === "disable") return undefined;
  if (mode === "verify-full" || mode === "verify-ca") return { rejectUnauthorized: true };
  if (mode) return { rejectUnauthorized: false };

  return looksRemote(host) ? { rejectUnauthorized: false } : undefined;
}

function buildPoolConfig(): pg.PoolConfig {
  const url = process.env.DATABASE_URL;

  if (url && (url.startsWith("postgresql://") || url.startsWith("postgres://"))) {
    // A malformed URL should fail when pg dials it, with pg's message, rather
    // than here while we are only trying to read the host off it.
    let host: string | undefined;
    let urlMode: string | undefined;
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      urlMode = parsed.searchParams.get("sslmode") ?? undefined;
    } catch (err) {
      // The defaults below are safe, so this is not fatal — but a DATABASE_URL
      // the runtime cannot even read the host out of is almost never what the
      // operator intended, and it used to produce no output at all.
      getLogger("db").event("app.config.invalid", {
        key: "DATABASE_URL",
        reason: err instanceof Error ? err.message : "not a parsable URL",
      });
    }

    const ssl = sslConfig(host, urlMode);
    return ssl ? { connectionString: url, max: 10, ssl } : { connectionString: url, max: 10 };
  }

  const host = process.env.PGHOST ?? "localhost";
  const ssl = sslConfig(host);

  return {
    host,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD ?? "",
    database: process.env.PGDATABASE ?? "appwithai",
    max: 10,
    ...(ssl ? { ssl } : {}),
  };
}

/**
 * How long a query may take before it is worth reporting on its own.
 *
 * Deliberately generous. The point is to catch the query that has quietly lost
 * its index, not to comment on ordinary load.
 */
const SLOW_QUERY_BUDGET_MS = Number(process.env.DB_SLOW_QUERY_MS ?? 500);

/**
 * The verb and the table out of a SQL string, for a log field.
 *
 * The statement itself is not logged. It carries the parameter values a `where`
 * clause was built from, which on this schema means email addresses and project
 * contents; a slow-query report is not worth exporting user data to a log
 * collector. The verb and the table are what identify the query.
 */
function operationOf(sql: string): string {
  return sql.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "unknown";
}

function tableOf(sql: string): string {
  const match = /\b(?:from|into|update|table)\s+"?([a-z_][a-z0-9_]*)"?/i.exec(sql);
  return match?.[1] ?? "unknown";
}

let _db: Kysely<Database> | null = null;

/**
 * Returns the shared Kysely<Database> instance (lazy singleton).
 */
export function getDb(): Kysely<Database> {
  if (!_db) {
    const log = getLogger("db");
    const poolConfig = buildPoolConfig();
    const pool = new pg.Pool(poolConfig);

    // Not optional, and not only about logging. `pg` emits `error` on an idle
    // client whose connection the server dropped — a routine event on hosted
    // Postgres, which closes idle connections — and an EventEmitter with no
    // `error` listener rethrows, taking the process down. So the handler has to
    // exist; reporting what it caught is what makes the restart explainable.
    pool.on("error", (err) => {
      log.event("db.connection.failed", {
        host: poolConfig.host ?? hostFromConnectionString(poolConfig.connectionString),
        database: poolConfig.database,
        err,
      });
    });

    pool.once("connect", () => {
      log.event("db.connected", {
        host: poolConfig.host ?? hostFromConnectionString(poolConfig.connectionString),
        database: poolConfig.database,
        poolMax: poolConfig.max,
      });
    });

    _db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
      // Kysely reports every executed query with its duration, which is the
      // only place that number exists — `pg` does not measure it and no call
      // site is going to time itself. Successful queries are not logged one by
      // one: at any real traffic that is a line per query and the useful ones
      // drown. Only the two worth a human's attention are.
      log: (event) => {
        const durationMs = Math.round(event.queryDurationMillis);

        if (event.level === "error") {
          log.event("db.query.failed", {
            operation: operationOf(event.query.sql),
            table: tableOf(event.query.sql),
            durationMs,
            err: event.error,
          });
          return;
        }

        if (durationMs > SLOW_QUERY_BUDGET_MS) {
          log.event("db.query.slow", {
            operation: operationOf(event.query.sql),
            table: tableOf(event.query.sql),
            durationMs,
            budgetMs: SLOW_QUERY_BUDGET_MS,
          });
        }
      },
    });
  }
  return _db;
}

/**
 * The host out of a connection string, for a log line.
 *
 * Never the whole string: it carries the password, and a connection failure is
 * exactly the moment someone pastes the log into a ticket.
 */
function hostFromConnectionString(connectionString: string | undefined): string | undefined {
  if (!connectionString) return undefined;
  try {
    return new URL(connectionString).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Destroy the connection pool (use in tests or graceful shutdown).
 */
export async function destroyDb(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}
