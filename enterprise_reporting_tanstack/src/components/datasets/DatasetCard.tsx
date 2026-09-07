"use client";

/**
 * Card component displaying a single dataset's info and actions.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetInfo } from "@/types/datasets";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface DatasetCardProps {
  dataset: DatasetInfo;
  onRefresh?: (id: string) => void;
  onUnload?: (id: string) => void;
  onLoad?: (id: string) => void;
}

export function DatasetCard({ dataset, onRefresh, onUnload, onLoad }: DatasetCardProps) {
  const isLoaded = dataset.memorySize > 0;
  const statusColor =
    dataset.cacheStatus === "cached"
      ? "bg-emerald-500"
      : dataset.cacheStatus === "stale"
        ? "bg-amber-500"
        : "bg-gray-400";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{dataset.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isLoaded ? "default" : "secondary"}>
              {isLoaded ? "Loaded" : dataset.cacheStatus === "cached" ? "Cached" : "Not loaded"}
            </Badge>
            <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Rows: {formatNumber(dataset.rowCount)}</span>
          <span>Size: {formatBytes(dataset.fileSize)}</span>
          {isLoaded && <span>Memory: {formatBytes(dataset.memorySize)}</span>}
        </div>

        {/* Schema preview */}
        {dataset.schema.length > 0 && (
          <div className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            schema: [{dataset.schema.map((c) => c.name).join(", ")}]
          </div>
        )}

        {/* Loading progress */}
        {dataset.isLoading && dataset.loadProgress !== undefined && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round(dataset.loadProgress * 100)}%` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isLoaded ? (
            <>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={() => onRefresh(dataset.id)}>
                  Refresh
                </Button>
              )}
              {onUnload && (
                <Button variant="outline" size="sm" onClick={() => onUnload(dataset.id)}>
                  Unload
                </Button>
              )}
            </>
          ) : (
            onLoad && (
              <Button variant="outline" size="sm" onClick={() => onLoad(dataset.id)}>
                Load
              </Button>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
