/**
 * What a record is called, when something other than the record is showing it.
 *
 * A reference column stores a uuid. Every screen that displays one has to turn
 * it back into something a person recognises — the form's lookup dropdown, and
 * the grid, which used to print the uuid itself. Both ask this module, so a
 * record cannot be "Northwind Systems" in the dropdown and
 * `39febc1c-8585-…` in the table it was chosen from.
 *
 * The choice is made from the Application Dictionary rather than from a list of
 * column names the generator hopes exist: the model decides what its tables
 * look like, so the dictionary is the only thing that knows.
 */

import { ident } from "./db.js";

/**
 * Pick the label for a table, from its `sys_column` rows.
 *
 * The dictionary already answers this: `is_identifier` marks the columns that
 * say what a record *is*, and a record's display value is those columns in
 * `seq_no` order. `first_name` and `last_name` are both identifiers on a person
 * table, which is why this concatenates rather than picking one — and it is the
 * same rule the generated NestJS backend follows, so a record is called the
 * same thing in both stacks.
 *
 * The key is never an identifier (see `identifierColumnNames`), so nothing here
 * has to filter it out. A table with no identifier at all falls back to the key,
 * because a lookup listing ids still beats a text box asking for one.
 *
 * Returns the key column, a readable name for the label, and the SQL expression
 * that produces it.
 */
export function labelFor(columns, options = {}) {
  const key = columns.find((column) => column.is_key)?.column_name ?? "id";
  if (columns.length === 0) return { key, label: key, expression: ident(key) };

  const identifiers = columns
    .filter((column) => column.is_identifier && !column.is_key)
    .sort((a, b) => Number(a.seq_no ?? 0) - Number(b.seq_no ?? 0));

  if (identifiers.length === 0) return { key, label: key, expression: ident(key) };

  /* An identifier that is itself a reference — a join entity, whose identity is
     the records it joins — holds a uuid, so printing it would defeat the whole
     point. It resolves through the parent's own label instead, as a correlated
     subquery: one level only, because a parent that is itself a join would make
     this recursive, and a label assembled from four grandparents is not a name
     anybody reads. `parents` carries the parent tables' columns; without it
     (the sync callers) a reference identifier falls back to the key. */
  const parents = options.parents ?? {};
  const table = options.table;

  const part = (column) => {
    const parentColumns = column.ref_table_name ? parents[column.ref_table_name] : null;
    if (!column.ref_table_name) return ident(column.column_name);
    if (!parentColumns || !table) return null;

    const parent = labelFor(parentColumns);
    /* `labelFor` on the parent, with no `parents` of its own, is what stops the
       recursion: a parent that is also a join entity labels itself by its key. */
    /* Cast both sides: a generated table's key is `UUID` and a reference to it
       is `VARCHAR(255)`, because the model declares `string campaign_id FK`.
       Postgres coerces a text *parameter* to uuid happily, which is why the
       grid's `WHERE id IN ($1, …)` never noticed, but it refuses to compare the
       two *columns* — `operator does not exist: uuid = character varying`. */
    return `(SELECT ${parent.expression} FROM ${ident(column.ref_table_name)}
              WHERE ${ident(column.ref_table_name)}.${ident(parent.key)}::text
                  = ${ident(table)}.${ident(column.column_name)}::text)`;
  };

  const parts = identifiers.map(part).filter(Boolean);
  if (parts.length === 0) return { key, label: key, expression: ident(key) };

  /* Two names of one record join with a space — `Hiroshi Kowalski`. Two
     *records* join with a dash — `Spring Promo — Hiroshi Kowalski` — because
     they are separate things and running them together reads as one name that
     belongs to nobody. */
  const separator = identifiers.some((column) => column.ref_table_name) ? " — " : " ";

  const joined =
    parts.length === 1
      ? parts[0]
      : // CONCAT_WS skips nulls, so a person with no surname recorded reads as
        // their first name rather than as a name with a gap in it, and a join
        // whose other side was deleted still names the side that remains.
        `TRIM(CONCAT_WS('${separator}', ${parts.join(", ")}))`;

  return {
    key,
    label: identifiers.map((column) => column.column_name).join(" "),
    /* Never hand back a blank. A join entity whose parents have both gone —
       deleted, or never seeded — concatenates two nulls into an empty string,
       and an option with no text is one a reader cannot pick or tell apart.
       The uuid is the thing this module exists to avoid, which makes it exactly
       the right last resort: it is unreadable, but it is unambiguous. */
    expression: `COALESCE(NULLIF(${joined}, ''), ${ident(key)}::text)`,
  };
}

/**
 * `labelFor`, with the parent tables a join entity needs already read.
 *
 * The sync form cannot fetch anything, and a join entity's label is built from
 * its parents' labels, so this is the form every caller that has a database
 * should use. One extra query per reference identifier, on tables that are
 * small by construction — a join has two parents, not two hundred.
 */
export async function labelForTable(db, table, columns) {
  const identifiers = columns.filter((column) => column.is_identifier && !column.is_key);
  const parents = {};
  for (const column of identifiers) {
    if (!column.ref_table_name || parents[column.ref_table_name]) continue;
    const parentColumns = await columnsOf(db, column.ref_table_name);
    if (parentColumns) parents[column.ref_table_name] = parentColumns;
  }
  return labelFor(columns, { table, parents });
}

/**
 * Read the `sys_column` rows for a table, or `null` if nothing declared it.
 *
 * Going through `sys_table` first is what stops a table nobody modelled being
 * read through a route that takes its name from a query string.
 */
export async function columnsOf(db, table) {
  const owner = await db.one("SELECT sys_table_id FROM sys_table WHERE table_name = $1", [table]);
  if (!owner) return null;
  return db.select("sys_column", { where: { sys_table_id: owner.sys_table_id }, orderBy: "seq_no" });
}

/**
 * Labels for the referenced records on one page of a grid.
 *
 * Only the ids actually on the page are looked up — a page is twenty-five rows,
 * so this is a handful of small queries rather than a copy of every parent
 * table. That is the difference between this and the form's dropdown, which
 * wants the whole list to choose from: the grid only needs the names of what is
 * already in front of the reader.
 *
 * Returns `{ column_name: { id: label } }`, left for the client to apply, so
 * the rows themselves keep the real foreign keys that editing and filtering
 * depend on.
 */
export async function labelsForRows(db, entity, rows) {
  if (rows.length === 0) return {};

  /* Which columns point at another table is `sys_column.ref_table_name` — the
     same row the form reads to decide it needs a lookup control. The entity's
     own attributes know a column is a foreign key but not what it resolves to,
     and guessing the parent from the column name is exactly the guess the
     dictionary exists to have already made. */
  const columns = await columnsOf(db, entity.tableName);
  if (!columns) return {};
  const references = columns.filter((column) => column.ref_table_name);
  if (references.length === 0) return {};

  const labels = {};
  for (const column of references) {
    const ids = [...new Set(rows.map((row) => row[column.column_name]).filter(Boolean))];
    if (ids.length === 0) continue;

    const parentColumns = await columnsOf(db, column.ref_table_name);
    if (!parentColumns) continue;
    const { key, expression } = await labelForTable(db, column.ref_table_name, parentColumns);

    const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
    const found = await db.query(
      `SELECT ${ident(key)} AS id, ${expression} AS label
         FROM ${ident(column.ref_table_name)}
        WHERE ${ident(key)} IN (${placeholders})`,
      ids
    );

    const map = {};
    for (const row of found) {
      // A parent row whose own label column is empty would otherwise render as
      // a blank cell, which reads as missing data rather than as a name nobody
      // filled in.
      map[row.id] = row.label == null || row.label === "" ? String(row.id) : String(row.label);
    }
    labels[column.column_name] = map;
  }

  return labels;
}
