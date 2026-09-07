"use client";

import { EChartsRenderer } from "@/components/echarts/EChartsRenderer";
import { convertRechartsToECharts } from "@/components/echarts/RechartsCompatAdapter";
import type { ChartConfig, ChartType, DataMapping } from "@/types/database";

interface ChartRendererProps {
  data: Record<string, unknown>[];
  chartType: ChartType;
  chartConfig: ChartConfig | null | undefined;
  dataMapping: DataMapping | null | undefined;
  height?: number;
  /** Callback when user clicks on chart data (for cross-filtering) */
  onDataClick?: (data: { column?: string; field?: string; value: unknown }) => void;
}

/**
 * Universal chart renderer using ECharts.
 * Replaces Recharts for better performance and more features.
 */
export function ChartRenderer({
  data,
  chartType,
  chartConfig,
  dataMapping,
  height = 400,
  onDataClick,
}: ChartRendererProps) {
  // Convert Recharts-style config to ECharts config
  const echartsConfig = convertRechartsToECharts(chartType, chartConfig, dataMapping);

  return (
    <EChartsRenderer
      config={echartsConfig}
      data={data}
      height={height}
      onChartClick={(params) => {
        if (onDataClick) {
          // Extract column and value from ECharts click params
          const column = params.seriesName || dataMapping?.xAxis?.field;
          onDataClick({
            column,
            field: column,
            value: params.value,
          });
        }
      }}
    />
  );
}
