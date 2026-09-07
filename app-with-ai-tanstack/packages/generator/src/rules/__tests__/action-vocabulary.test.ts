/**
 * Regression: ISSUE-005 — two of the three %%action types did nothing.
 * Found by /qa on 2026-09-01.
 * Report: .gstack/qa-reports/qa-report-dance-studio-qa-2026-09-01.md
 *
 * `%%action` compiled its rows using EML's own action names and EML's own
 * property shape. The generated runtime reads neither.
 *
 *   - `validation-error` is not a member of the runtime's action union, and
 *     neither `RulesService.validate()` (which rejects a write on `prevent`)
 *     nor `executeMatchedActions()` (which acts on SIDE_EFFECTING_ACTIONS) has
 *     a branch for it. The row matched, was handed to both, and was dropped by
 *     each: a rule written to refuse a write let every write through, silently.
 *   - `transform` carried its target as separate `field` and `value` columns.
 *     The runtime reads one `transformData` object, so every transform arrived
 *     with none and the executor logged "has no transformData — skipping".
 *
 * `trigger-workflow` was the one that worked, because its name and its
 * `workflowName` property already matched.
 *
 * The property worth holding is the one the running application depends on:
 * a compiled row speaks the vocabulary the runtime reads.
 */

import { describe, expect, it } from "vitest";
import { buildActionDecisionTable, parseRuleActions } from "../index";

/** The runtime's action union — RuleAction['type'] in rules-engine.service.ts. */
const RUNTIME_ACTIONS = [
  "validate",
  "notify",
  "prevent",
  "transform",
  "cascade-update",
  "cascade-delete",
  "cascade-create",
  "trigger-workflow",
];

const DIRECTIVES = [
  "%%action rejectEmptyPack validation-error when: credits_purchased <= 0 message: A pack must carry at least one credit.",
  "%%action openPackActive transform when: credits_purchased > 0 field: status value: active",
  '%%action escalate trigger-workflow when: status == "cancelled" workflow: SessionCancellationRefund',
].join("\n");

function table(source = DIRECTIVES) {
  const graph = buildActionDecisionTable("packOpeningBalance", parseRuleActions(source));
  const node = graph.nodes.find((n) => n.type === "decisionTableNode");
  if (!node?.content) throw new Error("no decision table node");
  return node.content;
}

/** Cells are zen expressions: `'prevent'`. Read the literal back out. */
function unquote(cell: string | undefined): string {
  const value = (cell ?? "").trim();
  return value.startsWith("'") && value.endsWith("'")
    ? value.slice(1, -1).replace(/\\'/g, "'")
    : value;
}

const row = (name: string) =>
  table().rules.find((r) => r._id === `packOpeningBalance-${name}`) as Record<string, string>;

describe("%%action compiles to the runtime's vocabulary", () => {
  it("emits only action names the runtime knows how to act on", () => {
    for (const r of table().rules) {
      expect(RUNTIME_ACTIONS).toContain(unquote(r.o1));
    }
  });

  it("compiles validation-error to prevent, keeping the author's message", () => {
    const r = row("rejectEmptyPack");
    expect(unquote(r.o1)).toBe("prevent");
    expect(unquote(r.o2)).toBe("A pack must carry at least one credit.");
  });

  it("gives a transform the transformData object the executor reads", () => {
    const r = row("openPackActive");
    expect(unquote(r.o1)).toBe("transform");
    expect(JSON.parse(unquote(r.o9))).toEqual({ status: "active" });
  });

  it("keeps field and value beside it, because the table editor shows them", () => {
    const r = row("openPackActive");
    expect(unquote(r.o5)).toBe("status");
    expect(unquote(r.o6)).toBe("active");
    expect(table().outputs.map((o) => o.field)).toContain("transformData");
  });

  it("leaves trigger-workflow alone — its name and property already matched", () => {
    const r = row("escalate");
    expect(unquote(r.o1)).toBe("trigger-workflow");
    expect(unquote(r.o4)).toBe("SessionCancellationRefund");
  });

  it("leaves transformData blank for an action that is not a transform", () => {
    // Blank rather than absent: zen-engine discards a row missing any output
    // cell, which would take the whole rule down with it. Blank parses to
    // undefined on the runtime side, which is what "no transform here" means.
    expect(unquote(row("rejectEmptyPack").o9)).toBe("");
    expect(unquote(row("escalate").o9)).toBe("");
  });

  it("writes every output column on every row", () => {
    const columns = table().outputs.map((_, i) => `o${i + 1}`);
    for (const r of table().rules) {
      for (const c of columns) expect(r[c]).toBeDefined();
    }
  });
});
