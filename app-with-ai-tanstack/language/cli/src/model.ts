/**
 * EML unified model.
 *
 * The single in-memory representation of an .mmd EML document after parsing:
 * the data model (entities/relationships/enums/indexes), the declarative
 * business rules (decision flows), and the business workflows (lifecycle hooks
 * and state machines). The generator consumes this model to emit an application.
 */

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

export type RuleNodeShape = "stadium" | "diamond" | "circle" | "rounded" | "rect";
export type JdmNodeRole =
  | "inputNode"
  | "outputNode"
  | "switchNode"
  | "functionNode"
  | "expressionNode";

export interface EmlAttribute {
  name: string;
  type: CanonicalType;
  rawType: string;
  maxLength?: number;
  required: boolean;
  unique: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  enumRef?: string;
  description?: string;
}

export interface EmlEntity {
  name: string;
  tableName: string;
  attributes: EmlAttribute[];
  primaryKey: string;
  timestamps: boolean;
  audited?: boolean;
  softDelete?: boolean;
  prefix?: string;
  label?: string;
}

export interface EmlRelationship {
  name: string;
  source: string;
  target: string;
  cardinality: CardinalityKind;
  operator: string;
  foreignKey: string;
}

export interface EmlEnum {
  name: string;
  values: string[];
}

export interface EmlIndex {
  entity: string;
  columns: string[];
  unique: boolean;
}

export interface RuleNode {
  id: string;
  label: string;
  shape: RuleNodeShape;
  jdmType: JdmNodeRole;
  /** Parsed condition when the label is machine-evaluable (decision nodes). */
  condition?: ParsedCondition;
}

export interface RuleEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ParsedCondition {
  field: string;
  op: ">" | ">=" | "<" | "<=" | "==" | "!=" | "contains";
  value: string | number | boolean;
  raw: string;
}

export interface EmlRule {
  name: string;
  entity?: string;
  event?: string;
  priority?: number;
  nodes: RuleNode[];
  edges: RuleEdge[];
  /** The original Mermaid flowchart source for this rule (fed to the JDM converter). */
  raw?: string;
}

export interface EmlHook {
  type: HookType;
  handler: string;
  entity: string;
  fields: string[];
}

export interface EmlTransition {
  from: string;
  to: string;
  event?: string;
}

export interface EmlGuard {
  roles: string[];
  entity: string;
  op: string;
}

export interface EmlTrigger {
  source: string;
  handler: string;
  entity: string;
}

export interface EmlWorkflow {
  name: string;
  entity?: string;
  kind: "hook" | "state" | "saga";
  hooks: EmlHook[];
  states: string[];
  transitions: EmlTransition[];
  guards: EmlGuard[];
  triggers: EmlTrigger[];
}

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  line?: number;
  /** Human description of the auto-correction applied, if any. */
  fix?: string;
}

export interface EmlMeta {
  name?: string;
  version?: string;
  stack?: string;
  [key: string]: string | undefined;
}

export interface EmlModel {
  meta: EmlMeta;
  entities: EmlEntity[];
  relationships: EmlRelationship[];
  enums: EmlEnum[];
  indexes: EmlIndex[];
  rules: EmlRule[];
  workflows: EmlWorkflow[];
  hooks: EmlHook[];
  guards: EmlGuard[];
  triggers: EmlTrigger[];
  diagnostics: Diagnostic[];
}

export function emptyModel(): EmlModel {
  return {
    meta: {},
    entities: [],
    relationships: [],
    enums: [],
    indexes: [],
    rules: [],
    workflows: [],
    hooks: [],
    guards: [],
    triggers: [],
    diagnostics: [],
  };
}
