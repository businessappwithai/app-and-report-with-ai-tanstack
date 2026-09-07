/**
 * GraphRAG — retrieve NL query context from the Apache AGE knowledge graph.
 *
 * Given a user's natural-language question and a data source ID, returns
 * the tables, columns, and FK paths most likely needed to answer it.
 * The caller (mastra-connector / llama-translator) injects this context
 * into the LLM prompt so the model knows the schema without seeing the
 * entire database.
 *
 * Two retrieval strategies run in parallel and their results are merged:
 *
 *   1. Keyword match  — Cypher CONTAINS search on table/column names and
 *      descriptions, ranked by how many query tokens hit.
 *   2. FK expansion   — for each matched table, pull in one hop of FK
 *      neighbours so the LLM can write JOINs without being told to.
 */

import { cypher, type CypherRow } from "./client";

export interface GraphContext {
  tables: TableContext[];
  llmKnowledge: { title: string; body: string }[];
  totalTokenEstimate: number;
}

export interface TableContext {
  tableName: string;
  schemaName: string;
  columns: ColumnContext[];
  relatedTables: string[];
}

export interface ColumnContext {
  name: string;
  dataType: string;
  nullable: boolean;
  isPk: boolean;
  isFk: boolean;
}

// --------------------------------------------------------------------------
// Helpers — parse AGE agtype values back to plain JS
// --------------------------------------------------------------------------

function prop(node: CypherRow, alias: string, key: string): unknown {
  const raw = node[alias];
  if (typeof raw !== "string") return undefined;
  try {
    // AGE returns agtype as JSON-like strings; unwrap the vertex wrapper
    const parsed = JSON.parse(raw.replace(/::vertex$/, "").replace(/::edge$/, ""));
    return parsed?.properties?.[key] ?? parsed?.[key];
  } catch {
    return undefined;
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function bool(v: unknown): boolean {
  return v === true || v === "true";
}

// --------------------------------------------------------------------------
// Keyword-based table discovery
// --------------------------------------------------------------------------

async function findRelevantTables(
  dsId: string,
  tokens: string[],
): Promise<string[]> {
  if (tokens.length === 0) return [];

  // Build one CONTAINS clause per token, OR-joined
  const conditions = tokens
    .map((t) => `toLower(t.name) CONTAINS toLower('${t.replace(/'/g, "\\'")}')`)
    .join(" OR ");

  const rows = await cypher(
    `MATCH (ds:DataSource {id: $ds_id})-[:HAS_TABLE]->(t:Table)
     WHERE ${conditions}
     RETURN t`,
    { ds_id: dsId },
    ["t"],
  );

  return rows.map((r) => str(prop(r, "t", "fqn")));
}

// --------------------------------------------------------------------------
// Expand one FK hop from matched tables
// --------------------------------------------------------------------------

async function expandFkNeighbours(tableFqns: string[]): Promise<string[]> {
  if (tableFqns.length === 0) return [];

  const inList = tableFqns.map((f) => `'${f.replace(/'/g, "\\'")}'`).join(", ");

  const rows = await cypher(
    `MATCH (t:Table)-[:HAS_COLUMN]->(:Column)-[:FK_REFERENCES]->(c2:Column)<-[:HAS_COLUMN]-(t2:Table)
     WHERE t.fqn IN [${inList}]
     RETURN DISTINCT t2`,
    {},
    ["t2"],
  );

  const extra = rows.map((r) => str(prop(r, "t2", "fqn"))).filter(Boolean);
  return [...new Set([...tableFqns, ...extra])];
}

// --------------------------------------------------------------------------
// Load full column details for a set of tables
// --------------------------------------------------------------------------

async function loadTableContexts(tableFqns: string[]): Promise<TableContext[]> {
  if (tableFqns.length === 0) return [];

  const inList = tableFqns.map((f) => `'${f.replace(/'/g, "\\'")}'`).join(", ");

  const rows = await cypher(
    `MATCH (t:Table)-[:HAS_COLUMN]->(c:Column)
     WHERE t.fqn IN [${inList}]
     RETURN t, c`,
    {},
    ["t", "c"],
  );

  const byTable = new Map<string, { ctx: TableContext; seen: Set<string> }>();

  for (const row of rows) {
    const tFqn = str(prop(row, "t", "fqn"));
    const tName = str(prop(row, "t", "name"));
    const tSchema = str(prop(row, "t", "schema_name")) || "public";

    if (!byTable.has(tFqn)) {
      byTable.set(tFqn, {
        ctx: { tableName: tName, schemaName: tSchema, columns: [], relatedTables: [] },
        seen: new Set(),
      });
    }

    const entry = byTable.get(tFqn)!;
    const colName = str(prop(row, "c", "name"));
    if (colName && !entry.seen.has(colName)) {
      entry.seen.add(colName);
      entry.ctx.columns.push({
        name: colName,
        dataType: str(prop(row, "c", "data_type")),
        nullable: bool(prop(row, "c", "nullable")),
        isPk: bool(prop(row, "c", "is_pk")),
        isFk: bool(prop(row, "c", "is_fk")),
      });
    }
  }

  // Annotate FK neighbours
  for (const [fqn, { ctx }] of byTable) {
    const fkRows = await cypher(
      `MATCH (t:Table {fqn: $fqn})-[:HAS_COLUMN]->(:Column)-[:FK_REFERENCES]->(:Column)<-[:HAS_COLUMN]-(t2:Table)
       RETURN DISTINCT t2`,
      { fqn },
      ["t2"],
    );
    ctx.relatedTables = fkRows.map((r) => str(prop(r, "t2", "name"))).filter(Boolean);
  }

  return [...byTable.values()].map((e) => e.ctx);
}

// --------------------------------------------------------------------------
// LLMKnowledge search
// --------------------------------------------------------------------------

async function findLLMKnowledge(tokens: string[], maxDocs = 3): Promise<{ title: string; body: string }[]> {
  if (tokens.length === 0) return [];

  const conditions = tokens
    .map((t) => `toLower(n.title) CONTAINS toLower('${t.replace(/'/g, "\\'")}') OR toLower(n.body) CONTAINS toLower('${t.replace(/'/g, "\\'")}')`)
    .join(" OR ");

  try {
    const rows = await cypher(
      `MATCH (n:LLMKnowledge) WHERE ${conditions} RETURN n`,
      {},
      ["n"],
    );

    return rows
      .slice(0, maxDocs)
      .map((r) => ({
        title: str(prop(r, "n", "title")),
        body: str(prop(r, "n", "body")).slice(0, 800),
      }))
      .filter((d) => d.title);
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Retrieve graph-based schema context for an NL query.
 *
 * @param dsId    - Data source ID to scope the search.
 * @param question - The user's natural-language question.
 * @param maxTables - Cap on how many tables to include (default 8).
 */
export async function getGraphContext(
  dsId: string,
  question: string,
  maxTables = 8,
): Promise<GraphContext> {
  // Tokenise the question (split on non-alphanumeric, keep 3+ char tokens)
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 20);

  const [matched, llmKnowledge] = await Promise.all([
    findRelevantTables(dsId, tokens),
    findLLMKnowledge(tokens),
  ]);
  const expanded = await expandFkNeighbours(matched.slice(0, maxTables));
  const capped = expanded.slice(0, maxTables);

  const tables = await loadTableContexts(capped);

  const totalTokenEstimate =
    tables.reduce((sum, t) => sum + 30 + t.columns.length * 15, 0) +
    llmKnowledge.reduce((sum, d) => sum + Math.ceil(d.body.length / 4), 0);

  return { tables, llmKnowledge, totalTokenEstimate };
}

/**
 * Format GraphContext as a compact prompt section.
 */
export function formatGraphContext(ctx: GraphContext): string {
  const lines: string[] = [];

  if (ctx.tables.length > 0) {
    lines.push("-- Relevant schema from knowledge graph --");
    for (const t of ctx.tables) {
      const cols = t.columns
        .map((c) => {
          const flags = [c.isPk && "PK", c.isFk && "FK"].filter(Boolean).join(",");
          return `  ${c.name} ${c.dataType}${flags ? ` [${flags}]` : ""}${c.nullable ? "" : " NOT NULL"}`;
        })
        .join("\n");
      lines.push(`TABLE ${t.schemaName}.${t.tableName}:\n${cols}`);
      if (t.relatedTables.length > 0) {
        lines.push(`  -- joins: ${t.relatedTables.join(", ")}`);
      }
    }
  }

  if (ctx.llmKnowledge.length > 0) {
    lines.push("\n-- Relevant documentation --");
    for (const doc of ctx.llmKnowledge) {
      lines.push(`[${doc.title}]\n${doc.body}`);
    }
  }

  return lines.join("\n");
}
