"use client";

/**
 * Universal ECharts chart renderer.
 * Replaces Recharts for canvas-based, high-performance charting.
 */

import {
  BarChart,
  BoxplotChart,
  CandlestickChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  MapChart,
  ParallelChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreemapChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  ParallelComponent as ParallelComp,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import type { EChartsConfig } from "@/types/charts";
import { buildChart } from "./ChartTypeFactory";
import { getBaseEChartsOption, getEChartsThemeColors } from "./ThemeAdapter";

// Register ECharts components (tree-shakeable)
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  HeatmapChart,
  TreemapChart,
  SunburstChart,
  SankeyChart,
  FunnelChart,
  GaugeChart,
  BoxplotChart,
  CandlestickChart,
  ParallelChart,
  MapChart,
  GraphChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
  TitleComponent,
  GeoComponent,
  ParallelComp,
  CanvasRenderer,
]);

interface EChartsRendererProps {
  /** Chart configuration */
  config: EChartsConfig;
  /** Data rows */
  data: Record<string, unknown>[];
  /** Chart height */
  height?: string | number;
  /** Enable zoom / dataZoom */
  enableZoom?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Error state */
  error?: Error | null;
  /** On chart click */
  onChartClick?: (params: { name?: string; value?: unknown; seriesName?: string }) => void;
}

export function EChartsRenderer({
  config,
  data,
  height = 400,
  enableZoom = false,
  loading = false,
  error,
  onChartClick,
}: EChartsRendererProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const option = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return {};

    const base = getBaseEChartsOption(isDark);
    const chart = buildChart(config, data);

    // Merge base theme, chart config, and user customOptions
    const merged = deepMerge(base, chart);

    // Apply title
    if (config.title) {
      merged.title = { ...(merged.title as object), text: config.title, subtext: config.subtitle };
    }

    // Apply colors
    merged.color = config.colors ?? getEChartsThemeColors();

    // Apply animation
    if (config.animation === false) {
      merged.animation = false;
    }

    // Apply dataZoom
    if (enableZoom) {
      merged.dataZoom = [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", start: 0, end: 100 },
      ];
    }

    // Merge custom options last
    if (config.customOptions) {
      return deepMerge(merged, config.customOptions);
    }

    return merged;
  }, [config, data, isDark, enableZoom]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-destructive p-4 text-sm text-destructive"
        style={{ height }}
      >
        {error.message}
      </div>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <div
        className="flex items-center justify-center rounded-md border text-sm text-muted-foreground"
        style={{ height }}
      >
        No data to display
      </div>
    );
  }

  const events = onChartClick
    ? {
        click: (params: { name?: string; value?: unknown; seriesName?: string }) => {
          onChartClick(params);
        },
      }
    : undefined;

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ height, width: "100%" }}
      showLoading={loading}
      onEvents={events}
      notMerge
      lazyUpdate
    />
  );
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
