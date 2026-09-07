/**
 * Metadata Mutations Hooks
 *
 * React Query mutations for entity and field metadata operations.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message?: string;
  };
}

/**
 * Update entity metadata
 */
export function useUpdateEntityMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      data,
    }: {
      entityId: string;
      data: {
        description?: string;
        is_active?: boolean;
        is_hidden?: boolean;
      };
    }) => {
      const response = await fetch(`/api/metadata/entities/${entityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to update entity metadata");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: (_data, variables) => {
      toast.success("Entity metadata updated successfully");

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["metadata-entity", variables.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["metadata-entities"],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update entity metadata");
    },
  });
}

/**
 * Update single field metadata
 */
export function useUpdateFieldMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      fieldId,
      data,
    }: {
      entityId: string;
      fieldId: string;
      data: {
        description?: string;
        is_display_field?: boolean;
        is_searchable?: boolean;
        display_order?: number;
        relationship_ui_type?: "dropdown" | "popup" | null;
      };
    }) => {
      const response = await fetch(`/api/metadata/entities/${entityId}/fields/${fieldId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to update field metadata");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: (_data, variables) => {
      toast.success("Field metadata updated successfully");

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["metadata-entity", variables.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["entity-fields", variables.entityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update field metadata");
    },
  });
}

/**
 * Batch update field metadata
 */
export function useBatchUpdateFieldMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityId,
      updates,
    }: {
      entityId: string;
      updates: Array<{
        id: string;
        data: {
          description?: string;
          is_display_field?: boolean;
          is_searchable?: boolean;
          display_order?: number;
          relationship_ui_type?: "dropdown" | "popup" | null;
        };
      }>;
    }) => {
      const response = await fetch(`/api/metadata/entities/${entityId}/fields/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to batch update field metadata");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: (_data, variables) => {
      toast.success(`${variables.updates.length} field(s) updated successfully`);

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["metadata-entity", variables.entityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["entity-fields", variables.entityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to batch update field metadata");
    },
  });
}

/**
 * Trigger datasource sync
 */
export function useSyncDatasource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dataSourceId }: { dataSourceId: string }) => {
      const response = await fetch("/api/metadata/entities/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceId }),
      });

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to sync datasource");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: (data) => {
      const syncData = data.data;
      const totalChanges =
        (syncData?.entitiesCreated || 0) +
        (syncData?.entitiesUpdated || 0) +
        (syncData?.fieldsCreated || 0) +
        (syncData?.fieldsUpdated || 0);

      toast.success(`Datasource synced successfully: ${totalChanges} change(s) made`);

      // Invalidate all metadata queries
      queryClient.invalidateQueries({
        queryKey: ["metadata-entities"],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sync datasource");
    },
  });
}

/**
 * Update datasource config (is_editable flag)
 */
export function useUpdateDatasourceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dataSourceId,
      is_editable,
    }: {
      dataSourceId: string;
      is_editable: boolean;
    }) => {
      const response = await fetch(`/api/data-sources/${dataSourceId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_editable }),
      });

      if (!response.ok) {
        const error: ApiResponse<never> = await response.json();
        throw new Error(error.error?.message || "Failed to update datasource config");
      }

      return response.json() as Promise<ApiResponse<any>>;
    },
    onSuccess: (_data, variables) => {
      toast.success(`Datasource is now ${variables.is_editable ? "editable" : "read-only"}`);

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ["datasource", variables.dataSourceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["datasources"],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update datasource config");
    },
  });
}
