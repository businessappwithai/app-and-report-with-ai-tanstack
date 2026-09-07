// Business-rule engine.
// Evaluates the decision flows compiled from the EML rules sections. Each rule
// is a directed graph of nodes (input/decision/expression/function/output) and
// edges. Evaluation walks the graph from the input node, taking decision
// branches based on the record's field values, and returns a decision trace.

import { MODEL } from "./model.js";

/** Evaluate a single parsed condition against a record. */
function evalCondition(cond, record) {
  if (!cond) return null;
  const raw = record[cond.field];
  const num = Number(raw);
  const cmp = Number(cond.value);
  switch (cond.op) {
    case ">":
      return num > cmp;
    case ">=":
      return num >= cmp;
    case "<":
      return num < cmp;
    case "<=":
      return num <= cmp;
    case "==":
      return String(raw) === String(cond.value);
    case "!=":
      return String(raw) !== String(cond.value);
    case "contains":
      return String(raw ?? "")
        .toLowerCase()
        .includes(String(cond.value).toLowerCase());
    default:
      return null;
  }
}

const TRUE_LABELS = new Set(["yes", "true", "y"]);
const FALSE_LABELS = new Set(["no", "false", "n"]);

/** Evaluate one rule graph against a record. Returns a decision trace. */
export function evaluateRule(rule, record) {
  const byId = new Map(rule.nodes.map((n) => [n.id, n]));
  const out = new Map();
  for (const e of rule.edges) {
    if (!out.has(e.source)) out.set(e.source, []);
    out.get(e.source).push(e);
  }

  const start = rule.nodes.find((n) => n.jdmType === "inputNode") ?? rule.nodes[0];
  const trace = [];
  const actions = [];
  const decisions = [];
  let node = start;
  let guard = 0;

  while (node && guard++ < 1000) {
    trace.push(node.id);
    const edges = out.get(node.id) ?? [];

    if (node.jdmType === "outputNode" || edges.length === 0) break;

    if (node.jdmType === "expressionNode" || node.jdmType === "functionNode") {
      actions.push(node.label);
    }

    let next = null;
    if (node.jdmType === "switchNode") {
      const result = evalCondition(node.condition, record);
      if (result !== null) {
        const want = result ? TRUE_LABELS : FALSE_LABELS;
        next = edges.find((e) => e.label && want.has(e.label.trim().toLowerCase())) ?? null;
        decisions.push({ node: node.id, condition: node.condition?.raw, result });
      }
      if (!next) {
        next = edges[0];
        decisions.push({
          node: node.id,
          condition: node.label,
          result: "unresolved (took first branch)",
        });
      }
    } else {
      next = edges[0];
    }

    node = next ? byId.get(next.target) : null;
  }

  return { rule: rule.name, trace, actions, decisions };
}

/** Run every rule bound to (entity, event), ordered by priority. */
export function runRules(entity, event, record) {
  const applicable = (MODEL.rules ?? [])
    .filter((r) => r.entity === entity && r.event === event)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return applicable.map((r) => evaluateRule(r, record));
}
