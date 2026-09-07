/**
 * Application Dictionary — TanStack DB collections synced by ElectricSQL.
 *
 * Every dictionary read in this app goes through one of the collections below.
 * A collection is populated once, by an Electric shape stream through the
 * backend's role-scoped proxy, and then lives in memory: reads are synchronous
 * lookups against local state, and `useLiveQuery` recomputes only the rows a
 * change actually touched. There is no per-screen fetch and no request waterfall
 * — opening a window costs nothing over the network.
 *
 * Scoping is the server's decision. The proxy derives the caller's roles from
 * the session and filters each shape before it streams, so what arrives here is
 * already only the part of the dictionary this user may see. The client never
 * says who it is.
 *
 * Collections are created lazily, after a session exists, because the shape
 * request must carry the session cookie to be scoped at all. `resetSysCollections()`
 * drops them on logout so the next user does not read the previous user's rows.
 *
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { createCollection } from '@tanstack/react-db';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import type { Row } from '@electric-sql/client';
import type {
  FieldMetadata,
  ColumnMetadata,
  SysTable,
  SysReference,
  SysTab,
  SysWindow,
} from '@/hooks/use-field-metadata';

/**
 * Where shape requests go. This is the backend proxy, never the Electric server
 * itself — pointing it at Electric directly would hand clients an unfiltered
 * dictionary.
 */
export const SHAPE_URL: string =
  import.meta.env.VITE_ELECTRIC_PROXY_URL ||
  `${import.meta.env.VITE_API_URL || '/api'}/v1/shape`;

/**
 * Sync is optional. With it switched off the dictionary hooks fall back to the
 * HTTP API, which is slower but correct, so a deployment without an Electric
 * server still runs.
 */
export const SYNC_ENABLED: boolean =
  String(import.meta.env.VITE_ELECTRIC_SYNC ?? 'true') !== 'false';

/**
 * The parts of a collection this module uses.
 *
 * Structural rather than `Collection<...>`: the concrete type is parameterised
 * six ways and differs per row type, so naming it here would mean threading
 * those parameters through every helper for no added safety.
 */
interface ManagedCollection {
  readonly toArray: readonly unknown[];
  subscribeChanges(callback: (changes: never) => void): { unsubscribe(): void };
  preload(): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * A dictionary row as it arrives off the shape stream.
 *
 * Electric's collections are keyed by an index signature — rows come off the
 * wire as untyped columns. Intersecting the declared interface with `Row` keeps
 * the named fields typed for callers while satisfying that constraint.
 */
type Dict<T> = T & Row;

function dictionaryCollection<T extends Row>(table: string, getKey: (row: T) => string | number) {
  return createCollection(
    electricCollectionOptions<T>({
      id: `dictionary:${table}`,
      shapeOptions: {
        url: SHAPE_URL,
        params: { table },
        // The session cookie is what the proxy reads to decide this caller's
        // roles, so the shape request has to be credentialed. Asserted to
        // `typeof fetch` because the DOM type carries static members this
        // wrapper does not need to reimplement.
        fetchClient: ((input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, credentials: 'include' })) as typeof fetch,
      },
      getKey,
    })
  );
}

/* -------------------------------------------------------------------------- */
/*  Collections                                                                */
/* -------------------------------------------------------------------------- */

export interface SysCollections {
  windows: ReturnType<typeof dictionaryCollection<Dict<SysWindow>>>;
  tables: ReturnType<typeof dictionaryCollection<Dict<SysTable>>>;
  tabs: ReturnType<typeof dictionaryCollection<Dict<SysTab>>>;
  columns: ReturnType<typeof dictionaryCollection<Dict<ColumnMetadata>>>;
  fields: ReturnType<typeof dictionaryCollection<Dict<FieldMetadata>>>;
  references: ReturnType<typeof dictionaryCollection<Dict<SysReference>>>;
}

let _collections: SysCollections | null = null;

/**
 * The dictionary collections for the current session, created on first use.
 *
 * Returns null when sync is disabled — callers read that as "use the HTTP
 * fallback" rather than as an error.
 */
export function getSysCollections(): SysCollections | null {
  if (!SYNC_ENABLED) return null;
  if (_collections) return _collections;

  _collections = {
    windows: dictionaryCollection<Dict<SysWindow>>('sys_window', (r) => r.sys_window_id),
    tables: dictionaryCollection<Dict<SysTable>>('sys_table', (r) => r.sys_table_id),
    tabs: dictionaryCollection<Dict<SysTab>>('sys_tab', (r) => r.sys_tab_id),
    columns: dictionaryCollection<Dict<ColumnMetadata>>('sys_column', (r) => r.sys_column_id),
    fields: dictionaryCollection<Dict<FieldMetadata>>('sys_field', (r) => r.sys_field_id),
    references: dictionaryCollection<Dict<SysReference>>('sys_reference', (r) => r.sys_reference_id),
  };

  return _collections;
}

/**
 * Drop every collection and its shape subscription.
 *
 * Called on logout and on any role change. The rows in a collection were
 * filtered for one specific session; keeping them across a sign-in would show
 * the next user a dictionary they may not be entitled to.
 */
export function resetSysCollections(): void {
  if (!_collections) return;
  for (const collection of Object.values(_collections) as unknown as ManagedCollection[]) {
    void collection.cleanup();
  }
  _collections = null;
}

/**
 * Resolve once every collection has completed its first sync.
 *
 * Used to decide whether a screen reads locally or over HTTP — not to block
 * rendering, which stays on the HTTP path until this resolves.
 */
export async function whenSysCollectionsReady(): Promise<boolean> {
  const collections = getSysCollections();
  if (!collections) return false;

  await Promise.all(
    (Object.values(collections) as unknown as ManagedCollection[]).map((c) => c.preload())
  );
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Reading a collection from React                                            */
/* -------------------------------------------------------------------------- */

const EMPTY: readonly never[] = [];

/**
 * Subscribe a component to one collection's rows.
 *
 * Deliberately not `useLiveQuery`. This app is server-rendered, and that hook
 * calls `useSyncExternalStore` without a `getServerSnapshot`, so every screen
 * reading the dictionary would warn and drop its subtree back to client
 * rendering. Here the server snapshot is simply an empty list — the dictionary
 * is a client-side cache, the server has nothing synced to report, and the
 * screens already render from the HTTP fallback until sync completes.
 *
 * The snapshot is cached in a ref because `useSyncExternalStore` compares
 * snapshots by identity: rebuilding the array on every read would look like a
 * change on every render and loop.
 */
export function useCollectionRows<T>(collection: unknown): T[] {
  // Widened at the boundary rather than at each of the dozen call sites: the
  // concrete collection type is parameterised six ways and differs per row
  // type, and only these four members are ever touched.
  const managed = collection as ManagedCollection | null | undefined;
  const cache = useRef<readonly unknown[]>(EMPTY);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!managed) return () => {};
      cache.current = managed.toArray;
      const subscription = managed.subscribeChanges(() => {
        cache.current = managed.toArray;
        onChange();
      });
      return () => subscription.unsubscribe();
    },
    [managed]
  );

  const getSnapshot = useCallback(() => {
    if (!managed) return EMPTY;
    return cache.current;
  }, [managed]);

  const getServerSnapshot = useCallback(() => EMPTY, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as T[];
}
