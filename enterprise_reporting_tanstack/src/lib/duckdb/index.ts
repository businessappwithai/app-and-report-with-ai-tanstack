/**
 * DuckDB-Wasm library — main exports.
 */

export { closeDuckDB, createConnection, getDuckDB, initDuckDB } from "./instance";
export { getMemoryManager, MemoryManager } from "./memory";
export {
  dropTable,
  executeQuery,
  executeQueryArrow,
  loadParquetFromBuffer,
  loadParquetFromUrl,
} from "./query";
export { getAllTableSchemas, getTableSchema, listTables } from "./schema";
export type { DuckDBInstanceOptions, DuckDBQueryResult, DuckDBTableInfo } from "./types";
export { DEFAULT_DUCKDB_OPTIONS } from "./types";
