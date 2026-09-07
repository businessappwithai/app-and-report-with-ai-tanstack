/**
 * SQL Generate Tool
 *
 * Calls the Mastra NL-to-SQL endpoint to produce a SQL query from a natural
 * language question and an RBAC-filtered schema text.
 *
 * Guardrails:
 *   - Input validated by Zod before the network call
 *   - Output validated by Zod before returning to the caller
 *   - Hard 30-second timeout on the Mastra request
 *   - SQL must be non-empty; confidence defaults to 0.7 if absent
 */

import { z } from "zod";

// ─── Input / Output Schemas ───────────────────────────────────────────────────

export const SqlGenerateInput = z.object({
  /** Natural language question describing the metric or query */
  nlQuestion: z.string().min(1),
  /** Compact schema text produced by executeSchemaIntrospect */
  schemaText: z.string(),
  /** Database dialect hint (e.g. "pg", "mysql", "sqlite3") */
  dataSourceType: z.string(),
  /** Data source identifier — passed through for audit / logging */
  dataSourceId: z.string(),
});

export const SqlGenerateOutput = z.object({
  sql: z.string(),
  explanation: z.string(),
  /** Classifier confidence 0–1 returned by the LLM endpoint */
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

export type SqlGenerateInput = z.infer<typeof SqlGenerateInput>;
export type SqlGenerateOutput = z.infer<typeof SqlGenerateOutput>;

// ─── Executor ─────────────────────────────────────────────────────────────────

export async function executeSqlGenerate(
  input: z.infer<typeof SqlGenerateInput>
): Promise<SqlGenerateOutput> {
  const { nlQuestion, schemaText, dataSourceType } = SqlGenerateInput.parse(input);

  const mastraUrl = process.env.MASTRA_URL ?? "http://localhost:4111";

  let response: Response;
  try {
    response = await fetch(`${mastraUrl}/api/nl-to-sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nlQuestion,
        schema: { schemaText },
        context: { dataSourceType },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Mastra NL-to-SQL request failed: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Mastra NL-to-SQL failed: HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error("Mastra NL-to-SQL returned non-JSON response");
  }

  const raw = data as {
    sql?: string;
    explanation?: string;
    confidence?: number;
    warnings?: string[];
  };

  if (!raw.sql || raw.sql.trim().length === 0) {
    throw new Error("Mastra returned empty SQL");
  }

  return SqlGenerateOutput.parse({
    sql: raw.sql.trim(),
    explanation: raw.explanation ?? "",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.7,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  });
}
