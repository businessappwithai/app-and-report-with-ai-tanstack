import { getLogger } from "@appwithai/core/logging";
import OpenAI from "openai";
import { AI_API_KEY, AI_BASE_URL, AI_MODEL } from "../config";

function makeLocalClient(): OpenAI {
  return new OpenAI({ apiKey: AI_API_KEY, baseURL: AI_BASE_URL });
}

/** Attribute shape used in OpenAI-parsed entity responses */
interface ParsedAttribute {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isForeignKey?: boolean;
  unique?: boolean;
  required?: boolean;
  confidence?: number;
}

/** Entity shape used in OpenAI-parsed domain responses */
interface ParsedEntity {
  name: string;
  suggestedAttributes?: ParsedAttribute[];
  attributes?: ParsedAttribute[];
  confidence?: number;
}

/** Relationship shape used in OpenAI-parsed domain responses */
interface ParsedRelationship {
  source: string;
  target: string;
  cardinality: string;
  name: string;
  confidence?: number;
}

/**
 * Validate Mermaid ERD syntax
 * Returns { valid: true } if valid, { valid: false, error: string } if invalid
 */
function validateMermaidSyntax(mermaidSyntax: string): { valid: boolean; error?: string } {
  const lines = mermaidSyntax.trim().split("\n");
  const errors: string[] = [];

  // Check for erDiagram opening
  if (!lines[0]?.trim().startsWith("erDiagram")) {
    errors.push('Must start with "erDiagram"');
  }

  const linesWithContent = lines.filter((line) => line.trim() && !line.trim().startsWith("%%"));

  for (let i = 0; i < linesWithContent.length; i++) {
    const line = (linesWithContent[i] ?? "").trim();

    // Skip entity blocks and empty lines
    if (line.includes("{") || line.includes("}") || line === "erDiagram") {
      continue;
    }

    // Check if it's a relationship line
    if (line.includes("--")) {
      // Validate relationship syntax
      const validCardinalities = [
        "||--||",
        "||--o{",
        "}o--||",
        "}o--o{",
        "||--|{",
        "}|--||",
        "||..||",
        "||..o{",
        "}o..||",
        "}o..o{",
      ];

      let hasValidCardinality = false;
      for (const cardinality of validCardinalities) {
        if (line.includes(cardinality)) {
          hasValidCardinality = true;
          break;
        }
      }

      if (!hasValidCardinality) {
        errors.push(`Invalid relationship syntax on line ${i + 1}: "${line}"`);
      }
    }

    // Check for attribute blocks
    if (line.match(/^\w+\s*\{$/)) {
      // Entity definition starts, ensure it has a closing brace
      let braceCount = 1;
      for (let j = i + 1; j < linesWithContent.length; j++) {
        if ((linesWithContent[j] ?? "").includes("{")) braceCount++;
        if ((linesWithContent[j] ?? "").includes("}")) braceCount--;
        if (braceCount === 0) break;
      }
      if (braceCount > 0) {
        errors.push(`Unclosed entity block starting at line ${i + 1}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join("; ") };
  }

  return { valid: true };
}

/**
 * Generate Mermaid ERD from domain analysis with retry logic
 */
async function generateMermaidWithRetry(
  openai: OpenAI,
  entities: ParsedEntity[],
  relationships: ParsedRelationship[],
  maxRetries: number = 3
): Promise<{ mermaidSyntax: string; entityCount: number; relationshipCount: number }> {
  let retryCount = 0;
  let lastError: string | undefined;

  while (retryCount < maxRetries) {
    retryCount++;
    console.log(`[Mermaid Generation] Attempt ${retryCount}/${maxRetries}`);

    try {
      const prompt =
        retryCount === 1
          ? `Generate a valid Mermaid ERD diagram from these entities and relationships:

ENTITIES:
${JSON.stringify(entities, null, 2)}

RELATIONSHIPS:
${JSON.stringify(relationships, null, 2)}

Generate ONLY valid Mermaid ERD syntax. Start with "erDiagram" and use proper cardinality symbols.`
          : `Previous attempt failed validation. Error: ${lastError}

Please fix the Mermaid ERD syntax:

ENTITIES:
${JSON.stringify(entities, null, 2)}

RELATIONSHIPS:
${JSON.stringify(relationships, null, 2)}

Generate ONLY valid Mermaid ERD syntax. Follow these rules:
1. Start with "erDiagram"
2. Use valid cardinality: ||--||, ||--o{, }o--||, }o--o{
3. Entity blocks use { and }
4. Attributes: type name PK/FK/UK
5. Relationships: ENTITY_A ||--o{ ENTITY_B : "label"`;

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert at generating valid Mermaid ERD diagrams. Always respond with only the Mermaid code, no explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      let mermaidSyntax = response.choices[0]?.message?.content || "";

      // Extract code blocks if present
      const codeBlockMatch = mermaidSyntax.match(/```(?:mermaid)?\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        mermaidSyntax = codeBlockMatch[1] ?? mermaidSyntax;
      }

      // Validate the generated syntax
      const validation = validateMermaidSyntax(mermaidSyntax);

      if (!validation.valid) {
        lastError = validation.error;
        console.warn(`[Mermaid Generation] Validation failed: ${validation.error}`);

        if (retryCount < maxRetries) {
          console.log(`[Mermaid Generation] Retrying...`);
          continue;
        }
      }

      // If valid or max retries reached, return the result
      return {
        mermaidSyntax,
        entityCount: entities.length,
        relationshipCount: relationships.length,
      };
    } catch (error) {
      console.error(`[Mermaid Generation] Error on attempt ${retryCount}:`, error);
      if (retryCount >= maxRetries) {
        throw error;
      }
    }
  }

  // Fallback: generate programmatically
  console.log("[Mermaid Generation] Using programmatic fallback");
  return generateMermaidProgrammatic(entities, relationships);
}

/**
 * Programmatic Mermaid generation (fallback)
 */
function generateMermaidProgrammatic(
  entities: ParsedEntity[],
  relationships: ParsedRelationship[]
): { mermaidSyntax: string; entityCount: number; relationshipCount: number } {
  let syntax = "erDiagram\n";

  // Relationships
  for (const rel of relationships) {
    const symbols: Record<string, string> = {
      oneToOne: "||--||",
      oneToMany: "||--o{",
      manyToOne: "}o--||",
      manyToMany: "}o--o{",
    };
    const symbol = symbols[rel.cardinality] || "||--o{";
    syntax += `    ${rel.source} ${symbol} ${rel.target} : "${rel.name}"\n`;
  }

  syntax += "\n";

  // Entities
  for (const entity of entities) {
    syntax += `    ${entity.name} {\n`;
    for (const attr of entity.suggestedAttributes || entity.attributes || []) {
      const modifiers = [];
      if (attr.name === "id" || attr.isPrimaryKey) modifiers.push("PK");
      if (attr.isUnique) modifiers.push("UK");
      if (attr.isForeignKey) modifiers.push("FK");
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

/**
 * Complete Mermaid ERD Syntax Documentation
 * From https://mermaid.ai/open-source/syntax/entityRelationshipDiagram.html
 */
const MERMAID_ERD_DOCUMENTATION = `
# Mermaid Entity Relationship Diagram Syntax

## Basic Structure
\`\`\`mermaid
erDiagram
  ENTITY_NAME {
    type attribute_name PK
    type attribute_name FK
    type attribute_name UK
  }

  ENTITY_ONE ||--o{ ENTITY_TWO : "relationship label"
\`\`\`

## Entity Names
- Use PascalCase (e.g., User, Order, Product)
- Use SINGULAR form (User, not Users)
- Supports unicode characters
- Spaces allowed with double quotes: "User Profile"

## Attribute Syntax
Inside entity blocks:
\`\`\`
ENTITY_NAME {
    string id PK
    string email UK
    string passwordHash
    boolean isActive
    datetime createdAt
    datetime updatedAt
}
\`\`\`

## Attribute Modifiers
- PK: Primary Key
- FK: Foreign Key
- UK: Unique Key
- Can combine: PK, FK

## Common Data Types
- string, text, varchar
- integer, number, bigint
- boolean
- datetime, timestamp, date
- decimal, float, double
- json, jsonb
- uuid

## Relationship Syntax
\`\`\`
SOURCE ||--o{ TARGET : "label"
\`\`\`

## Cardinality Notation (Crow's Foot)
| Syntax | Meaning |
|--------|---------|
| |o|   ... o||   | Zero or one to zero or one |
| ||    ... ||    | Exactly one to exactly one |
| }o|   ... o|{    | Zero or more to zero or more |
| }||   ... ||{   | One or more to one or more |
| ||    ... o|{    | Exactly one to zero or more |
| ||    ... ||{   | Exactly one to one or more |
| }o|   ... ||    | Zero or more to exactly one |

Common patterns:
- User ||--o{ Post : "creates" (one user, many posts)
- Order ||--o{ OrderItem : "contains" (one order, many items)
- Product }o--|| Category : "belongs to" (many products, one category)

## Identifying vs Non-Identifying Relationships
- Identifying (solid line): Uses --
- Non-identifying (dashed line): Uses ..

\`\`\`
PERSON }|..|{ CAR : "drives"  // non-identifying
CAR ||--|{ NAMED_DRIVER : "has"  // identifying
\`\`\`

## Complete Example
\`\`\`mermaid
erDiagram
    USER {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }

    POST {
        string id PK
        string title
        text content
        boolean isPublished
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    COMMENT {
        string id PK
        text content
        string postId FK
        string userId FK
        datetime createdAt
    }

    USER ||--o{ POST : creates
    POST ||--o{ COMMENT : has
    USER ||--o{ COMMENT : writes
\`\`\`

## Important Rules
1. Always start diagram with "erDiagram"
2. Entity blocks use { opening and } closing braces
3. Attributes: type name [PK|FK|UK]
4. Relationships must have valid cardinality symbols
5. Relationship labels are optional but recommended
6. No trailing commas or semicolons
`;

/**
 * Analyze domain and extract entities/relationships.
 * When currentErdCode is provided the AI is instructed to extend/modify the
 * existing diagram rather than start from scratch.
 */
export async function analyzeDomainWithOpenAI(description: string, currentErdCode: string = "") {
  const log = getLogger("ai");
  const startedAt = Date.now();

  log.event("ai.request.started", { model: AI_MODEL, operation: "analyze-domain" });

  const openai = makeLocalClient();

  const existingContext = currentErdCode.trim()
    ? `\n\nThe user already has this Mermaid ERD. Extend or modify it according to the request — preserve existing entities and relationships unless the request explicitly asks to remove them:\n\`\`\`mermaid\n${currentErdCode}\n\`\`\``
    : "";

  const systemPrompt = `You are an expert data modeler specializing in Entity-Relationship Diagram analysis and Mermaid ERD syntax.

${MERMAID_ERD_DOCUMENTATION}

Your task:
1. Extract entities from the domain description
2. Identify attributes with proper types and constraints
3. Determine relationships with correct cardinality
4. Always respond with valid JSON

Response format:
{
  "entities": [
    {
      "name": "EntityName",
      "suggestedAttributes": [
        {"name": "id", "type": "string", "isPrimaryKey": true, "confidence": 1.0},
        {"name": "email", "type": "string", "isUnique": true, "confidence": 1.0}
      ],
      "confidence": 1.0
    }
  ],
  "relationships": [
    {
      "source": "User",
      "target": "Post",
      "cardinality": "oneToMany",
      "name": "creates",
      "confidence": 1.0
    }
  ],
  "summary": "Brief analysis summary"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this domain description and extract entities and relationships:

${description}${existingContext}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);

    // Token counts are the field worth having here: they are what a bill and a
    // context-window failure are both measured in, and nothing else records
    // them. The prompt and the completion are deliberately not logged — this
    // runs over user domain descriptions.
    log.event("ai.request.completed", {
      model: AI_MODEL,
      operation: "analyze-domain",
      durationMs: Date.now() - startedAt,
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      entities: parsed.entities?.length ?? 0,
      relationships: parsed.relationships?.length ?? 0,
    });

    return {
      entities: parsed.entities || [],
      relationships: parsed.relationships || [],
      summary: parsed.summary || "",
    };
  } catch (error) {
    // One line with the error object rather than three with its pieces: Pino's
    // standard error serializer already writes the message, the type and the
    // stack as fields, and three `console.error` calls could interleave with
    // another request's under any concurrency at all.
    log.event("ai.request.failed", {
      model: AI_MODEL,
      operation: "analyze-domain",
      durationMs: Date.now() - startedAt,
      err: error,
    });
    throw error;
  }
}

/**
 * Generate Mermaid with retry logic (standalone function)
 */
export async function generateMermaidWithValidation(
  entities: ParsedEntity[],
  relationships: ParsedRelationship[]
): Promise<{ mermaidSyntax: string; entityCount: number; relationshipCount: number }> {
  return generateMermaidWithRetry(makeLocalClient(), entities, relationships, 3);
}
