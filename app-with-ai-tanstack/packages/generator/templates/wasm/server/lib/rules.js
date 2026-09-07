/**
 * The rules engine.
 *
 * Rules reach a generated application as GoRules JDM, in the two shapes the
 * compiler emits: a decision table when the section declared `%%action`
 * directives, and a node graph otherwise. The NestJS stack evaluates both with
 * zen-engine; zen-engine is a Rust library with a native binding, so this is
 * the browser's implementation of the same contract — same JDM in, same
 * `{ action, message, ruleId, ... }` violations out.
 *
 * The node-graph half needs one thing zen-engine never had to do. A rules
 * flowchart's decisions are written as prose — `Status == draft?`, `Title
 * provided?`, `Set severity: critical` — because that is what makes the section
 * render as a diagram a person can read. `interpretCondition` below recognises
 * the forms the language's own examples use and turns them into expressions;
 * anything it does not recognise is reported as `assumed` rather than quietly
 * treated as true, so a rule nobody can evaluate never passes for a rule that
 * evaluated and agreed.
 */

import { evaluate, test } from "./expr.js";
import { snakeCase } from "./naming.js";

/** `'draft'` -> `draft`. Decision-table cells are quoted zen literals. */
function unquote(cell) {
  const value = String(cell ?? "").trim();
  const match = value.match(/^'(.*)'$/s) || value.match(/^"(.*)"$/s);
  return match ? match[1].replace(/\\'/g, "'") : value;
}

/**
 * Turn a flowchart decision label into an expression over the record.
 *
 * Returns `{ expression }` when a form was recognised, `{ assumed: true }`
 * otherwise. Order matters: the most specific patterns run first, because
 * `Estimated duration >= 1?` also matches the "is this field set" shape.
 */
export function interpretCondition(label, columns = []) {
  const raw = String(label ?? "").trim().replace(/\?+$/, "").trim();
  if (!raw) return { assumed: true, reason: "empty label" };

  const known = new Set(columns);
  /** Resolve prose to a column: "Estimated duration" -> estimated_duration. */
  const column = (words) => {
    const snake = snakeCase(String(words).trim().replace(/[^A-Za-z0-9 _-]/g, " ").trim());
    if (known.has(snake)) return snake;
    const singular = snake.replace(/s$/, "");
    if (known.has(singular)) return singular;
    const tail = snake.split("_").slice(-2).join("_");
    if (known.has(tail)) return tail;
    const last = snake.split("_").pop();
    return known.has(last) ? last : null;
  };

  // `X length >= 100`
  let match = raw.match(/^(.+?)\s+length\s*(>=|<=|>|<|==|=)\s*(\d+)$/i);
  if (match) {
    const field = column(match[1]);
    if (field) {
      return { expression: `len(${field}) ${match[2] === "=" ? "==" : match[2]} ${match[3]}` };
    }
  }

  // `Status == draft`, `Amount >= 1000`, `Type = internal`
  match = raw.match(/^(.+?)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
  if (match) {
    const field = column(match[1]);
    if (field) {
      const operator = match[2] === "=" ? "==" : match[2];
      const literal = match[3].trim().replace(/^['"]|['"]$/g, "");
      const value = /^-?\d+(\.\d+)?$/.test(literal)
        ? literal
        : /^(true|false|null)$/i.test(literal)
          ? literal.toLowerCase()
          : `'${literal.replace(/'/g, "\\'")}'`;
      return { expression: `${field} ${operator} ${value}` };
    }
  }

  // `Title provided`, `PI assigned`, `Approver set`, `Notes present`
  match = raw.match(/^(.+?)\s+(provided|assigned|set|present|given|specified|filled)$/i);
  if (match) {
    const field = column(match[1]);
    if (field) return { expression: `not isEmpty(${field})` };
  }

  // `X missing`, `X empty`, `No approver`
  match = raw.match(/^(?:no\s+)?(.+?)\s*(missing|empty|blank)?$/i);
  if (match && /missing|empty|blank/i.test(raw)) {
    const field = column(match[1]);
    if (field) return { expression: `isEmpty(${field})` };
  }

  // A bare column name reads as its own truthiness: `Instrument is_active?`
  const bare = column(raw);
  if (bare) return { expression: bare };

  // Already an expression over known columns — the model may just write one.
  try {
    const referenced = raw.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
    if (referenced.some((name) => known.has(name))) {
      evaluate(raw, {});
      return { expression: raw };
    }
  } catch {
    // Not an expression either; fall through to `assumed`.
  }

  return { assumed: true, reason: `no column matches "${raw}"` };
}

/** `Set severity: critical` / `Reject: Title Required` / `Notify QA`. */
function interpretAction(label, columns) {
  const raw = String(label ?? "").trim();

  let match = raw.match(/^set\s+(.+?)\s*[:=]\s*(.+)$/i);
  if (match) {
    const snake = snakeCase(match[1]);
    const field = columns.includes(snake) ? snake : snake;
    return { action: "set", field, value: match[2].trim(), message: raw };
  }

  match = raw.match(/^(reject|deny|block|fail)\s*[:-]?\s*(.*)$/i);
  if (match) {
    return { action: "reject", message: match[2].trim() || raw };
  }

  match = raw.match(/^(notify|alert|escalate|email)\s+(.+)$/i);
  if (match) {
    return { action: "notify", target: match[2].trim(), message: raw };
  }

  return { action: "note", message: raw };
}

function evaluateDecisionTable(node, record) {
  const content = node.content || {};
  const outputs = content.outputs || [];
  const results = [];

  for (const row of content.rules || []) {
    const input = (content.inputs || [])[0];
    const condition = input ? row[input.id] : null;
    let matched;
    try {
      matched = test(condition, record);
    } catch (error) {
      results.push({ action: "error", message: `Rule row "${row._id}": ${error.message}` });
      continue;
    }
    if (!matched) continue;

    const value = {};
    for (const output of outputs) {
      const cell = row[output.id];
      if (cell === undefined) continue;
      const unquoted = unquote(cell);
      if (unquoted !== "") value[output.field] = unquoted;
    }
    results.push(value);
    if (content.hitPolicy !== "collect") break;
  }

  return results;
}

/**
 * Walk a decision graph.
 *
 * The traversal is breadth-first over reachable nodes with a visit cap, not a
 * recursive descent: a flowchart is authored by hand and may contain a cycle,
 * and a rule that hangs the tab is worse than one that reports it gave up.
 */
function evaluateGraph(graph, record, columns) {
  const nodes = new Map((graph.nodes || []).map((node) => [node.id, node]));
  const outgoing = new Map();
  for (const edge of graph.edges || []) {
    if (!outgoing.has(edge.sourceId)) outgoing.set(edge.sourceId, []);
    outgoing.get(edge.sourceId).push(edge);
  }

  const start =
    (graph.nodes || []).find((node) => node.type === "inputNode") || (graph.nodes || [])[0];
  if (!start) return { results: [], trace: [] };

  const results = [];
  const trace = [];
  const queue = [start.id];
  const seen = new Set();
  let visits = 0;

  while (queue.length && visits < 200) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    visits += 1;

    const node = nodes.get(id);
    if (!node) continue;
    const edges = outgoing.get(id) || [];

    if (node.type === "decisionTableNode") {
      results.push(...evaluateDecisionTable(node, record));
      for (const edge of edges) queue.push(edge.targetId);
      continue;
    }

    if (node.type === "switchNode") {
      const interpreted = interpretCondition(node.name, columns);
      let outcome;
      if (interpreted.expression) {
        try {
          outcome = test(interpreted.expression, record);
          trace.push({ node: node.name, expression: interpreted.expression, outcome });
        } catch (error) {
          outcome = true;
          trace.push({ node: node.name, assumed: true, reason: error.message });
        }
      } else {
        // Unreadable decision: follow the affirmative branch so the rest of the
        // graph still runs, and say so, rather than reporting a clean pass.
        outcome = true;
        trace.push({ node: node.name, assumed: true, reason: interpreted.reason });
      }

      const wanted = outcome ? /^(yes|true|y)$/i : /^(no|false|n)$/i;
      const branch =
        edges.find((edge) => wanted.test(String(edge.name || "").trim())) ||
        edges.find((edge) => !edge.name) ||
        (edges.length === 1 ? edges[0] : null);
      if (branch) queue.push(branch.targetId);
      continue;
    }

    if (node.type === "outputNode") {
      continue;
    }

    if (node.type !== "inputNode") {
      const action = interpretAction(node.name, columns);
      if (action.action !== "note") results.push(action);
      trace.push({ node: node.name, action: action.action });
    }

    for (const edge of edges) queue.push(edge.targetId);
  }

  return { results, trace };
}

/**
 * Evaluate every rule bound to an entity operation.
 *
 * Returns the violations and the mutations separately: a `reject` stops the
 * write with a 422, a `set` is applied to the record before it is stored. That
 * split is what makes "the rule decided" and "the rule acted" two visible
 * things rather than one opaque outcome.
 */
export async function evaluateRules(rules, record, options = {}) {
  const columns = options.columns || Object.keys(record || {});
  const violations = [];
  const mutations = {};
  const notifications = [];
  const traces = [];

  for (const rule of rules) {
    let graph;
    try {
      graph = typeof rule.jdm_content === "string" ? JSON.parse(rule.jdm_content) : rule.jdm_content;
    } catch (error) {
      violations.push({ ruleId: rule.name, action: "error", message: `Unreadable JDM: ${error.message}` });
      continue;
    }

    const table = (graph.nodes || []).find((node) => node.type === "decisionTableNode");
    const outcome = table
      ? { results: evaluateDecisionTable(table, record), trace: [] }
      : evaluateGraph(graph, record, columns);

    traces.push({ rule: rule.name, trace: outcome.trace });

    for (const result of outcome.results) {
      const action = String(result.action || "").toLowerCase();
      if (action === "reject" || action === "error") {
        violations.push({ ruleId: result.ruleId || rule.name, ...result });
      } else if (action === "set" && result.field) {
        mutations[result.field] = result.value;
      } else if (action === "notify" || action.startsWith("trigger")) {
        notifications.push({ ruleId: result.ruleId || rule.name, ...result });
      } else if (result.field && result.value !== undefined) {
        mutations[result.field] = result.value;
      } else if (result.message) {
        notifications.push({ ruleId: result.ruleId || rule.name, ...result });
      }
    }
  }

  return { violations, mutations, notifications, traces };
}
