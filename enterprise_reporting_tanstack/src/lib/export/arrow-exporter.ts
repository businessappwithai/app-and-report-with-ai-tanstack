/**
 * Server-side Arrow IPC export.
 * Converts query results into Arrow IPC format for streaming to clients.
 */

import * as Arrow from "apache-arrow";
import type { SourceRow } from "./source-connector";

/**
 * Convert an array of row objects to an Arrow IPC buffer (stream format).
 */
export function rowsToArrowIPC(
  rows: SourceRow[],
  columnMeta?: { name: string; type: string }[]
): Uint8Array {
  if (rows.length === 0) {
    const emptyTable = Arrow.tableFromArrays({});
    return Arrow.tableToIPC(emptyTable, "stream");
  }

  // Build column arrays
  const columns: Record<string, unknown[]> = {};
  const keys = columnMeta ? columnMeta.map((c) => c.name) : Object.keys(rows[0]);

  for (const key of keys) {
    columns[key] = rows.map((r) => r[key] ?? null);
  }

  const table = Arrow.tableFromArrays(columns);
  return Arrow.tableToIPC(table, "stream");
}

/**
 * Convert rows to Arrow IPC file format.
 */
export function rowsToArrowFile(
  rows: SourceRow[],
  columnMeta?: { name: string; type: string }[]
): Uint8Array {
  if (rows.length === 0) {
    const emptyTable = Arrow.tableFromArrays({});
    return Arrow.tableToIPC(emptyTable, "file");
  }

  const columns: Record<string, unknown[]> = {};
  const keys = columnMeta ? columnMeta.map((c) => c.name) : Object.keys(rows[0]);

  for (const key of keys) {
    columns[key] = rows.map((r) => r[key] ?? null);
  }

  const table = Arrow.tableFromArrays(columns);
  return Arrow.tableToIPC(table, "file");
}
