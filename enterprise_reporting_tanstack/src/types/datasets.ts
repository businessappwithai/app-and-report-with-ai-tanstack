/**
 * Type definitions for dataset management and metadata.
 */

import type { ColumnSchema } from "./database";

export type DatasetCacheStatus = "not-cached" | "cached" | "stale";
export type DatasetStatus = "pending" | "ready" | "error";

export interface DatasetInfo {
  id: string;
  name: string;
  description?: string | null;
  dataSourceId: string;
  dataSourceName?: string;
  tableName: string;
  query?: string;
  rowCount: number;
  fileSize: number;
  compressedSize?: number;
  memorySize: number;
  schema: ColumnSchema[];
  loadedAt?: Date;
  refreshedAt?: Date;
  cacheStatus: DatasetCacheStatus;
  isLoading: boolean;
  loadProgress?: number;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string | null;
  downloadUrl?: string;
  status?: DatasetStatus;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  description: string | null;
  dataSourceId: string;
  dataSourceName: string;
  rowCount: number;
  fileSize: number;
  compressedSize: number;
  columns: ColumnSchema[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  downloadUrl: string;
  isCached: boolean;
}
