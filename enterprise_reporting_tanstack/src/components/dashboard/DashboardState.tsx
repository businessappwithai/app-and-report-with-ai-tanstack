"use client";

/**
 * Dashboard state management context for WASM-enhanced dashboards.
 * Tracks loaded datasets, active filters (via TanStack DB), and widget states.
 */

import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useCrossFilterDB } from "@/hooks/useCrossFilterDB";
import type { ActiveFilter, CrossFilterConfig } from "@/types/filters";

interface DashboardStateValue {
  /** Cross-filter state */
  activeFilters: ActiveFilter[];
  applyFilter: (filter: Omit<ActiveFilter, "id" | "affectedWidgets">) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;
  getFilteredQuery: (widgetId: string, baseQuery: string) => string;
  /** Loaded dataset IDs per widget */
  widgetDatasets: Record<string, string>;
  setWidgetDataset: (widgetId: string, datasetId: string) => void;
}

const DashboardStateContext = createContext<DashboardStateValue | null>(null);

interface DashboardStateProviderProps {
  config: CrossFilterConfig;
  children: React.ReactNode;
}

export function DashboardStateProvider({ config, children }: DashboardStateProviderProps) {
  const { activeFilters, applyFilter, removeFilter, clearFilters, getFilteredQuery } =
    useCrossFilterDB(config);
  const [widgetDatasets, setWidgetDatasets] = useState<Record<string, string>>({});

  const setWidgetDataset = useCallback((widgetId: string, datasetId: string) => {
    setWidgetDatasets((prev) => ({ ...prev, [widgetId]: datasetId }));
  }, []);

  const value = useMemo<DashboardStateValue>(
    () => ({
      activeFilters,
      applyFilter,
      removeFilter,
      clearFilters,
      getFilteredQuery,
      widgetDatasets,
      setWidgetDataset,
    }),
    [
      activeFilters,
      applyFilter,
      removeFilter,
      clearFilters,
      getFilteredQuery,
      widgetDatasets,
      setWidgetDataset,
    ]
  );

  return <DashboardStateContext.Provider value={value}>{children}</DashboardStateContext.Provider>;
}

export function useDashboardState(): DashboardStateValue {
  const ctx = useContext(DashboardStateContext);
  if (!ctx) {
    throw new Error("useDashboardState must be used within a DashboardStateProvider");
  }
  return ctx;
}
