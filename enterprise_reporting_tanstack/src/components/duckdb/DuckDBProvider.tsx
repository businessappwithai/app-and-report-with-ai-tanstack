"use client";

/**
 * React Context provider for a shared DuckDB-Wasm instance.
 * Wraps the app and exposes the DuckDB instance plus helper methods.
 */

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DuckDBConfig, DuckDBStatus, MemoryUsage } from "@/types/wasm";
import type { QueryResult, TableSchema } from "@/types/database";

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface DuckDBContextValue {
  status: DuckDBStatus;
  error: Error | null;
  executeQuery: (sql: string) => Promise<QueryResult>;
  loadParquet: (tableName: string, url: string) => Promise<void>;
  loadParquetBuffer: (tableName: string, buffer: Uint8Array) => Promise<void>;
  getTableSchema: (tableName: string) => Promise<TableSchema>;
  listTables: () => Promise<string[]>;
  dropTable: (tableName: string) => Promise<void>;
  getMemoryUsage: () => MemoryUsage;
}

const DuckDBContext = createContext<DuckDBContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DuckDBProvider({
  config,
  children,
}: {
  config?: DuckDBConfig;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<DuckDBStatus>("initializing");
  const [error, setError] = useState<Error | null>(null);
  const libRef = useRef<typeof import("@/lib/duckdb") | null>(null);

  // Initialise DuckDB-Wasm lazily on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Dynamic import so the WASM bundle is only loaded client-side
        const lib = await import("@/lib/duckdb");
        if (cancelled) return;
        libRef.current = lib;

        await lib.initDuckDB({
          maxMemory: config?.maxMemory,
          enableLogging: config?.enableLogging,
        });

        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setStatus("error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [config?.maxMemory, config?.enableLogging]);

  // Memoised helper methods ---------------------------------------------------

  const executeQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    const res = await lib.executeQuery(sql);
    return {
      rows: res.rows as Record<string, unknown>[],
      rowCount: res.rowCount,
      columns: res.columns.map((c) => ({ ...c, nullable: true })),
      executionTime: res.executionTime,
      query: sql,
    };
  }, []);

  const loadParquet = useCallback(async (tableName: string, url: string) => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    await lib.loadParquetFromUrl(tableName, url);
  }, []);

  const loadParquetBuffer = useCallback(async (tableName: string, buffer: Uint8Array) => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    const db = lib.getDuckDB();
    if (!db) throw new Error("DuckDB instance not available");
    await lib.loadParquetFromBuffer(tableName, buffer, db);
  }, []);

  const getTableSchema = useCallback(async (tableName: string): Promise<TableSchema> => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    const info = await lib.getTableSchema(tableName);
    return {
      tableName: info.name,
      columns: info.columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
      })),
      rowCount: info.rowCount,
    };
  }, []);

  const listTablesFn = useCallback(async (): Promise<string[]> => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    return lib.listTables();
  }, []);

  const dropTableFn = useCallback(async (tableName: string) => {
    const lib = libRef.current;
    if (!lib) throw new Error("DuckDB not initialised");
    await lib.dropTable(tableName);
  }, []);

  const getMemoryUsageFn = useCallback((): MemoryUsage => {
    const lib = libRef.current;
    if (!lib) {
      return { used: 0, limit: 0, breakdown: {} };
    }
    return lib.getMemoryManager().getUsage();
  }, []);

  const value = useMemo<DuckDBContextValue>(
    () => ({
      status,
      error,
      executeQuery,
      loadParquet,
      loadParquetBuffer,
      getTableSchema,
      listTables: listTablesFn,
      dropTable: dropTableFn,
      getMemoryUsage: getMemoryUsageFn,
    }),
    [
      status,
      error,
      executeQuery,
      loadParquet,
      loadParquetBuffer,
      getTableSchema,
      listTablesFn,
      dropTableFn,
      getMemoryUsageFn,
    ]
  );

  return <DuckDBContext.Provider value={value}>{children}</DuckDBContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDuckDB(): DuckDBContextValue {
  const ctx = useContext(DuckDBContext);
  if (!ctx) {
    throw new Error("useDuckDB must be used within a DuckDBProvider");
  }
  return ctx;
}
