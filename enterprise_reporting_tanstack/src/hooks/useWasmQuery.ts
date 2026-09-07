"use client";

/**
 * Hook for executing DuckDB-Wasm queries with loading and error states.
 */

import { useCallback, useState } from "react";
import { useDuckDB } from "@/components/duckdb/DuckDBProvider";
import type { QueryResult } from "@/types/database";

interface UseWasmQueryReturn {
  result: QueryResult | null;
  isExecuting: boolean;
  error: Error | null;
  execute: (sql: string) => Promise<QueryResult>;
  reset: () => void;
}

export function useWasmQuery(): UseWasmQueryReturn {
  const { executeQuery } = useDuckDB();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (sql: string): Promise<QueryResult> => {
      setIsExecuting(true);
      setError(null);

      try {
        const res = await executeQuery(sql);
        setResult(res);
        return res;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsExecuting(false);
      }
    },
    [executeQuery]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isExecuting, error, execute, reset };
}
