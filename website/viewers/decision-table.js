/**
 * A decision table, drawn as a table.
 *
 * A `Decision` step carries its table as JSON in the `decisionTable` property,
 * and printing that JSON is printing the thing rather than showing it: four
 * inputs and five rows arrive as a two-hundred-character line that no reader
 * checks. The generated application's rule editor shows the same structure as a
 * grid -- inputs on the left, outputs on the right, one row per rule, read top
 * to bottom until one matches -- so that is what this draws.
 *
 * The shape is GoRules' own: `hitPolicy`, `inputs`, `outputs`, `rules`, where
 * each rule keys its cells by column id. Nothing is interpreted; an empty cell
 * means the column does not constrain that row, which is what the engine does
 * with it.
 */

import { el } from "./canvas.js";

/** Read the JSON a step or a rule carries. Returns null when it is not one. */
export function parseDecisionTable(json) {
  if (!json || !json.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  return {
    hitPolicy: parsed.hitPolicy === "collect" ? "collect" : "first",
    inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
    outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
  };
}

/** Draw one. Returns null when the JSON is not a table, so a caller can fall through. */
export function decisionTableElement(json) {
  const table = parseDecisionTable(json);
  if (!table || (table.inputs.length === 0 && table.outputs.length === 0)) return null;

  const wrapper = el("div", "awv-dt");

  const policy = el("p", "awv-dt-policy");
  policy.append(el("span", "awv-badge is-when", table.hitPolicy));
  policy.append(
    document.createTextNode(
      table.hitPolicy === "first"
        ? " — the first row whose inputs all match decides, and the rest are not read."
        : " — every row whose inputs match contributes, and the outputs collect."
    )
  );
  wrapper.append(policy);

  const grid = el("table", "awv-dt-grid");

  const head = el("thead");
  const groupRow = el("tr", "awv-dt-groups");
  if (table.inputs.length) {
    const cell = el("th", "awv-dt-group is-input", "When");
    cell.colSpan = table.inputs.length;
    groupRow.append(cell);
  }
  if (table.outputs.length) {
    const cell = el("th", "awv-dt-group is-output", "Then");
    cell.colSpan = table.outputs.length;
    groupRow.append(cell);
  }
  head.append(groupRow);

  const columnRow = el("tr");
  for (const column of table.inputs) columnRow.append(columnHeader(column, "is-input"));
  for (const column of table.outputs) columnRow.append(columnHeader(column, "is-output"));
  head.append(columnRow);
  grid.append(head);

  const body = el("tbody");
  for (const rule of table.rules) {
    const row = el("tr");
    for (const column of table.inputs) row.append(cell(rule[column.id], "is-input"));
    for (const column of table.outputs) row.append(cell(rule[column.id], "is-output"));
    body.append(row);
  }
  grid.append(body);

  wrapper.append(grid);
  return wrapper;
}

function columnHeader(column, kind) {
  const cell = el("th", "awv-dt-column " + kind);
  cell.append(el("span", "awv-dt-column-name", column.name || column.field || ""));
  if (column.field && column.field !== column.name) {
    cell.append(el("code", "awv-dt-column-field", column.field));
  }
  return cell;
}

function cell(value, kind) {
  const text = (value === undefined || value === null ? "" : String(value)).trim();
  const node = el("td", "awv-dt-cell " + kind, text || "—");
  // An empty input cell is not a missing value: it is the row saying it does
  // not care about that column. Marked so the two do not read alike.
  if (!text) node.classList.add("is-any");
  return node;
}
