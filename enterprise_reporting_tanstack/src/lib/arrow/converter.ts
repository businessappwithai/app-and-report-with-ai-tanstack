/**
 * Conversion utilities between JS objects and Apache Arrow tables.
 */

import * as Arrow from "apache-arrow";
import { resolveArrowType } from "./types";

/**
 * Convert an array of plain JS objects to an Arrow Table.
 * Infers schema from the first row unless explicit types are provided.
 */
export function objectsToArrow(
  rows: Record<string, unknown>[],
  columnTypes?: Record<string, string>
): Arrow.Table {
  if (rows.length === 0) {
    return Arrow.tableFromArrays({});
  }

  const firstRow = rows[0];
  const columns: Record<string, unknown[]> = {};

  for (const key of Object.keys(firstRow)) {
    columns[key] = rows.map((r) => r[key] ?? null);
  }

  // If explicit types are provided, build typed vectors
  if (columnTypes) {
    const fields: Arrow.Field[] = [];
    const batches: Arrow.Vector[] = [];

    for (const [name, values] of Object.entries(columns)) {
      const sqlType = columnTypes[name] ?? "text";
      const arrowType = resolveArrowType(sqlType);
      fields.push(new Arrow.Field(name, arrowType, true));
      batches.push(Arrow.vectorFromArray(values));
    }

    return new Arrow.Table(fields.map((f, i) => ({ field: f, vector: batches[i] })));
  }

  // Auto-infer from JS types
  return Arrow.tableFromArrays(columns);
}

/**
 * Convert an Arrow Table back to an array of plain JS objects.
 */
export function arrowToObjects(table: Arrow.Table): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (let i = 0; i < table.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      const col = table.getChild(field.name);
      row[field.name] = col?.get(i) ?? null;
    }
    result.push(row);
  }

  return result;
}

/**
 * Extract column names from an Arrow table.
 */
export function getColumnNames(table: Arrow.Table): string[] {
  return table.schema.fields.map((f) => f.name);
}

/**
 * Get a column's values as a JS array.
 */
export function getColumnValues(table: Arrow.Table, columnName: string): unknown[] {
  const col = table.getChild(columnName);
  if (!col) return [];
  return col.toArray() as unknown[];
}
