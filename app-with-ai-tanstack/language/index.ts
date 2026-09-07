/**
 * APPWITHAI Modeling Language (EML)
 * ---------------------------------
 * Standalone, Mermaid-based language for describing an application's
 * Entity Relationship Diagram (ERD), its business rules, and its business
 * workflows in one artifact.
 *
 * The canonical, machine-readable definition lives in
 * `language/appwithai-language.json`. This module is a typed loader/accessor
 * so the generator application (and any tooling) can read the language
 * definition without re-parsing the JSON by hand.
 *
 * @example
 * ```ts
 * import { loadLanguageDefinition, normalizeType, cardinalityKind } from "../language";
 *
 * const def = loadLanguageDefinition();
 * normalizeType("varchar");      // "string"
 * cardinalityKind("||--o{");     // "oneToMany"
 * isHookType("beforeCreate");    // true
 * ```
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Types describing the shape of appwithai-language.json
// ---------------------------------------------------------------------------

export type CanonicalType =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "json";

export type CardinalityKind = "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";

export type HookType =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "beforeQuery"
  | "afterQuery"
  | "customValidate"
  | "beforeRead"
  | "afterRead"
  | "beforeList"
  | "afterList";

export type JdmNodeRole =
  | "inputNode"
  | "outputNode"
  | "switchNode"
  | "functionNode"
  | "expressionNode";

/**
 * One executable step type for a saga workflow.
 *
 * The checker, the generator and both authoring UIs read their notion of "what
 * this step needs" from here, so a new step type is declared once.
 */
export interface StepNodeDefinition {
  name: string;
  purpose: string;
  required: string[];
  /** Groups where at least one member must be present. */
  oneOf?: string[][];
  optional?: string[];
  /** Formula only: the operations it understands. */
  operations?: Record<string, string>;
  /** Formula only: extra required properties per operation. */
  perOperation?: Record<string, { required: string[] }>;
  notes?: string[];
  rowTargeting?: string;
  shipped?: boolean;
  example: string;
}

/** One lifecycle event an automation can be triggered by. */
export interface AutomationTrigger {
  /** How the builder names it, e.g. "created". */
  event: string;
  /** The hook it maps to on the generated service, e.g. "afterCreate". */
  hook: string;
  phase: "before" | "after";
  /** Whether the automation can still stop the write. */
  blocking: boolean;
  purpose: string;
}

/** A comparison operator usable in an automation condition. */
export interface AutomationOperator {
  id: string;
  label: string;
  /** 0 means the operator takes no right-hand value ("is empty"). */
  arity: 0 | 1;
}

/** One step type in the automation dialect. */
export interface AutomationStepDefinition {
  type: string;
  purpose: string;
  properties: string[];
  example: string;
}

export interface LanguageDefinition {
  $schema: string;
  $id: string;
  language: {
    id: string;
    name: string;
    abbreviation: string;
    version: string;
    basedOn: string;
    mermaidCompatibility: string;
    description: string;
    fileExtensions: string[];
    encoding: string;
    caseSensitivity: Record<string, string>;
    purpose: string[];
  };
  document: Record<string, unknown>;
  sections: Record<string, unknown>;
  types: {
    description: string;
    canonical: CanonicalType[];
    map: Record<string, CanonicalType>;
    semanticHints: Record<string, string>;
    default: CanonicalType;
  };
  modifiers: {
    description: string;
    map: Record<string, { meaning: string; effects: string[] }>;
    defaults: Record<string, string>;
  };
  cardinalities: {
    description: string;
    glyphReference: Record<string, string>;
    map: Array<{ operator: string; kind: CardinalityKind; example: string }>;
  };
  hooks: {
    description: string;
    types: Array<{ type: HookType; phase: string; op: string; purpose: string }>;
    directive: { pattern: string; regex: string; paramForms: string[] };
  };
  ruleNodes: {
    description: string;
    /** Side-effecting actions a %%action directive may declare. */
    actions?: {
      description: string;
      directive: string;
      whenForm: string;
      types: Array<{
        name: string;
        purpose: string;
        required: string[];
        optional?: string[];
        example: string;
      }>;
    };
    map: Array<{
      shape: string;
      delimiters: string;
      jdmType: string;
      role: string;
      example: string;
      resolution?: string;
    }>;
  };
  workflowConstructs: {
    flowShapes: Record<string, string>;
    stateForm: Record<string, string>;
    workflowKinds: Record<string, Record<string, unknown>>;
    /** Executable step vocabulary for `kind: saga` workflows. */
    stepNodes: {
      description: string;
      directive: string;
      propertyForm: string;
      variables: string;
      types: StepNodeDefinition[];
    };
  };
  /** The automation dialect — the form the shipped builder reads and writes. */
  automations: {
    description: string;
    relationshipToSaga: string;
    shipped: boolean;
    writer: string;
    reader: string;
    envelope: { description: string; lines: string[]; note: string };
    triggers: {
      description: string;
      directive: string;
      note: string;
      events: AutomationTrigger[];
    };
    conditions: {
      description: string;
      directive: string;
      valueEncoding: string;
      conflict: { with: string; description: string; status: string };
      operators: AutomationOperator[];
    };
    steps: {
      description: string;
      directives: string[];
      types: AutomationStepDefinition[];
    };
    references: { description: string; form: string; sources: string[] };
    nodes: Record<string, string>;
  };
  directives: {
    description: string;
    reserved: Array<{ keyword: string; form: string; purpose: string; examples: string[] }>;
  };
  grammar: Record<string, string>;
  generatorContract: Record<string, unknown>;
  conformance: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Absolute path to the canonical language definition file. */
export const LANGUAGE_DEFINITION_PATH = (() => {
  // Resolve relative to this module so it works from source and from dist.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "appwithai-language.json");
})();

let cached: LanguageDefinition | null = null;

/**
 * Supply the definition instead of reading it from disk.
 *
 * The checker runs in a browser tab now — `appwithai-wasm`'s upload page checks
 * a model before compiling it — and a tab has no `appwithai-language.json` to
 * open. The bundler inlines the same JSON and hands it over here, so the
 * vocabulary a document is checked against is the file in this folder either
 * way, rather than a second copy that drifts.
 */
export function setLanguageDefinition(definition: LanguageDefinition): void {
  cached = definition;
}

/**
 * Load and cache the canonical EML definition from disk.
 * @param force - bypass the in-memory cache and re-read the file.
 */
export function loadLanguageDefinition(force = false): LanguageDefinition {
  if (cached && !force) return cached;
  const raw = readFileSync(LANGUAGE_DEFINITION_PATH, "utf-8");
  cached = JSON.parse(raw) as LanguageDefinition;
  return cached;
}

// ---------------------------------------------------------------------------
// Convenience accessors (thin helpers over the definition data)
// ---------------------------------------------------------------------------

/** Normalize an attribute type alias to its canonical type (default: "string"). */
export function normalizeType(rawType: string): CanonicalType {
  const def = loadLanguageDefinition();
  const key = (rawType || "")
    .toLowerCase()
    .replace(/\(\d+\)/, "")
    .trim();
  return def.types.map[key] ?? def.types.default;
}

/** Resolve a Mermaid ER relationship operator to a cardinality kind, or null. */
export function cardinalityKind(operator: string): CardinalityKind | null {
  const def = loadLanguageDefinition();
  const found = def.cardinalities.map.find((c) => c.operator === operator);
  return found ? found.kind : null;
}

/** All valid lifecycle hook types. */
export function hookTypes(): HookType[] {
  return loadLanguageDefinition().hooks.types.map((h) => h.type);
}

/** Type guard: is the given string a valid hook type? */
export function isHookType(value: string): value is HookType {
  return hookTypes().includes(value as HookType);
}

/** All reserved directive keywords (e.g. "%%hook", "%%enum"). */
export function reservedDirectives(): string[] {
  return loadLanguageDefinition().directives.reserved.map((d) => d.keyword);
}

/** Language version string, e.g. "1.0.0". */
export function languageVersion(): string {
  return loadLanguageDefinition().language.version;
}

export default loadLanguageDefinition;

/** The executable step types a `kind: saga` workflow may use. */
export function stepNodeTypes(): StepNodeDefinition[] {
  return loadLanguageDefinition().workflowConstructs.stepNodes.types;
}

/** Look up one step type's contract by name. */
export function stepNode(name: string): StepNodeDefinition | undefined {
  return stepNodeTypes().find((step) => step.name === name);
}

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

/** The lifecycle events an automation can be triggered by. */
export function automationTriggers(): AutomationTrigger[] {
  return loadLanguageDefinition().automations.triggers.events;
}

/**
 * The hook name a trigger event maps to, or null if the event is unknown.
 *
 * This is the mapping the serialiser writes into `%%hook`, so a tool that
 * needs to read or emit an automation should take it from here rather than
 * restating it.
 */
export function triggerHook(event: string): string | null {
  return automationTriggers().find((t) => t.event === event)?.hook ?? null;
}

/** The reverse: which trigger event a `%%hook` name denotes. */
export function hookTriggerEvent(hook: string): string | null {
  return automationTriggers().find((t) => t.hook === hook)?.event ?? null;
}

/** Comparison operators available to an automation condition. */
export function automationOperators(): AutomationOperator[] {
  return loadLanguageDefinition().automations.conditions.operators;
}

/**
 * How many operands an operator takes: 1 normally, 0 for checks like
 * "is empty" that have nothing on the right-hand side. Unknown operators are
 * reported as 1, matching the builder's own fallback.
 */
export function operatorArity(id: string): 0 | 1 {
  return automationOperators().find((o) => o.id === id)?.arity ?? 1;
}

/** The step types an automation may use. */
export function automationStepTypes(): AutomationStepDefinition[] {
  return loadLanguageDefinition().automations.steps.types;
}

/** Look up one automation step type by name. */
export function automationStep(type: string): AutomationStepDefinition | undefined {
  return automationStepTypes().find((step) => step.type === type);
}
