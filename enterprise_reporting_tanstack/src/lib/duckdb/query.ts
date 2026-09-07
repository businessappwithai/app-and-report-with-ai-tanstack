/**
 * DuckDB query execution utilities.
 */

import { createConnection } from "./instance";
import type { AsyncDuckDBConnection, DuckDBQueryResult } from "./types";

/**
 * Execute a SQL query against DuckDB-Wasm and return typed results.
 */
export async function executeQuery(
  sql: string,
  conn?: AsyncDuckDBConnection
): Promise<DuckDBQueryResult> {
  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  const start = performance.now();

  try {
    const arrowResult = await connection.query(sql);
    const executionTime = performance.now() - start;

    const schema = arrowResult.schema;
    const columns = schema.fields.map((f) => ({
      name: f.name,
      type: String(f.type),
    }));

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < arrowResult.numRows; i++) {
      const row: Record<string, unknown> = {};
      for (const field of schema.fields) {
        const col = arrowResult.getChild(field.name);
        row[field.name] = col?.get(i) ?? null;
      }
      rows.push(row);
    }

    return {
      rows,
      rowCount: arrowResult.numRows,
      columns,
      executionTime: Math.round(executionTime * 100) / 100,
    };
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}

/**
 * Execute a SQL query and return the raw Apache Arrow Table.
 */
export async function executeQueryArrow(sql: string, conn?: AsyncDuckDBConnection) {
  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  try {
    return await connection.query(sql);
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}

/**
 * Load a remote Parquet file into DuckDB as a named table.
 */
export async function loadParquetFromUrl(
  tableName: string,
  url: string,
  conn?: AsyncDuckDBConnection
): Promise<void> {
  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  try {
    await connection.query(
      `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${url}')`
    );
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}

/**
 * Register a Parquet file buffer and create a table from it.
 */
export async function loadParquetFromBuffer(
  tableName: string,
  buffer: Uint8Array,
  db: import("@duckdb/duckdb-wasm").AsyncDuckDB,
  conn?: AsyncDuckDBConnection
): Promise<void> {
  const fileName = `${tableName}.parquet`;
  await db.registerFileBuffer(fileName, buffer);

  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  try {
    await connection.query(
      `CREATE OR REPLACE TABLE "${tableName}" AS SELECT * FROM read_parquet('${fileName}')`
    );
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}

/**
 * Drop a table from DuckDB.
 */
export async function dropTable(tableName: string, conn?: AsyncDuckDBConnection): Promise<void> {
  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  try {
    await connection.query(`DROP TABLE IF EXISTS "${tableName}"`);
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}
