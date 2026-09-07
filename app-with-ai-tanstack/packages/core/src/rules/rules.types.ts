/**
 * Rules Engine Types
 * Types for business rules evaluation using GoRules Zen Engine
 */

/**
 * JDM (JSON Decision Model) content structure
 */
export interface JDMContent {
  name: string;
  version?: string;
  nodes: JDMNode[];
}

/**
 * JDM Node types
 */
export type JDMNode = JDMDecisionTableNode | JDMExpressionNode | JDMFunctionNode;

/**
 * Decision table node
 */
export interface JDMDecisionTableNode {
  id: string;
  type: "decisionTable";
  name: string;
  content: {
    inputs: string[];
    outputs: string[];
    rules: Array<{
      condition: string;
      output: Record<string, unknown>;
    }>;
  };
}

/**
 * Expression node
 */
export interface JDMExpressionNode {
  id: string;
  type: "expression";
  name: string;
  content: {
    expression: string;
    output: Record<string, unknown>;
  };
}

/**
 * Function node
 */
export interface JDMFunctionNode {
  id: string;
  type: "function";
  name: string;
  content: {
    function: string;
    output: Record<string, unknown>;
  };
}

/**
 * Rule evaluation context
 */
export interface RuleEvaluationContext {
  entity: Record<string, unknown>;
  relations: Record<string, Record<string, unknown>[]>;
  metadata: {
    entityName: string;
    entityId: string;
    operation: "CREATE" | "READ" | "UPDATE" | "DELETE";
    userId?: string;
    timestamp: string;
  };
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  success: boolean;
  mutations?: {
    entity?: Record<string, unknown>;
    relations?: Record<string, Record<string, unknown>>;
  };
  error?: string;
  validationErrors?: string[];
}

/**
 * Rule definition
 */
export interface RuleDefinition {
  id: string;
  entityName: string;
  ruleName: string;
  operation: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL";
  jdmContent: JDMContent;
  version: number;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rule validation result
 */
export interface RuleValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Rules engine service interface
 */
export interface IRulesEngineService {
  /**
   * Evaluate rule against context
   */
  evaluate(jdmContent: JDMContent, context: RuleEvaluationContext): Promise<RuleEvaluationResult>;

  /**
   * Validate JDM content
   */
  validateRule(jdmContent: JDMContent): Promise<RuleValidationResult>;

  /**
   * Get rule for entity and operation
   */
  getRule(
    entityName: string,
    operation: "CREATE" | "READ" | "UPDATE" | "DELETE"
  ): Promise<RuleDefinition | null>;

  /**
   * Create rule
   */
  createRule(
    entityName: string,
    ruleName: string,
    operation: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL",
    jdmContent: JDMContent,
    userId?: string
  ): Promise<RuleDefinition>;

  /**
   * Update rule
   */
  updateRule(ruleId: string, jdmContent: JDMContent): Promise<RuleDefinition>;

  /**
   * Get rule history
   */
  getRuleHistory(ruleId: string): Promise<RuleDefinition[]>;

  /**
   * Get all rules with pagination
   * Created by: CORE-008 ticket
   */
  getAllRules(
    page?: number,
    limit?: number,
    entityName?: string
  ): Promise<{
    rules: RuleDefinition[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Dry run rule
   */
  dryRun(jdmContent: JDMContent, context: RuleEvaluationContext): Promise<RuleEvaluationResult>;
}
