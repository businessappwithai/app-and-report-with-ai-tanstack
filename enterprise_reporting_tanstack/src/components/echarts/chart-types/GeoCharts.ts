import type { EChartsOption } from "echarts";
import type { EChartsConfig } from "@/types/charts";

export function buildMap(config: EChartsConfig, rows: Record<string, unknown>[]): EChartsOption {
  const valueCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const xCol = config.dataMapping.x ?? "";

  const data = rows.map((r) => ({
    name: String(r[xCol] ?? ""),
    value: Number(r[valueCol] ?? 0),
  }));

  const values = data.map((d) => d.value);

  return {
    visualMap: {
      min: Math.min(...values, 0),
      max: Math.max(...values, 1),
      calculable: true,
      left: "left",
      top: "bottom",
    },
    series: [
      {
        type: "map" as const,
        map: "world",
        roam: true,
        data,
        emphasis: { label: { show: true } },
      },
    ],
    tooltip: { trigger: "item" },
  };
}

export function buildGeoScatter(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const lonCol = config.dataMapping.x ?? "";
  const latCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");
  const sizeCol = config.dataMapping.size;

  const data = rows.map((r) => ({
    name: String(r[config.dataMapping.group ?? ""] ?? ""),
    value: [Number(r[lonCol] ?? 0), Number(r[latCol] ?? 0), sizeCol ? Number(r[sizeCol] ?? 1) : 1],
  }));

  return {
    geo: { map: "world", roam: true },
    series: [
      {
        type: "scatter" as const,
        coordinateSystem: "geo",
        data,
        symbolSize: (val: number[]) => Math.max(val[2] ?? 4, 4),
      },
    ],
    tooltip: { trigger: "item" },
  };
}
