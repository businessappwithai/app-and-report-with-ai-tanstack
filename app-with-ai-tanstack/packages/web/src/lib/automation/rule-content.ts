/**
 * Reading and writing what the rules API stores.
 *
 * Rules predate the rule-table editor, so `jdm_content` may hold either a
 * decision table or an older JDM decision graph. Anything that is not a table
 * opens as an empty one rather than a guessed conversion: a graph flattened by
 * assumption would look like a working table while deciding something different,
 * and visibly empty is the failure an author can actually see and fix.
 */

import { type DecisionTable, emptyDecisionTable } from "../workflow/bpmn-model";

/** What the rules API round-trips. Kept loose because older rows vary. */
export type StoredRuleContent = DecisionTable | Record<string, unknown>;

export function isDecisionTable(content: unknown): content is DecisionTable {
  if (!content || typeof content !== "object") return false;
  const c = content as Partial<DecisionTable>;
  return Array.isArray(c.inputs) && Array.isArray(c.outputs) && Array.isArray(c.rules);
}

/** A table to edit, whatever was stored. */
export function asDecisionTable(content: unknown): DecisionTable {
  // Parse JSON strings that came back from the API as raw text
  const parsed: unknown =
    typeof content === "string"
      ? (() => {
          try {
            return JSON.parse(content);
          } catch {
            return null;
          }
        })()
      : content;

  if (isDecisionTable(parsed)) {
    const t = parsed as DecisionTable;
    return {
      hitPolicy: t.hitPolicy === "collect" ? "collect" : "first",
      inputs: t.inputs,
      outputs: t.outputs,
      rules: t.rules,
    };
  }

  // JDM graph format: { name, nodes: [..., { type: "decisionTableNode", content: {...} }] }
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).nodes)
  ) {
    const nodes = (parsed as { nodes: unknown[] }).nodes;
    for (const node of nodes) {
      if (
        node &&
        typeof node === "object" &&
        (node as Record<string, unknown>).type === "decisionTableNode"
      ) {
        const tableContent = (node as Record<string, unknown>).content;
        if (isDecisionTable(tableContent)) {
          const t = tableContent as DecisionTable;
          return {
            hitPolicy: t.hitPolicy === "collect" ? "collect" : "first",
            inputs: t.inputs,
            outputs: t.outputs,
            rules: t.rules,
          };
        }
      }
    }
  }

  return emptyDecisionTable();
}

/** The older decision-graph shape, still accepted on write for existing tooling. */
export function isJdmGraph(content: unknown): boolean {
  if (!content || typeof content !== "object") return false;
  const c = content as { name?: unknown; nodes?: unknown };
  return typeof c.name === "string" && Array.isArray(c.nodes) && c.nodes.length > 0;
}

/**
 * What is wrong with a rule someone is trying to save, in the words they would
 * use to fix it. Empty means it is fine.
 *
 * Both shapes are accepted: a decision table, which is what the rule table
 * editor writes, and a JDM graph, which is what older rules and any external
 * tooling still write. Validating only the graph shape is what made the table
 * editor unable to save at all.
 */
export function validateStoredRuleContent(content: unknown): string[] {
  if (!content || typeof content !== "object") {
    return ["The rule has no content. Add at least one row."];
  }

  if (isDecisionTable(content)) {
    const table = content as DecisionTable;
    const problems: string[] = [];
    if (table.inputs.length === 0) problems.push("Add at least one input column to test against.");
    if (table.outputs.length === 0) {
      problems.push("Add at least one outcome column — a table that decides nothing does nothing.");
    }
    if (table.rules.length === 0) problems.push("Add at least one row.");
    for (const column of [...table.inputs, ...table.outputs]) {
      if (!String(column.field ?? "").trim()) {
        problems.push(`Column "${column.name || column.id}" does not say which field it reads.`);
      }
    }
    return problems;
  }

  if (isJdmGraph(content)) return [];

  return [
    "The rule content is neither a decision table nor a decision graph. Build it in the rule table editor.",
  ];
}

/**
 * Whether opening this rule will lose what was stored.
 *
 * True for a rule saved as something other than a table — the editor shows an
 * empty table, and saving would replace the old content. The routes use this to
 * warn before that happens rather than after.
 */
export function wouldReplaceStoredContent(content: unknown): boolean {
  return content !== null && content !== undefined && !isDecisionTable(content);
}
