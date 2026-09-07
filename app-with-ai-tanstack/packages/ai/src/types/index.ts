import { z } from "zod";

export const entityCandidateSchema = z.object({
  name: z.string(),
  description: z.string(),
  suggestedAttributes: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      unique: z.boolean().optional(),
      description: z.string().optional(),
    })
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const relationshipCandidateSchema = z.object({
  name: z.string(),
  source: z.string(),
  target: z.string(),
  cardinality: z.enum(["oneToOne", "oneToMany", "manyToOne", "manyToMany"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const domainAnalysisSchema = z.object({
  entities: z.array(entityCandidateSchema),
  relationships: z.array(relationshipCandidateSchema),
  summary: z.string(),
});

export type EntityCandidate = z.infer<typeof entityCandidateSchema>;
export type RelationshipCandidate = z.infer<typeof relationshipCandidateSchema>;
export type DomainAnalysis = z.infer<typeof domainAnalysisSchema>;

export interface WorkflowState {
  description: string;
  domainAnalysis?: DomainAnalysis;
  approvedEntities: EntityCandidate[];
  approvedRelationships: RelationshipCandidate[];
  mermaidSyntax?: string;
  currentStep: string;
}
