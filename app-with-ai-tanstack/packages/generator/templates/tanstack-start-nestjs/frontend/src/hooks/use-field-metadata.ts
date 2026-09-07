/**
 * Field Metadata Hooks
 *
 * TanStack Query hooks for fetching and managing field metadata
 * from the Application Dictionary (sys_field, sys_column).
 *
 * Enables runtime UI layout customization by fetching field
 * ordering and display settings from the backend.
 *
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, PaginatedResponse } from '@/lib/api-client';

export interface FieldMetadata {
  sys_field_id: string;
  sys_column_id: string;
  /** Owning tab — the join key the local dictionary queries walk. */
  sys_tab_id: string;
  name: string;
  seq_no: number;
  seq_no_grid: number;
  is_displayed: boolean;
  is_displayed_grid: boolean;
  is_read_only: boolean;
  is_mandatory: boolean;
  column_name: string;
  reference_id: number;
}

export interface ColumnMetadata {
  sys_column_id: string;
  sys_table_id: string;
  column_name: string;
  name: string;
  sys_reference_id: number;
  is_key: boolean;
  is_mandatory: boolean;
  seq_no: number;
}

export interface SysTable {
  sys_table_id: string;
  table_name: string;
  name: string;
}

export interface SysReference {
  sys_reference_id: number;
  name: string;
  description: string;
}

export interface SysWindow {
  sys_window_id: string;
  name: string;
  description: string;
}

/**
 * A tab binds one window to one table. Walking window → tab → field is how a
 * screen's layout is resolved without asking the server for it.
 */
export interface SysTab {
  sys_tab_id: string;
  sys_window_id: string;
  sys_table_id: string;
  name: string;
  seq_no: number;
}

/**
 * Fetch field metadata for a specific table
 */
export function useFieldMetadata(tableName: string) {
  return useQuery({
    queryKey: ['sys', 'fields', tableName],
    queryFn: async () => {
      // First get the table ID
      const tableRes = await apiClient.get<PaginatedResponse<SysTable>>(
        `/sys/tables?name=${tableName}`
      );
      const table = tableRes.data?.[0];
      if (!table?.sys_table_id) {
        return [];
      }

      // Then get the columns for this table
      const columnsRes = await apiClient.get<PaginatedResponse<ColumnMetadata>>(
        `/sys/columns?table_id=${table.sys_table_id}`
      );
      return columnsRes.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch all columns for a table by table ID
 */
export function useTableColumns(tableId: string) {
  return useQuery({
    queryKey: ['sys', 'columns', tableId],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<ColumnMetadata>>(
        `/sys/columns?table_id=${tableId}`
      );
      return response.data;
    },
    enabled: !!tableId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Update field sequence order (for drag-and-drop reordering)
 */
export function useUpdateFieldOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, newSeqNo }: { fieldId: string; newSeqNo: number }) => {
      return apiClient.patch<FieldMetadata>(`/sys/fields/${fieldId}`, {
        seq_no: newSeqNo,
      });
    },
    onSuccess: () => {
      // Invalidate field queries to refetch with new order
      queryClient.invalidateQueries({ queryKey: ['sys', 'fields'] });
    },
  });
}

/**
 * Toggle field visibility
 */
export function useToggleFieldVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, isDisplayed }: { fieldId: string; isDisplayed: boolean }) => {
      return apiClient.patch<FieldMetadata>(`/sys/fields/${fieldId}`, {
        is_displayed: isDisplayed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sys', 'fields'] });
    },
  });
}

/**
 * Fetch all reference types
 */
export function useReferenceTypes() {
  return useQuery({
    queryKey: ['sys', 'references'],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<SysReference>>(
        '/sys/references'
      );
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - reference types rarely change
  });
}
