/**
 * JDM (JSON Decision Model) Validation Schema
 * Zod schemas for validating JDM content
 *
 * Created by: CORE-006 ticket
 * Week: 1
 */

import { z } from "zod";

/**
 * Individual rule within a decision table
 */
export const JDMRuleSchema = z.object({
  condition: z.string().min(1, "Rule condition cannot be empty"),
  output: z.record(z.any(), {
    description: "Rule output values",
  }),
});

/**
 * Decision table node content
 */
export const JDMDecisionTableContentSchema = z.object({
  inputs: z.array(z.string()).min(1, "At least one input required"),
  outputs: z.array(z.string()).min(1, "At least one output required"),
  rules: z.array(JDMRuleSchema).min(1, "At least one rule required"),
});

/**
 * Expression node content
 */
export const JDMExpressionContentSchema = z.object({
  expression: z.string().min(1, "Expression cannot be empty"),
  output: z.record(z.any()),
});

/**
 * Function node content
 */
export const JDMFunctionContentSchema = z.object({
  function: z.string().min(1, "Function name cannot be empty"),
  output: z.record(z.any()),
});

/**
 * Decision table node
 */
export const JDMDecisionTableNodeSchema = z.object({
  id: z.string().min(1, "Node ID cannot be empty"),
  type: z.literal("decisionTable"),
  name: z.string().min(1, "Node name cannot be empty"),
  content: JDMDecisionTableContentSchema,
});

/**
 * Expression node
 */
export const JDMExpressionNodeSchema = z.object({
  id: z.string().min(1, "Node ID cannot be empty"),
  type: z.literal("expression"),
  name: z.string().min(1, "Node name cannot be empty"),
  content: JDMExpressionContentSchema,
});

/**
 * Function node
 */
export const JDMFunctionNodeSchema = z.object({
  id: z.string().min(1, "Node ID cannot be empty"),
  type: z.literal("function"),
  name: z.string().min(1, "Node name cannot be empty"),
  content: JDMFunctionContentSchema,
});

/**
 * Any JDM node (union of all node types)
 */
export const JDMNodeSchema = z.discriminatedUnion("type", [
  JDMDecisionTableNodeSchema,
  JDMExpressionNodeSchema,
  JDMFunctionNodeSchema,
]);

/**
 * Complete JDM content structure
 */
export const JDMContentSchema = z.object({
  name: z.string().min(1, "JDM name cannot be empty"),
  version: z.string().optional(),
  nodes: z.array(JDMNodeSchema).min(1, "At least one node required"),
});

/**
 * Type alias for the inferred TypeScript type
 */
export type JDMContent = z.infer<typeof JDMContentSchema>;
export type JDMNode = z.infer<typeof JDMNodeSchema>;
export type JDMDecisionTableNode = z.infer<typeof JDMDecisionTableNodeSchema>;
export type JDMExpressionNode = z.infer<typeof JDMExpressionNodeSchema>;
export type JDMFunctionNode = z.infer<typeof JDMFunctionNodeSchema>;

/**
 * Validate JDM content using Zod schema
 *
 * @param data - Unknown data to validate
 * @returns Zod validation result with success status and parsed data or error
 */
export function validateJDM(data: unknown) {
  return JDMContentSchema.safeParse(data);
}

/**
 * Assert that data is valid JDM content (throws if invalid)
 *
 * @param data - Unknown data to validate
 * @returns Parsed JDM content
 * @throws ZodError if validation fails
 */
export function assertValidJDM(data: unknown): JDMContent {
  return JDMContentSchema.parse(data);
}
