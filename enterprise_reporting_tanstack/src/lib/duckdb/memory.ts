/**
 * DuckDB memory monitoring and management.
 * Implements LRU eviction for loaded datasets.
 */

import type { MemoryUsage } from "@/types/wasm";

interface DatasetEntry {
  size: number;
  lastAccessed: number;
}

export class MemoryManager {
  private limit: number;
  private datasets: Map<string, DatasetEntry> = new Map();

  constructor(limit: number = 2 * 1024 * 1024 * 1024 /* 2 GB */) {
    this.limit = limit;
  }

  /** Get current total memory usage in bytes. */
  getCurrentUsage(): number {
    let total = 0;
    for (const entry of this.datasets.values()) {
      total += entry.size;
    }
    return total;
  }

  /** Check if a new dataset of the given size can be loaded. */
  canAdd(estimatedSize: number): boolean {
    return this.getCurrentUsage() + estimatedSize <= this.limit;
  }

  /** Register a loaded dataset. */
  register(datasetId: string, size: number): void {
    this.datasets.set(datasetId, {
      size,
      lastAccessed: Date.now(),
    });
  }

  /** Mark a dataset as recently accessed. */
  touch(datasetId: string): void {
    const entry = this.datasets.get(datasetId);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /** Unregister a dataset (after unloading). */
  unregister(datasetId: string): void {
    this.datasets.delete(datasetId);
  }

  /** Get memory used by a specific dataset. */
  getDatasetUsage(datasetId: string): number {
    return this.datasets.get(datasetId)?.size ?? 0;
  }

  /**
   * Find the least-recently-used dataset for eviction.
   * Returns null if no datasets are loaded.
   */
  evictLRU(): string | null {
    let lruId: string | null = null;
    let oldest = Infinity;

    for (const [id, entry] of this.datasets) {
      if (entry.lastAccessed < oldest) {
        oldest = entry.lastAccessed;
        lruId = id;
      }
    }

    return lruId;
  }

  /** Get full memory usage breakdown. */
  getUsage(): MemoryUsage {
    const breakdown: Record<string, number> = {};
    for (const [id, entry] of this.datasets) {
      breakdown[id] = entry.size;
    }
    return {
      used: this.getCurrentUsage(),
      limit: this.limit,
      breakdown,
    };
  }

  /** Set a new memory limit. */
  setLimit(limit: number): void {
    this.limit = limit;
  }

  /** Get the number of loaded datasets. */
  getDatasetCount(): number {
    return this.datasets.size;
  }
}

/** Singleton memory manager. */
let memoryManagerInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}
