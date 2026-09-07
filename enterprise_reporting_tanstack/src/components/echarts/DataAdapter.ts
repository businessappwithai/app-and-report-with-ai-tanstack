/**
 * Data adapter: converts query result rows to ECharts data structures.
 */

import type { DataMapping } from "@/types/charts";

/**
 * Extract category (x-axis) values from rows using the data mapping.
 */
export function extractCategories(rows: Record<string, unknown>[], mapping: DataMapping): string[] {
  if (!Array.isArray(rows)) return [];
  const { x } = mapping;
  if (!x) return [];
  return rows.map((r) => String(r[x] ?? ""));
}

/**
 * Extract series values from rows.
 * Supports single y or multi-y columns.
 */
export function extractSeries(
  rows: Record<string, unknown>[],
  mapping: DataMapping
): { name: string; data: number[] }[] {
  if (!Array.isArray(rows)) return [];
  const yColumns = Array.isArray(mapping.y) ? mapping.y : mapping.y ? [mapping.y] : [];

  return yColumns.map((col) => ({
    name: col,
    data: rows.map((r) => Number(r[col] ?? 0)),
  }));
}

/**
 * Extract grouped series (for stacked/grouped charts).
 */
export function extractGroupedSeries(
  rows: Record<string, unknown>[],
  mapping: DataMapping
): { name: string; data: number[] }[] {
  if (!Array.isArray(rows)) return [];
  if (!mapping.group || !mapping.y) return extractSeries(rows, mapping);

  const yColumn = Array.isArray(mapping.y) ? mapping.y[0] : mapping.y;
  const groups = new Map<string, Map<string, number>>();
  const categories = new Set<string>();

  const xCol = mapping.x ?? "";
  for (const row of rows) {
    const groupVal = String(row[mapping.group] ?? "");
    const catVal = String(row[xCol] ?? "");
    const value = Number(row[yColumn] ?? 0);

    categories.add(catVal);
    if (!groups.has(groupVal)) groups.set(groupVal, new Map());
    const groupMap = groups.get(groupVal);
    if (groupMap) {
      const existing = groupMap.get(catVal) ?? 0;
      groupMap.set(catVal, existing + value);
    }
  }

  const catArray = Array.from(categories);
  return Array.from(groups.entries()).map(([name, valMap]) => ({
    name,
    data: catArray.map((cat) => valMap.get(cat) ?? 0),
  }));
}

/**
 * Extract scatter data (x, y pairs).
 */
export function extractScatterData(
  rows: Record<string, unknown>[],
  mapping: DataMapping
): [number, number][] {
  if (!Array.isArray(rows)) return [];
  const yColumn = Array.isArray(mapping.y) ? mapping.y[0] : (mapping.y ?? "");
  const xCol = mapping.x ?? "";
  return rows.map((r) => [Number(r[xCol] ?? 0), Number(r[yColumn] ?? 0)]);
}

/**
 * Extract pie data (name, value pairs).
 */
export function extractPieData(
  rows: Record<string, unknown>[],
  mapping: DataMapping
): { name: string; value: number }[] {
  if (!Array.isArray(rows)) return [];
  const yColumn = Array.isArray(mapping.y) ? mapping.y[0] : (mapping.y ?? "");
  const xCol = mapping.x ?? "";

  // If xCol is not configured or produces no values, fall back to the first
  // non-y column in the data that has string-like values.
  const effectiveXCol = (() => {
    if (xCol && rows.length > 0 && rows[0][xCol] !== undefined) return xCol;
    if (rows.length === 0) return xCol;
    const yCols = new Set(Array.isArray(mapping.y) ? mapping.y : mapping.y ? [mapping.y] : []);
    const fallback = Object.keys(rows[0]).find((k) => !yCols.has(k));
    return fallback ?? xCol;
  })();

  return rows.map((r, i) => ({
    name: String(r[effectiveXCol] ?? `Item ${i + 1}`),
    value: Number(r[yColumn] ?? 0),
  }));
}
