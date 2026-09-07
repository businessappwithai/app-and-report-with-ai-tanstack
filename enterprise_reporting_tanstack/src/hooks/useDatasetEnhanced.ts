"use client";

/**
 * Enhanced dataset hook with offline mode support.
 * Checks IndexedDB cache before fetching from server.
 */

import { useCallback, useEffect, useState } from "react";
import { useDuckDB } from "@/components/duckdb/DuckDBProvider";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { DatasetInfo } from "@/types/datasets";

interface UseDatasetEnhancedReturn {
  datasets: DatasetInfo[];
  isLoading: boolean;
  error: Error | null;
  isOffline: boolean;
  loadDataset: (params: {
    id: string;
    name: string;
    dataSourceId: string;
    url: string;
    forceRefresh?: boolean;
  }) => Promise<void>;
  unloadDataset: (datasetId: string) => Promise<void>;
  refreshDataset: (datasetId: string, url: string) => Promise<void>;
  preloadFromCache: () => Promise<void>;
}

export function useDatasetEnhanced(): UseDatasetEnhancedReturn {
  const { loadParquetBuffer, dropTable, getTableSchema, status } = useDuckDB();
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadDataset = useCallback(
    async (params: {
      id: string;
      name: string;
      dataSourceId: string;
      url: string;
      forceRefresh?: boolean;
    }) => {
      if (status !== "ready") throw new Error("DuckDB not ready");

      const offlineEnabled = isFeatureEnabled("offlineEnabled");
      const tableName = `ds_${params.id}`;

      setIsLoading(true);
      setError(null);

      // Optimistic entry
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
        let buffer: Uint8Array;

        // Try to load from IndexedDB cache first (if offline mode is enabled)
        if (offlineEnabled && !params.forceRefresh) {
          try {
            const { get } = await import("idb-keyval");
            const cached = (await get(`parquet_${params.id}`)) as Uint8Array | undefined;

            if (cached) {
              console.log(`[Dataset] Loading from cache: ${params.name}`);
              buffer = cached;

              // Update metadata to show cached status
              setDatasets((prev) =>
                prev.map((d) =>
                  d.id === params.id
                    ? {
                        ...d,
                        cacheStatus: "cached" as const,
                        loadedAt: new Date(),
                        loadProgress: 0.5,
                      }
                    : d
                )
              );

              // If online, refresh in background
              if (!isOffline) {
                fetch(params.url)
                  .then((res) => res.arrayBuffer())
                  .then(async (freshBuffer) => {
                    const fresh = new Uint8Array(freshBuffer);
                    // Update cache silently
                    const { set } = await import("idb-keyval");
                    await set(`parquet_${params.id}`, fresh);
                  })
                  .catch(() => {
                    // Background refresh failed, but we have cached data
                    console.log(`[Dataset] Background refresh failed for: ${params.name}`);
                  });
              }
            } else {
              // Not in cache, fetch from server
              buffer = await fetchParquetBuffer(params.url, (loaded, total) => {
                setDatasets((prev) =>
                  prev.map((d) =>
                    d.id === params.id ? { ...d, loadProgress: total > 0 ? loaded / total : 0 } : d
                  )
                );
              });
            }
          } catch (cacheError) {
            // IndexedDB not available or error, fetch from server
            console.warn("[Dataset] Cache access failed, fetching from server:", cacheError);
            buffer = await fetchParquetBuffer(params.url, (loaded, total) => {
              setDatasets((prev) =>
                prev.map((d) =>
                  d.id === params.id ? { ...d, loadProgress: total > 0 ? loaded / total : 0 } : d
                )
              );
            });
          }
        } else {
          // Offline mode disabled, fetch directly
          buffer = await fetchParquetBuffer(params.url, (loaded, total) => {
            setDatasets((prev) =>
              prev.map((d) =>
                d.id === params.id ? { ...d, loadProgress: total > 0 ? loaded / total : 0 } : d
              )
            );
          });
        }

        // Load into DuckDB
        await loadParquetBuffer(tableName, buffer);

        // Get schema info
        const schema = await getTableSchema(tableName);

        const updatedDataset: DatasetInfo = {
          id: params.id,
          name: params.name,
          dataSourceId: params.dataSourceId,
          tableName,
          rowCount: schema.rowCount ?? 0,
          fileSize: buffer.byteLength,
          memorySize: buffer.byteLength,
          schema: schema.columns,
          cacheStatus: "cached",
          isLoading: false,
          loadProgress: 1,
          loadedAt: new Date(),
        };

        setDatasets((prev) => prev.map((d) => (d.id === params.id ? updatedDataset : d)));

        // Cache for offline use
        if (offlineEnabled) {
          try {
            const { set } = await import("idb-keyval");
            await set(`parquet_${params.id}`, buffer);
          } catch {
            // IndexedDB caching is best-effort
          }
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setDatasets((prev) => prev.filter((d) => d.id !== params.id));
      } finally {
        setIsLoading(false);
      }
    },
    [status, loadParquetBuffer, getTableSchema, isOffline]
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
        forceRefresh: true,
      });
    },
    [datasets, unloadDataset, loadDataset]
  );

  // Preload datasets from IndexedDB on mount (if offline mode is enabled)
  const preloadFromCache = useCallback(async () => {
    if (!isFeatureEnabled("offlineEnabled")) return;

    try {
      const { keys, entries } = await import("idb-keyval");
      const allKeys = await keys();
      const parquetKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith("parquet_"));

      if (parquetKeys.length > 0) {
        const allEntries = await entries();
        for (const [key, _buffer] of allEntries) {
          if (typeof key === "string" && key.startsWith("parquet_")) {
            const datasetId = key.replace("parquet_", "");
            const existing = datasets.find((d) => d.id === datasetId);

            if (!existing) {
              // Dataset exists in cache but not loaded into memory
              console.log(`[Dataset] Found cached dataset: ${datasetId}`);
            }
          }
        }
      }
    } catch {
      // IndexedDB not available
    }
  }, [datasets]);

  return {
    datasets,
    isLoading,
    error,
    isOffline,
    loadDataset,
    unloadDataset,
    refreshDataset,
    preloadFromCache,
  };
}

// Helper function to fetch with progress
async function fetchParquetBuffer(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    chunks.push(value);
    loaded += value.length;

    if (total > 0) {
      onProgress(loaded, total);
    }
  }

  // Combine chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}
