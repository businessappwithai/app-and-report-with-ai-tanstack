/**
 * Internal DuckDB-Wasm type definitions.
 */

import type * as duckdb from "@duckdb/duckdb-wasm";

export type DuckDBBundle = duckdb.DuckDBBundle;
export type AsyncDuckDB = duckdb.AsyncDuckDB;
export type AsyncDuckDBConnection = duckdb.AsyncDuckDBConnection;

export interface DuckDBQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: { name: string; type: string }[];
  executionTime: number;
}

export interface DuckDBTableInfo {
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
  rowCount: number;
}

export interface DuckDBInstanceOptions {
  maxMemory?: number;
  threads?: number;
  enableLogging?: boolean;
}

export const DEFAULT_DUCKDB_OPTIONS: DuckDBInstanceOptions = {
  maxMemory: 2 * 1024 * 1024 * 1024, // 2 GB
  threads: typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4,
  enableLogging: false,
};
