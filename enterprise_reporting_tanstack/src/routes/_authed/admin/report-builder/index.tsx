import { createFileRoute, redirect } from "@tanstack/react-router";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { NlBuilderPanel } from "@/components/admin/NlBuilderPanel";

export const Route = createFileRoute("/_authed/admin/report-builder/")({
  beforeLoad: ({ context }) => {
    const roles: string[] =
      (context as { session?: { user?: { roles?: string[] } } }).session?.user?.roles ?? [];
    const isAdmin = roles.some((r) => r.toLowerCase().includes("admin"));
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: NlReportBuilderPage,
});

function NlReportBuilderPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <CopilotSidebar
        defaultOpen={true}
        instructions={`You are an admin assistant that builds reports and charts from natural language descriptions.

STRICT WORKFLOW — follow these steps IN ORDER:
STEP 1: When the admin describes data they want, call previewQuery ONCE with their description and a dataSourceId from the available list. Wait for it to complete.
STEP 2: Summarise what the preview shows (row count, columns, generated SQL confidence). Ask the admin to confirm a name and whether they want a report, a chart, or both.
STEP 3a: If they want a report → call saveAsReport ONCE with name, description, and dataSourceId.
STEP 3b: If they want a chart → call saveAsChart ONCE with name, description, dataSourceId, and chartType.
STEP 3c: If they want both → call saveAsReport, then saveAsChart (same SQL preview, different name/type if needed).
STEP 4: Report success with links. STOP. Do not take further actions unless the admin explicitly asks for something new.

CHART TYPES: bar, line, pie, area, scatter, heatmap, gauge, funnel, sankey, treemap
  - Use bar for comparisons, line for trends over time, pie for proportions (≤6 slices), area for cumulative totals.
  - When unsure, default to bar.

RULES:
- NEVER call saveAsReport or saveAsChart before previewQuery has completed successfully.
- NEVER call previewQuery more than once per request unless the admin explicitly asks to try a different query.
- Always pick a valid dataSourceId from the available data sources list in context.
- If the admin says "make it a chart" without specifying a type, pick the most appropriate type based on the data columns.`}
        labels={{
          title: "NL Report & Chart Builder",
          initial:
            'Describe the data you want to visualise and I will generate the SQL, show a preview, then save it as a report or chart. Try: "Show me monthly revenue by product category for this year."',
          placeholder: "Describe the report or chart you need…",
        }}
      >
        <NlBuilderPanel />
      </CopilotSidebar>
    </CopilotKit>
  );
}
