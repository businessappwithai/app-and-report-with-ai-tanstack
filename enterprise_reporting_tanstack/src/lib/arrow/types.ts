/**
 * Arrow/Parquet type definitions and SQL-to-Arrow type mappings.
 */

import * as Arrow from "apache-arrow";

/** Map of SQL type names to Arrow DataType instances. */
export const SQL_TO_ARROW_TYPE: Record<string, Arrow.DataType> = {
  // Integer types
  tinyint: new Arrow.Int8(),
  smallint: new Arrow.Int16(),
  int: new Arrow.Int32(),
  integer: new Arrow.Int32(),
  bigint: new Arrow.Int64(),

  // Floating point
  float: new Arrow.Float32(),
  double: new Arrow.Float64(),
  real: new Arrow.Float32(),

  // String / Binary
  varchar: new Arrow.Utf8(),
  char: new Arrow.Utf8(),
  text: new Arrow.Utf8(),

  // Boolean
  boolean: new Arrow.Bool(),
  bool: new Arrow.Bool(),

  // Date / Time
  date: new Arrow.DateDay(),
  datetime: new Arrow.TimestampMillisecond(),
  timestamp: new Arrow.TimestampMillisecond(),

  // JSON stored as string
  json: new Arrow.Utf8(),

  // Null
  null: new Arrow.Null(),
};

/**
 * Resolve an Arrow DataType for a given SQL type string.
 * Falls back to Utf8 for unknown types.
 */
export function resolveArrowType(sqlType: string): Arrow.DataType {
  const normalised = sqlType.toLowerCase().trim();
  return SQL_TO_ARROW_TYPE[normalised] ?? new Arrow.Utf8();
}

export type { Field as ArrowField, Schema as ArrowSchema, Table as ArrowTable } from "apache-arrow";
