import type { EChartsOption } from "echarts";
import type { EChartsConfig } from "@/types/charts";
import { extractCategories, extractSeries } from "../DataAdapter";

export function buildHeatmap(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const xCategories = extractCategories(rows, config.dataMapping);
  const uniqueX = [...new Set(xCategories)];
  const yCol = config.dataMapping.group ?? "";
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const uniqueY = [...new Set(rows.map((r) => String(r[yCol] ?? "")))];

  const data: [number, number, number][] = [];
  const xCol = config.dataMapping.x ?? "";
  for (const row of rows) {
    const xi = uniqueX.indexOf(String(row[xCol] ?? ""));
    const yi = uniqueY.indexOf(String(row[yCol] ?? ""));
    const val = Number(row[valueCol] ?? 0);
    if (xi >= 0 && yi >= 0) data.push([xi, yi, val]);
  }

  return {
    xAxis: { type: "category", data: uniqueX },
    yAxis: { type: "category", data: uniqueY },
    visualMap: {
      min: 0,
      max: Math.max(...data.map((d) => d[2]), 1),
      calculable: true,
      orient: "horizontal" as const,
      left: "center",
      bottom: "0%",
    },
    series: [{ type: "heatmap" as const, data, emphasis: { itemStyle: { shadowBlur: 10 } } }],
    tooltip: { trigger: "item" },
  };
}

export function buildTreemap(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const xCol = config.dataMapping.x ?? "";
  const data = rows.map((r) => ({
    name: String(r[xCol] ?? ""),
    value: Number(r[valueCol] ?? 0),
  }));

  return {
    series: [{ type: "treemap" as const, data }],
    tooltip: { trigger: "item" },
  };
}

export function buildSunburst(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const xCol = config.dataMapping.x ?? "";
  const data = rows.map((r) => ({
    name: String(r[xCol] ?? ""),
    value: Number(r[valueCol] ?? 0),
  }));

  return {
    series: [{ type: "sunburst" as const, data, radius: [0, "90%"] }],
    tooltip: { trigger: "item" },
  };
}

export function buildFunnel(config: EChartsConfig, rows: Record<string, unknown>[]): EChartsOption {
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const xCol = config.dataMapping.x ?? "";
  const data = rows.map((r) => ({
    name: String(r[xCol] ?? ""),
    value: Number(r[valueCol] ?? 0),
  }));

  return {
    series: [{ type: "funnel" as const, data, left: "10%", width: "80%" }],
    tooltip: { trigger: "item" },
  };
}

export function buildGauge(config: EChartsConfig, rows: Record<string, unknown>[]): EChartsOption {
  const series = extractSeries(rows, config.dataMapping);
  const value = series[0]?.data[0] ?? 0;

  return {
    series: [
      {
        type: "gauge" as const,
        detail: { formatter: "{value}" },
        data: [{ value, name: series[0]?.name ?? "Value" }],
      },
    ],
    tooltip: { trigger: "item" },
  };
}

export function buildSankey(config: EChartsConfig, rows: Record<string, unknown>[]): EChartsOption {
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const sourceCol = config.dataMapping.x ?? "";
  const targetCol = config.dataMapping.group ?? "";

  const nodesSet = new Set<string>();
  const links = rows.map((r) => {
    const source = String(r[sourceCol] ?? "");
    const target = String(r[targetCol] ?? "");
    nodesSet.add(source);
    nodesSet.add(target);
    return { source, target, value: Number(r[valueCol] ?? 0) };
  });

  return {
    series: [
      {
        type: "sankey" as const,
        data: Array.from(nodesSet).map((name) => ({ name })),
        links,
        emphasis: { focus: "adjacency" as const },
      },
    ],
    tooltip: { trigger: "item" },
  };
}
