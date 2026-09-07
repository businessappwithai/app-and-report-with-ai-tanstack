/**
 * Type definitions for DuckDB WASM and in-memory analytics.
 * This file contains ONLY WASM-specific types.
 * General-purpose types have been moved to:
 * - src/types/database.ts (ColumnSchema, TableSchema, QueryResult)
 * - src/types/charts.ts (ChartType, EChartsConfig, etc.)
 * - src/types/datasets.ts (DatasetInfo, DatasetMetadata)
 * - src/types/filters.ts (FilterLink, ActiveFilter, etc.)
 */

// ---------------------------------------------------------------------------
// DuckDB WASM Configuration
// ---------------------------------------------------------------------------

export type DuckDBStatus = "initializing" | "ready" | "error";

export interface DuckDBConfig {
  /** Maximum memory allowed for DuckDB (bytes). @default 2GB */
  maxMemory?: number;
  /** Path to DuckDB-Wasm worker script */
  workerPath?: string;
  /** Enable query performance logging */
  enableLogging?: boolean;
  /** Custom logger */
  logger?: (message: string, level: "info" | "warn" | "error") => void;
}

export interface MemoryUsage {
  /** Currently used memory in bytes */
  used: number;
  /** Total memory limit in bytes */
  limit: number;
  /** Per-dataset breakdown */
  breakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Parquet Export Types
// ---------------------------------------------------------------------------

export type ParquetCompression = "uncompressed" | "snappy" | "gzip" | "brotli" | "lz4" | "zstd";

export interface ParquetExportConfig {
  dataSourceId: string;
  query: string;
  outputFileName: string;
  compression?: ParquetCompression;
  rowGroupSize?: number;
  maxFileSize?: number;
  enableStatistics?: boolean;
  enableDictionary?: boolean;
}

export interface ParquetExportResult {
  id: string;
  files: string[];
  rowCount: number;
  totalSize: number;
  compressionRatio: number;
  schema: Array<{ name: string; type: string }>;
  duration: number;
  createdAt: Date;
}

export interface ExportProgress {
  exportId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number; // 0-1
  rowsProcessed: number;
  totalRows?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Browser Capability Detection
// ---------------------------------------------------------------------------

export type ExecutionMode = "auto" | "server" | "client";
export type OutputFormat = "json" | "arrow" | "parquet";

export interface BrowserCapabilities {
  wasmSupported: boolean;
  sharedArrayBuffer: boolean;
  indexedDB: boolean;
  sufficientMemory: boolean;
}

// ---------------------------------------------------------------------------
// Error Codes & Presets (Constants)
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  UNAUTHORIZED: "AUTH_001",
  FORBIDDEN: "AUTH_002",
  SESSION_EXPIRED: "AUTH_003",
  VALIDATION_ERROR: "VAL_001",
  INVALID_SQL: "VAL_002",
  INVALID_FILTER: "VAL_003",
  DATASET_NOT_FOUND: "RES_001",
  DATA_SOURCE_NOT_FOUND: "RES_002",
  CHART_NOT_FOUND: "RES_003",
  EXPORT_FAILED: "OPS_001",
  QUERY_FAILED: "OPS_002",
  MEMORY_LIMIT_EXCEEDED: "OPS_003",
  RATE_LIMITED: "RT_001",
  INTERNAL_ERROR: "SRV_001",
  SERVICE_UNAVAILABLE: "SRV_002",
} as const;

export const PARQUET_PRESETS = {
  fast: {
    compression: "snappy" as ParquetCompression,
    rowGroupSize: 100_000,
    enableDictionary: true,
    enableStatistics: true,
  },
  balanced: {
    compression: "snappy" as ParquetCompression,
    rowGroupSize: 1_000_000,
    enableDictionary: true,
    enableStatistics: true,
  },
  compressed: {
    compression: "zstd" as ParquetCompression,
    rowGroupSize: 1_000_000,
    enableDictionary: true,
    enableStatistics: true,
  },
  timeSeries: {
    compression: "zstd" as ParquetCompression,
    rowGroupSize: 500_000,
    enableDictionary: false,
    enableStatistics: true,
  },
} as const;
