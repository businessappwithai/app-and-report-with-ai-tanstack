/**
 * The generated app and this one must behave identically.
 *
 * The builder ships twice — once here, once copied into every generated
 * project — and the copy is what a customer actually uses. A drift between them
 * would show up as an automation that opens correctly in the modelling tool and
 * wrongly in the app it was generated for, which is the worst place to find it.
 *
 * So this imports the generator's template copy directly and runs the same
 * inputs through both, over the drug-discovery model. It fails the moment
 * someone edits one and forgets the other.
 */

import { describe, expect, it } from "vitest";
import * as generated from "../../../../../generator/templates/tanstack-start-nestjs/frontend/src/lib/automation/model";
import * as generatedRules from "../../../../../generator/templates/tanstack-start-nestjs/frontend/src/lib/automation/rule-content";
import * as web from "../model";
import * as webRules from "../rule-content";

const ENTITIES = [
  "Compound",
  "Experiment",
  "Sample",
  "ChemicalInventory",
  "Instrument",
  "DeviationReport",
  "CAPA",
  "StabilityTest",
];

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("the copy shipped to generated apps", () => {
  it("declares the same step types, triggers and operators", () => {
    expect(generated.STEP_TYPES).toEqual(web.STEP_TYPES);
    expect(generated.TRIGGER_EVENTS).toEqual(web.TRIGGER_EVENTS);
    expect(generated.OPERATORS).toEqual(web.OPERATORS);
    expect(generated.STEP_LABELS).toEqual(web.STEP_LABELS);
    expect(generated.STEP_HINTS).toEqual(web.STEP_HINTS);
    expect(generated.TRIGGER_LABELS).toEqual(web.TRIGGER_LABELS);
    expect(generated.TRIGGER_HOOKS).toEqual(web.TRIGGER_HOOKS);
    expect(generated.STEP_FIELDS).toEqual(web.STEP_FIELDS);
  });

  it("serialises 200 automations to byte-identical mermaid", () => {
    const rand = makeRandom(775533);
    const mismatches: string[] = [];

    for (let n = 1; n <= 200; n++) {
      const entity = ENTITIES[Math.floor(rand() * ENTITIES.length)] as string;
      const event = web.TRIGGER_EVENTS[
        Math.floor(rand() * web.TRIGGER_EVENTS.length)
      ] as (typeof web.TRIGGER_EVENTS)[number];

      // Built once, then handed to both serialisers — the model is plain data,
      // so the only thing under test is what each copy does with it.
      const automation: web.Automation = {
        id: `a${n}`,
        name: `Parity ${n}`,
        trigger: { entity, event },
        conditions: [
          {
            id: `c${n}`,
            field: `${entity.toLowerCase()}.status`,
            operator: "eq",
            value: `state-${n}`,
          },
        ],
        steps: web.STEP_TYPES.map((type, i) => ({
          id: `s${n}_${i}`,
          type,
          resultName: `r${n}_${i}`,
          props: { ruleTable: "Assay tier", entity, field: "status", value: `v${i}`, url: "u" },
        })),
        status: "draft",
      };

      const fromWeb = web.serializeAutomation(automation);
      const fromGenerated = generated.serializeAutomation(
        automation as unknown as generated.Automation
      );
      if (fromWeb !== fromGenerated) mismatches.push(`automation ${n}`);
    }

    expect(mismatches).toEqual([]);
  });

  it("parses the same mermaid into the same automation", () => {
    const rand = makeRandom(918273);
    const mismatches: string[] = [];

    for (let n = 1; n <= 200; n++) {
      const entity = ENTITIES[Math.floor(rand() * ENTITIES.length)] as string;
      const source = web.serializeAutomation({
        id: `a${n}`,
        name: `Parity parse ${n}`,
        trigger: { entity, event: "created" },
        conditions: [
          { id: `c${n}`, field: `${entity.toLowerCase()}.quantity`, operator: "gt", value: `${n}` },
        ],
        steps: [
          {
            id: `s${n}`,
            type: "Decision",
            resultName: `tier${n}`,
            props: { ruleTable: "Hazard band" },
          },
        ],
        status: "draft",
      });

      const a = web.parseAutomation(source, entity);
      const b = generated.parseAutomation(source, entity);

      const shape = (x: { trigger: unknown; conditions: unknown[]; steps: unknown[] }) =>
        JSON.stringify({
          trigger: x.trigger,
          conditions: x.conditions.map((c) => {
            const { id: _id, ...rest } = c as Record<string, unknown>;
            return rest;
          }),
          steps: x.steps.map((s) => {
            const { id: _id, ...rest } = s as Record<string, unknown>;
            return rest;
          }),
        });

      if (shape(a) !== shape(b)) mismatches.push(`automation ${n}`);
    }

    expect(mismatches).toEqual([]);
  });

  it("validates the same automation to the same problems", () => {
    const broken: web.Automation = {
      id: "x",
      name: "",
      trigger: { entity: "", event: "created" },
      conditions: [{ id: "c", field: "", operator: "eq", value: "" }],
      steps: [{ id: "s", type: "Decision", resultName: "", props: {} }],
      status: "draft",
    };

    const a = web
      .validateAutomation(broken)
      .map((p) => p.message)
      .sort();
    const b = generated
      .validateAutomation(broken as unknown as generated.Automation)
      .map((p) => p.message)
      .sort();

    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(0);
  });

  it("offers the same values at the same point in a run", () => {
    const automation: web.Automation = {
      id: "a",
      name: "Values",
      trigger: { entity: "Experiment", event: "updated" },
      conditions: [],
      steps: [
        { id: "s1", type: "Decision", resultName: "tier", props: { ruleTable: "Assay tier" } },
        { id: "s2", type: "CreateEntity", resultName: "capaId", props: { entity: "CAPA" } },
        { id: "s3", type: "REST", resultName: "reply", props: { url: "u", method: "POST" } },
      ],
      status: "draft",
    };
    const fields = { Experiment: ["id", "status", "run_count"] };

    for (let i = 0; i <= automation.steps.length; i++) {
      const a = web.valuesAvailableAt(automation, i, fields).map((v) => v.path);
      const b = generated
        .valuesAvailableAt(automation as unknown as generated.Automation, i, fields)
        .map((v) => v.path);
      expect(b).toEqual(a);
    }
  });

  it("treats stored rule content the same way", () => {
    const table = {
      hitPolicy: "first" as const,
      inputs: [{ id: "i1", name: "Purity", field: "Compound.purity" }],
      outputs: [{ id: "o1", name: "Tier", field: "tier" }],
      rules: [{ _id: "r1", i1: "> 95", o1: "A" }],
    };
    const legacy = { name: "Old", nodes: [] };

    expect(generatedRules.isDecisionTable(table)).toBe(webRules.isDecisionTable(table));
    expect(generatedRules.isDecisionTable(legacy)).toBe(webRules.isDecisionTable(legacy));
    expect(generatedRules.asDecisionTable(table)).toEqual(webRules.asDecisionTable(table));
    expect(generatedRules.wouldReplaceStoredContent(legacy)).toBe(
      webRules.wouldReplaceStoredContent(legacy)
    );
  });
});
