"use client";

/**
 * Hook for loading and managing datasets in DuckDB-Wasm.
 * Handles fetching Parquet from the server, loading into DuckDB,
 * caching in IndexedDB, and memory tracking.
 */

import { useCallback, useState } from "react";
import { useDuckDB } from "@/components/duckdb/DuckDBProvider";
import { fetchParquetBuffer } from "@/lib/arrow/parquet";
import type { DatasetInfo } from "@/types/datasets";

interface UseDatasetReturn {
  datasets: DatasetInfo[];
  isLoading: boolean;
  error: Error | null;
  loadDataset: (params: {
    id: string;
    name: string;
    dataSourceId: string;
    url: string;
  }) => Promise<void>;
  unloadDataset: (datasetId: string) => Promise<void>;
  refreshDataset: (datasetId: string, url: string) => Promise<void>;
}

export function useDataset(): UseDatasetReturn {
  const { loadParquetBuffer, dropTable, getTableSchema, status } = useDuckDB();
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadDataset = useCallback(
    async (params: { id: string; name: string; dataSourceId: string; url: string }) => {
      if (status !== "ready") throw new Error("DuckDB not ready");

      setIsLoading(true);
      setError(null);

      // Optimistic entry
      const tableName = `ds_${params.id}`;
      const placeholder: DatasetInfo = {
        id: params.id,
        name: params.name,
        dataSourceId: params.dataSourceId,
        tableName,
        rowCount: 0,
        fileSize: 0,
        memorySize: 0,
        schema: [],
        cacheStatus: "not-cached",
        isLoading: true,
        loadProgress: 0,
        loadedAt: new Date(),
      };

      setDatasets((prev) => [...prev.filter((d) => d.id !== params.id), placeholder]);

      try {
        // Fetch Parquet file
        const buffer = await fetchParquetBuffer(params.url, (loaded, total) => {
          setDatasets((prev) =>
            prev.map((d) =>
              d.id === params.id ? { ...d, loadProgress: total > 0 ? loaded / total : 0 } : d
            )
          );
        });

        // Load into DuckDB
        await loadParquetBuffer(tableName, buffer);

        // Get schema info
        const schema = await getTableSchema(tableName);

        setDatasets((prev) =>
          prev.map((d) =>
            d.id === params.id
              ? {
                  ...d,
                  rowCount: schema.rowCount ?? 0,
                  fileSize: buffer.byteLength,
                  memorySize: buffer.byteLength,
                  schema: schema.columns,
                  cacheStatus: "cached" as const,
                  isLoading: false,
                  loadProgress: 1,
                }
              : d
          )
        );

        // Try to cache in IndexedDB
        try {
          const { set } = await import("idb-keyval");
          await set(`parquet_${params.id}`, buffer);
        } catch {
          // IndexedDB caching is best-effort
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setDatasets((prev) => prev.filter((d) => d.id !== params.id));
      } finally {
        setIsLoading(false);
      }
    },
    [status, loadParquetBuffer, getTableSchema]
  );

  const unloadDataset = useCallback(
    async (datasetId: string) => {
      const ds = datasets.find((d) => d.id === datasetId);
      if (ds) {
        await dropTable(ds.tableName);
        setDatasets((prev) => prev.filter((d) => d.id !== datasetId));
      }
    },
    [datasets, dropTable]
  );

  const refreshDataset = useCallback(
    async (datasetId: string, url: string) => {
      const ds = datasets.find((d) => d.id === datasetId);
      if (!ds) return;
      await unloadDataset(datasetId);
      await loadDataset({
        id: ds.id,
        name: ds.name,
        dataSourceId: ds.dataSourceId,
        url,
      });
    },
    [datasets, unloadDataset, loadDataset]
  );

  return { datasets, isLoading, error, loadDataset, unloadDataset, refreshDataset };
}
