import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { NlQueryContent } from "@/components/nl-query/nl-query-content";

export default function CopilotNlQuery() {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      transcribeAudioUrl="/api/copilotkit/transcribe"
      textToSpeechUrl="/api/copilotkit/tts"
    >
      <CopilotSidebar
        instructions={`You are a SQL generation agent for the Enterprise Reporting System.

STRICT WORKFLOW — follow these steps IN ORDER, exactly once each:
STEP 1: Call fetchSimilarQueries ONCE with the user's question. Wait for it to complete.
STEP 2: Using the schema from the context and the RAG result from Step 1, write the SQL query.
STEP 3: Call executeNaturalLanguageQuery ONCE with the question and the SQL you wrote.
STEP 4: Report the result to the user. STOP. Do not call any more actions.

RULES:
- Never call fetchSimilarQueries more than once per user question.
- Never call executeNaturalLanguageQuery more than once per user question.
- Use ONLY tables and columns from the schema in the context. Never invent table/column names.
- PostgreSQL syntax only. No INSERT/UPDATE/DELETE/DROP.
- Always GROUP BY when using aggregations. Always ORDER BY when using LIMIT.
- If access is denied, explain which entities were blocked.
- If the request is ambiguous, ask ONE clarifying question instead of guessing.`}
        labels={{
          title: "NL Query Assistant",
          initial:
            'Ask me anything about your data! I can generate SQL queries, create charts, and help you explore your database. Try: "Show me total patients by gender" or "What are the top 10 diagnoses?"',
          placeholder: "Ask about your data...",
        }}
        defaultOpen={true}
      >
        <NlQueryContent />
      </CopilotSidebar>
    </CopilotKit>
  );
}
