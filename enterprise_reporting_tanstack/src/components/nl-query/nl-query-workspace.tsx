"use client";

/**
 * NL Query Workspace Component
 *
 * This component uses TanStack Query hooks for:
 * - Client-side data fetching and caching
 * - Automatic background refetching
 * - Optimistic updates
 * - Request deduplication
 * - Stale-while-revalidate behavior
 *
 * Performance benefits:
 * - Cached schema responses (10 min TTL)
 * - Cached data source list (5 min TTL)
 * - Smart invalidation after mutations
 * - Reduced server load
 */

import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  History,
  Loader2,
  RefreshCw,
  Shield,
  Table as TableIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
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
import { getTremorChartPalette } from "@/lib/theme/tremor-colors";
import {
  useActiveDataSources,
  useDataSourceSchema,
  useExecuteNlQuery,
  useQueryHistory,
  useRefreshSchema,
} from "@/lib/hooks/use-nl-query";
import type {
  AccessCheckDetail,
  DataSourceListItem,
  NlChartConfig,
  NlQueryPipelineResult,
  QueryHistoryEntry,
  SchemaColumnSummary,
  SchemaOverviewResponse,
  SchemaTableSummary,
} from "@/types/database";
import { NlResultsChart } from "./nl-results-chart";
import { NlResultsTable } from "./nl-results-table";

export function NlQueryWorkspace() {
  // Local state
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>("");
  const [queryResult, setQueryResult] = useState<NlQueryPipelineResult | null>(null);
  const [chartConfig, setChartConfig] = useState<NlChartConfig | null>(null);
  const [activeTab, setActiveTab] = useState("results");

  // ============================================================================
  // TanStack Query Hooks - Client-side caching and state management
  // ============================================================================

  // Fetch active data sources with caching (5 min stale time)
  const {
    data: dataSources = [],
    isLoading: dataSourcesLoading,
    error: dataSourcesError,
  } = useActiveDataSources();

  // Fetch schema with aggressive caching (10 min stale time)
  const {
    data: schemaInfo,
    isLoading: schemaLoading,
    error: schemaError,
  } = useDataSourceSchema(selectedDataSourceId);

  // Query history with caching (30 sec stale time)
  const { data: queryHistory = [], isLoading: historyLoading } = useQueryHistory(
    selectedDataSourceId,
    { limit: 20 }
  );

  // Query execution mutation with automatic cache invalidation
  const executeMutation = useExecuteNlQuery();

  // Schema refresh with cache invalidation
  const refreshSchema = useRefreshSchema();

  // ============================================================================
  // CopilotKit Integration
  // ============================================================================

  const selectedDs = dataSources.find((ds: DataSourceListItem) => ds.id === selectedDataSourceId);

  // Expose state to CopilotKit for AI context
  useCopilotReadable({
    description:
      "Currently selected data source and its schema information for natural language SQL queries",
    value: {
      selectedDataSourceId,
      selectedDataSourceName: selectedDs?.name,
      schemaText: schemaInfo?.schemaText || null,
      schemaInfo: schemaInfo
        ? {
            tableCount: schemaInfo.tableCount,
            viewCount: schemaInfo.viewCount,
            tables: schemaInfo.tables?.map((t: SchemaTableSummary) => ({
              name: t.name,
              columns: t.columns
                ?.map((c: SchemaColumnSummary) => `${c.name} (${c.type})`)
                .join(", "),
            })),
          }
        : null,
      lastQueryResult: queryResult
        ? {
            accessGranted: queryResult.accessGranted,
            rowCount: queryResult.queryResults?.totalRows,
            error: queryResult.error,
          }
        : null,
    },
  });

  // CopilotKit action: Execute NL query
  useCopilotAction({
    name: "executeNaturalLanguageQuery",
    description:
      "Execute a natural language query against the selected data source. Generates SQL, checks RBAC permissions, and returns results. IMPORTANT: Use the exact table and column names from the schemaText in context. Do not guess or pluralize table names - use them exactly as specified in the DATABASE SCHEMA section.",
    parameters: [
      {
        name: "query",
        type: "string",
        description:
          'The natural language query to execute (e.g., "Show me top 10 customers by revenue")',
        required: true,
      },
      {
        name: "generatedSql",
        type: "string",
        description:
          'The SQL query generated from the natural language query. CRITICAL: Use ONLY the exact table names from the schemaText. For example, if the schema shows "regions" (plural), use "regions", not "region". Match table and column names exactly.',
        required: true,
      },
    ],
    render: ({ status, args, result }) => {
      if (status !== "complete") {
        return (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Executing query: &quot;{args.query}&quot;...</span>
          </div>
        );
      }

      const typedResult = result as NlQueryPipelineResult | { error: string } | undefined;
      if (typedResult && "error" in typedResult && typedResult.error) {
        return (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{typedResult.error}</span>
          </div>
        );
      }

      const pipelineResult = typedResult as NlQueryPipelineResult | undefined;
      return (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm">
            Query returned {pipelineResult?.queryResults?.totalRows || 0} rows in{" "}
            {pipelineResult?.queryResults?.executionTimeMs || 0}ms. View results in the table below.
          </span>
        </div>
      );
    },
    handler: async ({ query, generatedSql }) => {
      if (!selectedDataSourceId) {
        toast.error("Please select a data source first");
        return { error: "No data source selected" };
      }

      try {
        // Use TanStack Query mutation which handles caching automatically
        const result = await executeMutation.mutateAsync({
          query,
          dataSourceId: selectedDataSourceId,
          generatedSql,
        });

        // Update local state
        setQueryResult(result);
        setActiveTab("results");
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return { error: errorMsg };
      }
    },
  });

  // CopilotKit action: Generate chart
  useCopilotAction({
    name: "generateChart",
    description:
      "Generate a chart visualization from the current query results. Use this when the user asks for a chart, graph, trend, or visualization of the data.",
    parameters: [
      {
        name: "chartType",
        type: "string",
        description: "The type of chart to generate: bar, line, area, pie, or scatter",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "The chart title",
        required: true,
      },
      {
        name: "xAxisField",
        type: "string",
        description: "The column to use for the X axis",
        required: true,
      },
      {
        name: "yAxisFields",
        type: "string",
        description: 'Comma-separated column names to use for the Y axis (e.g., "revenue,count")',
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
          <span className="text-sm">Chart generated. View it in the Chart tab.</span>
        </div>
      );
    },
    handler: async ({ chartType, title, xAxisField, yAxisFields }) => {
      if (!queryResult?.queryResults) {
        return { error: "No query results available. Run a query first." };
      }

      const yFields = yAxisFields.split(",").map((f: string) => f.trim());

      const config: NlChartConfig = {
        chartType: chartType as NlChartConfig["chartType"],
        title,
        xAxis: { field: xAxisField, label: xAxisField },
        yAxis: yFields.map((f: string) => ({ field: f, label: f })),
        colors: getTremorChartPalette(5),
      };

      setChartConfig(config);
      setActiveTab("chart");
      return { success: true, config };
    },
  });

  // CopilotKit action: Refresh schema
  useCopilotAction({
    name: "refreshSchema",
    description:
      "Refresh the database schema cache. Use this when the user mentions schema changes or wants updated schema information.",
    parameters: [],
    handler: async () => {
      if (!selectedDataSourceId) {
        return { error: "No data source selected" };
      }

      // Use TanStack Query's refreshSchema which invalidates cache and refetches
      await refreshSchema(selectedDataSourceId);
      toast.success("Schema refreshed");
      return schemaInfo as SchemaOverviewResponse;
    },
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleRefreshSchema = useCallback(async () => {
    if (!selectedDataSourceId) return;
    try {
      await refreshSchema(selectedDataSourceId);
      toast.success("Schema cache refreshed");
    } catch {
      toast.error("Failed to refresh schema");
    }
  }, [selectedDataSourceId, refreshSchema]);

  const handleDataSourceChange = useCallback((dsId: string) => {
    setSelectedDataSourceId(dsId);
    setQueryResult(null); // Clear previous results
    setChartConfig(null); // Clear previous chart
    setActiveTab("results"); // Reset tab
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <CopilotSidebar
      instructions={`You are an expert SQL analyst assistant for the Enterprise Reporting System.
Help users query their databases using natural language.

IMPORTANT RULES:
1. When a user asks a question about data, use the executeNaturalLanguageQuery action.
2. Generate valid SQL based on the schema information in the context.
3. If the user asks for a chart or visualization, first execute the query, then use generateChart.
4. Always explain what you're doing and what the results mean.
5. If access is denied, explain which entities the user lacks permission for.
6. For trend analysis, use appropriate date grouping (daily, weekly, monthly).
7. Always use proper JOINs when combining tables.

The currently selected data source is: ${selectedDs?.name || "None selected"}.
${schemaInfo ? `It has ${schemaInfo.tableCount} tables and ${schemaInfo.viewCount} views.` : ""}`}
      labels={{
        title: "NL Query Assistant",
        initial: selectedDataSourceId
          ? "Ask me anything about your data! I can generate SQL queries, create charts, and help you explore your database."
          : "Select a data source to get started, then ask me questions about your data.",
        placeholder: "Ask about your data...",
      }}
      defaultOpen={true}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-semibold text-2xl text-tremor-content-strong">
            Natural Language Query
          </h1>
          <p className="text-tremor-content">
            Ask questions about your data in natural language. Powered by AI with RBAC-enforced
            access control.
          </p>
        </div>

        {/* Data Source Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Data Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select value={selectedDataSourceId} onValueChange={handleDataSourceChange}>
                <SelectTrigger className="w-[300px]" disabled={dataSourcesLoading}>
                  <SelectValue
                    placeholder={
                      dataSourcesLoading ? "Loading data sources..." : "Select a data source"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {dataSources.map((ds: DataSourceListItem) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name} ({ds.client_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedDataSourceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshSchema}
                  disabled={schemaLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${schemaLoading ? "animate-spin" : ""}`} />
                  Refresh Schema
                </Button>
              )}

              {schemaInfo && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{schemaInfo.tableCount} tables</Badge>
                  {schemaInfo.viewCount > 0 && (
                    <Badge variant="secondary">{schemaInfo.viewCount} views</Badge>
                  )}
                </div>
              )}
            </div>

            {/* Schema overview */}
            {schemaInfo?.tables && schemaInfo.tables.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Available tables:</p>
                <div className="flex flex-wrap gap-1">
                  {schemaInfo.tables.slice(0, 20).map((t: SchemaTableSummary) => (
                    <Badge key={t.name} variant="outline" className="text-xs font-mono">
                      {t.name} ({t.columnCount})
                    </Badge>
                  ))}
                  {schemaInfo.tables.length > 20 && (
                    <Badge variant="outline" className="text-xs">
                      +{schemaInfo.tables.length - 20} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Error states */}
            {dataSourcesError && (
              <p className="text-sm text-destructive mt-2">
                Failed to load data sources. Please refresh the page.
              </p>
            )}
            {schemaError && selectedDataSourceId && (
              <p className="text-sm text-destructive mt-2">
                Failed to load schema. Try refreshing.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results Area */}
        {(queryResult || executeMutation.isPending) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {executeMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : queryResult?.accessGranted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  Query Results
                </CardTitle>
                {queryResult?.queryResults && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{queryResult.queryResults.totalRows} rows</span>
                    <span>&middot;</span>
                    <span>{queryResult.queryResults.executionTimeMs}ms</span>
                  </div>
                )}
              </div>

              {/* Access check details */}
              {queryResult?.accessCheckResults && queryResult.accessCheckResults.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-sm font-medium">Access Check</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {queryResult.accessCheckResults.map((check: AccessCheckDetail) => (
                      <Badge
                        key={check.entity}
                        variant={check.hasAccess ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {check.hasAccess ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {check.entity}
                        {check.grantedBy ? ` (${check.grantedBy})` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated SQL */}
              {queryResult?.generatedSql && (
                <details className="mt-2">
                  <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                    View generated SQL
                  </summary>
                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                    {queryResult.generatedSql}
                  </pre>
                </details>
              )}
            </CardHeader>

            <CardContent>
              {queryResult?.error && (
                <div className="flex items-start gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{queryResult.error}</p>
                </div>
              )}

              {queryResult?.queryResults && (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="results" className="gap-1">
                      <TableIcon className="h-4 w-4" /> Table
                    </TabsTrigger>
                    <TabsTrigger value="chart" className="gap-1">
                      <BarChart3 className="h-4 w-4" /> Chart
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="results" className="mt-4">
                    <NlResultsTable
                      columns={queryResult.queryResults.columns}
                      rows={queryResult.queryResults.rows}
                      totalRows={queryResult.queryResults.totalRows}
                    />
                  </TabsContent>

                  <TabsContent value="chart" className="mt-4">
                    {chartConfig ? (
                      <NlResultsChart data={queryResult.queryResults.rows} config={chartConfig} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 mb-4" />
                        <p>Ask the assistant to generate a chart from the results.</p>
                        <p className="text-sm mt-1">
                          Try: &quot;Show me a bar chart of this data&quot;
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )}

        {/* Query History */}
        {queryHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Queries
                </div>
                {historyLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {queryHistory.slice(0, 10).map((h: QueryHistoryEntry) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.natural_language_query}</p>
                      {h.generated_sql && (
                        <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                          {h.generated_sql.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        h.access_check_result === "granted"
                          ? "default"
                          : h.access_check_result === "denied"
                            ? "destructive"
                            : "secondary"
                      }
                      className="ml-2 flex-shrink-0"
                    >
                      {h.access_check_result}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CopilotSidebar>
  );
}
