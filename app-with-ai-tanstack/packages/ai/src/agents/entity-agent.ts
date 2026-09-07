import { Agent } from "@mastra/core/agent";
import { mastraModelConfig } from "../config";
import { entityCandidateSchema } from "../types";

export const entityAgent = new Agent({
  id: "entity-agent",
  name: "Entity Refiner",
  instructions: `Refine entity structures following best practices:

1. Naming: PascalCase, singular form
2. Standard fields: id (string/UUID), createdAt, updatedAt
3. Validation: required, unique, length constraints
4. Security: hash passwords, validate emails
5. Defaults: timestamps, boolean flags

Return refined entity with confidence score.`,
  model: mastraModelConfig,
});

export async function refineEntity(entity: unknown) {
  const response = await entityAgent.generate(JSON.stringify(entity), {
    structuredOutput: {
      schema: entityCandidateSchema,
    },
  });

  return response.object;
}
