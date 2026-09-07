import { useQueries } from "@tanstack/react-query";
import type { ADLevel } from "@/components/admin/ad-window-configs";
import type { FieldMetadata } from "@/hooks/use-entities";
import { useElectric } from "@/providers/electric-provider";
import { getSysCollections, useCollectionRows } from "@/lib/sys-collections";
import { apiClient } from "@/lib/api-client";

interface BusWindowMeta {
  sys_window_id: string;
  name: string;
  description?: string;
}

interface BusTableMeta {
  sys_table_id: string;
  table_name: string;
  name: string;
}

interface WindowMeta {
  label: string;
  windowId?: string;
  windowSlug: string;
}

/**
 * Resolve which window presents an entity, from the window and table lists.
 *
 * Shared by both paths below so the local and HTTP answers cannot drift: only
 * where the two lists come from differs.
 */
function resolveWindowMeta(
  entityName: string,
  windows: BusWindowMeta[],
  tables: BusTableMeta[]
): WindowMeta {
  // Support both simple (account→bus_account) and kebab-case slugs (sales-order→bus_sales_order)
  const tableNameCandidates = [`bus_${entityName}`, `bus_${entityName.replace(/-/g, "_")}`];
  const table = tables.find((t) => tableNameCandidates.includes(t.table_name));
  const windowName = table?.name ?? entityName;
  // Match window by display name or by slug derived from window name
  const win = windows.find(
    (w) =>
      w.name.toLowerCase() === windowName.toLowerCase() ||
      w.name.toLowerCase().replace(/\s+/g, "-") === entityName
  );
  return {
    label: win?.name ?? table?.name ?? entityName,
    windowId: win?.sys_window_id,
    windowSlug: win?.name.toLowerCase().replace(/\s+/g, "-") ?? entityName,
  };
}

/**
 * Builds an ADLevel entirely from Application Dictionary metadata. No field
 * lists or display names are hardcoded.
 *
 * The window and table lists come from the local dictionary collections once
 * they have synced. That matters more than it looks: this hook runs on every
 * business screen, and over HTTP it costs two 500-row fetches each time, before
 * anything can render. Locally it is a live query over rows already in memory,
 * and it recomputes only when the dictionary itself changes.
 *
 * The field lists stay on the API. `/bus/:entity/fields/*` is not a plain
 * dictionary read — it resolves reference targets and their label fields across
 * other entities — and reimplementing that here would risk answering differently
 * from the server for the same entity.
 *
 * entityName: the bus_ entity name without prefix, e.g. 'account', 'contact'
 */
export function useBusEntityLevel(entityName: string) {
  const { isSynced } = useElectric();
  const collections = getSysCollections();
  const local = isSynced && !!collections;

  const localWindows = useCollectionRows<BusWindowMeta>(collections?.windows);
  const localTables = useCollectionRows<BusTableMeta>(collections?.tables);

  const results = useQueries({
    queries: [
      {
        queryKey: ["bus-form-fields", entityName],
        queryFn: () => apiClient.get<FieldMetadata[]>(`/bus/${entityName}/fields/form`),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["bus-grid-fields", entityName],
        queryFn: () => apiClient.get<FieldMetadata[]>(`/bus/${entityName}/fields/grid`),
        staleTime: 5 * 60 * 1000,
      },
      {
        queryKey: ["sys-window-for-entity", entityName],
        queryFn: async () => {
          const resp = await apiClient.get<{ data: BusWindowMeta[] }>("/sys/windows", {
            limit: 500,
          });
          const tableResp = await apiClient.get<{ data: BusTableMeta[] }>("/sys/tables", {
            limit: 500,
          });
          return resolveWindowMeta(entityName, resp.data, tableResp.data);
        },
        staleTime: 5 * 60 * 1000,
        // Skipped entirely while the dictionary is local — the same answer is
        // already in memory.
        enabled: !local,
      },
    ],
  });

  const [formQuery, gridQuery, windowQuery] = results;

  const windowMeta: WindowMeta | undefined = local
    ? resolveWindowMeta(entityName, localWindows, localTables)
    : (windowQuery.data as WindowMeta | undefined);

  const windowLoading = local ? false : windowQuery.isLoading;
  const isLoading = formQuery.isLoading || gridQuery.isLoading || windowLoading;

  const formFields: FieldMetadata[] = (formQuery.data as FieldMetadata[]) ?? [];
  const gridFields: FieldMetadata[] = (gridQuery.data as FieldMetadata[]) ?? [];
  const label = windowMeta?.label ?? entityName;
  const windowSlug = windowMeta?.windowSlug ?? entityName;

  // The record's display value is the dictionary's identifier columns in seq_no
  // order. This picks one column because it is used where a single field is
  // wanted; the first identifier is the right one (`first_name` before
  // `last_name`), and the fallbacks cover a table the dictionary marked none on.
  //
  // A reference identifier is skipped: on a join entity the identifiers are the
  // foreign keys to the records it joins, and those hold uuids. Displaying and
  // searching by one is worse than the fallback, which at least reads as words.
  const NAME_FALLBACKS = ["name", "full_name", "title", "first_name", "code", "description", "type"];
  const nameField =
    formFields
      .filter((f) => f.is_identifier && !f.is_key && !f.ref_table_name)
      .sort((a, b) => Number(a.seq_no ?? 0) - Number(b.seq_no ?? 0))[0]
      ?.column_name ??
    NAME_FALLBACKS.find((candidate) => formFields.some((f) => f.column_name === candidate)) ??
    "name";

  const level: ADLevel | null = isLoading
    ? null
    : {
        id: entityName,
        label,
        endpoint: `/bus/${entityName}`,
        idField: "id",
        nameField,
        searchField: nameField,
        formFields,
        gridFields,
        // Route path derived from Window name in Application Dictionary (kebab-case slug)
        baseRoutePath: `/${windowSlug}`,
      };

  return { level, isLoading };
}
