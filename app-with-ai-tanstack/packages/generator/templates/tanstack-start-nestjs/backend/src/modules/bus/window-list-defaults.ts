/**
 * `sys_window.where_clause` and `sys_window.order_by_clause`, turned into
 * something safe to query with.
 *
 * An administrator edits both from a screen, so neither may reach the database
 * as SQL. Each is parsed here against the entity's real columns, and anything
 * that does not resolve to a column the dictionary declares is dropped. What
 * comes out is the same shape a filter typed into the grid produces — column
 * names checked against a list, values carried separately and bound as
 * parameters by Kysely.
 *
 * The two grammars, in full:
 *
 *   where_clause     `column=operator:value`, comma-separated.
 *                    `status=equals:active, region=contains:north`
 *                    Operators are the grid's own: equals, notEquals, contains,
 *                    startsWith, endsWith, gt, gte, lt, lte, isNull, isNotNull.
 *
 *   order_by_clause  `column [ASC|DESC]`, comma-separated.
 *                    `updated_at DESC, name ASC`
 *                    The direction is optional and defaults to ASC.
 *
 * A value may be quoted, single or double, which is how a value containing a
 * comma is written: `note=contains:"a, b"`.
 */

/** What a list orders by when its window says nothing. Most recent change first. */
export const DEFAULT_ORDER_BY_CLAUSE = 'updated_at DESC';

export interface OrderTerm {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterTerm {
  column: string;
  operator: string;
  value: string | null;
}

export interface ParseWarning {
  clause: string;
  reason: string;
}

/**
 * The grid's filter vocabulary, mapped to what DatabaseService.findAll expects.
 * `contains`/`startsWith`/`endsWith` become an `ilike` with the pattern built
 * here, so the caller never assembles one and a value holding a literal `%`
 * cannot turn an equality into a wildcard.
 */
const OPERATORS: Record<string, (value: string) => { operator: string; value: unknown }> = {
  equals: (v) => ({ operator: '=', value: v }),
  notequals: (v) => ({ operator: '!=', value: v }),
  contains: (v) => ({ operator: 'ilike', value: `%${escapeLike(v)}%` }),
  startswith: (v) => ({ operator: 'ilike', value: `${escapeLike(v)}%` }),
  endswith: (v) => ({ operator: 'ilike', value: `%${escapeLike(v)}` }),
  gt: (v) => ({ operator: '>', value: v }),
  gte: (v) => ({ operator: '>=', value: v }),
  lt: (v) => ({ operator: '<', value: v }),
  lte: (v) => ({ operator: '<=', value: v }),
};

/**
 * The Application Dictionary's reference types, for the few whose column the
 * database will not compare against arbitrary text.
 *
 * A window filtering `id=equals:not-a-uuid` reaches PostgreSQL as
 * `uuid = 'not-a-uuid'`, which is error 22P02 — so the list answers 400 and the
 * screen is empty, for a clause an administrator typed into a text box. The
 * value is bound as a parameter either way, so this is not a security check; it
 * is the difference between a bad clause being dropped like every other bad
 * clause and a bad clause taking the list down.
 */
const REF = {
  INTEGER: 11,
  AMOUNT: 12,
  ID: 13,
  DATE: 15,
  DATETIME: 16,
  TABLE: 18,
  TABLE_DIRECT: 19,
  YES_NO: 20,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Is this value one the column's type can actually be compared against?
 *
 * Only the types whose mismatch is an error rather than a miss are checked. A
 * text column compared to anything is a comparison that returns no rows, which
 * is a correct answer to a filter nothing matches.
 */
function valueFitsColumn(value: string, referenceId: number | undefined): boolean {
  switch (referenceId) {
    case REF.ID:
    case REF.TABLE:
    case REF.TABLE_DIRECT:
      return UUID_PATTERN.test(value);
    case REF.INTEGER:
    case REF.AMOUNT:
      return /^-?\d+(\.\d+)?$/.test(value);
    case REF.YES_NO:
      return /^(true|false|yes|no|1|0)$/i.test(value);
    case REF.DATE:
    case REF.DATETIME:
      return !Number.isNaN(Date.parse(value));
    default:
      return true;
  }
}

/** `%` and `_` are wildcards in LIKE; a value carrying one means it literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Strip one layer of matching quotes, which is how a value with a comma is written. */
function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Split on commas that are not inside quotes.
 *
 * A plain `split(',')` cut `note=contains:"a, b"` in half and left two clauses
 * neither of which parses.
 */
function splitClauses(source: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const char of source) {
    if (quote) {
      if (char === quote) quote = null;
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ',') {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((clause) => clause.trim()).filter((clause) => clause.length > 0);
}

/**
 * Parse `order_by_clause` into terms naming columns that exist.
 *
 * Returns an empty list when the clause is empty or names nothing real, which
 * the caller reads as "fall back to the default" rather than as "order by
 * nothing".
 */
export function parseOrderByClause(
  clause: string | null | undefined,
  columns: Iterable<string>
): { terms: OrderTerm[]; warnings: ParseWarning[] } {
  const known = new Set(columns);
  const terms: OrderTerm[] = [];
  const warnings: ParseWarning[] = [];
  const seen = new Set<string>();

  for (const raw of splitClauses(clause ?? '')) {
    // Exactly a column and an optional direction. Anything else — a function
    // call, a NULLS FIRST, a subquery — does not match and is dropped, which
    // is the point: this is a whitelist, not a sanitiser.
    const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(ASC|DESC))?$/i.exec(raw);
    if (!match) {
      warnings.push({ clause: raw, reason: 'not a column and optional ASC/DESC' });
      continue;
    }
    const column = match[1];
    if (!known.has(column)) {
      warnings.push({ clause: raw, reason: `no column '${column}' on this entity` });
      continue;
    }
    if (seen.has(column)) continue;
    seen.add(column);
    terms.push({ column, direction: match[2]?.toLowerCase() === 'desc' ? 'desc' : 'asc' });
  }

  return { terms, warnings };
}

/**
 * Parse `where_clause` into filters in the shape DatabaseService.findAll takes.
 *
 * A clause naming a column the entity does not have is dropped rather than
 * ignored quietly at the database — a window filtering on a column somebody
 * later renamed should show every row and say why, not fail every request.
 */
export function parseWhereClause(
  clause: string | null | undefined,
  columns: Iterable<string>,
  /**
   * column -> sys_reference_id, so a value the column's type cannot be compared
   * against is dropped here rather than becoming a 400 from PostgreSQL. Omit it
   * and only the column name is checked.
   */
  columnTypes?: ReadonlyMap<string, number>
): { filters: Record<string, { operator: string; value: unknown }>; warnings: ParseWarning[] } {
  const known = new Set(columns);
  const filters: Record<string, { operator: string; value: unknown }> = {};
  const warnings: ParseWarning[] = [];

  for (const raw of splitClauses(clause ?? '')) {
    const eq = raw.indexOf('=');
    if (eq <= 0) {
      warnings.push({ clause: raw, reason: 'expected column=operator:value' });
      continue;
    }
    const column = raw.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
      warnings.push({ clause: raw, reason: `'${column}' is not a column name` });
      continue;
    }
    if (!known.has(column)) {
      warnings.push({ clause: raw, reason: `no column '${column}' on this entity` });
      continue;
    }

    const rest = raw.slice(eq + 1).trim();
    const colon = rest.indexOf(':');
    const operatorName = (colon >= 0 ? rest.slice(0, colon) : rest).trim().toLowerCase();
    const rawValue = colon >= 0 ? rest.slice(colon + 1) : '';

    if (operatorName === 'isnull') {
      filters[column] = { operator: 'is', value: null };
      continue;
    }
    if (operatorName === 'isnotnull') {
      filters[column] = { operator: 'is not', value: null };
      continue;
    }

    const build = OPERATORS[operatorName];
    if (!build) {
      warnings.push({ clause: raw, reason: `unknown operator '${operatorName}'` });
      continue;
    }

    const value = unquote(rawValue);
    if (value === '') {
      warnings.push({ clause: raw, reason: 'no value' });
      continue;
    }

    // A pattern match is always a text comparison — the query casts the column
    // to text for it — so the column's own type does not have to accept the
    // value. Every other operator compares against the column as it is.
    const comparesAsText = build(value).operator === 'ilike';
    if (!comparesAsText && !valueFitsColumn(value, columnTypes?.get(column))) {
      warnings.push({
        clause: raw,
        reason: `'${value}' is not a value column '${column}' can be compared against`,
      });
      continue;
    }

    filters[column] = build(value);
  }

  return { filters, warnings };
}
