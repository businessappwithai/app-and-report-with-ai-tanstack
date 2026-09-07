import { describe, expect, it } from "vitest";
import { buildPassThroughBpmn, buildStateEntryBpmn, compileWorkflows } from "../index";

const ENTITIES = ["Experiment", "CAPA"];

const EXPERIMENT_LIFECYCLE = `
%%meta name: Experiment Lifecycle
%%workflow ExperimentLifecycle entity: Experiment kind: state
stateDiagram-v2
    [*] --> draft
    draft --> submitted : submit
    submitted --> in_review : assign_reviewer
    in_review --> approved : approve
    approved --> completed : complete
    in_review --> draft : return_to_draft
    completed --> [*]
    approved --> cancelled : cancel
    cancelled --> [*]
`;

describe("compileWorkflows", () => {
  it("reads states, transitions, start and end", () => {
    const workflows = compileWorkflows(EXPERIMENT_LIFECYCLE, ENTITIES);

    expect(workflows).toHaveLength(1);
    const workflow = workflows[0];
    expect(workflow?.name).toBe("ExperimentLifecycle");
    expect(workflow?.entity).toBe("Experiment");
    expect(workflow?.initial).toBe("draft");
    expect(workflow?.terminal.sort()).toEqual(["cancelled", "completed"]);
    expect(workflow?.states.map((state) => state.name).sort()).toEqual([
      "approved",
      "cancelled",
      "completed",
      "draft",
      "in_review",
      "submitted",
    ]);
  });

  it("keeps the trigger label on a transition", () => {
    const workflow = compileWorkflows(EXPERIMENT_LIFECYCLE, ENTITIES)[0];
    const submit = workflow?.transitions.find((t) => t.from === "draft");
    expect(submit).toMatchObject({ to: "submitted", trigger: "submit" });
  });

  it("does not treat the [*] marker as a state", () => {
    const workflow = compileWorkflows(EXPERIMENT_LIFECYCLE, ENTITIES)[0];
    expect(workflow?.states.map((state) => state.name)).not.toContain("[*]");
    // `[*] --> draft` and `completed --> [*]` are start/end markers, not moves.
    expect(workflow?.transitions.every((t) => t.from !== "[*]" && t.to !== "[*]")).toBe(true);
  });

  it("ignores hook workflows — they compile to handlers, not definitions", () => {
    const source = `
%%workflow CompoundRegistration entity: Compound kind: hook
flowchart TD
    a[Request] --> b[Persist]
    %%hook beforeCreate stamp on Compound
`;
    expect(compileWorkflows(source, ["Compound"])).toEqual([]);
  });

  it("drops a workflow for an entity the model does not declare", () => {
    const warnings: string[] = [];
    const source = `
%%workflow Ghost entity: Nonexistent kind: state
stateDiagram-v2
    [*] --> draft
`;
    expect(compileWorkflows(source, ENTITIES, (m) => warnings.push(m))).toEqual([]);
    expect(warnings[0]).toContain("unknown entity");
  });

  it("warns when no starting state is marked", () => {
    const warnings: string[] = [];
    const source = `
%%workflow Loose entity: CAPA kind: state
stateDiagram-v2
    open --> closed : resolve
`;
    const workflows = compileWorkflows(source, ENTITIES, (m) => warnings.push(m));
    expect(workflows).toHaveLength(1);
    expect(workflows[0]?.initial).toBeUndefined();
    expect(warnings.join(" ")).toContain("no starting state");
  });
});

describe("buildStateEntryBpmn", () => {
  const workflow = compileWorkflows(EXPERIMENT_LIFECYCLE, ENTITIES)[0]!;

  it("sets the status field to the starting state", () => {
    const bpmn = buildStateEntryBpmn(workflow, "bus_experiment", "status");

    expect(bpmn).toContain('name="nodeType" value="UpdateEntity"');
    expect(bpmn).toContain('name="entity" value="bus_experiment"');
    expect(bpmn).toContain('name="field" value="status"');
    expect(bpmn).toContain('name="value" value="draft"');
  });

  it("wires start → task → end so the executor walks the chain", () => {
    const bpmn = buildStateEntryBpmn(workflow, "bus_experiment", "status");

    expect(bpmn).toContain('sourceRef="start" targetRef="task_enter_initial"');
    expect(bpmn).toContain('sourceRef="task_enter_initial" targetRef="end"');
  });

  it("skips straight from start to end when there is no starting state", () => {
    const noStart = { ...workflow, initial: undefined };
    const bpmn = buildStateEntryBpmn(noStart, "bus_experiment", "status");

    expect(bpmn).not.toContain("UpdateEntity");
    expect(bpmn).toContain('sourceRef="start" targetRef="end"');
  });

  it("escapes values so a stray quote cannot break the document", () => {
    const odd = { ...workflow, initial: 'dr"aft' };
    expect(buildStateEntryBpmn(odd, "bus_experiment", "status")).toContain("dr&quot;aft");
  });
});

describe("buildPassThroughBpmn", () => {
  it("still produces a run for an entity with no state machine", () => {
    const bpmn = buildPassThroughBpmn("bus_compound");

    expect(bpmn).toContain('name="nodeType" value="Formula"');
    expect(bpmn).toContain('sourceRef="start" targetRef="task_noop"');
    expect(bpmn).toContain('sourceRef="task_noop" targetRef="end"');
  });
});
