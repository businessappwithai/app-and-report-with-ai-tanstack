import { AlertCircle, Code2 } from "lucide-react";
import { useMemo, useState } from "react";
import { RuleTableEditor } from "@/components/eml/RuleTableEditor";
import {
  type DecisionTable,
  emptyDecisionTable,
  tableToEmlFlowchart,
  validateDecisionTable,
} from "@/lib/eml/decision-table";
import { convertFlowchartToTable } from "@/lib/eml/flowchart-to-table";

/**
 * One business rule — shown as a decision table, matching the rule editor in
 * the generated admin application so both surfaces look and behave identically.
 */

export const RULE_EVENTS = [
  "beforeCreate",
  "afterCreate",
  "beforeUpdate",
  "afterUpdate",
  "beforeDelete",
  "customValidate",
] as const;

export interface EditableRule {
  /** Stable across renames, so React keeps the row it is editing. */
  key: string;
  name: string;
  entity: string;
  event: string;
  priority?: number;
  title?: string;
  table: DecisionTable;
  /**
   * The rule's original Mermaid, kept verbatim when it is not a decision table
   * this editor wrote — a hand-authored `%%rule` flowchart, as every checked-in
   * example model uses. `table` holds a blank table in that case, and saving
   * would otherwise replace real branching logic with it. While this is set the
   * editor shows the source read-only and the save path writes it back
   * untouched; converting clears it and hands the rule to the table editor.
   */
  sourceFlowchart?: string;
}

export function slugifyRuleName(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join("");
  return cleaned || "rule";
}

export interface RuleEditorProps {
  rule: EditableRule;
  entities: Array<{ name: string; attributes: string[] }>;
  projectId: string;
  onChange: (patch: Partial<EditableRule>) => void;
  onError: (message: string | null) => void;
}

export function RuleEditor({ rule, entities, onChange }: RuleEditorProps) {
  const [showSource, setShowSource] = useState(false);
  const problems = useMemo(() => validateDecisionTable(rule.table), [rule.table]);
  const entityFields = useMemo(
    () => entities.find((e) => e.name === rule.entity)?.attributes ?? [],
    [entities, rule.entity]
  );
  // Whether the authored flowchart can be read as a table, worked out once so
  // the banner can say which it is rather than warning about both.
  const conversion = useMemo(
    () => convertFlowchartToTable(rule.sourceFlowchart ?? "", entityFields),
    [rule.sourceFlowchart, entityFields]
  );

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium">Name</span>
          <input
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            value={rule.title ?? rule.name}
            onChange={(event) =>
              onChange({ title: event.target.value, name: slugifyRuleName(event.target.value) })
            }
            placeholder="Sample expiry guard"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Entity</span>
          <select
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            value={rule.entity}
            onChange={(event) => onChange({ entity: event.target.value })}
          >
            <option value="">Choose…</option>
            {entities.map((entity) => (
              <option key={entity.name} value={entity.name}>
                {entity.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Runs on</span>
          <select
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            value={rule.event}
            onChange={(event) => onChange({ event: event.target.value })}
          >
            {RULE_EVENTS.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Priority</span>
          <input
            type="number"
            className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
            value={rule.priority ?? 100}
            onChange={(event) => onChange({ priority: Number(event.target.value) || 0 })}
          />
        </label>
      </div>

      {rule.sourceFlowchart ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-1.5 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {conversion.ok ? (
              <p>
                This rule came from your model as a flowchart. It is saved exactly as it is here. It
                can also be read as a table of{" "}
                <strong>
                  {conversion.table.rules.length} row
                  {conversion.table.rules.length === 1 ? "" : "s"}
                </strong>{" "}
                that decides the same thing — convert it to edit it here.
              </p>
            ) : (
              <p>
                This rule came from your model as a flowchart, and it is saved exactly as it is
                here. It cannot be read as a table: {conversion.reason}
              </p>
            )}
          </div>

          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-amber-200 bg-white/70 p-3 font-mono text-[11px] leading-relaxed">
            {rule.sourceFlowchart}
          </pre>

          {conversion.ok ? (
            <>
              {conversion.notes.map((note) => (
                <p key={note} className="mt-2 text-[11.5px] text-amber-900">
                  {note}
                </p>
              ))}
              <button
                type="button"
                onClick={() => onChange({ sourceFlowchart: undefined, table: conversion.table })}
                className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
              >
                Convert to a decision table
              </button>
              <p className="mt-1.5 text-[11.5px] text-amber-900/80">
                Nothing is written until you save, and the table is shown before then.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  onChange({ sourceFlowchart: undefined, table: emptyDecisionTable() })
                }
                className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
              >
                Start an empty table instead
              </button>
              <p className="mt-1.5 text-[11.5px] text-amber-900/80">
                This discards the flowchart above, so you would re-enter the logic by hand.
              </p>
            </>
          )}
        </div>
      ) : (
        <RuleTableEditor
          name={slugifyRuleName(rule.title ?? rule.name)}
          table={rule.table}
          onChange={(table) => onChange({ table })}
          entityFields={entityFields}
        />
      )}

      {!rule.sourceFlowchart && problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {problems.map((problem) => (
            <li key={problem} className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {problem}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowSource((current) => !current)}
        className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium"
      >
        <Code2 className="h-3.5 w-3.5" />
        {showSource ? "Hide" : "Show"} EML
      </button>

      {showSource && (
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {`%%rule ${slugifyRuleName(rule.title ?? rule.name)} on ${
            rule.entity || "<entity>"
          } event: ${rule.event} priority: ${rule.priority ?? 100}\n${
            // Match what the save path will write, or this preview claims the
            // rule is an empty table when it is really the authored flowchart.
            rule.sourceFlowchart ?? tableToEmlFlowchart(rule.table)
          }`}
        </pre>
      )}
    </>
  );
}
