/**
 * Compiling a repeat.
 *
 * A loop is drawn as a Mermaid `subgraph`, which means its members carry no
 * sequence-flow edges of their own. That is the trap: without expanding the
 * subgraph the members are unreachable from any edge and fall through to the
 * "unwired tasks run last" pass, so a workflow compiles with no warning and
 * runs its loop body *after* everything that was supposed to follow it.
 *
 * The loop needs no BPMN element of its own — the check is flattened onto each
 * member, and the executor treats a run of consecutive equal `loopId`s as one
 * body. That keeps every workflow definition written before loops existed, and
 * every BPMN renderer, working unchanged.
 */

import { describe, expect, it } from "vitest";
import { buildSagaBpmn, compileSagaWorkflows, parseSubgraphs } from "../index";

const WITH_LOOP = `flowchart TD
%%meta kind: workflow
%%workflow DrainBacklog entity: Sample kind: saga trigger: automatic operation: UPDATE
%%hook afterUpdate on Sample
%%loop L1 while: retry_count lt "5" max: 4
  start([Sample is updated])
  subgraph L1[Repeat while retry_count is less than 5]
    s1[Call a web service]
    s2[Set retry_count]
  end
  s3[Set status]
%%step s1 type: REST
%%step s1 method: POST
%%step s1 url: https://lims.example.com/sync
%%step s1 in: L1
%%step s2 type: UpdateEntity
%%step s2 field: retry_count
%%step s2 value: {{L1.iteration}}
%%step s2 in: L1
%%step s3 type: UpdateEntity
%%step s3 field: status
%%step s3 value: drained
  done([Done])
  start --> L1
  L1 --> s3
  s3 --> done`;

describe("parseSubgraphs", () => {
  it("reads the member ids in written order", () => {
    expect(parseSubgraphs(WITH_LOOP).get("L1")).toEqual(["s1", "s2"]);
  });

  it("ignores directive lines inside the block", () => {
    expect(parseSubgraphs(WITH_LOOP).get("L1")).not.toContain("%%step");
  });

  it("closes at end, so later nodes are not swallowed", () => {
    expect(parseSubgraphs(WITH_LOOP).get("L1")).not.toContain("s3");
  });
});

describe("compiling a workflow with a loop", () => {
  const warnings: string[] = [];
  const saga = compileSagaWorkflows(WITH_LOOP, ["Sample"], (w) => warnings.push(w))[0];

  it("compiles without warnings", () => {
    expect(warnings).toEqual([]);
    expect(saga).toBeDefined();
  });

  it("runs the loop body in place, not after everything else", () => {
    // The bug this pins: s3 running before s1/s2 because the members had no edges.
    expect(saga?.steps.map((s) => s.nodeId)).toEqual(["s1", "s2", "s3"]);
  });

  it("flattens the check onto every member", () => {
    const [first, second, outside] = saga?.steps ?? [];
    for (const member of [first, second]) {
      expect(member?.props).toMatchObject({
        loopId: "L1",
        loopField: "retry_count",
        loopOperator: "lt",
        loopValue: "5",
        loopMax: "4",
      });
    }
    expect(outside?.props.loopId).toBeUndefined();
  });

  it("does not leave the raw in: property on the step", () => {
    // `in` is the authoring spelling; downstream only ever sees loopId.
    expect(saga?.steps.every((s) => s.props.in === undefined)).toBe(true);
  });

  it("carries the loop into the BPMN as ordinary task properties", () => {
    const bpmn = buildSagaBpmn(saga as NonNullable<typeof saga>, "bus_sample");
    expect(bpmn).toContain('name="loopId" value="L1"');
    expect(bpmn).toContain('name="loopField" value="retry_count"');
    expect(bpmn).toContain('name="loopOperator" value="lt"');
    // No new element type, so an existing renderer still opens it.
    expect(bpmn).not.toContain("bpmn:loop");
  });
});

describe("loops that do not add up", () => {
  it("warns when a step names a loop that was never declared", () => {
    const orphan = WITH_LOOP.replace('%%loop L1 while: retry_count lt "5" max: 4\n', "");
    const warnings: string[] = [];
    compileSagaWorkflows(orphan, ["Sample"], (w) => warnings.push(w));
    expect(warnings.some((w) => /never declared/.test(w))).toBe(true);
  });

  it("warns when a declared loop has no members", () => {
    const unused = WITH_LOOP.replace(/%%step s1 in: L1\n/, "").replace(/%%step s2 in: L1\n/, "");
    const warnings: string[] = [];
    compileSagaWorkflows(unused, ["Sample"], (w) => warnings.push(w));
    expect(warnings.some((w) => /has no steps in it/.test(w))).toBe(true);
  });

  it("still compiles the rest when a loop is broken", () => {
    const orphan = WITH_LOOP.replace('%%loop L1 while: retry_count lt "5" max: 4\n', "");
    const saga = compileSagaWorkflows(orphan, ["Sample"], () => {})[0];
    expect(saga?.steps).toHaveLength(3);
  });
});
