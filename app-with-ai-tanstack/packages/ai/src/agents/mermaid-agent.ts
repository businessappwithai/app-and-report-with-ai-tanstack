import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { mastraModelConfig } from "../config";
import type { EntityCandidate, RelationshipCandidate } from "../types";

const mermaidOutputSchema = z.object({
  syntax: z.string(),
  entityCount: z.number(),
  relationshipCount: z.number(),
});

export const mermaidAgent = new Agent({
  id: "mermaid-agent",
  name: "Mermaid Generator",
  instructions: `Generate valid Mermaid ERD syntax.

Format:
erDiagram
    User ||--o{ Post : creates
    Post ||--o{ Comment : has
    
    User {
        string id PK
        string email UK
        string name
        datetime createdAt
        datetime updatedAt
    }

Cardinality symbols:
- ||--|| : oneToOne
- ||--o{ : oneToMany
- }o--|| : manyToOne
- }o--o{ : manyToMany`,
  model: mastraModelConfig,
});

export async function generateMermaid(
  entities: EntityCandidate[],
  relationships: RelationshipCandidate[]
) {
  const response = await mermaidAgent.generate(JSON.stringify({ entities, relationships }), {
    structuredOutput: {
      schema: mermaidOutputSchema,
    },
  });

  return response.object;
}

// Programmatic generator (fast, no AI)
export function generateMermaidProgrammatic(
  entities: EntityCandidate[],
  relationships: RelationshipCandidate[]
) {
  let syntax = "erDiagram\n";

  // Relationships
  for (const rel of relationships) {
    const symbols: Record<string, string> = {
      oneToOne: "||--||",
      oneToMany: "||--o{",
      manyToOne: "}o--||",
      manyToMany: "}o--o{",
    };
    syntax += `    ${rel.source} ${symbols[rel.cardinality]} ${rel.target} : ${rel.name}\n`;
  }

  syntax += "\n";

  // Entities
  for (const entity of entities) {
    syntax += `    ${entity.name} {\n`;
    for (const attr of entity.suggestedAttributes) {
      const modifiers = [];
      if (attr.name === "id") modifiers.push("PK");
      if (attr.unique) modifiers.push("UK");
      syntax += `        ${attr.type} ${attr.name}${modifiers.length ? ` ${modifiers.join(" ")}` : ""}\n`;
    }
    syntax += `    }\n\n`;
  }

  return {
    mermaidSyntax: syntax,
    entityCount: entities.length,
    relationshipCount: relationships.length,
  };
}
