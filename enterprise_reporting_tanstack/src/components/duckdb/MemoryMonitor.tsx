"use client";

/**
 * Displays current DuckDB-Wasm memory usage with a progress bar.
 */

import { useDuckDB } from "./DuckDBProvider";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(1)} ${units[i]}`;
}

export function MemoryMonitor() {
  const { getMemoryUsage, status } = useDuckDB();

  if (status !== "ready") return null;

  const usage = getMemoryUsage();
  const pct = usage.limit > 0 ? (usage.used / usage.limit) * 100 : 0;
  const datasets = Object.entries(usage.breakdown);

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">Memory</span>
        <span className="text-tremor-content">
          {formatBytes(usage.used)} / {formatBytes(usage.limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* Per-dataset breakdown */}
      {datasets.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {datasets.map(([id, size]) => (
            <li key={id} className="flex justify-between">
              <span className="truncate">{id}</span>
              <span>{formatBytes(size)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
