import { Agent } from "@mastra/core/agent";
import { mastraModelConfig } from "../config";
import { relationshipCandidateSchema } from "../types";

export const relationshipAgent = new Agent({
  id: "relationship-agent",
  name: "Relationship Analyzer",
  instructions: `Analyze relationships and determine:

1. Cardinality: oneToOne, oneToMany, manyToOne, manyToMany
2. Foreign key placement (many side for 1:N)
3. Cascade behaviors (CASCADE, SET NULL, RESTRICT)
4. Junction tables for M:N

Common patterns:
- "users create posts" → User 1:N Post (FK: authorId in Post)
- "post has comments" → Post 1:N Comment (FK: postId in Comment)
- "posts tagged with tags" → Post M:N Tag (junction table)`,
  model: mastraModelConfig,
});

export async function refineRelationship(relationship: unknown) {
  const response = await relationshipAgent.generate(JSON.stringify(relationship), {
    structuredOutput: {
      schema: relationshipCandidateSchema,
    },
  });

  return response.object;
}
