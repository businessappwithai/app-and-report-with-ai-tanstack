/**
 * Type definitions for chart configuration and ECharts integration.
 */

import type { ColumnSchema } from "./database";

export type ChartType =
  // Basic
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "doughnut"
  | "scatter"
  // Advanced
  | "heatmap"
  | "treemap"
  | "sunburst"
  | "sankey"
  | "funnel"
  | "gauge"
  // Geospatial
  | "map"
  | "geoScatter"
  // Relational
  | "graph"
  | "tree"
  // Statistical
  | "boxplot"
  | "candlestick"
  | "parallel"
  // 3D (optional)
  | "bar3d"
  | "scatter3d"
  | "surface3d";

export interface AxisConfig {
  type?: "category" | "value" | "time" | "log";
  name?: string;
  min?: number | string;
  max?: number | string;
  data?: string[];
}

export interface LegendConfig {
  data?: string[];
  orient?: "horizontal" | "vertical";
  left?: string | number;
  top?: string | number;
}

export interface TooltipConfig {
  trigger?: "item" | "axis" | "none";
  formatter?: string;
}

export interface AnimationConfig {
  duration?: number;
  easing?: string;
}

export interface DataMapping {
  /** Column for x-axis / category */
  x?: string;
  /** Column(s) for y-axis / value */
  y?: string | string[];
  /** Column for color encoding */
  color?: string;
  /** Column for size encoding */
  size?: string;
  /** Column for grouping (series) */
  group?: string;
  /** Aggregation function */
  aggregation?: "sum" | "avg" | "count" | "min" | "max" | "none";
}

export interface EChartsConfig {
  type: ChartType;
  title?: string;
  subtitle?: string;
  width?: string | number;
  height?: string | number;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  colors?: string[];
  /** Per-series colors (maps to series order) */
  seriesColors?: string[];
  legend?: boolean | LegendConfig;
  tooltip?: boolean | TooltipConfig;
  dataMapping: DataMapping;
  customOptions?: Record<string, unknown>;
  animation?: boolean | AnimationConfig;
}

export interface TableFilterState {
  columnId: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "startsWith" | "in" | "notIn";
  value: unknown;
}

export interface TableSortState {
  columnId: string;
  direction: "asc" | "desc";
}
