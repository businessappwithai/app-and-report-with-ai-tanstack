/**
 * Progressive loading utilities for large datasets.
 * Streams data in chunks and renders partial results.
 */

import type { ColumnSchema } from "@/types/database";

export interface ProgressiveLoadConfig {
  /** Total number of rows in the dataset */
  totalRows: number;
  /** Initial chunk size to load */
  initialChunkSize?: number;
  /** Subsequent chunk size */
  chunkSize?: number;
  /** Delay between chunks (ms) */
  chunkDelay?: number;
  /** Maximum chunks to load (0 = unlimited) */
  maxChunks?: number;
}

export interface ProgressiveLoadResult<T = unknown> {
  rows: T[];
  rowCount: number;
  columns: ColumnSchema[];
  isComplete: boolean;
  progress: number; // 0-1
  loadedChunks: number;
  totalChunks: number;
}

export interface ProgressiveLoadOptions {
  onProgress?: (progress: ProgressiveLoadResult) => void;
  onComplete?: (result: ProgressiveLoadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Load data progressively in chunks.
 * Useful for large datasets where you want to show partial results quickly.
 */
export async function progressiveLoad<T = unknown>(
  dataLoader: (
    offset: number,
    limit: number
  ) => Promise<{
    rows: T[];
    columns: ColumnSchema[];
    totalRows: number;
  }>,
  config: ProgressiveLoadConfig,
  options: ProgressiveLoadOptions = {}
): Promise<ProgressiveLoadResult<T>> {
  const { initialChunkSize = 1000, chunkSize = 5000, chunkDelay = 100, maxChunks = 0 } = config;

  const totalChunks =
    maxChunks > 0
      ? Math.min(maxChunks, Math.ceil(config.totalRows / chunkSize))
      : Math.ceil(config.totalRows / chunkSize);

  let allRows: T[] = [];
  let columns: ColumnSchema[] = [];
  let currentOffset = 0;
  let loadedChunks = 0;
  let firstChunk = true;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    while (loadedChunks < totalChunks) {
      const limit = firstChunk ? initialChunkSize : chunkSize;

      const result = await dataLoader(currentOffset, limit);
      allRows = allRows.concat(result.rows);
      columns = result.columns;
      currentOffset += limit;
      loadedChunks++;
      firstChunk = false;

      const progress: ProgressiveLoadResult<T> = {
        rows: allRows,
        rowCount: allRows.length,
        columns,
        isComplete: loadedChunks >= totalChunks || allRows.length >= config.totalRows,
        progress: Math.min(allRows.length / config.totalRows, 1),
        loadedChunks,
        totalChunks,
      };

      options.onProgress?.(progress);

      if (progress.isComplete) {
        options.onComplete?.(progress);
        return progress;
      }

      // Small delay between chunks to allow UI updates
      if (chunkDelay > 0) {
        await delay(chunkDelay);
      }
    }

    const finalResult: ProgressiveLoadResult<T> = {
      rows: allRows,
      rowCount: allRows.length,
      columns,
      isComplete: true,
      progress: 1,
      loadedChunks,
      totalChunks,
    };

    options.onComplete?.(finalResult);
    return finalResult;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    throw err;
  }
}

/**
 * Create a progressive data fetcher for a dataset.
 * Returns a function that can be called with offset/limit.
 */
export function createProgressiveFetcher(
  datasetId: string,
  baseUrl: string
): (
  offset: number,
  limit: number
) => Promise<{
  rows: unknown[];
  columns: ColumnSchema[];
  totalRows: number;
}> {
  return async (offset: number, limit: number) => {
    const response = await fetch(
      `${baseUrl}/api/datasets/${datasetId}?offset=${offset}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch dataset: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      rows: data.data.rows ?? [],
      columns: data.data.columns ?? [],
      totalRows: data.data.totalRows ?? 0,
    };
  };
}

/**
 * Estimate if progressive loading should be used based on dataset size.
 */
export function shouldUseProgressiveLoading(rowCount: number, fileSize: number): boolean {
  // Use progressive loading for:
  // - More than 100K rows, OR
  // - More than 10MB file size
  // Only if feature flag is enabled
  return (
    (rowCount > 100000 || fileSize > 10 * 1024 * 1024) &&
    process.env.NEXT_PUBLIC_PROGRESSIVE_ENABLED === "true"
  );
}
