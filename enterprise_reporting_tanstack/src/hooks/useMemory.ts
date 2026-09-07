"use client";

/**
 * Hook for monitoring DuckDB-Wasm memory usage.
 */

import { useCallback, useEffect, useState } from "react";
import { useDuckDB } from "@/components/duckdb/DuckDBProvider";
import type { MemoryUsage } from "@/types/wasm";

export function useMemory(pollIntervalMs: number = 5000): MemoryUsage {
  const { getMemoryUsage, status } = useDuckDB();
  const [usage, setUsage] = useState<MemoryUsage>({ used: 0, limit: 0, breakdown: {} });

  const refresh = useCallback(() => {
    if (status === "ready") {
      setUsage(getMemoryUsage());
    }
  }, [getMemoryUsage, status]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return usage;
}
