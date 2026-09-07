/**
 * DuckDB SQL dialect specifics.
 * Helpers for generating DuckDB-compatible SQL.
 */

/** DuckDB-specific aggregate functions. */
export const DUCKDB_AGGREGATES = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "MEDIAN",
  "STDDEV",
  "VARIANCE",
  "STRING_AGG",
  "LIST",
  "ARRAY_AGG",
  "APPROX_COUNT_DISTINCT",
  "APPROX_QUANTILE",
  "HISTOGRAM",
] as const;

/** DuckDB-specific scalar functions. */
export const DUCKDB_SCALAR_FUNCTIONS = [
  "COALESCE",
  "NULLIF",
  "IFNULL",
  "CAST",
  "TRY_CAST",
  "EPOCH_MS",
  "STRFTIME",
  "STRPTIME",
  "DATE_TRUNC",
  "DATE_PART",
  "DATE_DIFF",
  "REGEXP_MATCHES",
  "REGEXP_REPLACE",
  "REGEXP_EXTRACT",
  "LIST_VALUE",
  "UNNEST",
  "GENERATE_SERIES",
  "READ_PARQUET",
  "READ_CSV",
] as const;

/** DuckDB reserved keywords (subset). */
export const DUCKDB_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "ON",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "BETWEEN",
  "LIKE",
  "IS",
  "NULL",
  "TRUE",
  "FALSE",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "EXISTS",
  "UNION",
  "ALL",
  "EXCEPT",
  "INTERSECT",
  "WITH",
  "RECURSIVE",
  "DISTINCT",
  "CREATE",
  "TABLE",
  "VIEW",
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "INDEX",
  "USING",
  "QUALIFY",
  "WINDOW",
  "PARTITION",
  "OVER",
  "ROWS",
  "RANGE",
  "GROUPS",
  "UNBOUNDED",
  "PRECEDING",
  "FOLLOWING",
  "CURRENT",
  "ROW",
  "SAMPLE",
  "TABLESAMPLE",
  "PIVOT",
  "UNPIVOT",
] as const;

/**
 * Quote an identifier for DuckDB (double-quote if needed).
 */
export function quoteIdentifier(name: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name) && !isReserved(name)) {
    return name;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

function isReserved(word: string): boolean {
  return DUCKDB_KEYWORDS.includes(word.toUpperCase() as (typeof DUCKDB_KEYWORDS)[number]);
}
