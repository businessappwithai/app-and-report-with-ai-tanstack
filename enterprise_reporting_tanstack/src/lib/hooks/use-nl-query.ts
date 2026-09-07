/**
 * TanStack Query Hooks for NL Query Feature
 *
 * These hooks provide:
 * - Automatic caching and background refetching
 * - Optimistic updates for better UX
 * - Request deduplication
 * - Stale-while-revalidate behavior
 * - Pagination and infinite scroll support
 */

import { type UseQueryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  executeNlQuery,
  fetchActiveDataSources,
  fetchDataSourceSchema,
  fetchQueryHistory,
  nlQueryKeys,
} from "@/lib/api/nl-query-client";
import type {
  DataSourceListItem,
  NlQueryPipelineResult,
  QueryHistoryEntry,
  SchemaOverviewResponse,
} from "@/types/database";

// ============================================================================
// Data Source Hooks
// ============================================================================

/**
 * Hook to fetch all active data sources with caching
 *
 * Features:
 * - 5 minute stale time (data sources don't change often)
 * - Refetch on window focus
 * - Refetch on reconnect
 * - Automatic retry on failure
 */
export function useActiveDataSources(
  options?: Omit<UseQueryOptions<DataSourceListItem[], Error>, "queryKey" | "queryFn">
) {
  return useQuery<DataSourceListItem[], Error>({
    queryKey: nlQueryKeys.dataSources(),
    queryFn: fetchActiveDataSources,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}

/**
 * Hook to prefetch data sources (useful for navigation)
 */
export function usePrefetchDataSources() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey: nlQueryKeys.dataSources(),
      queryFn: fetchActiveDataSources,
      staleTime: 5 * 60 * 1000,
    });
  };
}

// ============================================================================
// Schema Hooks
// ============================================================================

/**
 * Hook to fetch data source schema with aggressive caching
 *
 * Features:
 * - 10 minute stale time (schema changes are infrequent)
 * - Selective refresh support
 * - Background refetch
 */
export function useDataSourceSchema(
  dataSourceId: string | undefined,
  options?: { refresh?: boolean; enabled?: boolean }
) {
  return useQuery<SchemaOverviewResponse, Error>({
    queryKey: nlQueryKeys.schema(dataSourceId || ""),
    queryFn: () => fetchDataSourceSchema(dataSourceId as string, { refresh: options?.refresh }),
    enabled: !!dataSourceId && options?.enabled !== false,
    staleTime: 10 * 60 * 1000, // 10 minutes - schema doesn't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });
}

/**
 * Hook to refresh schema cache
 */
export function useRefreshSchema() {
  const queryClient = useQueryClient();

  return async (dataSourceId: string) => {
    // Invalidate the schema cache
    await queryClient.invalidateQueries({
      queryKey: nlQueryKeys.schema(dataSourceId),
    });

    // Refetch with refresh flag
    return queryClient.fetchQuery({
      queryKey: nlQueryKeys.schema(dataSourceId),
      queryFn: () => fetchDataSourceSchema(dataSourceId, { refresh: true }),
    });
  };
}

// ============================================================================
// Query Execution Hooks
// ============================================================================

interface ExecuteNlQueryVariables {
  query: string;
  dataSourceId: string;
  generatedSql?: string;
}

/**
 * Hook to execute NL queries with optimistic updates
 *
 * Features:
 * - Automatic cache invalidation after execution
 * - Loading state management
 * - Error handling with toast notifications
 */
export function useExecuteNlQuery() {
  const queryClient = useQueryClient();

  return useMutation<NlQueryPipelineResult, Error, ExecuteNlQueryVariables>({
    mutationFn: ({ query, dataSourceId, generatedSql }) =>
      executeNlQuery({ query, dataSourceId, generatedSql }),

    // On success, invalidate related caches
    onSuccess: (data, variables) => {
      // Invalidate query history for this data source
      queryClient.invalidateQueries({
        queryKey: nlQueryKeys.historyForDataSource(variables.dataSourceId),
      });

      // Show success toast if query was successful
      if (data.accessGranted && data.queryResults) {
        const rowText = `${data.queryResults.totalRows} row${data.queryResults.totalRows !== 1 ? "s" : ""}`;
        const timeText = `${data.queryResults.executionTimeMs}ms`;
        toast.success(`Query returned ${rowText} in ${timeText}`);
      }

      // If access was denied, show warning
      if (!data.accessGranted) {
        toast.warning(data.error || "Access denied to some entities in this query");
      }

      // If there was an execution error (but access was granted), show error
      if (data.accessGranted && data.error) {
        toast.error(data.error);
      }
    },

    // On error, show error toast
    onError: (error) => {
      toast.error(`Query execution failed: ${error.message}`);
    },
  });
}

/**
 * Hook to get current query result from cache
 */
export function useQueryResult(queryId: string | null) {
  return useQuery<NlQueryPipelineResult | null, Error>({
    queryKey: nlQueryKeys.result(queryId || ""),
    queryFn: () => Promise.resolve(null),
    enabled: false, // This is only for reading from cache
    staleTime: Infinity,
  });
}

/**
 * Hook to save query result to cache
 */
export function useSaveQueryResult() {
  const queryClient = useQueryClient();

  return (result: NlQueryPipelineResult, queryId: string) => {
    queryClient.setQueryData(nlQueryKeys.result(queryId), result);
  };
}

// ============================================================================
// Query History Hooks
// ============================================================================

/**
 * Hook to fetch query history with pagination
 *
 * Features:
 * - Pagination support
 * - Automatic refetching
 * - Cache deduplication
 */
export function useQueryHistory(
  dataSourceId: string | undefined,
  options?: { limit?: number; offset?: number; enabled?: boolean }
) {
  return useQuery<QueryHistoryEntry[], Error>({
    queryKey: [
      ...nlQueryKeys.historyForDataSource(dataSourceId || ""),
      { limit: options?.limit, offset: options?.offset },
    ],
    queryFn: () => fetchQueryHistory(dataSourceId, options),
    enabled: !!dataSourceId && options?.enabled !== false,
    staleTime: 30 * 1000, // 30 seconds - history can change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/**
 * Hook to invalidate query history cache
 */
export function useInvalidateQueryHistory() {
  const queryClient = useQueryClient();

  return (dataSourceId?: string) => {
    if (dataSourceId) {
      queryClient.invalidateQueries({
        queryKey: nlQueryKeys.historyForDataSource(dataSourceId),
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: nlQueryKeys.history(),
      });
    }
  };
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook that provides all NL Query state in a single call
 * Useful for components that need multiple pieces of state
 */
export function useNlQueryState(dataSourceId: string | undefined) {
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | undefined>(
    dataSourceId
  );
  const queryClient = useQueryClient();

  const dataSourcesQuery = useActiveDataSources();
  const schemaQuery = useDataSourceSchema(selectedDataSourceId);
  const historyQuery = useQueryHistory(selectedDataSourceId, { limit: 20 });
  const executeMutation = useExecuteNlQuery();
  const refreshSchema = useRefreshSchema();
  const invalidateHistory = useInvalidateQueryHistory();

  return {
    // Data sources
    dataSources: dataSourcesQuery.data || [],
    dataSourcesLoading: dataSourcesQuery.isLoading,
    dataSourcesError: dataSourcesQuery.error,
    refetchDataSources: dataSourcesQuery.refetch,

    // Selected data source
    selectedDataSourceId,
    setSelectedDataSourceId,

    // Schema
    schema: schemaQuery.data,
    schemaLoading: schemaQuery.isLoading,
    schemaError: schemaQuery.error,
    refetchSchema: schemaQuery.refetch,
    refreshSchema: () => selectedDataSourceId && refreshSchema(selectedDataSourceId),

    // Query history
    history: historyQuery.data || [],
    historyLoading: historyQuery.isLoading,
    historyError: historyQuery.error,
    refetchHistory: historyQuery.refetch,
    invalidateHistory: () => selectedDataSourceId && invalidateHistory(selectedDataSourceId),

    // Query execution
    executeQuery: executeMutation.mutateAsync,
    isExecuting: executeMutation.isPending,
    executeError: executeMutation.error,

    // Utils
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: nlQueryKeys.all });
    },
  };
}
