/**
 * Metadata Queries Hooks
 *
 * React Query queries for fetching entity and field metadata.
 */

import { useQuery } from "@tanstack/react-query";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
  };
}

/**
 * Fetch entity list with filters and pagination
 */
export function useEntityList(params: {
  data_source_id?: string;
  is_active?: boolean;
  is_hidden?: boolean;
  include_hidden?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params.data_source_id) queryParams.set("data_source_id", params.data_source_id);
  if (params.is_active !== undefined) queryParams.set("is_active", String(params.is_active));
  if (params.is_hidden !== undefined) queryParams.set("is_hidden", String(params.is_hidden));
  if (params.include_hidden) queryParams.set("include_hidden", "true");
  if (params.search) queryParams.set("search", params.search);
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));

  return useQuery({
    queryKey: ["metadata-entities", params],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/entities?${queryParams.toString()}`);

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch entities");
      }

      return response.json() as Promise<
        ApiResponse<{
          entities: any[];
          total: number;
          page: number;
          limit: number;
        }>
      >;
    },
  });
}

/**
 * Fetch single entity with fields
 */
export function useEntity(entityId: string) {
  return useQuery({
    queryKey: ["metadata-entity", entityId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/entities/${entityId}`);

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch entity");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    enabled: !!entityId,
  });
}

/**
 * Fetch entity fields
 */
export function useEntityFields(entityId: string) {
  return useQuery({
    queryKey: ["entity-fields", entityId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/entities/${entityId}/fields`);

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch entity fields");
      }

      return response.json() as Promise<ApiResponse<any[]>>;
    },
    enabled: !!entityId,
  });
}

/**
 * Fetch entity permissions summary
 */
export function useEntityPermissions(entityId: string) {
  return useQuery({
    queryKey: ["entity-permissions", entityId],
    queryFn: async () => {
      const response = await fetch(`/api/metadata/entities/${entityId}/permissions`);

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch entity permissions");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    enabled: !!entityId,
  });
}

/**
 * Fetch datasource config
 */
export function useDatasourceConfig(dataSourceId: string) {
  return useQuery({
    queryKey: ["datasource-config", dataSourceId],
    queryFn: async () => {
      const response = await fetch(`/api/data-sources/${dataSourceId}/config`);

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch datasource config");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    enabled: !!dataSourceId,
  });
}

/**
 * Fetch entities for datasource (for CRUD interface)
 */
export function useDatasourceEntities(
  dataSourceId: string,
  options?: { includeFields?: boolean; activeOnly?: boolean }
) {
  const queryParams = new URLSearchParams();
  if (options?.includeFields) queryParams.set("include_fields", "true");
  if (options?.activeOnly !== false) queryParams.set("active_only", "true");

  return useQuery({
    queryKey: ["datasource-entities", dataSourceId, options],
    queryFn: async () => {
      const response = await fetch(
        `/api/data-sources/${dataSourceId}/entities?${queryParams.toString()}`
      );

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch datasource entities");
      }

      return response.json() as Promise<
        ApiResponse<{
          entities: any[];
          total: number;
        }>
      >;
    },
    enabled: !!dataSourceId,
  });
}

/**
 * Fetch entity records with pagination (for CRUD)
 */
export function useEntityRecords(
  dataSourceId: string,
  entityId: string,
  params: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: "asc" | "desc";
  }
) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.limit) queryParams.set("limit", String(params.limit));
  if (params.search) queryParams.set("search", params.search);
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.order) queryParams.set("order", params.order);

  return useQuery({
    queryKey: ["entity-records", dataSourceId, entityId, params],
    queryFn: async () => {
      const response = await fetch(
        `/api/data-sources/${dataSourceId}/entities/${entityId}/records?${queryParams.toString()}`
      );

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to fetch entity records");
      }

      return response.json() as Promise<
        ApiResponse<{
          records: any[];
          total: number;
          pageCount: number;
          page: number;
          limit: number;
        }>
      >;
    },
    enabled: !!dataSourceId && !!entityId,
  });
}
