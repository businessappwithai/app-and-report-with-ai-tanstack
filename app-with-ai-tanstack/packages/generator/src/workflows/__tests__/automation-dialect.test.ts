/**
 * The generator must read what the automation builder writes.
 *
 * There are two spellings of the same workflow. The generator compiles the saga
 * form (`%%step <node> <Type> <k>: <v>` on one line); the builder in the
 * application writes the automation form (`%%step <id> type: <T>`, one property
 * per line). Until this existed each side could only read its own: an
 * automation exported from a running application compiled to nothing, with the
 * type reported as literally "type" and every property line warned about as a
 * duplicate %%step on the node.
 *
 * That failure is quiet in the worst way — generation succeeds, the app builds,
 * and the workflow is simply absent. So these tests drive the real path: take
 * the exact text the builder's serialiser produces and compile it, rather than
 * a hand-written approximation that could drift from what is actually stored.
 */

import { describe, expect, it } from "vitest";
import { compileSagaWorkflows, sagaPropsFromAutomation } from "../index";

/**
 * The builder's output, verbatim.
 *
 * Copied from `serializeAutomation` rather than imported: the generator package
 * must not depend on the web package, and a fixture that cannot drift silently
 * is worth more here than one that is generated.
 */
const AUTOMATION = `flowchart TD
%%meta kind: workflow
%%workflow EscalateDeviations entity: DeviationReport kind: saga trigger: automatic operation: CREATE
%%hook afterCreate on DeviationReport
%%guard severity eq "critical"
  start([DeviationReport is created])
  guard{severity is "critical"}
  s1[Look up a rule table]
%%step s1 type: Decision as: tier
%%step s1 ruleTable: Escalation tier
  s2[Create a record]
%%step s2 type: CreateEntity as: newCapaId
%%step s2 entity: CAPA
%%step s2 values: {"title":"Escalated","status":"open"}
  s3[Work out a value]
%%step s3 type: Formula as: window
%%step s3 operation: multiply
%%step s3 left: {{tier}}
%%step s3 right: 7
  s4[Update a field]
%%step s4 type: UpdateEntity
%%step s4 field: status
%%step s4 value: {{window}}
%%step s4 target: {{newCapaId}}
  s5[Delete a record]
%%step s5 type: DeleteEntity
%%step s5 entity: StabilityPull
%%step s5 target: {{newCapaId}}
  s6[Call a web service]
%%step s6 type: REST
%%step s6 method: POST
%%step s6 url: https://lims.example.com/hook
%%step s6 body: {"id":"{{newCapaId}}"}
  done([Done])
  start --> guard
  guard --> s1
  s1 --> s2
  s2 --> s3
  s3 --> s4
  s4 --> s5
  s5 --> s6
  s6 --> done`;

describe("compiling an automation-dialect workflow", () => {
  const warnings: string[] = [];
  const sagas = compileSagaWorkflows(AUTOMATION, ["DeviationReport"], (w) => warnings.push(w));

  it("compiles it at all, without warnings", () => {
    expect(warnings).toEqual([]);
    expect(sagas).toHaveLength(1);
  });

  it("keeps every step, in the order they were drawn", () => {
    expect(sagas[0]?.steps.map((s) => s.type)).toEqual([
      "Decision",
      "CreateEntity",
      "Formula",
      "UpdateEntity",
      "DeleteEntity",
      "REST",
    ]);
  });

  it("carries the node labels through as task names", () => {
    expect(sagas[0]?.steps[0]?.label).toBe("Look up a rule table");
  });

  it("translates each step's properties into saga vocabulary", () => {
    const byType = new Map(sagas[0]?.steps.map((s) => [s.type, s.props]));

    // ruleTable names a table living elsewhere — a saga calls that `rule`.
    expect(byType.get("Decision")).toMatchObject({ rule: "Escalation tier" });
    expect(byType.get("CreateEntity")).toMatchObject({
      entity: "CAPA",
      fields: '{"title":"Escalated","status":"open"}',
      as: "newCapaId",
    });
    // `as:` names a Formula's result; a saga spells that `target:`.
    expect(byType.get("Formula")).toMatchObject({
      target: "window",
      operation: "multiply",
      source: "tier",
      operand: "7",
    });
    expect(byType.get("REST")).toMatchObject({
      method: "POST",
      url: "https://lims.example.com/hook",
      bodyTemplate: '{"id":"{{newCapaId}}"}',
    });
  });

  it("unwraps {{...}} references into the bare names a saga uses", () => {
    const update = sagas[0]?.steps.find((s) => s.type === "UpdateEntity")?.props;
    expect(update).toMatchObject({ field: "status", source: "window", targetSource: "newCapaId" });
    // A reference must not survive as a literal value — that would write the
    // braces into the record instead of the value they stand for.
    expect(update?.value).toBeUndefined();

    const del = sagas[0]?.steps.find((s) => s.type === "DeleteEntity")?.props;
    expect(del).toMatchObject({ entity: "StabilityPull", targetSource: "newCapaId" });
  });
});

describe("sagaPropsFromAutomation", () => {
  it("treats a non-reference value as a literal, not a variable", () => {
    const props = sagaPropsFromAutomation("UpdateEntity", { field: "status", value: "escalated" });
    expect(props).toEqual({ field: "status", value: "escalated" });
    expect(props.source).toBeUndefined();
  });

  it("keeps a literal left operand as a Formula value", () => {
    expect(sagaPropsFromAutomation("Formula", { operation: "set", left: "3" })).toEqual({
      operation: "set",
      value: "3",
    });
  });

  it("moves an inline decision table onto decisionTable", () => {
    const table = '{"hitPolicy":"first","rules":[]}';
    expect(sagaPropsFromAutomation("Decision", { table })).toEqual({ decisionTable: table });
  });

  it("drops inputs, which the saga compiler has no use for", () => {
    expect(sagaPropsFromAutomation("Decision", { ruleTable: "T", inputs: "a,b" })).toEqual({
      rule: "T",
    });
  });

  it("leaves saga-dialect props untouched", () => {
    // The same function runs over nothing but saga input in the mixed case, so
    // it has to be a no-op there rather than mangling the older spelling.
    const saga = { entity: "CAPA", targetSource: "newCapaId", field: "status", source: "days" };
    expect(sagaPropsFromAutomation("UpdateEntity", saga)).toEqual(saga);
  });
});
