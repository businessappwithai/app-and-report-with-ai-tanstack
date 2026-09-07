import { z } from 'zod';

/**
 * JDM content arrives either as a JSON string (older callers, and anything that
 * serialises before posting) or as the object the rule table editor holds in
 * state. Accepting only the string meant a table built in the editor was
 * rejected at the door with "Validation failed" and no way to tell why.
 */
const JdmContent = z.union([z.string(), z.record(z.unknown())]);

export const CreateRuleSchema = z.object({
  entityName: z.string().min(1),
  ruleName: z.string().min(1),
  operation: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE', 'ALL']),
  jdmContent: JdmContent,
});

export type CreateRuleDto = z.infer<typeof CreateRuleSchema>;

export const UpdateRuleSchema = z.object({
  jdmContent: JdmContent.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRuleDto = z.infer<typeof UpdateRuleSchema>;

export const ValidateJdmSchema = z.object({
  jdmContent: JdmContent,
});

export type ValidateJdmDto = z.infer<typeof ValidateJdmSchema>;

export const DryRunSchema = z.object({
  ruleId: z.string(),
  testData: z.record(z.unknown()),
});

export type DryRunDto = z.infer<typeof DryRunSchema>;

export const EvaluateRulesSchema = z.object({
  entityName: z.string(),
  operation: z.enum(['CREATE', 'READ', 'UPDATE', 'DELETE']),
  data: z.record(z.unknown()),
});

export type EvaluateRulesDto = z.infer<typeof EvaluateRulesSchema>;
