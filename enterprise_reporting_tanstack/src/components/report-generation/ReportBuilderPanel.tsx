import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportBuilderState, ReportHistoryEntry } from "@/lib/report-generation/types";
import { ReportHistoryPanel } from "./ReportHistoryPanel";
import { ReportPreviewPanel } from "./ReportPreviewPanel";

export function ReportBuilderPanel() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ReportBuilderState>({ phase: "idle" });
  const [activeTab, setActiveTab] = useState<"preview" | "history">("preview");

  // Fetch data sources for context
  const { data: dataSources } = useQuery({
    queryKey: ["data-sources-list"],
    queryFn: async () => {
      const res = await fetch("/api/data-sources?pageSize=100");
      if (!res.ok) return { dataSources: [] };
      const json = await res.json();
      // API returns { success, data: { items, meta } } — normalise to { dataSources }
      return { dataSources: json.data?.items ?? json.dataSources ?? [] };
    },
  });

  // Make data sources visible to CopilotKit AI
  useCopilotReadable({
    description: "Available data sources the user can generate reports from",
    value: {
      dataSources:
        dataSources?.dataSources?.map((ds: any) => ({
          id: ds.id,
          name: ds.name,
          type: ds.type,
        })) ?? [],
      currentPhase: state.phase,
      hasPreview: !!state.previewRows,
    },
  });

  // ─── Action 1: Build Report (dry-run preview) ──────────────

  useCopilotAction({
    name: "buildReport",
    description:
      "Analyze a natural language report request and show a data preview. Use this when the user describes a report they want.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The user's natural language description of the report",
        required: true,
      },
      {
        name: "dataSourceId",
        type: "string",
        description: "UUID of the data source to query. Pick from available data sources.",
        required: true,
      },
    ],
    render: ({ status }) => {
      if (status !== "complete") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Analyzing report request...</span>
          </div>
        );
      }
      return <></>;
    },
    handler: async ({ query, dataSourceId }) => {
      setState((s) => ({ ...s, phase: "classifying" }));

      try {
        // Call the Mastra report pipeline in dry-run mode
        const res = await fetch("/api/report-generation/definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nlQuery: query,
            dataSourceId,
            dryRun: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          setState((s) => ({ ...s, phase: "error", errorMessage: err.error }));
          return { success: false, error: err.error };
        }

        const data = await res.json();

        setState((s) => ({
          ...s,
          phase: "preview_ready",
          intent: data.intent,
          previewRows: data.previewRows,
          previewColumns: data.previewColumns,
          generatedSQL: data.generatedSQL,
        }));

        setActiveTab("preview");

        return {
          success: true,
          message: `Preview ready — ${data.previewRows?.length ?? 0} sample rows returned.`,
          sql: data.generatedSQL,
          columns: data.previewColumns,
          rowCount: data.previewRows?.length ?? 0,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to build report";
        setState((s) => ({ ...s, phase: "error", errorMessage: msg }));
        return { success: false, error: msg };
      }
    },
  });

  // ─── Action 2: Confirm Report ──────────────────────────────

  useCopilotAction({
    name: "confirmReport",
    description:
      "Confirm and generate the previewed report. Only use after buildReport has shown a preview.",
    parameters: [
      {
        name: "title",
        type: "string",
        description: "Short title for the report",
        required: true,
      },
      {
        name: "outputFormats",
        type: "string",
        description: "Comma-separated: excel,pdf,csv",
        required: true,
      },
      {
        name: "recipients",
        type: "string",
        description: "Comma-separated email addresses",
        required: false,
      },
      {
        name: "scheduleCron",
        type: "string",
        description: "Cron expression for recurring, or empty for one-shot",
        required: false,
      },
    ],
    render: ({ status }) => {
      if (status !== "complete") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating report...</span>
          </div>
        );
      }
      return <></>;
    },
    handler: async ({ title, outputFormats, recipients, scheduleCron }) => {
      if (!state.intent || !state.generatedSQL) {
        return { success: false, error: "No preview available. Use buildReport first." };
      }

      setState((s) => ({ ...s, phase: "generating" }));

      const formats = outputFormats.split(",").map((f: string) => f.trim().toLowerCase());
      const recipientList = recipients
        ? recipients.split(",").map((r: string) => ({ type: "email" as const, value: r.trim() }))
        : [];

      try {
        const res = await fetch("/api/report-generation/definitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            dataSourceId: state.intent.dataSourceHint,
            nlQuery: state.intent.reportTitle,
            generatedSQL: state.generatedSQL,
            metricColumns: state.intent.metrics,
            dimensionColumns: state.intent.dimensions,
            chartType: state.intent.chartType,
            outputFormats: formats,
            recipients: recipientList,
            scheduleCron: scheduleCron || null,
            runNow: true,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Generation failed" }));
          setState((s) => ({ ...s, phase: "error", errorMessage: err.error }));
          return { success: false, error: err.error };
        }

        const data = await res.json();

        setState((s) => ({
          ...s,
          phase: "complete",
          reportDefinitionId: data.definition.id,
        }));

        toast.success(`Report "${title}" generated successfully!`);
        queryClient.invalidateQueries({ queryKey: ["report-definitions"] });

        return {
          success: true,
          message: `Report "${title}" generated. ${recipientList.length > 0 ? "Email sent to recipients." : ""}`,
          reportId: data.definition.id,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed";
        setState((s) => ({ ...s, phase: "error", errorMessage: msg }));
        return { success: false, error: msg };
      }
    },
  });

  // ─── Action 3: List Past Reports ───────────────────────────

  useCopilotAction({
    name: "listReports",
    description:
      "List previously generated reports. Use when the user asks about past reports or report history.",
    parameters: [
      {
        name: "since",
        type: "string",
        description: "How far back to look: '7d' for 7 days, '30d' for 30 days, '90d' for 90 days",
        required: false,
      },
      {
        name: "titleLike",
        type: "string",
        description: "Search title keyword",
        required: false,
      },
    ],
    handler: async ({ since, titleLike }) => {
      const params = new URLSearchParams({ history: "true" });
      if (since) params.set("since", since);
      if (titleLike) params.set("titleLike", titleLike);

      const res = await fetch(`/api/report-generation/definitions?${params}`);
      if (!res.ok) return { success: false, error: "Failed to fetch report history" };

      const data = await res.json();
      const reports: ReportHistoryEntry[] = data.definitions.map((d: any) => ({
        id: d.id,
        title: d.title,
        nlQuery: d.nl_query,
        dataSourceName: d.data_source_name ?? "Unknown",
        chartType: d.chart_type,
        createdAt: d.created_at,
        lastRunAt: d.last_run_at,
        lastRunStatus: d.last_run_status,
        artifactCount: d.artifactCount ?? 0,
        formats: d.output_formats,
      }));

      setState((s) => ({ ...s, historyReports: reports }));
      setActiveTab("history");

      return {
        success: true,
        count: reports.length,
        reports: reports.map((r) => ({
          id: r.id,
          title: r.title,
          createdAt: r.createdAt,
          status: r.lastRunStatus ?? "never_run",
          formats: r.formats.join(", "),
        })),
      };
    },
  });

  // ─── Action 4: Download Report ─────────────────────────────

  useCopilotAction({
    name: "downloadReport",
    description: "Get download links for a specific report's artifacts.",
    parameters: [
      {
        name: "reportId",
        type: "string",
        description: "The report definition ID",
        required: true,
      },
    ],
    handler: async ({ reportId }) => {
      const res = await fetch(`/api/report-generation/artifacts/${reportId}`);
      if (!res.ok) return { success: false, error: "Failed to fetch artifacts" };

      const data = await res.json();
      if (data.executions.length === 0) {
        return { success: false, error: "No artifacts found. The report may not have run yet." };
      }

      const latest = data.executions[0];
      return {
        success: true,
        executionId: latest.executionId,
        createdAt: latest.createdAt,
        artifacts: latest.artifacts.map((a: any) => ({
          format: a.format,
          downloadUrl: a.downloadUrl,
          sizeKB: Math.round((a.fileSizeBytes ?? 0) / 1024),
        })),
      };
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-2xl text-tremor-content-strong">
            Dynamic Report Generator
          </h1>
          <p className="text-tremor-content">
            Describe the report you need in plain English using the chat panel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PhaseIndicator phase={state.phase} />
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="preview" className="gap-2">
            <Table2 className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            Report History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4">
          {state.phase === "idle" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="rounded-full bg-muted p-6">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-medium">No report in progress</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Use the chat panel to describe the report you want. For example: "Generate a
                    monthly summary of patient admissions by department for Q1 2026 as a PDF with a
                    bar chart."
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {state.phase === "preview_ready" && state.previewRows && (
            <ReportPreviewPanel
              rows={state.previewRows}
              columns={state.previewColumns ?? []}
              sql={state.generatedSQL ?? ""}
              intent={state.intent}
            />
          )}

          {state.phase === "generating" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-medium">Generating report...</p>
                <p className="text-tremor-default text-tremor-content">
                  Building Excel, PDF, and CSV artifacts. This may take a moment for large datasets.
                </p>
              </CardContent>
            </Card>
          )}

          {state.phase === "complete" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="rounded-full bg-emerald-100 p-6">
                  <Download className="h-10 w-10 text-emerald-600" />
                </div>
                <p className="text-lg font-medium">Report Generated Successfully</p>
                <p className="text-tremor-default text-tremor-content">
                  Check the History tab or your notifications for download links.
                  {state.intent?.recipients?.length ? " Email has been sent to recipients." : ""}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setState({ phase: "idle" });
                    setActiveTab("history");
                  }}
                >
                  View History
                </Button>
              </CardContent>
            </Card>
          )}

          {state.phase === "error" && (
            <Card className="border-destructive">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <p className="text-lg font-medium text-destructive">Report Generation Failed</p>
                <p className="text-tremor-default text-tremor-content">{state.errorMessage}</p>
                <Button variant="outline" onClick={() => setState({ phase: "idle" })}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <ReportHistoryPanel reports={state.historyReports ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhaseIndicator({ phase }: { phase: ReportBuilderState["phase"] }) {
  const labels: Record<string, { text: string; color: string }> = {
    idle: { text: "Ready", color: "bg-gray-100 text-gray-600" },
    classifying: { text: "Analyzing...", color: "bg-blue-100 text-blue-600" },
    rbac_check: { text: "Checking access...", color: "bg-amber-100 text-amber-600" },
    generating_sql: { text: "Generating SQL...", color: "bg-blue-100 text-blue-600" },
    preview_ready: { text: "Preview Ready", color: "bg-emerald-100 text-emerald-600" },
    confirmed: { text: "Confirmed", color: "bg-blue-100 text-blue-600" },
    generating: { text: "Generating...", color: "bg-violet-100 text-violet-600" },
    complete: { text: "Complete", color: "bg-emerald-100 text-emerald-600" },
    error: { text: "Error", color: "bg-red-100 text-red-600" },
  };

  const info = labels[phase] ?? labels.idle;
  return <Badge className={info.color}>{info.text}</Badge>;
}
