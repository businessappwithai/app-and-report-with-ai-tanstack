"use client";

/**
 * Hook for searching collections with instant client-side results
 * Phase 4: Enables instant search on reports/charts/dashboards lists
 *
 * Syncs entire collection from server, provides fast local searching
 * without network latency on each keystroke.
 */

import { useEffect, useState, useCallback, useMemo } from "react";

export interface SearchOptions<T> {
  searchFields: (keyof T)[];
  onLoadComplete?: () => void;
  maxResults?: number;
}

/**
 * Hook for searching items in a collection
 * All data loaded from collection, search is instant
 */
export function useCollectionSearch<T extends { id: string }>(
  items: T[],
  options: SearchOptions<T>
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Perform search on items
  const results = useMemo(() => {
    if (!searchQuery.trim()) {
      return items.slice(0, options.maxResults || 50);
    }

    const query = searchQuery.toLowerCase();
    const filtered = items.filter((item) => {
      for (const field of options.searchFields) {
        const value = item[field];
        if (value && String(value).toLowerCase().includes(query)) {
          return true;
        }
      }
      return false;
    });

    return filtered.slice(0, options.maxResults || 50);
  }, [items, searchQuery, options.searchFields, options.maxResults]);

  return {
    searchQuery,
    setSearchQuery,
    results,
    isLoading,
    resultCount: results.length,
  };
}

/**
 * Phase 4 specific: Hook for searching reports
 */
export function useReportsSearch(reports: any[]) {
  return useCollectionSearch(reports, {
    searchFields: ["name", "description"],
    maxResults: 50,
  });
}

/**
 * Phase 4 specific: Hook for searching charts
 */
export function useChartsSearch(charts: any[]) {
  return useCollectionSearch(charts, {
    searchFields: ["name", "description", "chartType"],
    maxResults: 50,
  });
}

/**
 * Phase 4 specific: Hook for searching dashboards
 */
export function useDashboardsSearch(dashboards: any[]) {
  return useCollectionSearch(dashboards, {
    searchFields: ["name", "description"],
    maxResults: 50,
  });
}
