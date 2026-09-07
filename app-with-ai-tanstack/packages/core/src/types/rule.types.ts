/**
 * Business Rules Types
 *
 * Metadata-driven business rule system following Compiere/ADempiere architecture.
 * Rules can execute in two modes:
 * - 'code': Generated TypeScript code (requires redeploy)
 * - 'runtime': JSON decision model (instant updates via rule engine)
 */

/**
 * Rule execution mode
 */
export type RuleExecutionMode = "code" | "runtime";

/**
 * Trigger events for rule execution
 */
export type RuleTrigger =
  | "beforeCreate"
  | "afterCreate"
  | "beforeUpdate"
  | "afterUpdate"
  | "beforeDelete"
  | "afterDelete"
  | "beforeRead"
  | "afterRead";

/**
 * Decision node types in GoRules decision graph
 */
export type DecisionNodeType = "input" | "decision" | "output";

/**
 * GoRules decision model structure
 */
export interface DecisionModel {
  name: string;
  nodes: DecisionNode[];
  edges: DecisionEdge[];
}

/**
 * Decision node in the decision graph
 */
export interface DecisionNode {
  id: string;
  type: DecisionNodeType;
  position: { x: number; y: number };
  data: {
    name: string;
    description?: string;
    fields?: DecisionField[];
    expression?: string; // For decision nodes
  };
}

/**
 * Decision edge connecting nodes
 */
export interface DecisionEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}

/**
 * Field definition for input/output nodes
 */
export interface DecisionField {
  name: string;
  type: string;
  entity?: string;
  required?: boolean;
}

/**
 * Rule decision output
 */
export interface RuleDecision {
  allowed: boolean;
  action: string;
  reason?: string;
  data?: Record<string, unknown>;
  approver?: string; // For approval routing
  modifiedFields?: Record<string, unknown>; // Fields to modify before save
}

/**
 * Rule execution context
 */
export interface RuleExecutionContext {
  entity: string;
  trigger: RuleTrigger;
  facts: Record<string, unknown>; // Input data
  context: {
    user?: {
      id: string;
      email: string;
      roles: string[];
    };
    timestamp: Date;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Rule definition from sys_rule table (legacy/database-level type)
 * For the business-layer type, see RuleDefinition in @appwithai/core/rules
 */
export interface SysRuleDefinition {
  id: string;
  name: string;
  description?: string;
  entity: string;
  trigger: RuleTrigger;
  execution_mode: RuleExecutionMode;
  decision_model?: string; // JSON string
  generated_code?: string; // TypeScript code
  active: boolean;
  priority: number;
  version: number;
  created_by: string;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Rule version snapshot
 */
export interface RuleVersion {
  id: string;
  rule_id: string;
  version: number;
  decision_model?: string;
  generated_code?: string;
  change_reason?: string;
  changed_by: string;
  changed_at: Date;
}

/**
 * Rule execution log entry
 */
export interface RuleExecutionLog {
  id: string;
  rule_id: string;
  entity: string;
  trigger: RuleTrigger;
  entity_record_id?: string;
  request_id?: string;
  input_facts?: Record<string, unknown>;
  output_decision?: RuleDecision;
  allowed: boolean;
  action?: string;
  reason?: string;
  execution_time_ms: number;
  executed_at: Date;
  error_message?: string;
  success: boolean;
}

/**
 * Rule evaluation request
 */
export interface EvaluateRuleRequest {
  ruleId: string;
  context: RuleExecutionContext;
}

/**
 * Rule evaluation response
 */
export interface EvaluateRuleResponse {
  decision: RuleDecision;
  ruleId: string;
  ruleName: string;
  executionTimeMs: number;
}

/**
 * Bulk rule evaluation (evaluates all active rules for entity/trigger)
 */
export interface EvaluateRulesRequest {
  entity: string;
  trigger: RuleTrigger;
  context: RuleExecutionContext;
}

/**
 * Bulk rule evaluation response
 */
export interface EvaluateRulesResponse {
  decisions: Array<{
    ruleId: string;
    ruleName: string;
    decision: RuleDecision;
  }>;
  executionTimeMs: number;
  rulesEvaluated: number;
  rulesTriggered: number;
}
