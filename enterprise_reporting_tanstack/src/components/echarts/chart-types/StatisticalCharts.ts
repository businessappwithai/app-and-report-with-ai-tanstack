import type { EChartsOption } from "echarts";
import type { EChartsConfig } from "@/types/charts";
import { extractCategories } from "../DataAdapter";

export function buildBoxplot(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const categories = extractCategories(rows, config.dataMapping);
  const uniqueCats = [...new Set(categories)];
  const yCol = Array.isArray(config.dataMapping.y)
    ? config.dataMapping.y[0]
    : (config.dataMapping.y ?? "");

  const grouped = new Map<string, number[]>();
  const xCol = config.dataMapping.x ?? "";
  for (const row of rows) {
    const cat = String(row[xCol] ?? "");
    const val = Number(row[yCol] ?? 0);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)?.push(val);
  }

  const data = uniqueCats.map((cat) => {
    const vals = (grouped.get(cat) ?? []).sort((a, b) => a - b);
    if (vals.length === 0) return [0, 0, 0, 0, 0];
    const q = (p: number) => {
      const pos = (vals.length - 1) * p;
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      return vals[lo] + (vals[hi] - vals[lo]) * (pos - lo);
    };
    return [vals[0], q(0.25), q(0.5), q(0.75), vals[vals.length - 1]];
  });

  return {
    xAxis: { type: "category", data: uniqueCats },
    yAxis: { type: "value" },
    series: [{ type: "boxplot" as const, data }],
    tooltip: { trigger: "item" },
  };
}

export function buildCandlestick(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const categories = extractCategories(rows, config.dataMapping);
  const yCols = Array.isArray(config.dataMapping.y) ? config.dataMapping.y : [];

  const data = rows.map((r) => yCols.map((col) => Number(r[col] ?? 0)));

  return {
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: [{ type: "candlestick" as const, data }],
    tooltip: { trigger: "axis" },
  };
}

export function buildParallel(
  config: EChartsConfig,
  rows: Record<string, unknown>[]
): EChartsOption {
  const yCols = Array.isArray(config.dataMapping.y) ? config.dataMapping.y : [];
  const allCols = config.dataMapping.x ? [config.dataMapping.x, ...yCols] : yCols;

  const parallelAxis = allCols.map((col, i) => ({
    dim: i,
    name: col,
  }));

  const data = rows.map((r) => allCols.map((col) => Number(r[col] ?? 0)));

  return {
    parallelAxis,
    series: [{ type: "parallel" as const, data }],
    tooltip: { trigger: "item" },
  };
}
