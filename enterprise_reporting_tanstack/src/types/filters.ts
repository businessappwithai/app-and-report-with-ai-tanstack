/**
 * Type definitions for cross-widget filtering and filter linkage.
 */

export interface FilterLink {
  sourceWidgetId: string;
  columnMapping: Record<string, string>;
  operator?: "eq" | "in" | "range";
}

export interface WidgetFilterConfig {
  widgetId: string;
  type: "chart" | "table" | "metric";
  datasetId: string;
  baseQuery: string;
  filterLinks: FilterLink[];
  broadcastsFilters?: boolean;
  filterableColumns?: string[];
}

export interface ActiveFilter {
  id: string;
  sourceWidgetId: string;
  column: string;
  values: unknown[];
  operator: "eq" | "in" | "range";
  affectedWidgets: string[];
}

export interface CrossFilterConfig {
  dashboardId: string;
  widgets: WidgetFilterConfig[];
}
