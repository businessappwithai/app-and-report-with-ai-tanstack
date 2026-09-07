/**
 * Translation Validation: Reverse-translate SQL back to natural English (D4)
 *
 * Validates that generated SQL accurately represents the original NL question
 * by translating it back to English and comparing semantic similarity.
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export interface ReverseTranslationResult {
  englishMeaning: string;
  confidence: number; // 0.0 to 1.0
  warnings?: string[];
  details?: {
    semanticSimilarity: number;
    keywordMatch: number;
  };
}

export interface TranslationValidationInput {
  sql: string;
  originalNLQuestion?: string;
  schema?: SchemaMetadata;
}

export interface SchemaMetadata {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string }>;
  }>;
}

/**
 * Reverse-translate SQL back to natural English
 * Uses Claude to explain what the SQL does in plain English
 */
export async function reverseTranslateSql(
  sql: string,
  originalNLQuestion?: string,
  schema?: SchemaMetadata
): Promise<ReverseTranslationResult> {
  try {
    // Build schema context for Claude
    const schemaContext = buildSchemaContext(schema);

    const prompt = `You are a SQL expert. Given the following SQL query and database schema, explain in plain English what this query does and what data it returns.

Database Schema:
${schemaContext}

SQL Query:
${sql}

${originalNLQuestion ? `Original Natural Language Question: ${originalNLQuestion}` : ""}

Provide:
1. A clear, concise English description of what this query returns
2. A confidence score (0.0-1.0) on how well this SQL answers the original question (if provided)
3. Any ambiguities or potential issues with the query

Format your response as JSON:
{
  "englishMeaning": "Clear description of what the SQL does",
  "confidence": 0.85,
  "warnings": ["optional warning 1", "optional warning 2"]
}`;

    const response = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
      temperature: 0.3, // Low temperature for consistent, deterministic responses
      maxTokens: 300,
    });

    if (!response.text) {
      return {
        englishMeaning: "(Could not reverse-translate SQL)",
        confidence: 0.0,
        warnings: ["Failed to get response from Claude"],
      };
    }

    let result: ReverseTranslationResult;
    try {
      // Extract JSON from response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          englishMeaning: response.text,
          confidence: 0.5,
          warnings: ["Response was not valid JSON"],
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      result = {
        englishMeaning: parsed.englishMeaning || "(No meaning extracted)",
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
        warnings: parsed.warnings || [],
      };
    } catch (_parseError) {
      return {
        englishMeaning: response.text,
        confidence: 0.5,
        warnings: ["Failed to parse JSON response"],
      };
    }

    // If original NL question provided, compute semantic similarity
    if (originalNLQuestion && result.englishMeaning) {
      const semanticScore = await computeSemanticSimilarity(
        originalNLQuestion,
        result.englishMeaning
      );

      result.details = {
        semanticSimilarity: semanticScore,
        keywordMatch: computeKeywordOverlap(originalNLQuestion, result.englishMeaning),
      };

      // Factor semantic similarity into final confidence
      result.confidence = Math.round((result.confidence * 0.6 + semanticScore * 0.4) * 100) / 100;
    }

    return result;
  } catch (error) {
    return {
      englishMeaning: "(Error during reverse-translation)",
      confidence: 0.0,
      warnings: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Compute semantic similarity between two texts using embedding-based approach
 * For MVP, uses a simpler heuristic: word overlap + synonym matching
 */
async function computeSemanticSimilarity(text1: string, text2: string): Promise<number> {
  // Normalize and tokenize
  const tokens1 = normalizeText(text1).split(/\s+/);
  const tokens2 = normalizeText(text2).split(/\s+/);

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  // Jaccard similarity: intersection / union
  const intersection = [...set1].filter((t) => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;

  const jaccardSimilarity = union > 0 ? intersection / union : 0;

  // Keyword-based matching (tables, columns, aggregates mentioned)
  const keywordScore = computeKeywordOverlap(text1, text2);

  // Combine scores: weighted average
  const combinedScore = jaccardSimilarity * 0.5 + keywordScore * 0.5;

  return Math.round(combinedScore * 100) / 100; // Round to 2 decimals
}

/**
 * Compute keyword overlap (tables, aggregates, operations)
 */
function computeKeywordOverlap(text1: string, text2: string): number {
  const keywords = [
    // Aggregates
    "count",
    "sum",
    "avg",
    "average",
    "min",
    "max",
    "total",
    // Operations
    "filter",
    "group",
    "sort",
    "order",
    "join",
    "distinct",
    "unique",
    // Data terms
    "user",
    "order",
    "product",
    "sale",
    "customer",
    "transaction",
    // Comparisons
    "greater",
    "greater than",
    "less",
    "less than",
    "equal",
    "between",
    "like",
  ];

  let matchCount = 0;
  for (const keyword of keywords) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(text1) && pattern.test(text2)) {
      matchCount++;
    }
  }

  return Math.min(1, matchCount / Math.max(keywords.length, 1));
}

/**
 * Normalize text for comparison (lowercase, remove punctuation, extra spaces)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build schema context for Claude prompt
 */
function buildSchemaContext(schema?: SchemaMetadata): string {
  if (!schema || schema.tables.length === 0) {
    return "(No schema provided - please ensure query is valid SQL)";
  }

  return schema.tables
    .map(
      (table) =>
        `Table: ${table.name}\n  Columns: ${table.columns
          .map((col) => `${col.name} (${col.type})`)
          .join(", ")}`
    )
    .join("\n");
}

/**
 * Validate translation confidence and return assessment
 *
 * Returns: { allowed: boolean, message: string, confidence: number }
 */
export function assessTranslationConfidence(
  result: ReverseTranslationResult,
  threshold: number = 0.9 // D3: ≥90% execute; <90% warn
): {
  allowed: boolean;
  shouldWarn: boolean;
  message: string;
  confidence: number;
} {
  const confidence = result.confidence;

  if (confidence >= threshold) {
    return {
      allowed: true,
      shouldWarn: false,
      message: `High confidence (${Math.round(confidence * 100)}%) - executing query`,
      confidence,
    };
  } else {
    return {
      allowed: true, // D4: Still execute, but warn
      shouldWarn: true,
      message: `Lower confidence (${Math.round(confidence * 100)}%) - verify meaning: "${result.englishMeaning}"`,
      confidence,
    };
  }
}
