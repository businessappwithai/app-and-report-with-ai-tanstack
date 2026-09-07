/**
 * Source database connector — executes queries against external data sources
 * and streams results for conversion to Parquet/Arrow.
 */

import { getDb } from "@/lib/db/config";

export interface SourceRow {
  [key: string]: unknown;
}

export interface SourceQueryResult {
  rows: SourceRow[];
  columns: { name: string; type: string }[];
  rowCount: number;
}

/**
 * Execute a query against a data source and return all rows.
 * Uses the config DB connection for now (SQLite data sources).
 */
export async function executeSourceQuery(
  dataSourceId: string,
  query: string
): Promise<SourceQueryResult> {
  const db = getDb();

  // Resolve the data source connection info
  const dataSource = await db
    .selectFrom("data_sources")
    .where("id", "=", dataSourceId)
    .selectAll()
    .executeTakeFirst();

  if (!dataSource) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }

  // For now we execute against the config DB (SQLite).
  // In production this would connect to the external source DB.
  const rows = await db.raw(query);

  // SQLite returns the rows directly as an array
  const resultRows: SourceRow[] = Array.isArray(rows) ? rows : [];

  const columns =
    resultRows.length > 0
      ? Object.keys(resultRows[0]).map((name) => ({
          name,
          type: typeof resultRows[0][name] === "number" ? "double" : "varchar",
        }))
      : [];

  return {
    rows: resultRows,
    columns,
    rowCount: resultRows.length,
  };
}

/**
 * Estimate the row count for a query (uses COUNT wrapper).
 */
export async function estimateRowCount(_dataSourceId: string, query: string): Promise<number> {
  const db = getDb();
  try {
    const result = await db.raw(`SELECT COUNT(*) as cnt FROM (${query}) AS _count_sub`);
    const rows = Array.isArray(result) ? result : [];
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}
