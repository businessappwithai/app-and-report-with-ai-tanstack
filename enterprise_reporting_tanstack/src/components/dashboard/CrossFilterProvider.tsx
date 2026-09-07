"use client";

/**
 * Cross-filter provider for dashboard widgets.
 * Wraps the dashboard and enables linked filtering across widgets.
 */

import React from "react";
import type { CrossFilterConfig } from "@/types/filters";
import { DashboardStateProvider } from "./DashboardState";

interface CrossFilterProviderProps {
  dashboardId: string;
  widgets: Array<{
    id: string;
    type: "chart" | "table" | "metric";
    datasetId?: string;
    baseQuery?: string;
    filterableColumns?: string[];
    broadcastsFilters?: boolean;
  }>;
  children: React.ReactNode;
}

export function CrossFilterProvider({ dashboardId, widgets, children }: CrossFilterProviderProps) {
  // Build cross-filter config from widget definitions
  const config: CrossFilterConfig = React.useMemo(() => {
    return {
      dashboardId,
      widgets: widgets.map((w) => ({
        widgetId: w.id,
        type: w.type,
        datasetId: w.datasetId ?? "",
        baseQuery: w.baseQuery ?? "SELECT * FROM data",
        filterLinks: [], // Populated dynamically when filters are applied
        broadcastsFilters: w.broadcastsFilters ?? true,
        filterableColumns: w.filterableColumns,
      })),
    };
  }, [dashboardId, widgets]);

  return <DashboardStateProvider config={config}>{children}</DashboardStateProvider>;
}
