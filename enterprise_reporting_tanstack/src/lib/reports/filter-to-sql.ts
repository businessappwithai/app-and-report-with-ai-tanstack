/**
 * Filter to SQL conversion utilities
 * Converts filter configurations to SQL WHERE clauses using parameterized queries
 * All filters are executed at the database level for security and performance
 */

// Filter types
export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "less_than"
  | "between"
  | "is_null"
  | "is_not_null"
  | "in"
  | "not_in"
  | "before"
  | "after"
  | "is_true"
  | "is_false";

export type FilterLogic = "AND" | "OR";

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value?: string | number | boolean | (string | number)[];
  value2?: string | number;
}

export interface FilterGroup {
  id: string;
  logic: FilterLogic;
  conditions: FilterCondition[];
  groups?: FilterGroup[];
}

/**
 * Escape SQL identifier (column/table name) to prevent SQL injection
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Convert a filter condition to SQL WHERE clause fragment with parameters
 * Returns SQL fragment and parameter values for parameterized queries
 *
 * Number field operators: equals, not_equals, greater_than, less_than, between
 * Date field operators: before (same as less_than), after (same as greater_than), between
 * Boolean field operators: is_true, is_false (checks multiple representations)
 * Text field operators: equals, not_equals, contains, not_contains, starts_with, ends_with
 */
export function conditionToSQL(condition: FilterCondition): {
  sql: string;
  params: (string | number | boolean)[];
} {
  const field = escapeIdentifier(condition.field);

  switch (condition.operator) {
    // Text and basic equality operators
    case "equals":
      return { sql: `${field} = ?`, params: [condition.value] };
    case "not_equals":
      return { sql: `${field} != ?`, params: [condition.value] };

    // Text pattern matching operators
    case "contains":
      return { sql: `${field} LIKE ?`, params: [`%${condition.value}%`] };
    case "not_contains":
      return { sql: `${field} NOT LIKE ?`, params: [`%${condition.value}%`] };
    case "starts_with":
      return { sql: `${field} LIKE ?`, params: [`${condition.value}%`] };
    case "ends_with":
      return { sql: `${field} LIKE ?`, params: [`%${condition.value}`] };

    // Number and comparison operators
    case "greater_than":
      return { sql: `${field} > ?`, params: [condition.value] };
    case "less_than":
      return { sql: `${field} < ?`, params: [condition.value] };
    case "between":
      return { sql: `${field} BETWEEN ? AND ?`, params: [condition.value, condition.value2 ?? ""] };

    // NULL check operators
    case "is_null":
      return { sql: `${field} IS NULL`, params: [] };
    case "is_not_null":
      return { sql: `${field} IS NOT NULL`, params: [] };

    // IN list operators
    case "in": {
      const inValues = Array.isArray(condition.value)
        ? condition.value
        : String(condition.value)
            .split(",")
            .map((v) => v.trim());
      const placeholders = inValues.map(() => "?").join(",");
      return { sql: `${field} IN (${placeholders})`, params: inValues };
    }
    case "not_in": {
      const notInValues = Array.isArray(condition.value)
        ? condition.value
        : String(condition.value)
            .split(",")
            .map((v) => v.trim());
      const notInPlaceholders = notInValues.map(() => "?").join(",");
      return { sql: `${field} NOT IN (${notInPlaceholders})`, params: notInValues };
    }

    // Boolean operators - handle multiple representations (1/0, '1'/'0', 'true'/'false')
    case "is_true":
      return { sql: `(${field} = 1 OR ${field} = '1' OR ${field} = 'true')`, params: [] };
    case "is_false":
      return {
        sql: `(${field} = 0 OR ${field} = '0' OR ${field} = 'false' OR ${field} IS NULL)`,
        params: [],
      };

    // Date operators (semantically clearer aliases for less_than/greater_than)
    case "before":
      return { sql: `${field} < ?`, params: [condition.value] };
    case "after":
      return { sql: `${field} > ?`, params: [condition.value] };

    default:
      return { sql: "1=1", params: [] };
  }
}

/**
 * Convert filter group to SQL WHERE clause with parameters
 * Returns SQL fragment and parameter values for parameterized queries
 */
export function filterGroupToSQL(group: FilterGroup): {
  sql: string;
  params: (string | number | boolean)[];
} {
  const results = group.conditions.map((c) => conditionToSQL(c));
  const groupResults = (group.groups || []).map((g) => filterGroupToSQL(g));

  const allSQLs = [...results.map((r) => `(${r.sql})`), ...groupResults.map((r) => `(${r.sql})`)];

  const allParams = [...results.flatMap((r) => r.params), ...groupResults.flatMap((r) => r.params)];

  if (allSQLs.length === 0) {
    return { sql: "1=1", params: [] };
  }

  return {
    sql: allSQLs.join(` ${group.logic} `),
    params: allParams,
  };
}

/**
 * Build complete SQL query with WHERE clause from filters
 * Returns SQL with ? placeholders and separate parameter array
 *
 * This ensures all filtering happens at the database level using SQL WHERE clauses
 * with parameterized queries for SQL injection prevention.
 */
export function buildSQLWithFilters(
  baseSQL: string,
  filterConfig: FilterGroup | null
): { sql: string; params: (string | number | boolean)[] } {
  // Remove existing WHERE clause, LIMIT, OFFSET
  let cleanSQL = baseSQL
    .replace(/\bWHERE\s+.*?(?=\bLIMIT\b|\bGROUP BY\b|\bORDER BY\b|\bHAVING\b|$)/i, "")
    .replace(/\bLIMIT\s+\d+/i, "")
    .replace(/\bOFFSET\s+\d+/i, "")
    .replace(/;$/, "");

  // Trim trailing whitespace
  cleanSQL = cleanSQL.trim();

  if (!filterConfig || filterConfig.conditions.length === 0) {
    return { sql: cleanSQL, params: [] };
  }

  // Convert filter group to SQL with parameters
  const { sql: whereSQL, params } = filterGroupToSQL(filterConfig);

  // Inject WHERE clause
  return {
    sql: `${cleanSQL} WHERE ${whereSQL}`,
    params,
  };
}

/**
 * Apply a single filter condition to a row (client-side fallback)
 * Only used when database-level filtering is not possible
 */
export function applyCondition(row: Record<string, unknown>, condition: FilterCondition): boolean {
  const value = row[condition.field];

  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "contains":
      return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
    case "not_contains":
      return !String(value).toLowerCase().includes(String(condition.value).toLowerCase());
    case "starts_with":
      return String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
    case "ends_with":
      return String(value).toLowerCase().endsWith(String(condition.value).toLowerCase());
    case "greater_than":
      return Number(value) > Number(condition.value);
    case "less_than":
      return Number(value) < Number(condition.value);
    case "between":
      return Number(value) >= Number(condition.value) && Number(value) <= Number(condition.value2 ?? "");
    case "is_null":
      return value === null || value === undefined;
    case "is_not_null":
      return value !== null && value !== undefined;
    case "in": {
      const inValues = Array.isArray(condition.value)
        ? condition.value
        : String(condition.value)
            .split(",")
            .map((v) => v.trim());
      return inValues.includes(String(value));
    }
    case "not_in": {
      const notInValues = Array.isArray(condition.value)
        ? condition.value
        : String(condition.value)
            .split(",")
            .map((v) => v.trim());
      return !notInValues.includes(String(value));
    }
    case "is_true":
      return value === true || value === 1 || value === "1" || value === "true";
    case "is_false":
      return value === false || value === 0 || value === "0" || value === "false";
    case "before":
      return new Date(String(value)) < new Date(String(condition.value));
    case "after":
      return new Date(String(value)) > new Date(String(condition.value));
    default:
      return true;
  }
}

/**
 * Recursively apply filter group to rows (client-side fallback)
 * Only used when database-level filtering is not possible
 */
export function applyFilterGroup(row: Record<string, unknown>, group: FilterGroup): boolean {
  // Evaluate all conditions
  const conditionResults = group.conditions.map((condition) => applyCondition(row, condition));

  // Evaluate nested groups
  const groupResults = (group.groups || []).map((g) => applyFilterGroup(row, g));

  // Combine all results
  const allResults = [...conditionResults, ...groupResults];

  // Apply logic (AND or OR)
  if (group.logic === "AND") {
    return allResults.every((result) => result === true);
  } else {
    // OR
    return allResults.some((result) => result === true);
  }
}

/**
 * Apply filter configuration to rows (client-side fallback)
 * Only used when database-level filtering is not possible
 */
export function applyFilters(
  rows: Record<string, unknown>[],
  filterConfig: FilterGroup | null
): Record<string, unknown>[] {
  if (!filterConfig || filterConfig.conditions.length === 0) {
    return rows;
  }

  return rows.filter((row) => applyFilterGroup(row, filterConfig));
}
