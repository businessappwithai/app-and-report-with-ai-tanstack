import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { createFileRoute } from "@tanstack/react-router";
import { ReportBuilderPanel } from "@/components/report-generation/ReportBuilderPanel";
import "@copilotkit/react-ui/styles.css";

export const Route = createFileRoute("/_authed/reports/generate/")({
  component: ReportGeneratePage,
});

function ReportGeneratePage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar
        defaultOpen={true}
        instructions={`You are a report generation assistant for an enterprise reporting platform.

STRICT WORKFLOW — follow these steps IN ORDER:
STEP 1: When the user asks for a report, call buildReport ONCE with their natural language query and a dataSourceId picked from the available data sources list in context. Wait for it to complete.
STEP 2: Tell the user what the preview shows (row count, columns, generated SQL). Ask them to confirm with a title.
STEP 3: After user confirms, call confirmReport ONCE with: title (short name for the report), outputFormats (e.g. "excel"), and optional recipients/scheduleCron.
STEP 4: Report success. STOP. Do not call any more actions.

OTHER COMMANDS:
- User asks about past reports → call listReports ONCE
- User asks to download → call downloadReport ONCE

RULES:
- NEVER call confirmReport before buildReport has completed successfully.
- NEVER call buildReport more than once per request.
- Always pick a valid dataSourceId from the available data sources in the context.`}
        labels={{
          title: "Report Generator",
          initial: "What report would you like to generate? Describe the data you need, the format (Excel, PDF, CSV), and who should receive it.",
        }}
        className="h-full"
      >
        <ReportBuilderPanel />
      </CopilotSidebar>
    </CopilotKit>
  );
}
