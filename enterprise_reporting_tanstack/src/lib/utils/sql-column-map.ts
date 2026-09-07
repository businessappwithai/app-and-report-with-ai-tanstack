export interface ColumnMeta {
  tableName: string | null;
  drillable: boolean;
}

function splitSelectColumns(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function extractTableAliases(sql: string): Map<string, string> {
  const map = new Map<string, string>();
  const re =
    /(?:FROM|JOIN)\s+["'`]?(\w+)["'`]?\s*(?:AS\s+)?(?:([\w]+)(?=\s|$|,|\)|;))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const alias = m[2]?.toLowerCase();
    if (
      alias &&
      !/^(ON|WHERE|INNER|LEFT|RIGHT|FULL|OUTER|CROSS|SET|USING)$/i.test(alias)
    ) {
      map.set(alias, table);
    }
    map.set(table, table);
  }
  return map;
}

const AGGREGATE_RE =
  /^\s*(COUNT|SUM|AVG|MIN|MAX|STDDEV|STDDEV_POP|STDDEV_SAMP|VARIANCE|VAR_POP|VAR_SAMP|STRING_AGG|ARRAY_AGG|JSON_AGG|GROUP_CONCAT|MEDIAN|PERCENTILE_CONT|PERCENTILE_DISC|BIT_AND|BIT_OR|BOOL_AND|BOOL_OR|EVERY)\s*\(/i;

function isAggregate(expr: string): boolean {
  return AGGREGATE_RE.test(expr.trim());
}

function aggKey(expr: string): string {
  const fnMatch = expr.match(/^\s*(\w+)\s*\(/i);
  if (fnMatch) return fnMatch[1].toLowerCase();
  return "agg";
}

/**
 * Parse a SQL SELECT statement and return a map of
 * output column name (lower-cased) -> ColumnMeta.
 *
 * Aggregate function columns (COUNT, SUM, etc.) are marked drillable:false
 * because they represent grouped values, not individual rows.
 */
export function parseColumnTableMap(sql: string): Record<string, ColumnMeta> {
  const result: Record<string, ColumnMeta> = {};

  const tableAliases = extractTableAliases(sql);
  const allTables = Array.from(new Set(tableAliases.values()));

  const selectMatch = sql.match(/^\s*SELECT\s+([\s\S]+?)\s+FROM\s/i);
  if (!selectMatch) return result;

  const colExprs = splitSelectColumns(selectMatch[1]);

  for (const colExpr of colExprs) {
    const raw = colExpr.trim();
    if (!raw) continue;

    const asMatch = raw.match(/^([\s\S]+?)\s+AS\s+["'`]?(\w+)["'`]?\s*$/i);
    const exprPart = (asMatch ? asMatch[1] : raw).trim();
    const explicitAlias = asMatch ? asMatch[2].toLowerCase() : null;

    if (exprPart === "*") {
      if (allTables.length === 1) {
        result["*"] = { tableName: allTables[0], drillable: true };
      }
      continue;
    }

    const tableStarMatch = exprPart.match(/^["'`]?(\w+)["'`]?\.\*$/);
    if (tableStarMatch) {
      const ref = tableStarMatch[1].toLowerCase();
      const actual = tableAliases.get(ref) ?? ref;
      result[`${ref}.*`] = { tableName: actual, drillable: true };
      continue;
    }

    if (isAggregate(exprPart)) {
      const key = explicitAlias ?? aggKey(exprPart);
      result[key] = { tableName: null, drillable: false };
      continue;
    }

    const dotMatch = exprPart.match(/^["'`]?(\w+)["'`]?\.["'`]?(\w+)["'`]?$/);
    if (dotMatch) {
      const ref = dotMatch[1].toLowerCase();
      const col = dotMatch[2].toLowerCase();
      const actual = tableAliases.get(ref) ?? ref;
      result[explicitAlias ?? col] = { tableName: actual, drillable: true };
      continue;
    }

    const simpleMatch = exprPart.match(/^["'`]?(\w+)["'`]?$/);
    if (simpleMatch) {
      const col = simpleMatch[1].toLowerCase();
      const tableName = allTables.length === 1 ? allTables[0] : null;
      result[explicitAlias ?? col] = { tableName, drillable: true };
      continue;
    }

    if (explicitAlias) {
      result[explicitAlias] = { tableName: null, drillable: false };
    }
  }

  return result;
}

/**
 * Given the parsed column map and actual result column names,
 * return the set of column names that support drill-down.
 * Handles the SELECT * sentinel by expanding it to all result columns.
 */
export function drillableColumnSet(
  colMap: Record<string, ColumnMeta>,
  resultColumns: string[],
  entityTableNames: Set<string>,
): Set<string> {
  const drillable = new Set<string>();
  const wildcard = colMap["*"];

  for (const colName of resultColumns) {
    const key = colName.toLowerCase();
    const meta = colMap[key] ?? wildcard ?? null;
    if (!meta) continue;
    if (!meta.drillable) continue;
    if (!meta.tableName) continue;
    if (!entityTableNames.has(meta.tableName.toLowerCase())) continue;
    drillable.add(colName);
  }

  return drillable;
}
