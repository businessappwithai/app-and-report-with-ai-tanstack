/**
 * Application Dictionary hooks — local-first.
 *
 * These are the hooks every screen uses to ask what a window looks like. When
 * the dictionary has finished syncing they answer from the local TanStack DB
 * collections: no request, no loading state, and no waterfall. Until then — and
 * in a deployment with sync switched off — the same hooks fetch over HTTP, so a
 * screen renders correctly either way and never waits on the initial sync.
 *
 * The joins below are plain array work. The whole dictionary is a few hundred
 * rows already in memory, so resolving one is far cheaper than the round-trip it
 * replaces, and keeping it in ordinary TypeScript means the local answer is
 * visibly the same shape as the HTTP one.
 *
 * Reads are local; writes are not. Every mutation goes to the API so the server
 * stays the single authority, and the edit comes back down the shape stream.
 *
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useElectric } from '@/providers/electric-provider';
import { getSysCollections, useCollectionRows } from '@/lib/sys-collections';
import { apiClient, type PaginatedResponse } from '@/lib/api-client';
import type {
  FieldMetadata,
  ColumnMetadata,
  SysTable,
  SysReference,
  SysTab,
} from './use-field-metadata';

/**
 * Whether the local dictionary should answer this render.
 *
 * Both collections and hooks call this so a screen can never end up reading
 * half locally and half over HTTP.
 */
function useLocalDictionary() {
  const { isSynced } = useElectric();
  const collections = getSysCollections();
  return { collections, local: isSynced && !!collections };
}

/* -------------------------------------------------------------------------- */
/*  sys_table                                                                  */
/* -------------------------------------------------------------------------- */

/** Resolve a dictionary table entry by its physical table name. */
export function useSysTable(tableName: string) {
  const { collections, local } = useLocalDictionary();
  const tables = useCollectionRows<SysTable>(collections?.tables);

  const remote = useQuery<SysTable | undefined>({
    queryKey: ['sys', 'table', tableName],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<SysTable>>(
        `/sys/tables?name=${encodeURIComponent(tableName)}`
      );
      return res.data?.[0];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tableName && !local,
  });

  if (local) {
    return {
      data: tables.find((t) => t.table_name === tableName),
      isLoading: false,
    };
  }
  return { data: remote.data, isLoading: remote.isLoading };
}

/* -------------------------------------------------------------------------- */
/*  sys_column                                                                 */
/* -------------------------------------------------------------------------- */

/** Every column of a table, in dictionary order. */
export function useSysColumns(tableName: string) {
  const { collections, local } = useLocalDictionary();
  const tables = useCollectionRows<SysTable>(collections?.tables);
  const columns = useCollectionRows<ColumnMetadata>(collections?.columns);

  const remote = useQuery<ColumnMetadata[]>({
    queryKey: ['sys', 'columns', tableName],
    queryFn: async () => {
      const tableRes = await apiClient.get<PaginatedResponse<SysTable>>(
        `/sys/tables?name=${encodeURIComponent(tableName)}`
      );
      const tableId = tableRes.data?.[0]?.sys_table_id;
      if (!tableId) return [];

      const colRes = await apiClient.get<PaginatedResponse<ColumnMetadata>>(
        `/sys/columns?table_id=${tableId}`
      );
      return colRes.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tableName && !local,
  });

  if (local) {
    const tableId = tables.find((t) => t.table_name === tableName)?.sys_table_id;
    const data = tableId
      ? columns.filter((c) => c.sys_table_id === tableId).sort((a, b) => a.seq_no - b.seq_no)
      : [];
    return { data, isLoading: false };
  }
  return { data: remote.data ?? [], isLoading: remote.isLoading };
}

/* -------------------------------------------------------------------------- */
/*  sys_field                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The fields of a table's window, in display order.
 *
 * Walks field → tab → table, which is the join the HTTP path pays two
 * sequential round-trips for.
 */
export function useSysFields(tableName: string) {
  const { collections, local } = useLocalDictionary();
  const tables = useCollectionRows<SysTable>(collections?.tables);
  const tabs = useCollectionRows<SysTab>(collections?.tabs);
  const fields = useCollectionRows<FieldMetadata>(collections?.fields);

  const remote = useQuery<FieldMetadata[]>({
    queryKey: ['sys', 'fields', tableName],
    queryFn: async () => {
      const tableRes = await apiClient.get<PaginatedResponse<SysTable>>(
        `/sys/tables?name=${encodeURIComponent(tableName)}`
      );
      const tableId = tableRes.data?.[0]?.sys_table_id;
      if (!tableId) return [];

      const fieldRes = await apiClient.get<PaginatedResponse<FieldMetadata>>(
        `/sys/fields?table_id=${tableId}`
      );
      return fieldRes.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tableName && !local,
  });

  if (local) {
    const tableId = tables.find((t) => t.table_name === tableName)?.sys_table_id;
    const tabIds = new Set(
      tabs.filter((tb) => tb.sys_table_id === tableId).map((tb) => tb.sys_tab_id)
    );
    const data = tableId
      ? fields.filter((f) => tabIds.has(f.sys_tab_id)).sort((a, b) => a.seq_no - b.seq_no)
      : [];
    return { data, isLoading: false };
  }
  return { data: remote.data ?? [], isLoading: remote.isLoading };
}

/* -------------------------------------------------------------------------- */
/*  sys_reference                                                              */
/* -------------------------------------------------------------------------- */

/** The shared type vocabulary. Small, unscoped, and read by every form. */
export function useSysReferences() {
  const { collections, local } = useLocalDictionary();
  const references = useCollectionRows<SysReference>(collections?.references);

  const remote = useQuery<SysReference[]>({
    queryKey: ['sys', 'references'],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResponse<SysReference>>('/sys/references');
      return res.data ?? [];
    },
    staleTime: 30 * 60 * 1000,
    enabled: !local,
  });

  if (local) {
    return {
      data: [...references].sort((a, b) => a.name.localeCompare(b.name)),
      isLoading: false,
    };
  }
  return { data: remote.data ?? [], isLoading: remote.isLoading };
}

/* -------------------------------------------------------------------------- */
/*  Mutations — always server-authoritative                                    */
/* -------------------------------------------------------------------------- */

export function useUpdateFieldOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, newSeqNo }: { fieldId: string; newSeqNo: number }) =>
      apiClient.patch<FieldMetadata>(`/sys/fields/${fieldId}`, { seq_no: newSeqNo }),
    onSuccess: () => {
      // The shape stream carries the change back into the collection on its
      // own; this only refreshes the HTTP fallback's cache.
      queryClient.invalidateQueries({ queryKey: ['sys', 'fields'] });
    },
  });
}

export function useToggleFieldVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, isDisplayed }: { fieldId: string; isDisplayed: boolean }) =>
      apiClient.patch<FieldMetadata>(`/sys/fields/${fieldId}`, { is_displayed: isDisplayed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sys', 'fields'] });
    },
  });
}
