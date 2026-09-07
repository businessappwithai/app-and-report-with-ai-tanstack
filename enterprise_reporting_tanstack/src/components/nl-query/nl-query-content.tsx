import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  LineChart,
  Loader2,
  PieChart,
  Play,
  Save,
  ScatterChart,
  Search,
  Table2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { EChartsRenderer } from "@/components/echarts/EChartsRenderer";
import { QueryResults } from "@/components/sql-editor/query-results";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordViewDialog } from "@/components/nl-query/RecordViewDialog";
import { VoiceInput } from "@/components/nl-query/VoiceInput";
import { useDatasourceEntities } from "@/hooks/metadata/use-metadata-queries";
import { drillableColumnSet, parseColumnTableMap } from "@/lib/utils/sql-column-map";
import type { SQLExecutionResponse } from "@/types/api";
import type { ChartType, DataMapping, EChartsConfig } from "@/types/charts";
import type { MetadataEntityWithFields } from "@/types/database";

const CHART_TYPES: {
  value: ChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "bar", label: "Bar", icon: BarChart3 },
  { value: "line", label: "Line", icon: LineChart },
  { value: "area", label: "Area", icon: BarChart3 },
  { value: "pie", label: "Pie", icon: PieChart },
  { value: "scatter", label: "Scatter", icon: ScatterChart },
];

const NUMERIC_TYPES = new Set([
  "integer",
  "int",
  "int2",
  "int4",
  "int8",
  "bigint",
  "smallint",
  "numeric",
  "decimal",
  "real",
  "float",
  "float4",
  "float8",
  "double precision",
  "money",
  "number",
]);

function isNumeric(typeName: string): boolean {
  return NUMERIC_TYPES.has(typeName.toLowerCase().trim());
}

function autoDetectMapping(result: SQLExecutionResponse): DataMapping {
  const cols = result.columns ?? [];
  if (cols.length === 0) return {};
  const numericCols = cols.filter((c) => isNumeric(c.type)).map((c) => c.name);
  const categoryCols = cols.filter((c) => !isNumeric(c.type)).map((c) => c.name);
  const x = categoryCols[0] ?? cols[0].name;
  const yRaw =
    numericCols.length > 0 ? numericCols : cols.filter((c) => c.name !== x).map((c) => c.name);
  const y = yRaw.length === 1 ? yRaw[0] : yRaw.length > 1 ? yRaw : cols[cols.length - 1].name;
  return { x, y };
}

interface HistoryEntry {
  id: string;
  nl_question: string;
  generated_sql: string;
  data_source_id: string;
  data_source_name?: string | null;
  role_name: string;
  user_name?: string | null;
  was_successful: boolean;
  row_count: number | null;
  execution_time_ms?: number | null;
  created_at: string;
}

export function NlQueryContent() {
  const [question, setQuestion] = useState("");
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<SQLExecutionResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchInput, setHistorySearchInput] = useState("");

  const [resultView, setResultView] = useState<"table" | "chart">("table");
  const [sqlOffset, setSqlOffset] = useState(0);

  const [drillRow, setDrillRow] = useState<Record<string, unknown> | null>(null);
  const [drillEntity, setDrillEntity] = useState<MetadataEntityWithFields | null>(null);

  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState<string>("");
  const [yCol, setYCol] = useState<string>("");

  const { data: dataSources = [], isLoading: isLoadingDs } = useQuery({
    queryKey: ["nl-query-data-sources"],
    queryFn: async () => {
      const res = await fetch("/api/data-sources?inspected=true");
      if (!res.ok) return [];
      const json = await res.json();
      let items = json.data?.items || json.items || [];
      if (items.length === 0) {
        const allRes = await fetch("/api/data-sources");
        if (allRes.ok) {
          const allJson = await allRes.json();
          items = allJson.data?.items || allJson.items || [];
        }
      }
      return items as {
        id: string;
        name: string;
        client_type: string;
        last_inspected_at?: string | null;
      }[];
    },
  });

  const [selectedDsId, setSelectedDsId] = useState<string>("");
  const dataSourceId = selectedDsId || dataSources[0]?.id || null;

  const { data: dsEntitiesData } = useDatasourceEntities(dataSourceId ?? "", {
    includeFields: true,
    activeOnly: true,
  });
  const dsEntities = (dsEntitiesData?.data?.entities ?? []) as MetadataEntityWithFields[];

  const colTableMap = useMemo(() => parseColumnTableMap(generatedSql ?? ""), [generatedSql]);

  const entityTableNames = useMemo(
    () => new Set(dsEntities.map((e) => e.entity_name?.toLowerCase() ?? "")),
    [dsEntities]
  );

  const drillableCols = useMemo(
    () =>
      queryResult
        ? drillableColumnSet(
            colTableMap,
            queryResult.columns.map((c) => c.name),
            entityTableNames
          )
        : new Set<string>(),
    [queryResult, colTableMap, entityTableNames]
  );

  const columnEntityMap = useMemo(() => {
    const map: Record<string, MetadataEntityWithFields> = {};
    const wildcard = colTableMap["*"];
    for (const colName of drillableCols) {
      const meta = colTableMap[colName.toLowerCase()] ?? wildcard;
      if (!meta?.tableName) continue;
      const entity = dsEntities.find((e) => e.entity_name?.toLowerCase() === meta.tableName);
      if (entity) map[colName] = entity;
    }
    return map;
  }, [drillableCols, colTableMap, dsEntities]);

  const { data: schemaContext } = useQuery({
    queryKey: ["nl-query-schema", dataSourceId],
    queryFn: async () => {
      if (!dataSourceId) return null;
      const res = await fetch(`/api/nl-query/schema?data_source_id=${dataSourceId}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as {
        schemaText: string;
        tables: { name: string; columns: string[] }[];
      } | null;
    },
    enabled: !!dataSourceId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ["nl-query-history", dataSourceId, historySearch],
    queryFn: async () => {
      const params = new URLSearchParams({ scope: "role", limit: "10" });
      if (dataSourceId) params.set("data_source_id", dataSourceId);
      if (historySearch) params.set("search", historySearch);
      const res = await fetch(`/api/nl-query/history?${params}`);
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as HistoryEntry[];
    },
    enabled: showHistory,
  });

  const { mutate: saveToHistory, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      if (!generatedSql || !question) throw new Error("No SQL to save");
      const res = await fetch("/api/nl-query/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nl_question: question,
          generated_sql: generatedSql,
          data_source_id: dataSourceId,
          row_count: queryResult?.rowCount ?? 0,
          was_successful: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Saved to role history");
      refetchHistory();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
  });

  const [rerunningId, setRerunningId] = useState<string | null>(null);

  const rerunSavedQuery = useCallback(
    async (entry: HistoryEntry) => {
      if (!dataSourceId) {
        toast.error("No data source selected");
        return;
      }
      setRerunningId(entry.id);
      try {
        const res = await fetch("/api/nl-query/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: entry.nl_question,
            data_source_id: entry.data_source_id || dataSourceId,
            generated_sql: entry.generated_sql,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "Query execution failed");
          return;
        }
        const pipelineResult = json.data;
        if (pipelineResult?.accessGranted === false) {
          toast.error("Access denied to one or more entities");
          return;
        }
        if (pipelineResult?.queryResults) {
          const cols = pipelineResult.queryResults.columns || [];
          const rows = pipelineResult.queryResults.rows || [];
          const totalRows = pipelineResult.queryResults.totalRows || rows.length;
          const execTime = pipelineResult.queryResults.executionTimeMs || 0;
          const sqlResult: SQLExecutionResponse = {
            columns: cols.map((name: string) => ({ name, type: "text" })),
            rows,
            rowCount: totalRows,
            executionTime: execTime,
          };
          setQuestion(entry.nl_question);
          setGeneratedSql(entry.generated_sql);
          setQueryResult(sqlResult);
          const mapping = autoDetectMapping(sqlResult);
          setXCol((mapping.x as string) ?? "");
          setYCol(
            typeof mapping.y === "string" ? mapping.y : Array.isArray(mapping.y) ? mapping.y[0] : ""
          );
          setResultView("table");
          setSqlOffset(0);
          toast.success(`Query re-executed: ${totalRows} rows in ${execTime}ms`);
        } else if (pipelineResult?.error) {
          toast.error(pipelineResult.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to re-execute query");
      } finally {
        setRerunningId(null);
      }
    },
    [dataSourceId]
  );

  const executeSQLFn = useCallback(
    async (sqlText: string, offset = 0): Promise<SQLExecutionResponse> => {
      const res = await fetch("/api/sql/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceId, sql: sqlText, limit: 100, offset }),
      });
      if (!res.ok) throw new Error("Failed to execute SQL");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Execution failed");
      return json.data as SQLExecutionResponse;
    },
    [dataSourceId]
  );

  const handlePageChange = (offset: number) => {
    setSqlOffset(offset);
    if (generatedSql) {
      executeSQLFn(generatedSql, offset)
        .then((data) => {
          setQueryResult(data);
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Pagination failed");
        });
    }
  };

  // ── CopilotKit Integration ──
  const selectedDs = dataSources.find((ds) => ds.id === dataSourceId);

  useCopilotReadable({
    description: "Data source and schema context",
    value: {
      dataSourceId,
      dsName: selectedDs?.name ?? "none",
      dsType: selectedDs?.client_type ?? "pg",
      schema: schemaContext?.schemaText ?? "Loading...",
    },
  });

  useCopilotAction({
    name: "fetchSimilarQueries",
    description:
      "Fetch RAG context: similar past queries and relevant table schemas. Call this ONCE as the first step, then proceed to executeNaturalLanguageQuery.",
    parameters: [
      {
        name: "query",
        type: "string",
        description: "The natural language question to find similar context for",
        required: true,
      },
    ],
    render: ({ status, result }) => {
      const typedResult = result as
        | { context?: string; steps?: { name: string; status: string; detail?: string }[] }
        | undefined;
      if (status !== "complete") {
        return (
          <div className="space-y-1 p-3 bg-muted rounded-lg text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
              <span>RAG Pipeline</span>
            </div>
            <div className="ml-6 text-muted-foreground space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Searching vector embeddings...</span>
              </div>
            </div>
          </div>
        );
      }
      const steps = typedResult?.steps || [];
      return (
        <div className="space-y-1 p-3 bg-muted rounded-lg text-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>RAG Pipeline</span>
          </div>
          <div className="ml-6 text-muted-foreground space-y-0.5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {s.status === "done" ? (
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                )}
                <span>
                  {s.name}
                  {s.detail ? `: ${s.detail}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    },
    handler: async ({ query }) => {
      if (!dataSourceId) return { context: "", steps: [] };
      try {
        const res = await fetch("/api/nl-query/rag-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            data_source_id: dataSourceId,
            context_budget: 4000,
            top_k_queries: 3,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          return {
            context: data.data.contextText || "",
            steps: data.data.modules || [],
          };
        }
        return {
          context: "No similar queries found. Use the table names from schema.",
          steps: [{ name: "RAG", status: "empty", detail: "No matches" }],
        };
      } catch {
        return {
          context: "RAG unavailable. Use table names from schema.",
          steps: [{ name: "RAG", status: "error", detail: "Service unavailable" }],
        };
      }
    },
  });

  useCopilotAction({
    name: "executeNaturalLanguageQuery",
    description:
      "Execute a natural language query against the selected data source. Generate the SQL query based on the schema, then execute it with RBAC permission checks. Results will appear in the main interface. If access is denied, explain which entities the user lacks permission for.",
    parameters: [
      {
        name: "query",
        type: "string",
        description:
          'The natural language question (e.g., "Show me top 10 patients by admissions")',
        required: true,
      },
      {
        name: "generatedSql",
        type: "string",
        description:
          "The SQL query to execute, generated from the natural language question based on the schema context",
        required: true,
      },
    ],
    render: ({ status, args, result }) => {
      if (status !== "complete") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Executing: &quot;{args.query}&quot;...</span>
          </div>
        );
      }
      const typedResult = result as
        | {
            error?: string;
            accessGranted?: boolean;
            rowCount?: number;
            executionTimeMs?: number;
            deniedEntities?: string[];
          }
        | undefined;
      if (typedResult?.error) {
        return (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{typedResult.error}</span>
          </div>
        );
      }
      if (typedResult && typedResult.accessGranted === false) {
        return (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">
              Access denied to entities: {typedResult.deniedEntities?.join(", ") || "unknown"}.
              Contact your administrator.
            </span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="text-sm">
            Query returned {typedResult?.rowCount ?? 0} rows ({typedResult?.executionTimeMs ?? 0}
            ms). Results are shown below.
          </span>
        </div>
      );
    },
    handler: async ({ query, generatedSql: sqlFromAI }) => {
      if (!dataSourceId) {
        return { error: "No data source selected. Please select one from the dropdown above." };
      }
      try {
        const res = await fetch("/api/nl-query/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            data_source_id: dataSourceId,
            generated_sql: sqlFromAI,
          }),
        });
        const json = await res.json();

        if (!json.success) {
          return { error: json.error?.message || "Query execution failed" };
        }

        const pipelineResult = json.data;

        if (pipelineResult?.accessGranted === false) {
          return {
            accessGranted: false,
            deniedEntities:
              pipelineResult.parsedEntities?.filter(
                (_: string, i: number) =>
                  pipelineResult.accessCheckResults?.[i]?.hasAccess === false
              ) || [],
            error: pipelineResult.error,
          };
        }

        if (pipelineResult?.queryResults) {
          const cols = pipelineResult.queryResults.columns || [];
          const rows = pipelineResult.queryResults.rows || [];
          const totalRows = pipelineResult.queryResults.totalRows || rows.length;
          const execTime = pipelineResult.queryResults.executionTimeMs || 0;

          const sqlResult: SQLExecutionResponse = {
            columns: cols.map((name: string) => ({ name, type: "text" })),
            rows,
            rowCount: totalRows,
            executionTime: execTime,
          };

          setQuestion(query);
          setGeneratedSql(sqlFromAI);
          setQueryResult(sqlResult);
          const mapping = autoDetectMapping(sqlResult);
          setXCol((mapping.x as string) ?? "");
          setYCol(
            typeof mapping.y === "string" ? mapping.y : Array.isArray(mapping.y) ? mapping.y[0] : ""
          );
          setResultView("table");
          setSqlOffset(0);
          const preview = rows.slice(0, 10);

          // Auto-store successful query in RAG for future similarity matching
          fetch("/api/nl-query/rag-store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data_source_id: dataSourceId,
              natural_language_query: query,
              generated_sql: sqlFromAI,
              row_count: totalRows,
              execution_time_ms: execTime,
            }),
          }).catch(() => {});

          return {
            accessGranted: true,
            rowCount: totalRows,
            executionTimeMs: execTime,
            columns: cols,
            data: preview,
            STOP: "Query complete. Present ONLY these results to the user. Do NOT call any more actions. Do NOT generate charts unless the user explicitly asks. Say: 'Would you like to explore this data further or run another query?'",
          };
        }

        if (pipelineResult?.error) {
          return { error: pipelineResult.error };
        }

        return { error: "Unexpected response from server" };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Query execution failed";
        return { error: msg };
      }
    },
  });

  useCopilotAction({
    name: "generateChart",
    description:
      "Switch the result view to a chart visualization. Use after executing a query when the user asks for a chart, graph, or visualization.",
    parameters: [
      {
        name: "chartType",
        type: "string",
        description: "Chart type: bar, line, area, pie, or scatter",
        required: true,
      },
      {
        name: "xAxisField",
        type: "string",
        description: "Column name for the X axis (or category for pie)",
        required: true,
      },
      {
        name: "yAxisField",
        type: "string",
        description: "Column name for the Y axis (or value for pie)",
        required: true,
      },
    ],
    render: ({ status }) => {
      if (status !== "complete") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating chart...</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span className="text-sm">Chart is now displayed in the main interface.</span>
        </div>
      );
    },
    handler: async ({ chartType: ct, xAxisField, yAxisField }) => {
      if (!queryResult) {
        return { error: "No query results available. Run a query first." };
      }
      setChartType(ct as ChartType);
      setXCol(xAxisField);
      setYCol(yAxisField);
      setResultView("chart");
      return { success: true };
    },
  });

  // ── Chart Config ──
  const chartConfig: EChartsConfig = {
    type: chartType,
    title: question || "Query Result",
    dataMapping: { x: xCol || undefined, y: yCol || undefined } satisfies DataMapping,
    legend: true,
    tooltip: true,
  };

  const allColumns = queryResult?.columns ?? [];

  return (
    <div className="space-y-4 max-w-full">
      {/* Page Header + Data Source Selector */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl text-tremor-content-strong">Natural Language Query</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Use the chat sidebar to ask questions — AI generates and runs SQL for you
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 self-start"
        >
          <BookOpen className="h-4 w-4" />
          <span className="hidden xs:inline">Role </span>History
          {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Data Source Selector */}
      {isLoadingDs ? (
        <Card>
          <CardContent className="pt-6 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading data sources...
          </CardContent>
        </Card>
      ) : dataSources.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No inspected data sources found. Go to{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => (window.location.href = "/data-sources")}
                >
                  Data Sources
                </Button>{" "}
                and click <strong>Inspect Schema</strong> on a configured data source to use it
                here.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground shrink-0">
                Data Source
              </span>
              <Select
                value={selectedDsId || dataSources[0]?.id || ""}
                onValueChange={setSelectedDsId}
              >
                <SelectTrigger className="w-full sm:w-80">
                  <SelectValue placeholder="Select data source" />
                </SelectTrigger>
                <SelectContent>
                  {dataSources.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      <span className="flex flex-col">
                        <span>{ds.name}</span>
                        {ds.last_inspected_at && (
                          <span className="text-tremor-label text-tremor-content">
                            Inspected {new Date(ds.last_inspected_at).toLocaleString()}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice Input — portals mic button into CopilotKit sidebar input */}
      <VoiceInput />

      {/* Role History panel */}
      {showHistory && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Saved SQL History (your role)
            </CardTitle>
            <form
              className="flex items-center gap-2 mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                setHistorySearch(historySearchInput);
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search queries... e.g. patient, gender"
                  value={historySearchInput}
                  onChange={(e) => setHistorySearchInput(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="h-8 px-3">
                Search
              </Button>
              {historySearch && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    setHistorySearch("");
                    setHistorySearchInput("");
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
            {historySearch && (
              <p className="text-xs text-muted-foreground mt-1">
                Showing results matching &quot;{historySearch}&quot;
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!historyData || historyData.length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">
                {historySearch
                  ? `No queries matching "${historySearch}". Try a different search term.`
                  : "No history yet. Run and save a query to see it here."}
              </p>
            ) : (
              <div className="divide-y max-h-72 overflow-y-auto">
                {historyData.map((entry) => (
                  <div
                    key={entry.id}
                    className="w-full text-left px-4 sm:px-6 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{entry.nl_question}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {entry.generated_sql.slice(0, 80)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 shrink-0"
                        onClick={() => rerunSavedQuery(entry)}
                        disabled={rerunningId === entry.id}
                      >
                        {rerunningId === entry.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1 text-xs">Run</span>
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {entry.role_name}
                      </Badge>
                      {entry.user_name && (
                        <Badge variant="secondary" className="text-xs">
                          {entry.user_name}
                        </Badge>
                      )}
                      {entry.data_source_name && (
                        <Badge variant="secondary" className="text-xs">
                          {entry.data_source_name}
                        </Badge>
                      )}
                      {entry.row_count != null && (
                        <span className="text-tremor-label text-tremor-content">
                          {entry.row_count} rows
                        </span>
                      )}
                      {entry.execution_time_ms != null && (
                        <span className="text-tremor-label text-tremor-content">
                          {entry.execution_time_ms}ms
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {queryResult ? (
        <Card className="overflow-hidden">
          <div className="w-full flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Results
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {(queryResult.pagination?.totalRows ?? queryResult.rowCount).toLocaleString()} row
                {(queryResult.pagination?.totalRows ?? queryResult.rowCount) !== 1 ? "s" : ""}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => saveToHistory()}
              disabled={isSaving || !generatedSql}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline ml-1">Save</span>
            </Button>
          </div>

          {/* Generated SQL (collapsible) */}
          {generatedSql && (
            <details className="px-4 sm:px-6 pb-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                View generated SQL
              </summary>
              <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                {generatedSql}
              </pre>
            </details>
          )}

          {/* View toggle */}
          <div className="px-4 sm:px-6 py-3 border-b bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              View as
            </p>
            <div className="sm:hidden">
              <Select
                value={resultView === "table" ? "table" : chartType}
                onValueChange={(v) => {
                  if (v === "table") {
                    setResultView("table");
                  } else {
                    setChartType(v as ChartType);
                    setResultView("chart");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="table">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      Table
                    </div>
                  </SelectItem>
                  {CHART_TYPES.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {label} Chart
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="hidden sm:flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={resultView === "table" ? "default" : "outline"}
                onClick={() => setResultView("table")}
                className="h-8"
              >
                <Table2 className="h-3.5 w-3.5 mr-1.5" />
                Table
              </Button>
              {CHART_TYPES.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  size="sm"
                  variant={resultView === "chart" && chartType === value ? "default" : "outline"}
                  onClick={() => {
                    setChartType(value);
                    setResultView("chart");
                  }}
                  className="h-8"
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <CardContent className="p-0">
            {resultView === "table" ? (
              <div style={{ height: "min(480px, 60vh)" }} className="min-h-[200px]">
                <QueryResults
                  result={queryResult}
                  onPageChange={handlePageChange}
                  drillableColumns={drillableCols.size > 0 ? drillableCols : undefined}
                  onCellClick={
                    drillableCols.size > 0
                      ? (row, colName) => {
                          const entity = columnEntityMap[colName];
                          if (entity) {
                            setDrillRow(row);
                            setDrillEntity(entity);
                          }
                        }
                      : undefined
                  }
                />
                {drillableCols.size > 0 && (
                  <p className="text-xs text-muted-foreground px-3 pb-2 pt-1">
                    Tap a highlighted cell to view its record details
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  {chartType !== "pie" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-12 shrink-0">X axis</span>
                      <Select value={xCol} onValueChange={setXCol}>
                        <SelectTrigger className="flex-1 sm:w-44">
                          <SelectValue placeholder="Column" />
                        </SelectTrigger>
                        <SelectContent>
                          {allColumns.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-12 shrink-0">
                      {chartType === "pie" ? "Value" : "Y axis"}
                    </span>
                    <Select value={yCol} onValueChange={setYCol}>
                      <SelectTrigger className="flex-1 sm:w-44">
                        <SelectValue placeholder="Column" />
                      </SelectTrigger>
                      <SelectContent>
                        {allColumns.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {xCol && yCol ? (
                  <EChartsRenderer
                    config={chartConfig}
                    data={queryResult.rows}
                    height={Math.min(320, Math.max(220, window.innerHeight * 0.4))}
                  />
                ) : (
                  <div className="flex items-center justify-center h-36 text-muted-foreground text-sm text-center px-4">
                    Select columns above to render the chart
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <Table2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No results yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
              Open the chat sidebar and ask a question about your data. Try: &quot;Show me total
              patients by gender&quot; or &quot;What are the top 10 diagnoses?&quot;
            </p>
          </CardContent>
        </Card>
      )}

      {drillRow && drillEntity && dataSourceId && (
        <RecordViewDialog
          open={!!drillRow}
          onClose={() => {
            setDrillRow(null);
            setDrillEntity(null);
          }}
          dataSourceId={dataSourceId}
          entityId={drillEntity.id}
          record={drillRow}
          entityMeta={drillEntity}
        />
      )}
    </div>
  );
}
