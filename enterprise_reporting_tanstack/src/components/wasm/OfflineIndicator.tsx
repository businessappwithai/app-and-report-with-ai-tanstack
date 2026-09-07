"use client";

/**
 * Offline indicator component.
 * Shows whether the app is offline/online and displays cached data status.
 */

import { Database, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useDataset } from "@/hooks/useDataset";
import { isFeatureEnabled } from "@/lib/feature-flags";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const { datasets } = useDataset();
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Count cached datasets
    const countCached = async () => {
      try {
        const { keys } = await import("idb-keyval");
        const allKeys = await keys();
        const parquetKeys = allKeys.filter(
          (k) => typeof k === "string" && k.startsWith("parquet_")
        );
        setCachedCount(parquetKeys.length);
      } catch {
        // IndexedDB not available
      }
    };

    countCached();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isFeatureEnabled("offlineEnabled")) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/30 border-b text-xs">
      <div className="flex items-center gap-1.5">
        {isOnline ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">Offline</span>
          </>
        )}
      </div>
      {cachedCount > 0 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>
            {cachedCount} cached dataset{cachedCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      {!isOnline && datasets.length === 0 && (
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          No cached data available
        </Badge>
      )}
    </div>
  );
}
