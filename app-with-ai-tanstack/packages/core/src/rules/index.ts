/**
 * Rules Engine Module
 *
 * Business rules evaluation using GoRules zen-engine.
 *
 * Created by: CORE-002 ticket
 * Week: 1
 */

export type {
  JDMContent,
  JDMDecisionTableNode,
  JDMExpressionNode,
  JDMFunctionNode,
  JDMNode,
} from "./jdm.schema";
export {
  assertValidJDM,
  JDMContentSchema,
  JDMDecisionTableNodeSchema,
  JDMExpressionNodeSchema,
  JDMFunctionNodeSchema,
  JDMNodeSchema,
  JDMRuleSchema,
  validateJDM,
} from "./jdm.schema";
export type { CacheStats } from "./rule-cache.service";
export {
  RuleCacheService,
  ruleCache,
} from "./rule-cache.service";
export type {
  IRulesEngineService,
  JDMContent as JDM,
  RuleDefinition,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleValidationResult,
} from "./rules.types";
// Default export
export { RulesEngineService, RulesEngineService as default } from "./rules-engine.service";
export type { EvaluationOptions, EvaluationResult } from "./zen-engine.singleton";
// Public API exports
export { default as ZenEngineSingleton, zenEngine } from "./zen-engine.singleton";
