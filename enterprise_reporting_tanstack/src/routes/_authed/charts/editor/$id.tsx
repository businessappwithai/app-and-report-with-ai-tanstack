import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChartAppearance } from "@/components/charts/editor/chart-appearance";
import { ChartAxisConfig } from "@/components/charts/editor/chart-axis-config";
import { ChartBasicInfo } from "@/components/charts/editor/chart-basic-info";
import { ChartDataSource } from "@/components/charts/editor/chart-data-source";
import { ChartPreviewPanel } from "@/components/charts/editor/chart-preview-panel";
import { ChartReusableFilters } from "@/components/charts/editor/chart-reusable-filters";
import { ChartTypeSelector } from "@/components/charts/editor/chart-type-selector";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import type {
  ChartConfig,
  ChartDefinition,
  ChartType,
  DataMapping,
  FilterDefinition,
  SavedQuery,
} from "@/types/database";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
export const Route = createFileRoute("/_authed/charts/editor/$id")({
  component: ChartEditorPage,
});

function ChartEditorContent() {
  const { id: chartId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [chartName, setChartName] = useState("");
  const [chartDescription, setChartDescription] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedQueryId, setSelectedQueryId] = useState("");
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    title: { show: true, text: "" },
    legend: { show: true, position: "bottom" },
    tooltip: { enabled: true },
    animation: true,
    stacked: false,
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
  });
  const [dataMapping, setDataMapping] = useState<DataMapping>({
    xAxis: { field: "", label: "" },
    yAxis: [],
    groupBy: "",
    colorBy: "",
  });
  const [showPreview, setShowPreview] = useState(true);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<string>("");
  const [targetColumn, setTargetColumn] = useState<string>("");

  const { data: chart } = useQuery<ChartDefinition>({
    queryKey: ["chart", chartId],
    queryFn: async () => {
      const res = await fetch(`/api/charts/${chartId}`);
      const data = await res.json();
      return data.data;
    },
    enabled: !!chartId && chartId !== "new",
  });

  const { data: queries } = useQuery<SavedQuery[]>({
    queryKey: ["queries"],
    queryFn: async () => {
      const res = await fetch("/api/queries");
      const data = await res.json();
      return data.data?.items || [];
    },
  });

  const { data: availableFilters } = useQuery<FilterDefinition[]>({
    queryKey: ["filters"],
    queryFn: async () => {
      const res = await fetch("/api/filters");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: chartFilters } = useQuery({
    queryKey: ["chart-filters", chartId],
    queryFn: async () => {
      if (chartId === "new") return [];
      const res = await fetch(`/api/charts/${chartId}/filters`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!chartId && chartId !== "new",
  });

  const { data: queryResults, isLoading: queryResultsLoading } = useQuery({
    queryKey: ["chart-data-preview", selectedQueryId, chartId],
    queryFn: async () => {
      if (!selectedQueryId) return { rows: [] };
      const res = await fetch(`/api/queries/${selectedQueryId}/execute`, { method: "POST" });
      if (!res.ok) return { rows: [] };
      const data = await res.json();
      return data.data;
    },
    enabled: !!selectedQueryId,
  });

  useEffect(() => {
    if (chart) {
      setChartName(chart.name || "");
      setChartDescription(chart.description || "");
      setChartType(chart.chart_type || "bar");
      setSelectedQueryId(chart.saved_query_id || "");

      if (chart.chart_config) {
        try {
          let configStr = chart.chart_config;
          if (
            typeof configStr === "string" &&
            configStr.startsWith('"') &&
            configStr.includes('\\"')
          ) {
            configStr = JSON.parse(configStr);
          }
          const parsed = typeof configStr === "string" ? JSON.parse(configStr) : configStr;
          setChartConfig({
            title: parsed.title || { show: true, text: "" },
            legend: parsed.legend || { show: true, position: "bottom" },
            tooltip: parsed.tooltip || { enabled: true },
            animation: parsed.animation !== undefined ? parsed.animation : true,
            stacked: parsed.stacked || false,
            colors: parsed.colors || ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"],
          });
        } catch {
          // keep defaults
        }
      }

      if (chart.data_mapping) {
        try {
          let mappingStr = chart.data_mapping;
          if (
            typeof mappingStr === "string" &&
            mappingStr.startsWith('"') &&
            mappingStr.includes('\\"')
          ) {
            mappingStr = JSON.parse(mappingStr);
          }
          const parsed = typeof mappingStr === "string" ? JSON.parse(mappingStr) : mappingStr;
          setDataMapping({
            xAxis: parsed.xAxis || { field: "", label: "" },
            yAxis: parsed.yAxis || [],
            groupBy: parsed.groupBy || "",
            colorBy: parsed.colorBy || "",
          });
        } catch {
          // keep defaults
        }
      }
    }
  }, [chart]);

  useEffect(() => {
    if (queryResults?.rows) {
      setPreviewData(queryResults.rows);
    }
  }, [queryResults]);

  useEffect(() => {
    // Only reset axes when the user picks a *different* query than the saved one.
    // Without this guard, saving the chart re-fetches `chart`, fires this effect,
    // and wipes the axis configuration the user just configured.
    if (selectedQueryId && chart && selectedQueryId !== chart.saved_query_id) {
      setDataMapping({ xAxis: { field: "", label: "" }, yAxis: [], groupBy: "", colorBy: "" });
    }
  }, [selectedQueryId, chart]);

  const availableFields = previewData.length > 0 ? Object.keys(previewData[0]) : [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: chartName,
        description: chartDescription,
        chart_type: chartType,
        saved_query_id: selectedQueryId || undefined,
        chart_config: JSON.stringify(chartConfig),
        data_mapping: JSON.stringify(dataMapping),
      };
      const url = chartId === "new" ? "/api/charts" : `/api/charts/${chartId}`;
      const method = chartId === "new" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to save chart");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Chart saved successfully");
      queryClient.invalidateQueries({ queryKey: ["charts"] });
      queryClient.invalidateQueries({ queryKey: ["chart"] });
      if (chartId === "new") {
        navigate({ to: "/charts/editor/$id", params: { id: data.data.id } });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const addFilterMutation = useMutation({
    mutationFn: async ({ filterId, targetColumn }: { filterId: string; targetColumn: string }) => {
      const res = await fetch(`/api/charts/${chartId}/filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter_id: filterId, target_column: targetColumn }),
      });
      if (!res.ok) throw new Error("Failed to add filter");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Filter added");
      queryClient.invalidateQueries({ queryKey: ["chart-filters", chartId] });
    },
  });

  const removeFilterMutation = useMutation({
    mutationFn: async (filterLinkId: string) => {
      const res = await fetch(`/api/charts/${chartId}/filters/${filterLinkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove filter");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Filter removed");
      queryClient.invalidateQueries({ queryKey: ["chart-filters", chartId] });
    },
  });

  // ── CopilotKit ─────────────────────────────────────────────────────────
  useCopilotReadable({
    description: "Available saved queries for the chart",
    value: (queries ?? []).map((q) => ({ id: q.id, name: q.name, dataSourceId: q.data_source_id })),
  });
  useCopilotReadable({
    description: "Current chart configuration",
    value: { chartType, chartName, chartDescription, selectedQueryId, dataMapping, chartConfig },
  });

  useCopilotAction({
    name: "setChartType",
    description:
      "Change the chart type (bar, line, pie, area, scatter, heatmap, gauge, funnel, treemap)",
    parameters: [
      {
        name: "chartType",
        type: "string",
        description: "One of: bar, line, pie, area, scatter, heatmap, gauge, funnel, treemap",
        required: true,
      },
    ],
    handler: async ({ chartType: ct }) => {
      setChartType(ct as ChartType);
      return `Chart type set to ${ct}.`;
    },
  });
  useCopilotAction({
    name: "setChartName",
    description: "Set the chart name and optional description",
    parameters: [
      { name: "name", type: "string", description: "Chart name", required: true },
      { name: "description", type: "string", description: "Chart description", required: false },
    ],
    handler: async ({ name: n, description: d }) => {
      setChartName(n);
      if (d) setChartDescription(d);
      return `Chart named "${n}".`;
    },
  });
  useCopilotAction({
    name: "selectQuery",
    description: "Select which saved query provides data for this chart",
    parameters: [
      {
        name: "queryId",
        type: "string",
        description: "Saved query ID from the available list",
        required: true,
      },
    ],
    handler: async ({ queryId }) => {
      setSelectedQueryId(queryId);
      return `Query ${queryId} selected.`;
    },
  });
  useCopilotAction({
    name: "setAxisMapping",
    description: "Configure which columns map to the X and Y axes",
    parameters: [
      {
        name: "xField",
        type: "string",
        description: "Column name for the X axis / category",
        required: true,
      },
      {
        name: "yFields",
        type: "string[]",
        description: "Column names for Y axis / values",
        required: true,
      },
    ],
    handler: async ({ xField, yFields }) => {
      setDataMapping((prev) => ({
        ...prev,
        xAxis: { ...prev.xAxis, field: xField },
        yAxis: yFields.map((f) => ({ field: f, label: f, aggregation: "sum" as const })),
      }));
      return `Axis mapping set: x=${xField}, y=[${yFields.join(",")}].`;
    },
  });
  // ────────────────────────────────────────────────────────────────────────

  return (
    <CopilotSidebar
      instructions={
        "You are a chart configuration assistant. Help users configure charts.\nWORKFLOW:\n1. Ask what data they want to visualise.\n2. Suggest an appropriate chart type based on the data (bar for comparisons, line for trends, pie for proportions).\n3. Call selectQuery to pick the saved query with the data.\n4. Call setAxisMapping with column names from the query.\n5. Call setChartType and setChartName.\n6. Tell the user to click Save when done.\nRULES: Never invent column names — only use columns the user mentions or that appear in the query."
      }
      defaultOpen={false}
      labels={{
        title: "Chart Assistant",
        initial: "Describe the chart you want to create and I'll configure it for you.",
        placeholder: "e.g. Bar chart of revenue by region…",
      }}
    >
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/charts/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <PageHeader
                title="Chart Editor"
                description="{chartId === &quot;new&quot; ? &quot;Create a new chart&quot; : &quot;Edit chart configuration&quot;}"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="mr-2 h-4 w-4" />
                {showPreview ? "Hide" : "Show"} Preview
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Chart"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <ChartBasicInfo
                chartName={chartName}
                chartDescription={chartDescription}
                onNameChange={setChartName}
                onDescriptionChange={setChartDescription}
              />
              <ChartDataSource
                queries={queries}
                selectedQueryId={selectedQueryId}
                availableFields={availableFields}
                onQueryChange={setSelectedQueryId}
              />
              {chartId !== "new" && (
                <ChartReusableFilters
                  availableFilters={availableFilters}
                  chartFilters={chartFilters}
                  availableFields={availableFields}
                  selectedFilterId={selectedFilterId}
                  targetColumn={targetColumn}
                  onSelectedFilterChange={setSelectedFilterId}
                  onTargetColumnChange={setTargetColumn}
                  onAddFilter={(filterId, col) => {
                    addFilterMutation.mutate({ filterId, targetColumn: col });
                    setSelectedFilterId("");
                    setTargetColumn("");
                  }}
                  onRemoveFilter={(id) => removeFilterMutation.mutate(id)}
                  isAdding={addFilterMutation.isPending}
                  isRemoving={removeFilterMutation.isPending}
                />
              )}
              <ChartTypeSelector chartType={chartType} onChartTypeChange={setChartType} />
              <ChartAxisConfig
                dataMapping={dataMapping}
                availableFields={availableFields}
                chartConfig={chartConfig}
                onDataMappingChange={setDataMapping}
              />
              <ChartAppearance
                chartConfig={chartConfig}
                chartType={chartType}
                onChartConfigChange={setChartConfig}
              />
            </div>

            {showPreview && (
              <ChartPreviewPanel
                previewData={previewData}
                availableFields={availableFields}
                chartType={chartType}
                chartConfig={chartConfig}
                dataMapping={dataMapping}
                selectedQueryId={selectedQueryId}
                isLoading={queryResultsLoading}
              />
            )}
          </div>
        </div>
      </div>
    </CopilotSidebar>
  );
}

function ChartEditorPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <ChartEditorContent />
    </CopilotKit>
  );
}
