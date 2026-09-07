/**
 * Business rules authored in EML.
 *
 * A `%%rule` section is a decision flowchart. These compile it to a GoRules JDM
 * decision graph — the same representation the generated application's rules
 * engine evaluates and its admin editor edits — so a rule drawn in the design
 * phase is the rule that runs.
 *
 * The flowchart parser and JDM converter live here rather than in the web app
 * because the generator is what consumes them; the web app re-exports these.
 */

export * from "./flowchart-parser";
export * from "./jdm-converter";

import type { EmlRuleSection } from "../eml";
import { parseMermaidFlowchart } from "./flowchart-parser";
import { convertToJdm, type JdmGraph } from "./jdm-converter";

/** A rule compiled from EML, ready to seed into `sys_rule_definitions`. */
export interface CompiledRule {
  /** Directive name, used as the seeded rule's identity. */
  name: string;
  /** Table the rule is bound to, e.g. `bus_sample`. */
  tableName: string;
  entity: string;
  /** Lifecycle event from the directive, e.g. `beforeCreate`. */
  event: string;
  /** CRUD operation the rules engine keys on: CREATE / UPDATE / DELETE / ALL. */
  operation: "CREATE" | "UPDATE" | "DELETE" | "ALL";
  priority: number;
  /** The JDM decision graph, serialised. */
  jdmContent: string;
}

/** Map a lifecycle event onto the operation the rules engine evaluates against. */
export function eventToOperation(event: string): CompiledRule["operation"] {
  const normalized = event.toLowerCase();
  if (normalized.includes("create")) return "CREATE";
  if (normalized.includes("update")) return "UPDATE";
  if (normalized.includes("delete")) return "DELETE";
  return "ALL";
}

/** `Sample` → `bus_sample`, matching the ERD's table naming. */
function toTableName(entity: string): string {
  const snake = entity
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
  return snake.startsWith("bus_") || snake.startsWith("sys_") ? snake : `bus_${snake}`;
}

/**
 * Compile the `%%rule` sections of a model into seedable JDM.
 *
 * A section whose flowchart cannot be parsed is skipped with a warning rather
 * than failing the build: one malformed rule should not stop an application
 * from being generated, and the checker already reports the syntax problem.
 */
/** A side-effecting action a rule emits, declared by a `%%action` directive. */
export interface CompiledRuleAction {
  name: string;
  type: string;
  /** Zen expression over the record; `true` fires on every write. */
  when: string;
  props: Record<string, string>;
}

/** `%%action <name> <type> when: <expr> <key>: <value> ...` */
const ACTION_DIRECTIVE = /^%%action\s+([A-Za-z_][\w-]*)\s+([A-Za-z][\w-]*)\s*(.*)$/;

/** `key:` starts a new property; the value runs to the next one. */
function parseActionProps(rest: string): Record<string, string> {
  const props: Record<string, string> = {};
  const trimmed = rest.trim();
  if (!trimmed) return props;
  for (const chunk of trimmed.split(/\s+(?=[A-Za-z_]\w*:)/)) {
    const at = chunk.indexOf(":");
    if (at <= 0) continue;
    const key = chunk.slice(0, at).trim();
    if (key) props[key] = chunk.slice(at + 1).trim();
  }
  return props;
}

export function parseRuleActions(flowchart: string): CompiledRuleAction[] {
  const actions: CompiledRuleAction[] = [];
  for (const rawLine of (flowchart ?? "").split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("%%action")) continue;
    const match = line.match(ACTION_DIRECTIVE);
    if (!match) continue;
    const [, name, type, rest] = match as unknown as [string, string, string, string];
    const props = parseActionProps(rest ?? "");
    const { when, ...others } = props;
    actions.push({ name, type, when: when?.trim() || "true", props: others });
  }
  return actions;
}

/** Quote a value for a zen decision-table output cell. */
function zenLiteral(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}

/* -------------------------------------------------------------------------- */
/*  Decision tables authored in the editor                                      */
/* -------------------------------------------------------------------------- */

/**
 * The directive the application's decision-table editor writes.
 *
 * The editor emits a placeholder `Start --> End` flowchart and hangs the real
 * table off this comment so the model still parses as Mermaid. Without the
 * branch below, `parseMermaidFlowchart` saw only those two nodes and the rule
 * compiled to an input wired straight to an output — a rule that runs and
 * decides nothing.
 */
const DECISION_TABLE_DIRECTIVE = "%%decision-table ";

interface EditorDecisionTable {
  hitPolicy?: "first" | "collect";
  inputs?: Array<{ id: string; name?: string; field?: string }>;
  outputs?: Array<{ id: string; name?: string; field?: string }>;
  rules?: Array<Record<string, string>>;
}

export function parseDecisionTableDirective(flowchart: string): EditorDecisionTable | null {
  const line = (flowchart ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith(DECISION_TABLE_DIRECTIVE));
  if (!line) return null;
  try {
    const parsed = JSON.parse(line.slice(DECISION_TABLE_DIRECTIVE.length)) as EditorDecisionTable;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** A cell that zen should read as a value rather than an identifier reference. */
function isBareLiteral(value: string): boolean {
  return (
    value === "true" ||
    value === "false" ||
    value === "null" ||
    (value !== "" && !Number.isNaN(Number(value)))
  );
}

function isQuoted(value: string): boolean {
  return (
    value.length >= 2 &&
    (value.startsWith("'") || value.startsWith('"')) &&
    value.endsWith(value[0] as string)
  );
}

/**
 * The editor stores what the user typed; zen evaluates expressions.
 *
 * An output of `validation-error` is a subtraction of two identifiers to zen,
 * and an input of `hot` is a reference to an undefined variable. Both have to
 * be quoted. Numbers, booleans and already-quoted cells are left alone.
 */
function zenCell(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (value === "") return "";
  if (isQuoted(value) || isBareLiteral(value)) return value;
  return zenLiteral(value);
}

/**
 * Input cells may carry a leading comparison, matching the editor's own
 * evaluator. `>= 70` stays a unary comparison; a bare `hot` becomes `'hot'`;
 * an explicit `= hot` drops the operator, because zen reads a bare value as
 * equality and `= 'hot'` is not valid unary syntax.
 */
function zenInputCell(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (value === "") return "";
  const match = value.match(/^(>=|<=|!=|=|>|<)\s*(.*)$/);
  if (!match) return zenCell(value);
  const [, operator, operand] = match as unknown as [string, string, string];
  const cell = zenCell(operand);
  if (!cell) return "";
  return operator === "=" ? cell : `${operator} ${cell}`;
}

/**
 * Compile the editor's table into the one JDM shape the rules engine reads.
 *
 * Every declared column is written into every row: zen-engine yields no result
 * at all for a row with a missing cell, so an omitted column would silently
 * disable the whole rule.
 */
export function buildEditorDecisionTable(ruleName: string, table: EditorDecisionTable): JdmGraph {
  const inputs = (table.inputs ?? []).filter((column) => (column.field ?? "").trim() !== "");
  const outputs = (table.outputs ?? []).filter((column) => (column.field ?? "").trim() !== "");

  const rows = (table.rules ?? []).map((row, index) => {
    const compiled: Record<string, string> = { _id: row._id || `${ruleName}-${index + 1}` };
    for (const column of inputs) compiled[column.id] = zenInputCell(row[column.id]);
    for (const column of outputs) compiled[column.id] = zenCell(row[column.id]);
    return compiled;
  });

  const tableId = `${ruleName}-table`;
  return {
    nodes: [
      { id: "input", name: "Input", type: "inputNode" },
      {
        id: tableId,
        name: ruleName,
        type: "decisionTableNode",
        content: {
          hitPolicy: table.hitPolicy === "collect" ? ("collect" as const) : ("first" as const),
          inputs: inputs.map((column) => ({
            id: column.id,
            name: column.name ?? column.id,
            field: column.field ?? "",
          })),
          outputs: outputs.map((column) => ({
            id: column.id,
            name: column.name ?? column.id,
            field: column.field ?? "",
          })),
          rules: rows,
        },
      },
      { id: "output", name: "Output", type: "outputNode" },
    ],
    edges: [
      { id: "edge-1", sourceId: "input", targetId: tableId },
      { id: "edge-2", sourceId: tableId, targetId: "output" },
    ],
  };
}

/**
 * EML's action names, in the vocabulary the generated runtime reads.
 *
 * The runtime's action union (RuleAction['type'] in rules-engine.service.ts) is
 * the one the in-app rule editor already writes, and it is what decides what a
 * matched row *does*: `validate()` rejects a write on `prevent`, and
 * `executeMatchedActions()` acts on the SIDE_EFFECTING_ACTIONS list. EML spells
 * the same intent `validation-error`, which is in neither, so a compiled
 * `validation-error` row matched, was handed to both readers, and was dropped by
 * each in turn — a rule that refuses a write let every write through, silently.
 *
 * `transform` and `trigger-workflow` are already the runtime's own names.
 */
const RUNTIME_ACTION: Record<string, string> = {
  "validation-error": "prevent",
};

/**
 * A transform's target, as the runtime wants it.
 *
 * EML writes `field:` and `value:` as two properties; the runtime reads one
 * `transformData` object of column → value (a JSON string is accepted and
 * parsed). Emitting only the two separate columns left every transform with no
 * transformData, and the executor logged "has no transformData — skipping" for a
 * rule the author had written correctly.
 *
 * The `field`/`value` columns stay beside it: the decision-table editor shows
 * them, and dropping them would empty that view for every model-authored rule.
 */
function transformDataCell(action: CompiledRuleAction): string {
  const field = (action.props.field ?? "").trim();
  if (action.type !== "transform" || !field) return zenLiteral("");
  return zenLiteral(JSON.stringify({ [field]: action.props.value ?? "" }));
}

/**
 * A GoRules decision table, one row per `%%action`.
 *
 * The node-graph form a rules flowchart compiles to carries no outputs, so the
 * rules engine finds no actions in it and a model-declared rule can decide but
 * never act. A decision table is the shape the engine reads `action`,
 * `message`, `ruleId` and `workflowName` from, so a section that declares
 * actions is compiled as one.
 *
 * `hitPolicy: "collect"` because several rows may match one write — a rule that
 * escalates *and* stamps a field is ordinary.
 *
 * The `action` cell and a transform's payload are translated into the runtime's
 * own vocabulary rather than written in EML's — see RUNTIME_ACTION and the
 * `transformData` column below. Emitting the EML spelling made two of the three
 * shipped action types silently inert.
 */
export function buildActionDecisionTable(
  ruleName: string,
  actions: CompiledRuleAction[]
): JdmGraph {
  // Every declared output column has to appear in every row, blank when the
  // action does not use it. zen-engine yields *no result at all* for a row with
  // a missing cell — not a row with an empty field — so an omitted column made
  // the whole rule silently evaluate to nothing.
  const cells = [
    (action: CompiledRuleAction) => zenLiteral(RUNTIME_ACTION[action.type] ?? action.type),
    (action: CompiledRuleAction) =>
      zenLiteral(action.props.message ?? `${ruleName}: ${action.name}`),
    () => zenLiteral(ruleName),
    (action: CompiledRuleAction) => zenLiteral(action.props.workflow ?? ""),
    (action: CompiledRuleAction) => zenLiteral(action.props.field ?? ""),
    (action: CompiledRuleAction) => zenLiteral(action.props.value ?? ""),
    (action: CompiledRuleAction) => zenLiteral(action.props.targetEntity ?? ""),
    (action: CompiledRuleAction) => zenLiteral(action.props.linkField ?? ""),
    transformDataCell,
  ];

  const rows = actions.map((action) => {
    const row: Record<string, string> = {
      _id: `${ruleName}-${action.name}`,
      i1: action.when,
    };
    cells.forEach((cell, index) => {
      row[`o${index + 1}`] = cell(action);
    });
    return row;
  });

  return {
    nodes: [
      { id: "input", name: "Input", type: "inputNode" },
      {
        id: `${ruleName}-table`,
        name: ruleName,
        type: "decisionTableNode",
        content: {
          hitPolicy: "collect" as const,
          inputs: [{ id: "i1", name: "Record", field: "" }],
          outputs: [
            { id: "o1", name: "Action", field: "action" },
            { id: "o2", name: "Message", field: "message" },
            { id: "o3", name: "Rule ID", field: "ruleId" },
            { id: "o4", name: "Workflow Name", field: "workflowName" },
            { id: "o5", name: "Field", field: "field" },
            { id: "o6", name: "Value", field: "value" },
            { id: "o7", name: "Target Entity", field: "targetEntity" },
            { id: "o8", name: "Link Field", field: "linkField" },
            { id: "o9", name: "Transform Data", field: "transformData" },
          ],
          rules: rows,
        },
      },
      { id: "output", name: "Output", type: "outputNode" },
    ],
    edges: [
      { id: "edge-1", sourceId: "input", targetId: `${ruleName}-table` },
      { id: "edge-2", sourceId: `${ruleName}-table`, targetId: "output" },
    ],
  };
}

export function compileRules(
  sections: EmlRuleSection[],
  onWarn: (message: string) => void = () => {}
): CompiledRule[] {
  const compiled: CompiledRule[] = [];

  for (const section of sections) {
    if (!section.entity) {
      onWarn(`Rule "${section.name}" declares no entity; skipping.`);
      continue;
    }

    try {
      // A table authored in the editor carries its own directive and only a
      // placeholder flowchart, so it has to be read before the AST — compiling
      // the placeholder yields a rule that decides nothing.
      const editorTable = parseDecisionTableDirective(section.flowchart);

      const ast = parseMermaidFlowchart(section.flowchart);
      if (!editorTable && !ast.nodes.size) {
        onWarn(`Rule "${section.name}" has no nodes; skipping.`);
        continue;
      }

      // A section that declares actions compiles to a decision table: that is
      // the only JDM shape the rules engine reads actions out of.
      const actions = parseRuleActions(section.flowchart);
      let jdm: JdmGraph;
      if (editorTable) {
        jdm = buildEditorDecisionTable(section.name, editorTable);
      } else if (actions.length) {
        jdm = buildActionDecisionTable(section.name, actions);
      } else {
        jdm = convertToJdm(ast);
      }
      compiled.push({
        name: section.name,
        entity: section.entity,
        tableName: toTableName(section.entity),
        event: section.event,
        operation: eventToOperation(section.event),
        priority: section.priority ?? 100,
        jdmContent: JSON.stringify(jdm),
      });
    } catch (error) {
      onWarn(
        `Rule "${section.name}" could not be compiled: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return compiled;
}
