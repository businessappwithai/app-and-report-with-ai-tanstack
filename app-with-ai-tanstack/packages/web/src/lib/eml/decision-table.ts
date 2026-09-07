/**
 * Decision table model shared between the rule editor and the EML layer.
 *
 * Rules are authored as decision tables. The EML representation embeds the
 * table as a `%%decision-table` directive inside a minimal Mermaid flowchart
 * so the file round-trips without loss. The generator reads the directive and
 * compiles it to a GoRules JDM decision graph for the generated app.
 */

export interface DecisionColumn {
  id: string;
  name: string;
  /** Context key read (inputs) or published (outputs). */
  field: string;
  /** When set, the cell renders as a dropdown constrained to these values. */
  options?: string[];
}

/** The output columns the generated rule engine recognises. */
export const KNOWN_OUTPUT_FIELDS = [
  { field: "action", label: "Action" },
  { field: "message", label: "Message" },
  { field: "ruleId", label: "Rule ID" },
  { field: "workflowName", label: "Workflow Name" },
  { field: "field", label: "Field" },
  { field: "value", label: "Value" },
  { field: "targetEntity", label: "Target Entity" },
  { field: "linkField", label: "Link Field" },
] as const;

/** Auto-applied options when a column field matches a known name. */
export const WELL_KNOWN_OPTIONS: Record<string, string[]> = {
  action: ["trigger-workflow", "validation-error", "transform"],
};

export function getColumnOptions(col: DecisionColumn): string[] | undefined {
  if (col.options && col.options.length > 0) return col.options;
  const key = col.field.trim().toLowerCase();
  return WELL_KNOWN_OPTIONS[key];
}

export interface DecisionRow {
  _id: string;
  [cell: string]: string;
}

export interface DecisionTable {
  hitPolicy: "first" | "collect";
  inputs: DecisionColumn[];
  outputs: DecisionColumn[];
  rules: DecisionRow[];
}

let rowCounter = 0;
export function newRowId(): string {
  return `r${(rowCounter++).toString(36)}${Date.now().toString(36)}`;
}

export function emptyDecisionTable(): DecisionTable {
  return {
    hitPolicy: "first",
    inputs: [{ id: "i1", name: "Input", field: "" }],
    outputs: [{ id: "o1", name: "Output", field: "" }],
    rules: [{ _id: newRowId(), i1: "", o1: "" }],
  };
}

export function parseDecisionTable(json: string | undefined): DecisionTable | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json) as Partial<DecisionTable>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      hitPolicy: parsed.hitPolicy === "collect" ? "collect" : "first",
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
      rules: Array.isArray(parsed.rules) ? (parsed.rules as DecisionRow[]) : [],
    };
  } catch {
    return null;
  }
}

export function validateDecisionTable(table: DecisionTable): string[] {
  const problems: string[] = [];
  if (table.inputs.length === 0) problems.push("Add at least one input column to test against.");
  if (table.outputs.length === 0) {
    problems.push("Add at least one output column — a table that publishes nothing does nothing.");
  }
  if (table.rules.length === 0) problems.push("Add at least one row.");
  for (const input of table.inputs) {
    if (!input.field.trim()) problems.push(`Input "${input.name || input.id}" reads no field.`);
  }
  for (const output of table.outputs) {
    if (!output.field.trim()) {
      problems.push(`Output "${output.name || output.id}" publishes under no name.`);
    }
  }
  return problems;
}

/* -------------------------------------------------------------------------- */
/*  Evaluation                                                                  */
/* -------------------------------------------------------------------------- */

export interface TableTestResult {
  rowIndex: number | null;
  outputs: Record<string, string>;
}

export function evaluateTable(
  table: DecisionTable,
  values: Record<string, string>
): TableTestResult {
  for (let i = 0; i < table.rules.length; i++) {
    const row = table.rules[i];
    if (!row) continue;
    const fits = table.inputs.every((col) => {
      const cell = (row[col.id] ?? "").trim();
      if (!cell) return true;
      return cellMatches(cell, values[col.field] ?? "");
    });
    if (fits) {
      const outputs: Record<string, string> = {};
      for (const col of table.outputs) outputs[col.field || col.name] = unquote(row[col.id] ?? "");
      return { rowIndex: i, outputs };
    }
  }
  return { rowIndex: null, outputs: {} };
}

function cellMatches(cell: string, value: string): boolean {
  const m = cell.match(/^\s*(>=|<=|!=|=|>|<)?\s*(.+)$/);
  if (!m) return false;
  const op = m[1] ?? "=";
  const raw = unquote((m[2] ?? "").trim());
  const a = Number(value);
  const b = Number(raw);
  const numeric = !Number.isNaN(a) && !Number.isNaN(b) && value.trim() !== "";
  switch (op) {
    case "=":
      return numeric ? a === b : value === raw;
    case "!=":
      return numeric ? a !== b : value !== raw;
    case ">":
      return numeric && a > b;
    case ">=":
      return numeric && a >= b;
    case "<":
      return numeric && a < b;
    case "<=":
      return numeric && a <= b;
    default:
      return false;
  }
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && (t.startsWith('"') || t.startsWith("'"))) {
    const q = t[0] as string;
    if (t.endsWith(q)) return t.slice(1, -1);
  }
  return t;
}

/* -------------------------------------------------------------------------- */
/*  Coverage                                                                    */
/* -------------------------------------------------------------------------- */

export interface CoverageNote {
  level: "ok" | "warn";
  message: string;
}

export function checkCoverage(table: DecisionTable): CoverageNote[] {
  const notes: CoverageNote[] = [];
  const hasCatchAll = table.rules.some((row) =>
    table.inputs.every((c) => !(row[c.id] ?? "").trim())
  );
  notes.push(
    hasCatchAll
      ? { level: "ok", message: "Every combination of inputs reaches a row. No gaps." }
      : {
          level: "warn",
          message:
            "No catch-all row. If nothing fits, this table returns no answer. Add a row with every check left blank.",
        }
  );
  for (let i = 0; i < table.rules.length; i++) {
    for (let j = i + 1; j < table.rules.length; j++) {
      const earlier = table.rules[i];
      const later = table.rules[j];
      if (!earlier || !later) continue;
      const shadowed = table.inputs.every((c) => {
        const e = (earlier[c.id] ?? "").trim();
        const l = (later[c.id] ?? "").trim();
        return !e || e === l;
      });
      if (shadowed) {
        notes.push({
          level: "warn",
          message: `Row ${i + 1} already covers everything row ${j + 1} does, so row ${j + 1} can never fire.`,
        });
        return notes;
      }
    }
  }
  return notes;
}

/* -------------------------------------------------------------------------- */
/*  EML round-trip                                                              */
/* -------------------------------------------------------------------------- */

const DIRECTIVE_PREFIX = "%%decision-table ";

/**
 * Embed the decision table in a minimal EML-compatible Mermaid flowchart.
 *
 * The actual table JSON lives in a `%%decision-table` directive so it
 * survives the EML round-trip intact. The generator reads this directive when
 * compiling rules to GoRules JDM.
 */
export function tableToEmlFlowchart(table: DecisionTable): string {
  const json = JSON.stringify(table);
  return [
    "flowchart TD",
    "    Start([Rule table]) --> End([Result])",
    `    ${DIRECTIVE_PREFIX}${json}`,
  ].join("\n");
}

/**
 * Extract a decision table from an EML flowchart that was previously produced
 * by `tableToEmlFlowchart`. Returns null for flowcharts that were hand-authored
 * or produced by the old flowchart editor.
 */
export function parseTableFromFlowchart(flowchart: string): DecisionTable | null {
  const line = (flowchart ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(DIRECTIVE_PREFIX));
  if (!line) return null;
  return parseDecisionTable(line.slice(DIRECTIVE_PREFIX.length));
}
