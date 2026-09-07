"use client";

/**
 * Main dataset manager component.
 * Shows loaded datasets, memory usage, and actions.
 */

import { MemoryMonitor } from "@/components/duckdb/MemoryMonitor";
import { Button } from "@/components/ui/button";
import type { DatasetInfo } from "@/types/datasets";
import { DatasetCard } from "./DatasetCard";

interface DatasetManagerProps {
  datasets: DatasetInfo[];
  onLoad?: (id: string) => void;
  onUnload?: (id: string) => void;
  onRefresh?: (id: string) => void;
  onClearCache?: () => void;
  showMemoryMonitor?: boolean;
}

export function DatasetManager({
  datasets,
  onLoad,
  onUnload,
  onRefresh,
  onClearCache,
  showMemoryMonitor = true,
}: DatasetManagerProps) {
  return (
    <div className="space-y-4">
      {/* Memory monitor */}
      {showMemoryMonitor && <MemoryMonitor />}

      {/* Action bar */}
      <div className="flex items-center gap-2">
        {onClearCache && (
          <Button variant="outline" size="sm" onClick={onClearCache}>
            Clear Cache
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Dataset cards */}
      {datasets.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No datasets loaded. Use the SQL editor or reports to load data.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {datasets.map((ds) => (
            <DatasetCard
              key={ds.id}
              dataset={ds}
              onLoad={onLoad}
              onUnload={onUnload}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
