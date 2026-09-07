/**
 * Mastra.ai Agent Server
 *
 * Local agent server that provides:
 * - OpenAI-compatible /v1/chat/completions (proxied to llama.cpp)
 * - /health endpoint
 * - /api/nl-to-sql endpoint for NL query pipeline
 *
 * Architecture: CopilotKit → this server (Mastra agent) → llama.cpp
 *
 * Start: bun run mastra/server.ts
 * Config: .env.mastra
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.mastra
try {
  const envPath = resolve(import.meta.dir, "../.env.mastra");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

// AI_* vars take priority over the legacy LLAMA_* vars.
// AI_* BASE_URL must be the full OpenAI-compatible base including /v1.
// LLAMA_* vars (no /v1 suffix) are the local fallback — /v1 is appended below.
function _base(ai: string | undefined, llama: string | undefined, def: string): string {
  return ai ?? `${llama ?? def}/v1`;
}
function isLocal(url: string): boolean {
  return url.includes("localhost") || url.includes("127.0.0.1");
}

const NL2SQL_BASE = _base(process.env.AI_NL2SQL_BASE_URL, process.env.LLAMA_REASONING_URL, "http://localhost:8080");
const NL2SQL_MODEL = process.env.AI_NL2SQL_MODEL ?? process.env.LLAMA_REASONING_MODEL ?? "qwen3.6";
const NL2SQL_API_KEY = process.env.AI_NL2SQL_API_KEY ?? process.env.LLAMA_REASONING_API_KEY ?? "none";

const STT_BASE = _base(process.env.AI_STT_BASE_URL, process.env.LLAMA_STT_URL, "http://localhost:8081");
const STT_MODEL = process.env.AI_STT_MODEL ?? process.env.LLAMA_STT_MODEL ?? "Qwen3-ASR";
const STT_API_KEY = process.env.AI_STT_API_KEY ?? process.env.LLAMA_STT_API_KEY ?? "none";
// Treat any HTTP (non-HTTPS) URL as a local/internal service that may support
// the whisper.cpp /inference endpoint in addition to /v1/audio/transcriptions
const STT_IS_LOCAL = isLocal(STT_BASE) || STT_BASE.startsWith("http://");

const TTS_BASE = _base(process.env.AI_TTS_BASE_URL, process.env.LLAMA_TTS_URL, "http://localhost:8083");
const TTS_MODEL = process.env.AI_TTS_MODEL ?? process.env.LLAMA_TTS_MODEL ?? "Qwen3-TTS";
const TTS_API_KEY = process.env.AI_TTS_API_KEY ?? process.env.LLAMA_TTS_API_KEY ?? "none";

const EMB_BASE = _base(
  process.env.AI_EMBEDDING_BASE_URL,
  process.env.LLAMA_EMBEDDING_URL ?? process.env.LLAMA_REASONING_URL,
  "http://localhost:8080"
);
const EMB_MODEL = process.env.AI_EMBEDDING_MODEL ?? process.env.LLAMA_EMBEDDING_MODEL ?? "embedding";

const PORT = parseInt(process.env.MASTRA_PORT || "4111", 10);

const SYSTEM_PROMPT = `You are a highly experienced SQL generation agent for the Enterprise Reporting System.

CAPABILITIES:
- You understand MySQL/PostgreSQL/SQLite syntax and the concepts of tables, columns, joins, filters, aggregates, subqueries, window functions, and CTEs.
- You generate precise, optimized SQL based on user intent and the provided schema.

SCHEMA-AWARENESS:
- The user or context will provide a database schema (table and column definitions). Use ONLY this schema. Do not invent any table or column.
- CRITICAL: Use the exact table and column names from the schema. Do not guess or pluralize table names.

SQL DIALECTS:
- Adapt to the appropriate SQL dialect: MySQL (backticks for identifiers), PostgreSQL (double quotes for identifiers, $1 parameter syntax), or SQLite.
- Default to PostgreSQL unless the context indicates otherwise.

CONSTRAINTS:
- Do not perform any data modifications: no INSERT, UPDATE, DELETE, or DROP commands.
- Avoid using SELECT * by default — select only the columns needed to answer the question.
- If LIMIT is needed, always include an ORDER BY to ensure deterministic results.
- Parameterize all user-provided literal values (e.g. use $1 or ?) to prevent SQL injection when possible.
- Limit results to 1000 rows unless the user asks for all.
- For aggregation queries, always include GROUP BY.
- Always use proper JOINs when combining tables.

ERROR HANDLING:
- Double-check your SQL for syntax errors or logic issues before returning.
- If you cannot answer the question with the given schema, indicate your inability and explain why.

CLARIFICATION STRATEGY:
- If the user's request is ambiguous, respond by asking a clarifying question rather than guessing.

EXAMPLES:
- User: "Show total sales per region in 2025." → SELECT region, SUM(sales) AS total_sales FROM sales_table WHERE EXTRACT(YEAR FROM sale_date) = 2025 GROUP BY region ORDER BY total_sales DESC;
- User: "List customers in Chicago." → SELECT name, city FROM customers WHERE city = $1 ORDER BY name; (with param ["Chicago"])
- User: "Count patients by gender" → SELECT gender, COUNT(*) AS total_patients FROM patients GROUP BY gender ORDER BY total_patients DESC;

OUTPUT FORMAT:
- When calling the executeNaturalLanguageQuery tool, provide the SQL in the generatedSql parameter.
- Always explain what you're doing and what the results mean in your text response.
- For trend analysis, use appropriate date grouping (daily, weekly, monthly).`;

async function proxyToLlama(body: unknown): Promise<Response> {
  const payload = body as Record<string, unknown>;
  // chat_template_kwargs is Qwen3/llama.cpp specific — skip for cloud providers
  if (isLocal(NL2SQL_BASE) && !payload.chat_template_kwargs) {
    payload.chat_template_kwargs = { enable_thinking: false };
  }
  const res = await fetch(`${NL2SQL_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(NL2SQL_API_KEY !== "none" ? { Authorization: `Bearer ${NL2SQL_API_KEY}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  return res;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (path === "/health" || path === "/") {
      try {
        const llamaRes = await fetch(`${NL2SQL_BASE}/models`);
        const llamaOk = llamaRes.ok;
        return Response.json(
          {
            status: "ok",
            agent: "sql-agent",
            llama: llamaOk ? "connected" : "unreachable",
            llamaUrl: NL2SQL_BASE,
            model: NL2SQL_MODEL,
          },
          { headers: corsHeaders },
        );
      } catch {
        return Response.json(
          { status: "degraded", agent: "sql-agent", llama: "unreachable", llamaUrl: NL2SQL_BASE },
          { status: 503, headers: corsHeaders },
        );
      }
    }

    // OpenAI-compatible chat completions — proxy to llama.cpp
    if (path === "/v1/chat/completions" && req.method === "POST") {
      try {
        const body = await req.json();
        // Inject system prompt if not present
        if (!body.messages?.some((m: { role: string }) => m.role === "system")) {
          body.messages = [{ role: "system", content: SYSTEM_PROMPT }, ...(body.messages || [])];
        }
        // Override model to the configured one
        body.model = body.model || NL2SQL_MODEL;

        const llamaRes = await proxyToLlama(body);
        const llamaBody = await llamaRes.text();

        return new Response(llamaBody, {
          status: llamaRes.status,
          headers: {
            ...corsHeaders,
            "Content-Type": llamaRes.headers.get("Content-Type") || "application/json",
          },
        });
      } catch (error) {
        return Response.json(
          { error: { message: `Llama.cpp connection failed: ${error}`, type: "server_error" } },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Models endpoint — proxy to LLM backend
    if (path === "/v1/models") {
      try {
        const llamaRes = await fetch(`${NL2SQL_BASE}/models`);
        const data = await llamaRes.json();
        return Response.json(data, { headers: corsHeaders });
      } catch {
        return Response.json(
          { data: [{ id: NL2SQL_MODEL, object: "model", owned_by: "local" }] },
          { headers: corsHeaders },
        );
      }
    }

    // NL-to-SQL endpoint (used by mastra-connector.ts)
    if (path === "/api/nl-to-sql" && req.method === "POST") {
      try {
        const { nlQuestion, schema, context, modelConfig } = await req.json();

        const schemaText =
          schema?.schemaText ||
          (schema?.tables
            ?.map(
              (t: { name: string; columns?: { name: string; type: string }[] }) =>
                `${t.name}: ${t.columns?.map((c) => `${c.name} (${c.type})`).join(", ")}`,
            )
            .join("\n") || "No schema available");

        const prompt = `Based on the following database schema, generate a SQL query for the user's question.

DATABASE SCHEMA:
${schemaText}

${context?.contextFromSimilarQueries ? `SIMILAR SUCCESSFUL QUERIES:\n${context.contextFromSimilarQueries}\n` : ""}

USER QUESTION: ${nlQuestion}

Respond with ONLY a JSON object in this exact format:
{"sql": "SELECT ...", "explanation": "Brief explanation of what the query does", "warnings": []}`;

        const model = modelConfig?.reasoningModel || NL2SQL_MODEL;

        const llamaRes = await proxyToLlama({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        });

        if (!llamaRes.ok) {
          return Response.json(
            { sql: "", explanation: "LLM failed to generate SQL", warnings: ["LLM error"] },
            { status: 502, headers: corsHeaders },
          );
        }

        const llamaData = await llamaRes.json();
        const content = llamaData.choices?.[0]?.message?.content || "";

        // Try to parse JSON from the response
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return Response.json(
              {
                sql: parsed.sql || "",
                explanation: parsed.explanation || "",
                warnings: parsed.warnings || [],
                confidence: 0.8,
              },
              { headers: corsHeaders },
            );
          }
        } catch {}

        // Fallback: treat the whole response as SQL
        return Response.json(
          {
            sql: content.trim(),
            explanation: "SQL generated from natural language query",
            warnings: ["Could not parse structured response — raw SQL returned"],
          },
          { headers: corsHeaders },
        );
      } catch (error) {
        return Response.json(
          { sql: "", explanation: `Error: ${error}`, warnings: ["Agent error"] },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // SQL validation endpoint
    if (path === "/api/validate-sql" && req.method === "POST") {
      try {
        const { sql } = await req.json();
        const isValid = sql && sql.trim().length > 0;
        return Response.json({ isValid, errors: isValid ? [] : ["Empty SQL"] }, { headers: corsHeaders });
      } catch {
        return Response.json({ isValid: false, errors: ["Validation error"] }, { headers: corsHeaders });
      }
    }

    // TTS — proxy to llama.cpp TTS (OpenAI-compatible)
    if (path === "/v1/audio/speech" && req.method === "POST") {
      try {
        const body = await req.json();
        body.model = body.model || TTS_MODEL;

        const ttsRes = await fetch(`${TTS_BASE}/audio/speech`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(TTS_API_KEY !== "none" ? { Authorization: `Bearer ${TTS_API_KEY}` } : {}),
          },
          body: JSON.stringify(body),
        });

        const audioData = await ttsRes.arrayBuffer();
        return new Response(audioData, {
          status: ttsRes.status,
          headers: {
            ...corsHeaders,
            "Content-Type": ttsRes.headers.get("Content-Type") || "audio/mpeg",
          },
        });
      } catch (error) {
        return Response.json(
          { error: `TTS proxy failed: ${error}` },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Audio transcription — proxy to whisper.cpp server or OpenAI-compatible STT
    if (path === "/v1/audio/transcriptions" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const newForm = new FormData();
        for (const [key, value] of formData.entries()) {
          newForm.append(key, value);
        }

        let sttRes: Response;
        if (STT_IS_LOCAL) {
          // Try whisper.cpp /inference endpoint first, fall back to OpenAI-compatible
          const sttRoot = STT_BASE.replace(/\/v1$/, "");
          try {
            sttRes = await fetch(`${sttRoot}/inference`, { method: "POST", body: newForm });
          } catch {
            if (!newForm.has("model")) newForm.append("model", STT_MODEL);
            sttRes = await fetch(`${STT_BASE}/audio/transcriptions`, {
              method: "POST",
              headers: { ...(STT_API_KEY !== "none" ? { Authorization: `Bearer ${STT_API_KEY}` } : {}) },
              body: newForm,
            });
          }
        } else {
          // Cloud/OpenAI-compatible: go straight to /audio/transcriptions
          if (!newForm.has("model")) newForm.append("model", STT_MODEL);
          sttRes = await fetch(`${STT_BASE}/audio/transcriptions`, {
            method: "POST",
            headers: { ...(STT_API_KEY !== "none" ? { Authorization: `Bearer ${STT_API_KEY}` } : {}) },
            body: newForm,
          });
        }

        const sttBody = await sttRes.text();
        return new Response(sttBody, {
          status: sttRes.status,
          headers: {
            ...corsHeaders,
            "Content-Type": sttRes.headers.get("Content-Type") || "application/json",
          },
        });
      } catch (error) {
        return Response.json(
          { error: `STT proxy failed: ${error}` },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // Embeddings endpoint — proxy to llama.cpp embedding instance
    if (path === "/v1/embeddings" && req.method === "POST") {
      try {
        const body = await req.json();
        body.model = body.model || EMB_MODEL;

        const embRes = await fetch(`${EMB_BASE}/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const embBody = await embRes.text();
        return new Response(embBody, {
          status: embRes.status,
          headers: {
            ...corsHeaders,
            "Content-Type": embRes.headers.get("Content-Type") || "application/json",
          },
        });
      } catch (error) {
        return Response.json(
          { error: { message: `Embedding proxy failed: ${error}`, type: "server_error" } },
          { status: 502, headers: corsHeaders },
        );
      }
    }

    // ── Supervisor: build-monitoring-pipeline ─────────────────────────────────
    // Orchestrates intent-classifier, report-builder, rule-builder, and schedule
    // specialist agents to produce a complete monitoring pipeline definition.
    if (path === "/api/build-monitoring-pipeline" && req.method === "POST") {
      try {
        const {
          nlRequest,
          userId,
          dataSourceId,
          dataSourceType,
          schemaText,
          allowedTableNames,
          rbacSnapshot,
        } = await req.json() as {
          nlRequest: string;
          userId: string;
          dataSourceId: string;
          dataSourceType: string;
          schemaText: string;
          allowedTableNames: string[];
          rbacSnapshot: unknown;
          sessionId?: string;
        };

        if (!nlRequest || !schemaText) {
          return Response.json(
            { error: "nlRequest and schemaText are required" },
            { status: 400, headers: corsHeaders }
          );
        }

        const { runSupervisorAgent } = await import("./agents/supervisor-agent");
        const result = await runSupervisorAgent({
          nlRequest,
          userId,
          dataSourceId,
          dataSourceType,
          schemaText,
          allowedTableNames: allowedTableNames ?? [],
          rbacSnapshot,
        });

        return Response.json(result, { headers: corsHeaders });
      } catch (error) {
        console.error("[Mastra] build-monitoring-pipeline error:", error);
        return Response.json(
          {
            success: false,
            error: `Supervisor agent failed: ${error instanceof Error ? error.message : String(error)}`,
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // ── RBAC-filtered schema for a user+datasource pair ───────────────────────
    if (path === "/api/rbac-schema" && req.method === "POST") {
      try {
        const { userId, dataSourceId } = await req.json() as { userId: string; dataSourceId: string };
        if (!userId || !dataSourceId) {
          return Response.json(
            { error: "userId and dataSourceId are required" },
            { status: 400, headers: corsHeaders }
          );
        }
        // Return a placeholder — actual RBAC schema resolution happens in the app layer
        // This endpoint is for direct Mastra-to-app queries in multi-service deployments
        return Response.json(
          { message: "Use the app's /api/adk/analyze-intent endpoint for full RBAC resolution" },
          { headers: corsHeaders }
        );
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500, headers: corsHeaders });
      }
    }

    // ── Validate a monitoring rule (dry-run) ──────────────────────────────────
    if (path === "/api/validate-monitoring-rule" && req.method === "POST") {
      try {
        const { sql, metricColumn, thresholdOperator, thresholdValue } =
          await req.json() as Record<string, unknown>;

        const errors: string[] = [];
        if (!sql || typeof sql !== "string" || !sql.trim()) {
          errors.push("sql is required and must be a non-empty string");
        }
        if (!metricColumn || typeof metricColumn !== "string") {
          errors.push("metricColumn is required");
        }
        const validOperators = ["gt", "gte", "lt", "lte", "eq", "neq", "between"];
        if (!thresholdOperator || !validOperators.includes(thresholdOperator as string)) {
          errors.push(`thresholdOperator must be one of: ${validOperators.join(", ")}`);
        }
        if (thresholdValue === undefined || thresholdValue === null || typeof thresholdValue !== "number") {
          errors.push("thresholdValue must be a number");
        }

        // SQL read-only check
        if (typeof sql === "string") {
          const upper = sql.trim().toUpperCase();
          const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE"];
          for (const kw of forbidden) {
            if (new RegExp(`\\b${kw}\\b`).test(upper)) {
              errors.push(`SQL contains forbidden keyword: ${kw}`);
            }
          }
        }

        return Response.json({ valid: errors.length === 0, errors }, { headers: corsHeaders });
      } catch (error) {
        return Response.json(
          { valid: false, errors: [`Validation error: ${error}`] },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  },
});

console.log(`[Mastra Agent] Server running at http://localhost:${PORT}`);
console.log(`[Mastra Agent] LLM backend: ${NL2SQL_BASE} (model: ${NL2SQL_MODEL})`);
console.log(`[Mastra Agent] Endpoints:`);
console.log(`  GET  /health                         — Health check`);
console.log(`  POST /v1/chat/completions             — OpenAI-compatible chat (proxied to llama.cpp)`);
console.log(`  GET  /v1/models                       — Models list`);
console.log(`  POST /api/nl-to-sql                   — NL to SQL translation`);
console.log(`  POST /api/validate-sql                — SQL validation`);
console.log(`  POST /v1/embeddings                   — Embedding generation (proxied to llama.cpp)`);
console.log(`  POST /api/build-monitoring-pipeline   — Supervisor agent: full monitoring pipeline`);
console.log(`  POST /api/rbac-schema                 — RBAC-filtered schema`);
console.log(`  POST /api/validate-monitoring-rule    — Monitoring rule dry-run validation`);
console.log(`[Mastra Agent] Embedding backend: ${EMB_BASE} (model: ${EMB_MODEL})`);
