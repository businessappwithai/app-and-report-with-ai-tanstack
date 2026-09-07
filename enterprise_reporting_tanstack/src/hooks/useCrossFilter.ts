"use client";

/**
 * Hook for managing cross-widget filtering on dashboards.
 */

import { nanoid } from "nanoid";
import { useCallback, useMemo, useState } from "react";
import type { ActiveFilter, CrossFilterConfig, WidgetFilterConfig } from "@/types/filters";

interface UseCrossFilterReturn {
  activeFilters: ActiveFilter[];
  applyFilter: (filter: Omit<ActiveFilter, "id" | "affectedWidgets">) => void;
  removeFilter: (filterId: string) => void;
  clearFilters: () => void;
  getFilteredQuery: (widgetId: string, baseQuery: string) => string;
}

export function useCrossFilter(config: CrossFilterConfig): UseCrossFilterReturn {
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Build a lookup of which widgets are affected by filters from each source
  const widgetMap = useMemo(() => {
    const map = new Map<string, WidgetFilterConfig>();
    for (const w of config.widgets) {
      map.set(w.widgetId, w);
    }
    return map;
  }, [config.widgets]);

  const applyFilter = useCallback(
    (filter: Omit<ActiveFilter, "id" | "affectedWidgets">) => {
      // Determine affected widgets
      const affected: string[] = [];
      for (const widget of config.widgets) {
        if (widget.widgetId === filter.sourceWidgetId) continue;
        for (const link of widget.filterLinks) {
          if (link.sourceWidgetId === filter.sourceWidgetId) {
            affected.push(widget.widgetId);
            break;
          }
        }
      }

      const newFilter: ActiveFilter = {
        id: nanoid(),
        ...filter,
        affectedWidgets: affected,
      };

      setActiveFilters((prev) => {
        // Replace existing filter from the same source on the same column
        const filtered = prev.filter(
          (f) => !(f.sourceWidgetId === filter.sourceWidgetId && f.column === filter.column)
        );
        return [...filtered, newFilter];
      });
    },
    [config.widgets]
  );

  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const getFilteredQuery = useCallback(
    (widgetId: string, baseQuery: string): string => {
      const widget = widgetMap.get(widgetId);
      if (!widget) return baseQuery;

      const clauses: string[] = [];

      for (const filter of activeFilters) {
        if (!filter.affectedWidgets.includes(widgetId)) continue;

        // Find the column mapping for this widget
        const link = widget.filterLinks.find((l) => l.sourceWidgetId === filter.sourceWidgetId);
        if (!link) continue;

        const targetColumn = link.columnMapping[filter.column] ?? filter.column;

        if (filter.operator === "eq" && filter.values.length === 1) {
          const val =
            typeof filter.values[0] === "string"
              ? `'${filter.values[0].replace(/'/g, "''")}'`
              : filter.values[0];
          clauses.push(`"${targetColumn}" = ${val}`);
        } else if (filter.operator === "in") {
          const vals = filter.values
            .map((v) => (typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v))
            .join(", ");
          clauses.push(`"${targetColumn}" IN (${vals})`);
        } else if (filter.operator === "range" && filter.values.length === 2) {
          clauses.push(`"${targetColumn}" BETWEEN ${filter.values[0]} AND ${filter.values[1]}`);
        }
      }

      if (clauses.length === 0) return baseQuery;

      const whereClause = clauses.join(" AND ");
      // Wrap the base query and apply filters
      return `SELECT * FROM (${baseQuery}) AS _sub WHERE ${whereClause}`;
    },
    [activeFilters, widgetMap]
  );

  return { activeFilters, applyFilter, removeFilter, clearFilters, getFilteredQuery };
}
