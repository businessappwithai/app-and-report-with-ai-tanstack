/**
 * DuckDB schema introspection utilities.
 */

import { createConnection } from "./instance";
import { executeQuery } from "./query";
import type { AsyncDuckDBConnection, DuckDBTableInfo } from "./types";

/**
 * List all user tables currently loaded in DuckDB.
 */
export async function listTables(conn?: AsyncDuckDBConnection): Promise<string[]> {
  const result = await executeQuery(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'main'
     ORDER BY table_name`,
    conn
  );
  return result.rows.map((r) => String(r.table_name));
}

/**
 * Get schema information for a specific table.
 */
export async function getTableSchema(
  tableName: string,
  conn?: AsyncDuckDBConnection
): Promise<DuckDBTableInfo> {
  const ownConnection = !conn;
  const connection = conn ?? (await createConnection());

  try {
    const columnsResult = await executeQuery(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = '${tableName}' AND table_schema = 'main'
       ORDER BY ordinal_position`,
      connection
    );

    const countResult = await executeQuery(
      `SELECT COUNT(*) as cnt FROM "${tableName}"`,
      connection
    );

    return {
      name: tableName,
      columns: columnsResult.rows.map((r) => ({
        name: String(r.column_name),
        type: String(r.data_type),
        nullable: r.is_nullable === "YES",
      })),
      rowCount: Number(countResult.rows[0]?.cnt ?? 0),
    };
  } finally {
    if (ownConnection) {
      await connection.close();
    }
  }
}

/**
 * Get schema info for all tables.
 */
export async function getAllTableSchemas(conn?: AsyncDuckDBConnection): Promise<DuckDBTableInfo[]> {
  const tables = await listTables(conn);
  const schemas: DuckDBTableInfo[] = [];
  for (const table of tables) {
    schemas.push(await getTableSchema(table, conn));
  }
  return schemas;
}
