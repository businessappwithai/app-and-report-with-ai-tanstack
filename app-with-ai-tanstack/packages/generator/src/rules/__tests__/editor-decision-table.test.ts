/**
 * Regression: ISSUE-004 — rules authored in the decision-table editor.
 * Found by /qa on 2026-08-28.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-08-28.md
 *
 * The editor writes a placeholder `Start --> End` flowchart and hangs the real
 * table off a `%%decision-table` directive. The compiler read only the
 * placeholder, so every rule built in the UI reached the generated app as an
 * input wired straight to an output — it ran, and decided nothing.
 *
 * The property worth holding is the one a user can check by using the editor:
 * what the editor's own preview says a row decides is what the compiled graph
 * decides.
 */

import { describe, expect, it } from "vitest";
import { compileRules } from "../index";
import type { JdmGraph } from "../jdm-converter";

interface EditorTable {
  hitPolicy: "first" | "collect";
  inputs: Array<{ id: string; name: string; field: string }>;
  outputs: Array<{ id: string; name: string; field: string }>;
  rules: Array<Record<string, string>>;
}

/** Exactly what `tableToEmlFlowchart()` in the web app emits. */
const asEditorFlowchart = (table: EditorTable) =>
  [
    "flowchart TD",
    "    Start([Rule table]) --> End([Result])",
    `    %%decision-table ${JSON.stringify(table)}`,
  ].join("\n");

const compileOne = (table: EditorTable, name = "enterpriseDiscountCap") => {
  const [rule] = compileRules([
    {
      name,
      entity: "Quote",
      event: "beforeUpdate",
      priority: 100,
      flowchart: asEditorFlowchart(table),
    },
  ]);
  if (!rule) throw new Error("rule did not compile");
  return JSON.parse(rule.jdmContent) as JdmGraph;
};

const discountTable: EditorTable = {
  hitPolicy: "first",
  inputs: [{ id: "i1", name: "Discount", field: "discount_percent" }],
  outputs: [{ id: "o1", name: "Action", field: "action" }],
  rules: [
    { _id: "r1", i1: "> 40", o1: "validation-error" },
    { _id: "r2", i1: "", o1: "transform" },
  ],
};

const tableNode = (graph: JdmGraph) =>
  graph.nodes.find((node) => node.type === "decisionTableNode");

describe("rules authored in the decision-table editor", () => {
  it("compiles to a decision table rather than a bare input → output graph", () => {
    const graph = compileOne(discountTable);
    const node = tableNode(graph);

    expect(node).toBeDefined();
    expect(node?.content?.inputs).toEqual([
      { id: "i1", name: "Discount", field: "discount_percent" },
    ]);
    expect(node?.content?.outputs).toEqual([{ id: "o1", name: "Action", field: "action" }]);
    // The table has to sit between input and output, or the engine never reaches it.
    expect(graph.edges).toHaveLength(2);
  });

  it("quotes output values, which zen would otherwise read as arithmetic", () => {
    const node = tableNode(compileOne(discountTable));
    // Unquoted, `validation-error` is `validation` minus `error`.
    expect(node?.content?.rules[0]?.o1).toBe("'validation-error'");
    expect(node?.content?.rules[1]?.o1).toBe("'transform'");
  });

  it("keeps a comparison in an input cell and leaves the catch-all blank", () => {
    const node = tableNode(compileOne(discountTable));
    expect(node?.content?.rules[0]?.i1).toBe("> 40");
    expect(node?.content?.rules[1]?.i1).toBe("");
  });

  it("quotes a bare input value but leaves numbers and booleans alone", () => {
    const node = tableNode(
      compileOne({
        hitPolicy: "first",
        inputs: [
          { id: "i1", name: "Rating", field: "rating" },
          { id: "i2", name: "Score", field: "score" },
          { id: "i3", name: "Active", field: "is_active" },
        ],
        outputs: [{ id: "o1", name: "Value", field: "value" }],
        rules: [{ _id: "r1", i1: "hot", i2: "70", i3: "true", o1: "12" }],
      })
    );
    const row = node?.content?.rules[0];
    expect(row?.i1).toBe("'hot'");
    expect(row?.i2).toBe("70");
    expect(row?.i3).toBe("true");
    // A numeric output stays numeric — quoting it would publish the string "12".
    expect(row?.o1).toBe("12");
  });

  it("drops an explicit `=`, which is not valid zen unary syntax", () => {
    const node = tableNode(
      compileOne({
        hitPolicy: "first",
        inputs: [{ id: "i1", name: "Status", field: "status" }],
        outputs: [{ id: "o1", name: "Action", field: "action" }],
        rules: [{ _id: "r1", i1: "= draft", o1: "transform" }],
      })
    );
    expect(node?.content?.rules[0]?.i1).toBe("'draft'");
  });

  it("ignores a column that reads no field, so a half-built table still compiles", () => {
    const node = tableNode(
      compileOne({
        hitPolicy: "collect",
        inputs: [
          { id: "i1", name: "Discount", field: "discount_percent" },
          { id: "i2", name: "Input", field: "" },
        ],
        outputs: [
          { id: "o1", name: "Action", field: "action" },
          { id: "o2", name: "Output", field: "" },
        ],
        rules: [{ _id: "r1", i1: "> 40", i2: "ignored", o1: "validation-error", o2: "ignored" }],
      })
    );
    expect(node?.content?.hitPolicy).toBe("collect");
    expect(node?.content?.inputs).toHaveLength(1);
    expect(node?.content?.outputs).toHaveLength(1);
    expect(node?.content?.rules[0]).not.toHaveProperty("i2");
    expect(node?.content?.rules[0]).not.toHaveProperty("o2");
  });

  it("still compiles a hand-authored flowchart through the AST path", () => {
    // The example models author rules as real flowcharts; that path must stay.
    const [rule] = compileRules([
      {
        name: "leadScoring",
        entity: "Lead",
        event: "beforeCreate",
        priority: 10,
        flowchart: [
          "flowchart TD",
          "    A([Start]) --> B{score >= 70?}",
          "    B -->|Yes| C[Set rating hot]",
          "    B -->|No| D[Set rating cold]",
        ].join("\n"),
      },
    ]);
    const graph = JSON.parse(rule!.jdmContent) as JdmGraph;
    expect(graph.nodes.length).toBeGreaterThan(2);
    expect(tableNode(graph)).toBeUndefined();
  });
});
