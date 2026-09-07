/**
 * NL Query API Client
 *
 * Provides typed API functions for the Natural Language Query feature.
 * Used by TanStack Query hooks for data fetching, caching, and synchronization.
 */

import type {
  DataSourceListItem,
  NlQueryPipelineResult,
  QueryHistoryEntry,
  SchemaOverviewResponse,
} from "@/types/database";

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * Fetch all active data sources
 */
export async function fetchActiveDataSources(): Promise<DataSourceListItem[]> {
  const res = await fetch("/api/data-sources", {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch data sources: ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Failed to fetch data sources");
  }
  // Filter to only active data sources
  return (json.data?.items || []).filter((ds: DataSourceListItem) => ds.is_active);
}

/**
 * Fetch schema information for a data source
 */
export async function fetchDataSourceSchema(
  dataSourceId: string,
  options: { refresh?: boolean } = {}
): Promise<SchemaOverviewResponse> {
  const res = await fetch("/api/nl-query/schema", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      data_source_id: dataSourceId,
      refresh: options.refresh || false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Failed to fetch schema");
  }
  return json.data;
}

/**
 * Execute a natural language query
 */
export async function executeNlQuery(params: {
  query: string;
  dataSourceId: string;
  generatedSql?: string;
}): Promise<NlQueryPipelineResult> {
  const res = await fetch("/api/nl-query/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      query: params.query,
      data_source_id: params.dataSourceId,
      generated_sql: params.generatedSql,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to execute query: ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Failed to execute query");
  }
  return json.data;
}

/**
 * Fetch query history for a data source
 */
export async function fetchQueryHistory(
  dataSourceId: string | undefined,
  options: { limit?: number; offset?: number } = {}
): Promise<QueryHistoryEntry[]> {
  const params = new URLSearchParams();
  if (dataSourceId) params.append("data_source_id", dataSourceId);
  if (options.limit) params.append("limit", String(options.limit));
  if (options.offset) params.append("offset", String(options.offset));

  const res = await fetch(`/api/nl-query/history?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch history: ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || "Failed to fetch history");
  }
  return json.data || [];
}

/**
 * Invalidate all NL Query related caches
 */
export function invalidateNlQueryCaches() {
  // This will be called by queryClient
  // The actual invalidation happens in the hooks
}

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Query keys for TanStack Query cache management
 * Using a factory pattern makes it easy to invalidate related queries
 */
export const nlQueryKeys = {
  // All NL Query related keys
  all: ["nl-query"] as const,

  // Data sources
  dataSources: () => [...nlQueryKeys.all, "data-sources"] as const,
  dataSource: (id: string) => [...nlQueryKeys.all, "data-source", id] as const,

  // Schema
  schemas: () => [...nlQueryKeys.all, "schemas"] as const,
  schema: (dataSourceId: string) => [...nlQueryKeys.schemas(), dataSourceId] as const,

  // Query results
  results: () => [...nlQueryKeys.all, "results"] as const,
  result: (queryId: string) => [...nlQueryKeys.results(), queryId] as const,

  // History
  history: () => [...nlQueryKeys.all, "history"] as const,
  historyForDataSource: (dataSourceId: string) =>
    [...nlQueryKeys.history(), "data-source", dataSourceId] as const,
} as const;
