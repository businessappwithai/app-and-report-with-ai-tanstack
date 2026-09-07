# Enhancement: TanStack DB Integration for Reactive Local State

## Document Information
- **Title**: TanStack DB Integration — Reactive Client-Side Data Layer
- **Date**: 2026-05-11
- **Status**: Proposal
- **Version**: 1.0

## Executive Summary

This enhancement proposes integrating **TanStack DB** as a reactive, local-first client-side data layer alongside the existing TanStack Start server stack. TanStack DB acts as a sync engine and local cache — not a replacement for PostgreSQL/SQLite — enabling optimistic updates, offline-capable interactions, and reactive re-renders without full round-trips to the server.

For this enterprise reporting application the most impactful areas are:

1. **Realtime dashboards** — widgets react instantly to filter changes without re-fetching from the server
2. **Optimistic chart/report edits** — changes are reflected immediately in the editor UI; server persistence happens in the background
3. **Cross-filter coordination** — the existing `CrossFilterProvider` can be backed by a TanStack DB collection instead of React context, giving any component direct `useLiveQuery` access
4. **Collaborative/multi-tab coherence** — multiple browser tabs or users see a consistent view via sync

---

## Current Architecture

```
Browser UI (React)
   ↓ fetch / server functions
TanStack Start (server routes, loaders, createServerFn)
   ↓ Kysely
SQLite (bun:sqlite) / PostgreSQL
```

State today lives in:
- **TanStack Query** — async server state, cached per query key
- **React context** — cross-filter state (`CrossFilterProvider`), dashboard state (`DashboardState`)
- **Component state** — ephemeral UI state (chart editor, widget config)

Pain points with the current model:
| Problem | Root cause |
|---------|-----------|
| Dashboard filter changes trigger multiple network round-trips | Each widget re-fetches independently via TanStack Query |
| Chart editor shows stale preview until save | No optimistic local mutation layer |
| `CrossFilterProvider` is prop-drilled / context-coupled | No reactive query layer decoupled from the component tree |
| No offline support | All state requires live server connection |

---

## Proposed Architecture with TanStack DB

```
Browser UI (React)
   ↓  useLiveQuery()
TanStack DB (local reactive collections)
   ↓  sync / mutations
TanStack Start server functions / API routes
   ↓  Kysely
SQLite / PostgreSQL
```

TanStack DB sits between React components and the network. Components subscribe to **live queries** over local collections; mutations write locally first, then sync to the server.

### Key concepts

| Concept | Description |
|---------|-------------|
| `Collection` | In-memory reactive table (e.g. `dashboards`, `charts`, `filters`) |
| `useLiveQuery` | React hook that re-renders whenever the query result changes |
| Optimistic mutation | Write to local collection immediately; roll back on server error |
| Sync adapter | Pluggable layer connecting local collection to a backend (server function, REST, WebSocket) |

---

## Integration Points in This Codebase

### 1. Dashboard Widgets and Cross-Filtering

**Current state** (`src/components/dashboard/CrossFilterProvider.tsx`):
- Filters stored in React context
- Each widget subscribes via `useCrossFilter()` hook
- Widget re-renders are coordinated through context propagation

**With TanStack DB:**

```typescript
// src/lib/tanstack-db/collections.ts
import { createCollection } from '@tanstack/db'

export const activeFiltersCollection = createCollection({
  id: 'active-filters',
  schema: z.object({
    id: z.string(),
    widgetId: z.string(),
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  }),
})
```

```typescript
// Any component — no prop drilling needed
import { useLiveQuery } from '@tanstack/db'
import { activeFiltersCollection } from '@/lib/tanstack-db/collections'

function WidgetRenderer({ widgetId }: { widgetId: string }) {
  const filters = useLiveQuery(() =>
    activeFiltersCollection.filter(f => f.widgetId === widgetId)
  )
  // re-renders automatically when any matching filter changes
}
```

**Benefits:**
- `CrossFilterProvider` context wrapper can be removed or thinned to just initialise the collection
- Any component anywhere in the tree can subscribe without needing the context chain
- Filter mutations (add, remove, clear) update all subscribers in one tick

---

### 2. Chart Editor — Optimistic Preview

**Current state** (`src/components/charts/editor/chart-preview-panel.tsx`):
- Preview re-fetches data on every config change
- User sees a loading spinner between edits

**With TanStack DB:**

```typescript
// src/lib/tanstack-db/collections.ts
export const chartDraftCollection = createCollection({
  id: 'chart-drafts',
  schema: chartConfigSchema,
})

// editor component
const [draft] = useLiveQuery(() =>
  chartDraftCollection.find(chartId)
)

async function updateDraftField(key: string, value: unknown) {
  // Immediately reflected in preview — no server round-trip
  await chartDraftCollection.update(chartId, { [key]: value })
}

async function saveChart() {
  // Persist to server only on explicit save
  await persistChart({ data: draft })
}
```

**Benefits:**
- Preview panel (`chart-preview-panel.tsx`) reacts to live draft, not to a save event
- `chart-appearance.tsx`, `chart-axis-config.tsx`, `chart-basic-info.tsx` all write to the same draft collection — no inter-component prop passing needed

---

### 3. Dashboard State

**Current state** (`src/components/dashboard/DashboardState.tsx`):
- Layout, widget config, and active selections held in component state
- Navigating away and back resets state

**With TanStack DB:**

```typescript
export const dashboardStateCollection = createCollection({
  id: 'dashboard-state',
  schema: z.object({
    dashboardId: z.string(),
    layout: z.array(widgetLayoutSchema),
    activeWidgetId: z.string().optional(),
    editMode: z.boolean(),
  }),
})
```

- State persists across route changes (survives navigation within the SPA)
- Multiple dashboards can have independent state entries
- `useLiveQuery` replaces `useState` for layout and widget tracking

---

### 4. SQL Editor — Query History and Saved Drafts

**Current state**: Executed query results are held transiently; history is fetched from server.

**With TanStack DB:**

```typescript
export const queryHistoryCollection = createCollection({
  id: 'query-history',
  schema: z.object({
    id: z.string(),
    sql: z.string(),
    executedAt: z.string(),
    rowCount: z.number(),
    durationMs: z.number(),
  }),
})
```

- Query history available instantly (no loading state after first sync)
- Works offline — user can review past queries without network
- Sync to `saved_queries` table in the background

---

### 5. Report List — Instant Search and Filtering

**Current state** (`src/components/datasets/DatasetManager.tsx` and reports list):
- Server-side filtered list, re-fetched on each search keystroke (debounced)

**With TanStack DB:**

```typescript
export const reportsCollection = createCollection({
  id: 'reports',
  schema: reportSchema,
})

// Component
const [search, setSearch] = useState('')
const reports = useLiveQuery(() =>
  reportsCollection
    .filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    .sortBy('updatedAt', 'desc')
    .limit(50)
)
```

- Search is instantaneous (client-side over synced collection)
- No debounce or loading spinner needed for search
- Server sync runs in the background on initial load and on mutations

---

## Sync Strategy

TanStack DB requires a sync adapter to connect local collections to the backend. The recommended approach for this stack:

```
Collection mutation
   → optimistic local write
   → call createServerFn (TanStack Start)
   → on success: confirm local write
   → on error: roll back local write + show toast
```

### Sync adapter skeleton

```typescript
// src/lib/tanstack-db/sync-adapter.ts
import { createSyncAdapter } from '@tanstack/db'
import { listReports, createReport, updateReport } from '@/server-fns/reports'

export const reportsSyncAdapter = createSyncAdapter({
  async load() {
    return listReports({ page: 0, pageSize: 1000 })
  },
  async create(item) {
    return createReport({ data: item })
  },
  async update(id, patch) {
    return updateReport({ id, data: patch })
  },
  async delete(id) {
    return deleteReport({ id })
  },
})
```

This keeps TanStack Start server functions as the authoritative API surface — no new REST routes needed.

---

## TanStack DB vs TanStack Query — When to Use Which

Both will coexist in the codebase. The rule of thumb:

| Scenario | Use |
|----------|-----|
| One-off data fetch (e.g. load a single report by ID) | TanStack Query |
| Paginated server-side tables | TanStack Query (server-side pagination stays) |
| Collections that benefit from instant reactivity across components | TanStack DB |
| Optimistic mutations with rollback | TanStack DB |
| Background sync of frequently-changed data | TanStack DB |
| External API calls (OpenAI, export jobs) | TanStack Query |

**Critical rule: server-side pagination must remain for all data table views.** TanStack DB local collections are for reactive UI state and moderate-sized working sets (hundreds to low thousands of rows), not for replacing `MAX_PAGE_SIZE=1000` server queries on large tables.

---

## Implementation Roadmap

### Phase 1 — Foundation (low risk)
- Install `@tanstack/db` package
- Create `src/lib/tanstack-db/collections.ts` with collection definitions
- Create `src/lib/tanstack-db/sync-adapter.ts` with server function adapters
- Wrap app root with `TanStackDBProvider` in `src/routes/__root.tsx`

### Phase 2 — Cross-filter refactor (medium risk)
- Replace `CrossFilterProvider` context state with `activeFiltersCollection`
- Keep the `useCrossFilter()` hook API intact (just change its internals to `useLiveQuery`)
- Migrate `ActiveFiltersBar.tsx` and `DashboardState.tsx` to live queries

### Phase 3 — Chart editor (medium risk)
- Introduce `chartDraftCollection` for editor state
- Connect `chart-preview-panel.tsx` to live draft
- Decouple editor tabs (`chart-appearance`, `chart-axis-config`, etc.) from prop callbacks

### Phase 4 — Report and dataset lists (low risk)
- Sync reports/charts/dashboards lists into local collections
- Enable client-side instant search
- Keep server-side pagination for detail/data views

### Phase 5 — SQL editor history (low risk)
- Persist query history to `queryHistoryCollection`
- Sync to `saved_queries` on demand

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| TanStack DB is still experimental | Limit Phase 1–2 to non-critical UI state; keep TanStack Query for all data-critical paths |
| Local collection grows too large | Apply `maxSize` config on collections; always paginate data tables server-side |
| Optimistic updates show wrong data on error | Implement rollback handler + toast notification in sync adapter |
| Multi-user sync conflicts | For Phase 1–3 scope, last-write-wins is acceptable; collaborative locking is a future concern |
| Bundle size increase | TanStack DB is lightweight (~20kb); acceptable given existing Recharts/ECharts payload |

---

## Dependencies

```json
{
  "@tanstack/db": "^0.6.0"
}
```

Install:
```bash
bun add @tanstack/db
```

No additional backend dependencies — existing `createServerFn` server functions serve as the sync backend.

---

## Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Dashboard filter change latency (UI update) | ~300ms (network round-trip) | <16ms (local collection) |
| Chart editor preview update on config change | ~400ms (fetch + render) | <50ms (live draft) |
| Report list search latency | ~150ms (debounced server fetch) | <5ms (client-side) |
| Cross-filter subscriber re-renders | Context propagation cascade | Single `useLiveQuery` subscription per widget |

---

## References

- [TanStack DB Documentation](https://tanstack.com/db/latest)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- `src/components/dashboard/CrossFilterProvider.tsx` — existing cross-filter implementation
- `src/components/dashboard/DashboardState.tsx` — existing dashboard state
- `src/components/charts/editor/chart-preview-panel.tsx` — chart editor preview
- `src/lib/config/pagination.ts` — server-side pagination config (must be preserved)
