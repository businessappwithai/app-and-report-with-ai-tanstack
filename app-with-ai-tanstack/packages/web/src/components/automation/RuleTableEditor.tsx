/**
 * A rule table: the conditions on the left, the answer on the right.
 *
 * Rows are read top to bottom and the first one that fits wins. That ordering
 * is the whole semantics, so the editor makes it visible — rows are numbered,
 * draggable, and the catch-all is pinned last and worded as "Otherwise" rather
 * than left as a row of empty cells the author has to recognise.
 *
 * The two panels underneath answer the questions a table always raises: what
 * does it say for this input, and is there an input it says nothing for.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type DecisionColumn,
  type DecisionRow,
  type DecisionTable,
  getColumnOptions,
  KNOWN_OUTPUT_FIELDS,
  newRowId,
} from "@/lib/workflow/bpmn-model";

const cellClass =
  "w-full min-w-[80px] rounded-md border border-input bg-card px-2 py-1.5 text-[13px] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/10";

/* -------------------------------------------------------------------------- */
/*  Evaluation — the same first-match rule the engine applies                  */
/* -------------------------------------------------------------------------- */

export interface TableTestResult {
  rowIndex: number | null;
  outputs: Record<string, string>;
}

/**
 * Which row fits, given some values.
 *
 * Deliberately a small subset of the expression language: `=`, `>`, `>=`, `<`,
 * `<=`, `!=`, and a bare value meaning equality. A blank cell means "any". This
 * runs in the browser so the author gets an answer while typing; the engine
 * remains the authority at run time, and anything this cannot parse is treated
 * as not matching rather than as matching by accident.
 */
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
/*  Coverage — the two things that silently break a table                      */
/* -------------------------------------------------------------------------- */

export interface CoverageNote {
  level: "ok" | "warn";
  message: string;
}

/**
 * Report gaps and shadowed rows.
 *
 * A gap means some input reaches no row and the step quietly produces nothing.
 * A shadowed row means an earlier row already covers everything a later one
 * does, so the later row can never fire — almost always a reordering mistake
 * rather than an intention.
 */
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
            "No catch-all row. If nothing fits, this table returns no answer and the step produces nothing. Add a row with every check left blank.",
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
          message: `Row ${i + 1} already covers everything row ${j + 1} does, so row ${j + 1} can never fire. Reorder if that is not what you meant.`,
        });
        return notes;
      }
    }
  }

  return notes;
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                     */
/* -------------------------------------------------------------------------- */

export interface RuleTableEditorProps {
  name: string;
  table: DecisionTable;
  onChange: (next: DecisionTable) => void;
  /** Automations that look this table up, so a change's blast radius is visible. */
  usedBy?: { name: string; where: string }[];
  /** Entity field names for the input column dropdowns. */
  entityFields?: string[];
}

export function RuleTableEditor({
  name,
  table,
  onChange,
  usedBy = [],
  entityFields = [],
}: RuleTableEditorProps) {
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  const result = useMemo(() => evaluateTable(table, testValues), [table, testValues]);
  const coverage = useMemo(() => checkCoverage(table), [table]);

  const setCell = (rowIndex: number, colId: string, value: string) => {
    const rules = table.rules.map((r, i) => (i === rowIndex ? { ...r, [colId]: value } : r));
    onChange({ ...table, rules });
  };

  const addRow = () => {
    const row: DecisionRow = { _id: newRowId() };
    for (const c of [...table.inputs, ...table.outputs]) row[c.id] = "";
    onChange({ ...table, rules: [...table.rules, row] });
  };

  const removeRow = (index: number) =>
    onChange({ ...table, rules: table.rules.filter((_, i) => i !== index) });

  const moveRow = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= table.rules.length) return;
    const rules = [...table.rules];
    const [moved] = rules.splice(index, 1);
    if (moved) rules.splice(to, 0, moved);
    onChange({ ...table, rules });
  };

  const addColumn = (side: "inputs" | "outputs") => {
    const prefix = side === "inputs" ? "i" : "o";
    const col: DecisionColumn = {
      id: `${prefix}${Date.now().toString(36)}`,
      name: side === "inputs" ? "New input" : "New outcome",
      field: "",
    };
    onChange({ ...table, [side]: [...table[side], col] });
  };

  const setColumn = (side: "inputs" | "outputs", id: string, patch: Partial<DecisionColumn>) =>
    onChange({
      ...table,
      [side]: table[side].map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const isCatchAll = (row: DecisionRow) => table.inputs.every((c) => !(row[c.id] ?? "").trim());
  const lastCatchAllIndex = (() => {
    for (let i = table.rules.length - 1; i >= 0; i--) {
      // Narrowed rather than asserted: noUncheckedIndexedAccess types this as
      // possibly undefined, and the assertion was the file's only lint warning.
      const row = table.rules[i];
      if (row && isCatchAll(row)) return i;
    }
    return -1;
  })();

  return (
    <div className="flex-1 overflow-y-auto bg-muted/30 px-7 py-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">{name}</h1>
        {usedBy.length > 0 ? (
          <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Used by {usedBy.length} automation{usedBy.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <p className="mb-4 mt-1 text-[13px] text-muted-foreground">
        Rows are read top to bottom. The first row where every check fits is the answer.
      </p>

      {/* the table's declaration, as a sentence */}
      <div className="mb-4 rounded-xl border border-border bg-card px-4 py-3.5 text-[15px] leading-loose">
        Given{" "}
        {table.inputs.map((c, i) => (
          <span key={c.id}>
            {i > 0 ? " and " : ""}
            {entityFields.length > 0 ? (
              <select
                aria-label={`Input ${i + 1} field`}
                value={c.field}
                onChange={(e) => setColumn("inputs", c.id, { field: e.target.value })}
                className="mx-0.5 w-[9.5rem] rounded-md border border-border bg-muted px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:border-primary"
              >
                <option value="">— pick field —</option>
                {entityFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={`Input ${i + 1} field`}
                value={c.field}
                onChange={(e) => setColumn("inputs", c.id, { field: e.target.value })}
                placeholder="Customer.tier"
                className="mx-0.5 w-[9.5rem] rounded-md border border-border bg-muted px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:border-primary"
              />
            )}
          </span>
        ))}
        , decide{" "}
        {table.outputs.map((c, i) => (
          <span key={c.id}>
            {i > 0 ? " and " : ""}
            <select
              aria-label={`Outcome ${i + 1} field`}
              value={c.field}
              onChange={(e) => setColumn("outputs", c.id, { field: e.target.value })}
              className="mx-0.5 w-[9.5rem] rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:border-primary"
            >
              <option value="">— pick output —</option>
              {KNOWN_OUTPUT_FIELDS.map((f) => (
                <option key={f.field} value={f.field}>
                  {f.label}
                </option>
              ))}
            </select>
          </span>
        ))}
        <button
          type="button"
          onClick={() => addColumn("inputs")}
          className="ml-3 text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ＋ input
        </button>
        <button
          type="button"
          onClick={() => addColumn("outputs")}
          className="ml-2 text-[13px] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ＋ outcome
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="w-9 border-b border-border bg-muted/40 px-3 py-2" />
              <th
                colSpan={table.inputs.length}
                className="border-b border-border bg-muted/40 px-3 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-blue-600"
              >
                ◇ When all of these fit
              </th>
              <th
                colSpan={table.outputs.length}
                className="border-b border-l-2 border-border px-3 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.1em] text-primary"
              >
                ▸ The answer is
              </th>
              <th className="w-10 border-b border-border bg-muted/40" />
            </tr>
            <tr>
              <th className="border-b border-border bg-muted/40" />
              {table.inputs.map((c) => (
                <th
                  key={c.id}
                  className="border-b border-border bg-muted/40 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-blue-600"
                >
                  {c.field || c.name}
                </th>
              ))}
              {table.outputs.map((c, i) => (
                <th
                  key={c.id}
                  className={cn(
                    "border-b border-border bg-muted/40 px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-primary",
                    i === 0 && "border-l-2"
                  )}
                >
                  {c.field || c.name}
                </th>
              ))}
              <th className="border-b border-border bg-muted/40" />
            </tr>
          </thead>
          <tbody>
            {table.rules.map((row, rowIndex) => {
              const catchAll = isCatchAll(row) && rowIndex === lastCatchAllIndex;
              return (
                <tr key={row._id} className={cn(catchAll && "bg-muted/30")}>
                  <td className="w-10 border-b border-border px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">
                    {catchAll ? "↓" : rowIndex + 1}
                  </td>

                  {catchAll ? (
                    <td
                      colSpan={table.inputs.length}
                      className="border-b border-border px-3 py-2 italic text-muted-foreground"
                    >
                      Otherwise — nothing above fit
                    </td>
                  ) : (
                    table.inputs.map((c) => (
                      <td key={c.id} className="border-b border-border px-2 py-2">
                        <input
                          aria-label={`Row ${rowIndex + 1}, ${c.field || c.name}`}
                          className={cellClass}
                          value={row[c.id] ?? ""}
                          onChange={(e) => setCell(rowIndex, c.id, e.target.value)}
                          placeholder="any"
                        />
                      </td>
                    ))
                  )}

                  {table.outputs.map((c, i) => {
                    const opts = getColumnOptions(c);
                    return (
                      <td
                        key={c.id}
                        className={cn("border-b border-border px-2 py-2", i === 0 && "border-l-2")}
                      >
                        {opts ? (
                          <select
                            aria-label={`Row ${rowIndex + 1}, ${c.field || c.name} answer`}
                            className={cn(
                              cellClass,
                              "border-primary/30 bg-primary/5 font-semibold text-primary"
                            )}
                            value={row[c.id] ?? ""}
                            onChange={(e) => setCell(rowIndex, c.id, e.target.value)}
                          >
                            <option value="">— pick —</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            aria-label={`Row ${rowIndex + 1}, ${c.field || c.name} answer`}
                            className={cn(
                              cellClass,
                              "border-primary/30 bg-primary/5 font-semibold text-primary"
                            )}
                            value={row[c.id] ?? ""}
                            onChange={(e) => setCell(rowIndex, c.id, e.target.value)}
                          />
                        )}
                      </td>
                    );
                  })}

                  <td className="w-24 border-b border-border px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move row ${rowIndex + 1} up`}
                        onClick={() => moveRow(rowIndex, -1)}
                        disabled={rowIndex === 0}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs leading-none text-muted-foreground hover:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move row ${rowIndex + 1} down`}
                        onClick={() => moveRow(rowIndex, 1)}
                        disabled={rowIndex === table.rules.length - 1}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs leading-none text-muted-foreground hover:bg-muted disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove row ${rowIndex + 1}`}
                        onClick={() => removeRow(rowIndex)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs leading-none text-muted-foreground hover:bg-muted hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ＋ Add row
        </button>
        <span className="text-[12.5px] text-muted-foreground">
          Move rows with ↑ ↓. A row with every check left blank is the catch-all — keep it last.
        </span>
      </div>

      <div className="mt-5 grid gap-3.5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Test with values
          </h2>
          <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
            {table.inputs.map((c) => (
              <label key={c.id} className="block">
                <span className="mb-1 block text-[11.5px] text-muted-foreground">
                  {c.field || c.name}
                </span>
                <input
                  className={cellClass}
                  value={testValues[c.field] ?? ""}
                  onChange={(e) => setTestValues((v) => ({ ...v, [c.field]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          {result.rowIndex === null ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              No row fits these values, so this table would return nothing.
            </p>
          ) : (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
              <b>Row {result.rowIndex + 1} fits.</b>{" "}
              {Object.entries(result.outputs)
                .map(([k, v]) => `${k} = ${v || "(empty)"}`)
                .join(", ")}
              .
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Coverage check
          </h2>
          {coverage.map((note) => (
            <p
              key={note.message}
              className={cn(
                "mb-2 rounded-lg border px-3 py-2 text-[12.5px] last:mb-0",
                note.level === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {note.message}
            </p>
          ))}

          {usedBy.length > 0 ? (
            <>
              <h2 className="mb-2 mt-4 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Where this is used
              </h2>
              {usedBy.map((u) => (
                <p key={`${u.name}-${u.where}`} className="text-[12.5px] leading-relaxed">
                  <span className="font-semibold text-primary">{u.name}</span>{" "}
                  <span className="text-muted-foreground">— {u.where}</span>
                </p>
              ))}
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Publishing a change affects all of them immediately.
              </p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
