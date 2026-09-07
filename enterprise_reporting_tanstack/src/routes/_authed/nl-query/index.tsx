import { createFileRoute } from "@tanstack/react-router";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { NlQueryContent } from "@/components/nl-query/nl-query-content";

export const Route = createFileRoute("/_authed/nl-query/")({
  component: NlQueryPage,
});

function NlQueryPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" textToSpeechUrl="/api/copilotkit/tts">
      <CopilotSidebar
        instructions={`SQL agent for PostgreSQL. Use ONLY tables/columns from the schema context — never invent names.

WORKFLOW: Call fetchSimilarQueries FIRST to get proven SQL examples and schema context, then call executeNaturalLanguageQuery with the SQL you generate. Use the top matching past queries from RAG as templates.

CRITICAL: When summarizing results, use ONLY the exact values from the "data" field in the action result. Never invent or approximate numbers.

STOP RULE: After executeNaturalLanguageQuery returns successfully, you MUST stop immediately. Present the data summary and say "Would you like to explore this data further or run another query?" Do NOT call generateChart or any other action. Do NOT take additional actions unless the user explicitly asks.

RULES: SELECT only (no INSERT/UPDATE/DELETE/DROP). No SELECT *. Use ORDER BY with LIMIT. Use GROUP BY with aggregates. Use proper JOINs. If ambiguous, ask to clarify.`}
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
