import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Database,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nlBuildPreview, nlSaveChart, nlSaveReport } from "@/server-fns/admin-builder";
import { nlBuilderListDataSources } from "@/server-fns/admin-builder";
import type { ChartType } from "@/lib/schemas/charts";

// ---------------------------------------------------------------------------
// Local state shape
// ---------------------------------------------------------------------------

type BuilderPhase = "idle" | "translating" | "preview_ready" | "saving" | "saved";

interface PreviewState {
  sql: string;
  confidence: number;
  columns: string[];
  rows: Record<string, unknown>[];
}

interface SavedItem {
  type: "report" | "chart";
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NlBuilderPanel() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<BuilderPhase>("idle");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Data sources ──────────────────────────────────────────────────────────

  const { data: dataSources = [] } = useQuery({
    queryKey: ["admin-builder-datasources"],
    queryFn: () => nlBuilderListDataSources(),
    staleTime: 60_000,
  });

  useCopilotReadable({
    description: "Available data sources the admin can build reports and charts from",
    value: dataSources.map((ds) => ({ id: ds.id, name: ds.name, type: ds.client_type })),
  });

  useCopilotReadable({
    description: "Builder state — current phase and whether a SQL preview is ready",
    value: {
      phase,
      hasSqlPreview: !!preview,
      previewSql: preview?.sql ?? null,
      previewRowCount: preview?.rows.length ?? 0,
      previewColumns: preview?.columns ?? [],
      recentlySaved: saved,
    },
  });

  // ── CopilotKit actions ────────────────────────────────────────────────────

  useCopilotAction({
    name: "previewQuery",
    description:
      "Translate a natural language description into SQL and show a data preview. Call this first before saving a report or chart.",
    parameters: [
      {
        name: "nlDescription",
        type: "string",
        description: "What the admin wants to see — e.g. 'top 10 products by revenue last 30 days'",
        required: true,
      },
      {
        name: "dataSourceId",
        type: "string",
        description: "UUID of the data source to query — pick from the available data sources list",
        required: true,
      },
    ],
    render: ({ status }) =>
      status !== "complete" ? (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Translating to SQL and running preview…
        </div>
      ) : null,
    handler: async ({ nlDescription, dataSourceId }) => {
      setPhase("translating");
      setErrorMsg(null);

      const result = await nlBuildPreview({ data: { nlDescription, dataSourceId } });

      if (!result.success) {
        setPhase("idle");
        setErrorMsg(result.error);
        return { success: false, error: result.error };
      }

      setPreview({
        sql: result.sql,
        confidence: result.confidence,
        columns: result.columns,
        rows: result.rows as Record<string, unknown>[],
      });
      setPhase("preview_ready");

      return {
        success: true,
        sql: result.sql,
        confidence: result.confidence,
        rowCount: result.rows.length,
        columns: result.columns,
        message: `Preview ready — ${result.rows.length} row(s). Confirm a name to save as a report or chart.`,
      };
    },
  });

  useCopilotAction({
    name: "saveAsReport",
    description:
      "Save the current SQL preview as a named report definition. Only call this after previewQuery has succeeded and the admin has confirmed a name.",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "Short human-readable report name",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "One-sentence description of what the report shows",
        required: false,
      },
      {
        name: "dataSourceId",
        type: "string",
        description: "UUID of the data source — same as used in previewQuery",
        required: true,
      },
      {
        name: "exportFormats",
        type: "string[]",
        description: "Which export formats to enable: csv, xlsx, pdf",
        required: false,
      },
    ],
    render: ({ status }) =>
      status !== "complete" ? (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving report…
        </div>
      ) : null,
    handler: async ({ name, description, dataSourceId, exportFormats }) => {
      if (!preview) return { success: false, error: "Run previewQuery first." };
      setPhase("saving");

      const validFormats = (exportFormats ?? ["csv", "xlsx", "pdf"]).filter(
        (f): f is "csv" | "xlsx" | "pdf" => ["csv", "xlsx", "pdf"].includes(f)
      );

      const result = await nlSaveReport({
        data: {
          name,
          description,
          dataSourceId,
          sql: preview.sql,
          exportFormats: validFormats.length > 0 ? validFormats : ["csv", "xlsx", "pdf"],
        },
      });

      if (!result.success) {
        setPhase("preview_ready");
        return { success: false, error: "Save failed" };
      }

      setSaved((prev) => [...prev, { type: "report", id: result.reportId, name }]);
      setPhase("saved");
      toast.success(`Report "${name}" saved.`);
      queryClient.invalidateQueries({ queryKey: ["reports"] });

      return {
        success: true,
        reportId: result.reportId,
        message: `Report "${name}" created. View it at /reports.`,
      };
    },
  });

  useCopilotAction({
    name: "saveAsChart",
    description:
      "Save the current SQL preview as a named chart definition. Only call this after previewQuery has succeeded and the admin has confirmed a name and chart type.",
    parameters: [
      {
        name: "name",
        type: "string",
        description: "Short human-readable chart name",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "One-sentence description of what the chart shows",
        required: false,
      },
      {
        name: "dataSourceId",
        type: "string",
        description: "UUID of the data source — same as used in previewQuery",
        required: true,
      },
      {
        name: "chartType",
        type: "string",
        description:
          "Chart type: bar | line | pie | area | scatter | heatmap | gauge | funnel | sankey | treemap",
        required: true,
      },
    ],
    render: ({ status }) =>
      status !== "complete" ? (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving chart…
        </div>
      ) : null,
    handler: async ({ name, description, dataSourceId, chartType }) => {
      if (!preview) return { success: false, error: "Run previewQuery first." };
      setPhase("saving");

      const validTypes = [
        "bar",
        "line",
        "pie",
        "area",
        "scatter",
        "heatmap",
        "gauge",
        "funnel",
        "sankey",
        "treemap",
      ];
      const safeChartType = validTypes.includes(chartType) ? (chartType as ChartType) : "bar";

      const result = await nlSaveChart({
        data: {
          name,
          description,
          dataSourceId,
          sql: preview.sql,
          chartType: safeChartType,
        },
      });

      if (!result.success) {
        setPhase("preview_ready");
        return { success: false, error: "Save failed" };
      }

      setSaved((prev) => [...prev, { type: "chart", id: result.chartId, name }]);
      setPhase("saved");
      toast.success(`Chart "${name}" saved.`);
      queryClient.invalidateQueries({ queryKey: ["charts"] });

      return {
        success: true,
        chartId: result.chartId,
        message: `Chart "${name}" created. View it at /charts.`,
      };
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          NL Report &amp; Chart Builder
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Describe what you want in plain English — the AI generates the SQL and creates the
          definition for you.
        </p>
      </div>

      {/* Data sources */}
      {dataSources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dataSources.map((ds) => (
            <Badge key={ds.id} variant="outline" className="text-xs">
              {ds.name} <span className="ml-1 text-muted-foreground">({ds.client_type})</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{errorMsg}</CardContent>
        </Card>
      )}

      {/* Translating spinner */}
      {phase === "translating" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Translating to SQL and running preview…</span>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && phase !== "translating" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              SQL Preview
              {preview.confidence > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {Math.round(preview.confidence * 100)}% confidence
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto mb-4 whitespace-pre-wrap">
              {preview.sql}
            </pre>

            {preview.rows.length > 0 ? (
              <div className="overflow-x-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.columns.map((col) => (
                        <TableHead key={col} className="text-xs">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: preview rows are ephemeral
                      <TableRow key={i}>
                        {preview.columns.map((col) => (
                          <TableCell key={col} className="text-xs">
                            {String(row[col] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Query returned no rows.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recently saved */}
      {saved.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Created this session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {saved.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {item.type === "report" ? (
                      <FileText className="h-4 w-4 text-blue-500" />
                    ) : (
                      <BarChart3 className="h-4 w-4 text-purple-500" />
                    )}
                    {item.name}
                    <Badge variant="outline" className="text-xs capitalize">
                      {item.type}
                    </Badge>
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={item.type === "report" ? "/reports" : "/charts"}>
                      View <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {phase === "idle" && !errorMsg && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Database className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">
              Ask the AI assistant to build something
            </p>
            <p className="text-sm text-muted-foreground/70 max-w-xs">
              Try: "Show me total orders by customer for the last 30 days" — then confirm a name to
              save it as a report or chart.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
