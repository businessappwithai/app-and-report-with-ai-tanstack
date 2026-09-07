"use client";

/**
 * Unified widget renderer that supports both legacy and WASM rendering.
 * Dispatches to ECharts (charts), DataTable (tables), or metric display.
 */

import { EChartsRenderer } from "@/components/echarts/EChartsRenderer";
import { DataTable } from "@/components/reporting/DataTable";
import type { ColumnSchema } from "@/types/database";
import type { EChartsConfig } from "@/types/charts";

interface WidgetRendererProps {
  type: "chart" | "table" | "metric";
  /** ECharts config (for chart type) */
  chartConfig?: EChartsConfig;
  /** Data rows */
  data: Record<string, unknown>[];
  /** Column schema (for table type) */
  columns?: ColumnSchema[];
  /** Widget height */
  height?: number;
  /** On chart click (for cross-filtering) */
  onChartClick?: (params: { name?: string; value?: unknown; seriesName?: string }) => void;
}

export function WidgetRenderer({
  type,
  chartConfig,
  data,
  columns,
  height = 300,
  onChartClick,
}: WidgetRendererProps) {
  switch (type) {
    case "chart":
      if (!chartConfig) {
        return (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            No chart configuration
          </div>
        );
      }
      return (
        <EChartsRenderer
          config={chartConfig}
          data={data}
          height={height}
          onChartClick={onChartClick}
        />
      );

    case "table":
      return (
        <DataTable
          data={data}
          columns={
            columns ||
            Object.keys(data[0] || {}).map((key) => ({
              name: key,
              type: "text",
              nullable: true,
            }))
          }
          pageSize={50}
          sortable={true}
          filterable={true}
        />
      );

    case "metric": {
      // Simple metric display: show the first value prominently
      const value = data.length > 0 ? Object.values(data[0])[0] : "N/A";
      return (
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <span className="text-4xl font-bold">{String(value)}</span>
        </div>
      );
    }

    default:
      return (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height }}
        >
          Unknown widget type: {type}
        </div>
      );
  }
}
