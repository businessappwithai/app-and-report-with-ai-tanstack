#!/usr/bin/env bun
/**
 * Derive a reporting pack from an EML model.
 *
 * The reporting platform stores reports, charts and dashboards as definitions
 * over saved SQL queries. This turns a model into exactly those definitions, so
 * that a generated application arrives with a reporting layer already built for
 * *its* entities rather than an empty workspace and a SQL editor.
 *
 *   bun build/reporting-pack.ts -i <model.eml.mmd> -o <pack.json> --database <db>
 *
 * Nothing here is invented. Every query is derived from something the model
 * actually declares, and a model that declares less gets a smaller pack:
 *
 *   entity                → a register: what rows exist, newest first
 *   %%enum-bound column   → a breakdown: how the rows divide, as a chart
 *   created_at            → volume by month, as a line
 *   kind: state workflow  → a lifecycle report over the states the diagram
 *                           declares, in the diagram's order, zeroes included
 *   numeric columns       → a measures report, grouped by the entity's own
 *                           primary enum column where it has one
 *   oneToMany             → children per parent, ranked
 *
 * The *names and descriptions* come from `%%entity help:` and `%%field help:` —
 * the only place a model says what an entity is for rather than what shape it
 * is. That is what makes the difference between a report called "bus_account by
 * status" and one called "Accounts by status" that explains, underneath, what
 * an account is in this business. A model with no help text still produces a
 * working pack; it just produces one named after tables.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EmlAttribute, EmlEntity, EmlModel, EmlWorkflow } from "../language/cli/src/model.ts";
import { parseEml } from "../language/cli/src/parser.ts";
import { foreignKeyName } from "../language/cli/src/util.ts";

// --- The pack ----------------------------------------------------------------

export interface SavedQuerySpec {
  key: string;
  name: string;
  description: string;
  sql: string;
}

export interface ReportSpec {
  key: string;
  name: string;
  description: string;
  queryKey: string;
  columns: { field: string; label: string }[];
  pageSize: number;
}

export interface ChartSpec {
  key: string;
  name: string;
  description: string;
  queryKey: string;
  chartType: "bar" | "line" | "pie" | "area";
  xField: string;
  yField: string;
}

export interface DashboardWidgetSpec {
  chartKey?: string;
  reportKey?: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardSpec {
  key: string;
  name: string;
  description: string;
  widgets: DashboardWidgetSpec[];
}

export interface ReportingPack {
  application: {
    name: string;
    description: string;
    model: string;
    databaseName: string;
    generatedAt: string;
  };
  dataSource: { name: string; description: string; clientType: "pg" };
  queries: SavedQuerySpec[];
  reports: ReportSpec[];
  charts: ChartSpec[];
  dashboards: DashboardSpec[];
}

// --- Naming ------------------------------------------------------------------

/** The generated backend prefixes every business table with `bus_`. */
function tableOf(e: EmlEntity): string {
  return `bus_${e.tableName}`;
}

function titleOf(e: EmlEntity): string {
  return e.label ?? e.name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function pluralTitle(e: EmlEntity): string {
  const t = titleOf(e);
  if (/[^aeiou]y$/i.test(t)) return `${t.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(t)) return `${t}es`;
  return `${t}s`;
}

function labelOf(column: string): string {
  return column
    .replace(/_id$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The entity's own sentence, trimmed to one line. Falls back to a plain
 * statement of what the report covers rather than to nothing: a description
 * field left empty reads, in the reporting UI, exactly like a broken import.
 */
function helpOf(e: EmlEntity): string {
  const h = e.help?.trim();
  if (h) return h.replace(/\s+/g, " ");
  return `Rows of ${pluralTitle(e).toLowerCase()} held by the application.`;
}

/** SQL string literal. Model text reaches these queries, so it is escaped. */
function lit(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// --- Column classification ---------------------------------------------------

const AUDIT_COLUMNS = new Set(["created_at", "updated_at", "deleted_at", "version"]);

function isAudit(a: EmlAttribute): boolean {
  return AUDIT_COLUMNS.has(a.name);
}

function businessColumns(e: EmlEntity): EmlAttribute[] {
  return e.attributes.filter((a) => !a.isPrimaryKey && !isAudit(a));
}

/**
 * The column a human recognises a row by. A report keyed on a UUID is a report
 * nobody can read, so this is picked before anything else is derived.
 */
function displayColumn(e: EmlEntity): string {
  const cols = businessColumns(e).filter((a) => !a.isForeignKey);
  const byName = cols.find((a) => /^(name|title|label|code|reference|subject)$/.test(a.name));
  if (byName) return byName.name;
  const unique = cols.find((a) => a.unique && (a.type === "string" || a.type === "text"));
  if (unique) return unique.name;
  const email = cols.find((a) => /email/.test(a.name));
  if (email) return email.name;
  const firstString = cols.find((a) => a.type === "string");
  return firstString?.name ?? e.primaryKey;
}

/**
 * Enum-bound columns, most characteristic first.
 *
 * `status` before `type` before everything else, because a lifecycle column is
 * what an operator actually asks about, and because it is the column a state
 * machine (when the model draws one) is keyed on.
 */
function enumColumns(e: EmlEntity): EmlAttribute[] {
  const bound = businessColumns(e).filter((a) => a.enumRef);
  const rank = (a: EmlAttribute): number => {
    if (/^(status|state)$/.test(a.name)) return 0;
    if (/(stage|phase|priority)/.test(a.name)) return 1;
    if (/(type|tier|category|kind)/.test(a.name)) return 2;
    return 3;
  };
  return [...bound].sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name));
}

function measureColumns(e: EmlEntity): EmlAttribute[] {
  return businessColumns(e).filter(
    (a) => !a.isForeignKey && (a.type === "integer" || a.type === "decimal")
  );
}

function stateWorkflow(model: EmlModel, e: EmlEntity): EmlWorkflow | undefined {
  return model.workflows.find((w) => w.kind === "state" && w.entity === e.name);
}

/**
 * The states the diagram declares, in the order it declares them, with the
 * pseudo-states dropped. Order matters: a lifecycle report sorted
 * alphabetically tells you nothing about where work is piling up.
 */
function declaredStates(w: EmlWorkflow): string[] {
  const seen: string[] = [];
  const push = (s: string) => {
    const v = s.trim();
    if (!v || v === "[*]" || seen.includes(v)) return;
    seen.push(v);
  };
  for (const s of w.states) push(s);
  for (const t of w.transitions) {
    push(t.from);
    push(t.to);
  }
  return seen;
}

// --- Derivation --------------------------------------------------------------

interface Ctx {
  model: EmlModel;
  queries: SavedQuerySpec[];
  reports: ReportSpec[];
  charts: ChartSpec[];
}

function addQuery(ctx: Ctx, spec: SavedQuerySpec): string {
  ctx.queries.push(spec);
  return spec.key;
}

function deriveEntity(ctx: Ctx, e: EmlEntity): void {
  const table = tableOf(e);
  const slug = e.tableName;
  const display = displayColumn(e);
  const help = helpOf(e);
  const live = "deleted_at IS NULL";

  // 1. The register — every entity earns one.
  const registerCols = [
    display,
    ...enumColumns(e)
      .slice(0, 2)
      .map((a) => a.name),
    ...measureColumns(e)
      .slice(0, 2)
      .map((a) => a.name),
  ].filter((c, i, all) => all.indexOf(c) === i);
  const registerSelect = [...registerCols, "created_at", "updated_at"].join(", ");
  const qRegister = addQuery(ctx, {
    key: `${slug}__register`,
    name: `${pluralTitle(e)} — register`,
    description: `${help} Newest first.`,
    sql: `SELECT ${registerSelect}\nFROM ${table}\nWHERE ${live}\nORDER BY created_at DESC\nLIMIT 500`,
  });
  ctx.reports.push({
    key: `${slug}__register`,
    name: `${pluralTitle(e)} — register`,
    description: help,
    queryKey: qRegister,
    columns: [...registerCols, "created_at", "updated_at"].map((c) => ({
      field: c,
      label: labelOf(c),
    })),
    pageSize: 50,
  });

  // 2. Breakdowns, one per enum-bound column (the two most characteristic).
  for (const col of enumColumns(e).slice(0, 2)) {
    const values = ctx.model.enums.find((en) => en.name === col.enumRef)?.values ?? [];
    const key = `${slug}__by_${col.name}`;
    const q = addQuery(ctx, {
      key,
      name: `${pluralTitle(e)} by ${labelOf(col.name).toLowerCase()}`,
      description:
        col.description?.trim() ??
        `How ${pluralTitle(e).toLowerCase()} divide across ${labelOf(col.name).toLowerCase()}.`,
      sql: `SELECT COALESCE(${col.name}, '(unset)') AS bucket, COUNT(*) AS records\nFROM ${table}\nWHERE ${live}\nGROUP BY 1\nORDER BY records DESC`,
    });
    ctx.charts.push({
      key,
      name: `${pluralTitle(e)} by ${labelOf(col.name).toLowerCase()}`,
      description:
        col.description?.trim() ?? `${help} Grouped by ${labelOf(col.name).toLowerCase()}.`,
      queryKey: q,
      // Few buckets read as a share of a whole; many read as a ranking. The
      // model states how many, so this is decided rather than guessed.
      chartType: values.length > 0 && values.length <= 6 ? "pie" : "bar",
      xField: "bucket",
      yField: "records",
    });
    ctx.reports.push({
      key,
      name: `${pluralTitle(e)} by ${labelOf(col.name).toLowerCase()}`,
      description: `Counts of ${pluralTitle(e).toLowerCase()} per ${labelOf(col.name).toLowerCase()}.`,
      queryKey: q,
      columns: [
        { field: "bucket", label: labelOf(col.name) },
        { field: "records", label: "Records" },
      ],
      pageSize: 50,
    });
  }

  // 3. Volume over time — every generated table carries created_at.
  const qVolume = addQuery(ctx, {
    key: `${slug}__volume_by_month`,
    name: `${pluralTitle(e)} created per month`,
    description: `New ${pluralTitle(e).toLowerCase()} per month over the last two years.`,
    sql: `SELECT date_trunc('month', created_at)::date AS month, COUNT(*) AS records\nFROM ${table}\nWHERE ${live} AND created_at >= now() - interval '24 months'\nGROUP BY 1\nORDER BY 1`,
  });
  ctx.charts.push({
    key: `${slug}__volume_by_month`,
    name: `${pluralTitle(e)} created per month`,
    description: `${help} Counted by the month the record was created.`,
    queryKey: qVolume,
    chartType: "line",
    xField: "month",
    yField: "records",
  });

  // 4. Lifecycle — only where the model draws a state machine.
  const wf = stateWorkflow(ctx.model, e);
  const statusCol = enumColumns(e).find((a) => /^(status|state)$/.test(a.name))?.name;
  if (wf && statusCol) {
    const states = declaredStates(wf);
    if (states.length > 0) {
      // The states come from the diagram, LEFT JOINed to the counts, so a state
      // the application has never reached shows as zero rather than vanishing.
      // A missing row and a zero row mean very different things here.
      const valuesList = states.map((s, i) => `(${lit(s)}, ${i})`).join(", ");
      const key = `${slug}__lifecycle`;
      const q = addQuery(ctx, {
        key,
        name: `${titleOf(e)} lifecycle — ${wf.name}`,
        description: `Where ${pluralTitle(e).toLowerCase()} sit in the ${wf.name} state machine. Every state the model declares appears, including the ones nothing has reached.`,
        sql: `WITH declared(state, position) AS (\n  VALUES ${valuesList}\n)\nSELECT d.state, COALESCE(c.records, 0) AS records\nFROM declared d\nLEFT JOIN (\n  SELECT ${statusCol} AS state, COUNT(*) AS records\n  FROM ${table}\n  WHERE ${live}\n  GROUP BY 1\n) c ON c.state = d.state\nORDER BY d.position`,
      });
      ctx.reports.push({
        key,
        name: `${titleOf(e)} lifecycle — ${wf.name}`,
        description: `Where ${pluralTitle(e).toLowerCase()} sit in the ${wf.name} state machine, in the order the diagram draws it.`,
        queryKey: q,
        columns: [
          { field: "state", label: "State" },
          { field: "records", label: "Records" },
        ],
        pageSize: 50,
      });
      ctx.charts.push({
        key,
        name: `${titleOf(e)} lifecycle`,
        description: `${pluralTitle(e)} per declared state of ${wf.name}.`,
        queryKey: q,
        chartType: "bar",
        xField: "state",
        yField: "records",
      });
    }
  }

  // 5. Measures — only where the entity has something to add up.
  const measures = measureColumns(e);
  if (measures.length > 0) {
    const groupCol = enumColumns(e)[0]?.name;
    const aggregates = measures
      .slice(0, 4)
      .flatMap((m) => [
        `SUM(${m.name}) AS total_${m.name}`,
        `ROUND(AVG(${m.name})::numeric, 2) AS avg_${m.name}`,
      ]);
    const key = `${slug}__measures`;
    const sql = groupCol
      ? `SELECT COALESCE(${groupCol}, '(unset)') AS bucket, COUNT(*) AS records, ${aggregates.join(", ")}\nFROM ${table}\nWHERE ${live}\nGROUP BY 1\nORDER BY records DESC`
      : `SELECT COUNT(*) AS records, ${aggregates.join(", ")}\nFROM ${table}\nWHERE ${live}`;
    const q = addQuery(ctx, {
      key,
      name: `${pluralTitle(e)} — measures`,
      description: `Totals and averages over the numeric columns of ${pluralTitle(e).toLowerCase()}${groupCol ? `, by ${labelOf(groupCol).toLowerCase()}` : ""}.`,
      sql,
    });
    ctx.reports.push({
      key,
      name: `${pluralTitle(e)} — measures`,
      description: `Totals and averages${groupCol ? ` by ${labelOf(groupCol).toLowerCase()}` : ""}. ${help}`,
      queryKey: q,
      columns: [
        ...(groupCol ? [{ field: "bucket", label: labelOf(groupCol) }] : []),
        { field: "records", label: "Records" },
        ...measures.slice(0, 4).flatMap((m) => [
          { field: `total_${m.name}`, label: `Total ${labelOf(m.name).toLowerCase()}` },
          { field: `avg_${m.name}`, label: `Average ${labelOf(m.name).toLowerCase()}` },
        ]),
      ],
      pageSize: 50,
    });
  }
}

/**
 * `%%report` directives — the queries the model's author wrote for the people
 * who will use the application.
 *
 * These are not derived from anything. Everything else in this file infers a
 * report from structure: an entity earns a register, an enum earns a breakdown,
 * a state machine earns a lifecycle. That inference is complete and shallow —
 * it can tell you how many opportunities sit in each stage, and it can never
 * tell you that the sales manager's actual question is which of them slipped
 * past their close date with no activity logged. That question lives in the
 * model because somebody who understood the business put it there.
 */
function addAuthoredReports(ctx: Ctx): void {
  for (const r of ctx.model.reports) {
    const key = `authored__${r.name}`;
    const description = r.help?.trim() ?? `Declared in the model as %%report ${r.name}.`;
    ctx.queries.push({ key, name: r.title, description, sql: r.sql });

    // Result columns are only knowable by running the query, which this build
    // step deliberately does not do. The chart's own x/y are named, so they are
    // the columns the report shows; without a chart the report renders whatever
    // the query returns, which the platform handles from the result set.
    const columns =
      r.chart && r.x && r.y
        ? [
            { field: r.x, label: labelOf(r.x) },
            { field: r.y, label: labelOf(r.y) },
          ]
        : [];

    ctx.reports.push({
      key,
      name: r.title,
      description,
      queryKey: key,
      columns,
      pageSize: 50,
    });

    if (r.chart && r.x && r.y) {
      ctx.charts.push({
        key,
        name: r.title,
        description,
        queryKey: key,
        chartType: r.chart,
        xField: r.x,
        yField: r.y,
      });
    }
  }
}

/** Children per parent, for every oneToMany the diagram actually draws. */
function deriveRelationships(ctx: Ctx): void {
  const byName = new Map(ctx.model.entities.map((e) => [e.name, e]));
  for (const rel of ctx.model.relationships) {
    if (rel.cardinality !== "oneToMany") continue;
    const parent = byName.get(rel.source);
    const child = byName.get(rel.target);
    if (!parent || !child) continue;
    // Which column on the child points at the parent.
    //
    // `rel.foreignKey` is derived from the relationship's *target*, so on
    // `Team ||--o{ User` it reads `user_id` — the child's own id, not the
    // column that points back at Team. The column wanted here is named for the
    // parent (`team_id`), which is also what the generator's migration emits.
    // The parser's value is still tried second: a model may name the column
    // either way, and a join on a column that does not exist is a report that
    // fails at run time rather than one that is simply absent.
    const fk =
      child.attributes.find((a) => a.name === foreignKeyName(parent.name)) ??
      child.attributes.find((a) => a.name === rel.foreignKey);
    if (!fk) continue;

    const parentDisplay = displayColumn(parent);
    const key = `${child.tableName}__per_${parent.tableName}`;

    /*
     * Whether the two sides of the join are the same SQL type.
     *
     * The generator gives a column `uuid` when the Application Dictionary makes
     * it a Table Direct reference, which needs both the `FK` modifier and a
     * name ending `_id` or `_by`; anything else falls through to `varchar`.
     * A primary key is always `uuid`. So the join is `uuid = uuid` for a column
     * the model marked properly and `uuid = varchar` for one it did not —
     * and PostgreSQL has no implicit cast between them, so the wrong guess is
     * not a slow report but `operator does not exist` on every run.
     *
     * This used to cast the parent's key to text unconditionally, which was
     * right only while a bug elsewhere left every foreign key a `varchar`. The
     * cast is emitted now when the model says it is needed, and the parent's
     * primary-key index is used when it is not.
     */
    const sameType = fk.isForeignKey && (fk.name.endsWith("_id") || fk.name.endsWith("_by"));
    const parentKey = sameType ? `p.${parent.primaryKey}` : `p.${parent.primaryKey}::text`;
    const q = addQuery(ctx, {
      key,
      name: `${pluralTitle(child)} per ${titleOf(parent).toLowerCase()}`,
      description: `How many ${pluralTitle(child).toLowerCase()} each ${titleOf(parent).toLowerCase()} has, most first. Derived from the ${rel.name.replace(/_/g, " ")} relationship the model draws.`,
      sql: `SELECT p.${parentDisplay} AS ${parent.tableName}, COUNT(c.${child.primaryKey}) AS records\nFROM ${tableOf(parent)} p\nLEFT JOIN ${tableOf(child)} c\n  ON c.${fk.name} = ${parentKey} AND c.deleted_at IS NULL\nWHERE p.deleted_at IS NULL\nGROUP BY 1\nORDER BY records DESC\nLIMIT 50`,
    });
    ctx.reports.push({
      key,
      name: `${pluralTitle(child)} per ${titleOf(parent).toLowerCase()}`,
      description: `${helpOf(parent)} Counted by the ${pluralTitle(child).toLowerCase()} attached to each.`,
      queryKey: q,
      columns: [
        { field: parent.tableName, label: titleOf(parent) },
        { field: "records", label: pluralTitle(child) },
      ],
      pageSize: 50,
    });
    ctx.charts.push({
      key,
      name: `${pluralTitle(child)} per ${titleOf(parent).toLowerCase()}`,
      description: `The ${titleOf(parent).toLowerCase()} records carrying the most ${pluralTitle(child).toLowerCase()}.`,
      queryKey: q,
      chartType: "bar",
      xField: parent.tableName,
      yField: "records",
    });
  }
}

/**
 * How central an entity is to the model: what points at it, whether it has a
 * lifecycle, whether it has anything to measure. The overview dashboard shows
 * the top of this ranking rather than whichever entities happen to be first in
 * the file.
 */
function centrality(model: EmlModel, e: EmlEntity): number {
  const incoming = model.relationships.filter((r) => r.source === e.name).length;
  const outgoing = model.relationships.filter((r) => r.target === e.name).length;
  const hasState = model.workflows.some((w) => w.kind === "state" && w.entity === e.name) ? 3 : 0;
  const hasMeasures = measureColumns(e).length > 0 ? 1 : 0;
  return incoming * 2 + outgoing + hasState + hasMeasures;
}

function deriveDashboards(ctx: Ctx, model: EmlModel): DashboardSpec[] {
  const ranked = [...model.entities].sort((a, b) => centrality(model, b) - centrality(model, a));
  const headline = ranked.slice(0, 6);

  const widgets: DashboardWidgetSpec[] = [];
  let x = 0;
  let y = 0;
  const place = (title: string, chartKey: string) => {
    widgets.push({ chartKey, title, x, y, w: 6, h: 4 });
    x += 6;
    if (x >= 12) {
      x = 0;
      y += 4;
    }
  };

  // An authored chart is a question somebody asked for by name, so it takes the
  // top of the dashboard ahead of anything inferred.
  for (const c of ctx.charts.filter((x) => x.key.startsWith("authored__")).slice(0, 4)) {
    place(c.name, c.key);
  }

  for (const e of headline) {
    // A lifecycle chart where the model draws one, else the primary breakdown,
    // else the volume line. Every entity contributes exactly one tile, so the
    // dashboard stays readable on a model with fifty entities.
    const lifecycle = ctx.charts.find((c) => c.key === `${e.tableName}__lifecycle`);
    const breakdown = ctx.charts.find((c) => c.key.startsWith(`${e.tableName}__by_`));
    const volume = ctx.charts.find((c) => c.key === `${e.tableName}__volume_by_month`);
    const chosen = lifecycle ?? breakdown ?? volume;
    if (chosen) place(chosen.name, chosen.key);
  }

  const appName = model.meta.name ?? "Application";
  return [
    {
      key: "overview",
      name: `${appName} — overview`,
      description:
        model.meta.description?.trim() ??
        `The ${headline.length} entities this model puts at the centre of ${appName}, one tile each.`,
      widgets,
    },
  ];
}

/**
 * Drop a derived item whose *name* an authored one already uses.
 *
 * The reporting platform has no column for the pack's key: its seeder upserts
 * by name, the way its own sample seeds do. So two items sharing a name are not
 * two rows in the platform — they are one row, written twice, and which query
 * survives depends on insertion order. Nothing reports it.
 *
 * That is not hypothetical. An authored "Accounts per territory" collided with
 * the children-per-parent report derived from the same relationship, and the
 * derived one silently replaced the query somebody had written by hand.
 *
 * The authored one wins: it is the same question asked deliberately, usually
 * with the filters and joins the derived version cannot know about.
 */
function dropDerivedDuplicatesOfAuthored(ctx: Ctx): void {
  const authoredNames = new Set(
    [...ctx.reports, ...ctx.charts, ...ctx.queries]
      .filter((x) => x.key.startsWith("authored__"))
      .map((x) => x.name)
  );
  if (authoredNames.size === 0) return;

  const keep = <T extends { key: string; name: string }>(items: T[]): T[] =>
    items.filter((x) => x.key.startsWith("authored__") || !authoredNames.has(x.name));

  const droppedQueryKeys = new Set(
    ctx.queries
      .filter((q) => !q.key.startsWith("authored__") && authoredNames.has(q.name))
      .map((q) => q.key)
  );

  ctx.queries = keep(ctx.queries);
  // A report or chart whose query has gone must go too, or it points at nothing.
  ctx.reports = keep(ctx.reports).filter((r) => !droppedQueryKeys.has(r.queryKey));
  ctx.charts = keep(ctx.charts).filter((c) => !droppedQueryKeys.has(c.queryKey));
}

/**
 * Names are what the platform keys on, so a duplicate is data loss rather than
 * a cosmetic problem. Checked here so it fails the build, loudly, instead of
 * surfacing as a report whose query is not the one it was written with.
 */
function assertNamesUnique(ctx: Ctx, dashboards: DashboardSpec[]): void {
  const collections: [string, { name: string; key: string }[]][] = [
    ["queries", ctx.queries],
    ["reports", ctx.reports],
    ["charts", ctx.charts],
    ["dashboards", dashboards],
  ];
  const problems: string[] = [];
  for (const [label, items] of collections) {
    const byName = new Map<string, string[]>();
    for (const item of items) {
      byName.set(item.name, [...(byName.get(item.name) ?? []), item.key]);
    }
    for (const [name, keys] of byName) {
      if (keys.length > 1) problems.push(`  ${label}: "${name}" ← ${keys.join(", ")}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `The pack has items sharing a name. The reporting platform upserts by name, so these would collapse into one row:\n${problems.join("\n")}`
    );
  }
}

// --- Entry point -------------------------------------------------------------

export function buildPack(source: string, modelPath: string, databaseName: string): ReportingPack {
  const model = parseEml(source);
  const errors = model.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Model has ${errors.length} error(s); run the checker first:\n` +
        errors.map((d) => `  ${d.code} ${d.message}`).join("\n")
    );
  }
  if (model.entities.length === 0) throw new Error("Model declares no entities.");

  const ctx: Ctx = { model, queries: [], reports: [], charts: [] };
  // Authored first, and therefore listed first. A `%%report` is a question
  // somebody decided the application's users ask; the derived ones below
  // describe the shape of the data and cannot know that.
  addAuthoredReports(ctx);
  for (const e of model.entities) deriveEntity(ctx, e);
  deriveRelationships(ctx);
  dropDerivedDuplicatesOfAuthored(ctx);
  const dashboards = deriveDashboards(ctx, model);
  assertNamesUnique(ctx, dashboards);

  const appName = model.meta.name ?? path.basename(modelPath).replace(/\.eml\.mmd$/, "");
  return {
    application: {
      name: appName,
      description:
        model.meta.description?.trim() ??
        `${appName}: ${model.entities.length} entities, ${model.workflows.length} workflows.`,
      model: path.basename(modelPath),
      databaseName,
      generatedAt: new Date().toISOString(),
    },
    dataSource: {
      name: `${appName} (application database)`,
      description: `The generated application's own PostgreSQL database, read directly. Every report and chart below is a query against its bus_ tables.`,
      clientType: "pg",
    },
    queries: ctx.queries,
    reports: ctx.reports,
    charts: ctx.charts,
    dashboards,
  };
}

function main(): number {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const input = flag("-i") ?? flag("--input");
  const output = flag("-o") ?? flag("--output") ?? "reporting-pack.json";
  const database = flag("--database") ?? "appdb";

  if (!input) {
    console.error("usage: reporting-pack.ts -i <model.eml.mmd> [-o pack.json] [--database name]");
    return 2;
  }
  if (!existsSync(input)) {
    console.error(`Model not found: ${input}`);
    return 2;
  }

  const pack = buildPack(readFileSync(input, "utf8"), input, database);
  mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(pack, null, 2)}\n`);

  console.log(`  ${pack.application.name}`);
  console.log(
    `  ${pack.queries.length} queries · ${pack.reports.length} reports · ${pack.charts.length} charts · ${pack.dashboards.length} dashboard(s)`
  );
  console.log(`  → ${output}`);
  return 0;
}

if (import.meta.main) process.exit(main());
