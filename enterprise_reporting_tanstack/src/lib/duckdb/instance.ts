/**
 * DuckDB-Wasm instance management.
 * Creates and manages a singleton DuckDB instance running in a Web Worker.
 */

import * as duckdb from "@duckdb/duckdb-wasm";
import type { AsyncDuckDB, AsyncDuckDBConnection, DuckDBInstanceOptions } from "./types";
import { DEFAULT_DUCKDB_OPTIONS } from "./types";

let dbInstance: AsyncDuckDB | null = null;
let initPromise: Promise<AsyncDuckDB> | null = null;

/**
 * Select the best available DuckDB bundle for the current browser.
 */
async function selectBundle(): Promise<duckdb.DuckDBBundle> {
  const bundles = duckdb.getJsDelivrBundles();
  return await duckdb.selectBundle(bundles);
}

/**
 * Initialize and return a singleton DuckDB-Wasm instance.
 * If already initialized, returns the existing instance.
 */
export async function initDuckDB(options: DuckDBInstanceOptions = {}): Promise<AsyncDuckDB> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  const opts = { ...DEFAULT_DUCKDB_OPTIONS, ...options };

  initPromise = (async () => {
    const bundle = await selectBundle();

    const worker = new Worker(bundle.mainWorker ?? "");
    const logger = new duckdb.ConsoleLogger(
      opts.enableLogging ? duckdb.LogLevel.INFO : duckdb.LogLevel.WARNING
    );

    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    // Apply configuration
    const conn = await db.connect();
    try {
      if (opts.maxMemory) {
        const mb = Math.floor(opts.maxMemory / (1024 * 1024));
        await conn.query(`SET memory_limit = '${mb}MB'`);
      }
      if (opts.threads) {
        await conn.query(`SET threads = ${opts.threads}`);
      }
    } finally {
      await conn.close();
    }

    dbInstance = db;
    return db;
  })();

  try {
    return await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

/**
 * Get the current DuckDB instance (null if not initialized).
 */
export function getDuckDB(): AsyncDuckDB | null {
  return dbInstance;
}

/**
 * Create a new connection to the DuckDB instance.
 */
export async function createConnection(): Promise<AsyncDuckDBConnection> {
  const db = await initDuckDB();
  return db.connect();
}

/**
 * Close the DuckDB instance and release resources.
 */
export async function closeDuckDB(): Promise<void> {
  if (dbInstance) {
    await dbInstance.terminate();
    dbInstance = null;
    initPromise = null;
  }
}
