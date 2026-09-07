/**
 * Convert filter state to DuckDB WHERE clause fragments.
 */

import type { TableFilterState } from "@/types/filters";

/**
 * Build a WHERE clause string from an array of filters.
 * Returns empty string if no filters.
 */
export function filtersToSQL(filters: TableFilterState[]): string {
  if (filters.length === 0) return "";

  const clauses = filters.map((f) => filterToClause(f));
  return `WHERE ${clauses.join(" AND ")}`;
}

function filterToClause(f: TableFilterState): string {
  const col = `"${f.columnId}"`;
  const val = typeof f.value === "string" ? `'${f.value.replace(/'/g, "''")}'` : String(f.value);

  switch (f.operator) {
    case "eq":
      return `${col} = ${val}`;
    case "ne":
      return `${col} != ${val}`;
    case "gt":
      return `${col} > ${val}`;
    case "lt":
      return `${col} < ${val}`;
    case "gte":
      return `${col} >= ${val}`;
    case "lte":
      return `${col} <= ${val}`;
    case "contains":
      return `${col} LIKE '%${String(f.value).replace(/'/g, "''")}%'`;
    case "startsWith":
      return `${col} LIKE '${String(f.value).replace(/'/g, "''")}%'`;
    default:
      return `${col} = ${val}`;
  }
}
