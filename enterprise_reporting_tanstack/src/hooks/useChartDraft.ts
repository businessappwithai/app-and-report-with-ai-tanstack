"use client";

/**
 * Hook for managing chart draft state with TanStack DB
 * Provides optimistic updates with instant preview
 *
 * Used in chart editor for live preview as user edits
 */

import { useEffect, useCallback, useState } from "react";
import { chartDraftCollection } from "@/lib/tanstack-db/collections";
import type { ChartConfig, ChartType, DataMapping } from "@/types/database";

export interface ChartDraft {
  id: string;
  name: string;
  description: string;
  chartType: ChartType;
  chartConfig: ChartConfig;
  dataMapping: DataMapping;
  savedQueryId: string;
  lastEditedAt: string;
}

/**
 * Hook to manage chart draft with TanStack DB
 * Automatically persists changes via ElectricSQL
 */
export function useChartDraft(chartId: string) {
  const [draft, setDraft] = useState<Partial<ChartDraft> | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load draft from collection on mount
  useEffect(() => {
    const subscription = chartDraftCollection.subscribeChanges(
      (changes) => {
        for (const change of changes) {
          if (change.key === chartId) {
            if (change.type === "INSERT") {
              setDraft(change.value);
            } else if (change.type === "DELETE") {
              setDraft(null);
            }
          }
        }
      },
      { includeInitialState: true }
    );

    return () => subscription.unsubscribe();
  }, [chartId]);

  /**
   * Initialize a new draft
   * Creates entry in collection
   */
  const createDraft = useCallback(
    async (initial: Partial<ChartDraft>) => {
      const newDraft: ChartDraft = {
        id: chartId,
        name: initial.name || "",
        description: initial.description || "",
        chartType: initial.chartType || "bar",
        chartConfig: initial.chartConfig || {
          title: { show: true, text: "" },
          legend: { show: true, position: "bottom" },
          tooltip: { enabled: true },
          animation: true,
          stacked: false,
          colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
        },
        dataMapping: initial.dataMapping || {
          xAxis: { field: "", label: "" },
          yAxis: [],
          groupBy: "",
          colorBy: "",
        },
        savedQueryId: initial.savedQueryId || "",
        lastEditedAt: new Date().toISOString(),
      };

      try {
        setIsSyncing(true);
        await chartDraftCollection.insert(newDraft);
        setDraft(newDraft);
      } finally {
        setIsSyncing(false);
      }
    },
    [chartId]
  );

  /**
   * Update draft field and persist to collection
   * Changes appear instantly in preview
   */
  const updateDraft = useCallback(
    async (updates: Partial<ChartDraft>) => {
      try {
        setIsSyncing(true);
        // Optimistic update
        setDraft((prev) => (prev ? { ...prev, ...updates } : updates));

        // Persist to collection
        await chartDraftCollection.update(chartId, (current) => ({
          ...current,
          ...updates,
          lastEditedAt: new Date().toISOString(),
        }));
      } finally {
        setIsSyncing(false);
      }
    },
    [chartId]
  );

  /**
   * Convenience methods for individual field updates
   */
  const updateName = useCallback((name: string) => updateDraft({ name }), [updateDraft]);

  const updateDescription = useCallback(
    (description: string) => updateDraft({ description }),
    [updateDraft]
  );

  const updateChartType = useCallback(
    (chartType: ChartType) => updateDraft({ chartType }),
    [updateDraft]
  );

  const updateChartConfig = useCallback(
    (chartConfig: ChartConfig) => updateDraft({ chartConfig }),
    [updateDraft]
  );

  const updateDataMapping = useCallback(
    (dataMapping: DataMapping) => updateDraft({ dataMapping }),
    [updateDraft]
  );

  const updateSavedQueryId = useCallback(
    (savedQueryId: string) => updateDraft({ savedQueryId }),
    [updateDraft]
  );

  /**
   * Discard draft (remove from collection)
   * Called when user clicks cancel/discard
   */
  const discardDraft = useCallback(async () => {
    try {
      setIsSyncing(true);
      await chartDraftCollection.delete(chartId);
      setDraft(null);
    } finally {
      setIsSyncing(false);
    }
  }, [chartId]);

  /**
   * Get current draft data
   * Returns empty defaults if no draft loaded yet
   */
  const getDraftData = useCallback(() => {
    return (
      draft || {
        id: chartId,
        name: "",
        description: "",
        chartType: "bar" as ChartType,
        chartConfig: {
          title: { show: true, text: "" },
          legend: { show: true, position: "bottom" as const },
          tooltip: { enabled: true },
          animation: true,
          stacked: false,
          colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
        },
        dataMapping: {
          xAxis: { field: "", label: "" },
          yAxis: [],
          groupBy: "",
          colorBy: "",
        },
        savedQueryId: "",
        lastEditedAt: new Date().toISOString(),
      }
    );
  }, [draft, chartId]);

  return {
    draft: getDraftData(),
    isDraft: draft !== null,
    isSyncing,
    createDraft,
    updateDraft,
    updateName,
    updateDescription,
    updateChartType,
    updateChartConfig,
    updateDataMapping,
    updateSavedQueryId,
    discardDraft,
  };
}
