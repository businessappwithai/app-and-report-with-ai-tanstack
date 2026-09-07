# Implementation Plan: TanStack DB Integration

**Status**: Planning Phase  
**Created**: 2026-05-13  
**Scope**: Phase 1 Foundation + Optional Phase 2  

---

## Overview

This document outlines the specific implementation steps for integrating TanStack DB into the reporting system, based on the Enhancement proposal.

### Key Decision Points

1. **Which phases to implement?** (Select 1 or more)
   - [x] **Phase 1: Foundation** — Install packages, create collection schemas, wrap app with provider
   - [ ] **Phase 2: Cross-filter refactor** — Migrate `CrossFilterProvider` context to TanStack DB
   - [ ] **Phase 3: Chart editor** — Optimistic draft edits with live preview
   - [ ] **Phase 4: Report/dataset lists** — Instant client-side search on synced collections
   - [ ] **Phase 5: SQL editor history** — Query history persistence

2. **Risk tolerance**: Phases 1–2 are lower risk (UI state only). Phases 3–5 are medium risk (require refactoring existing components).

---

## Phase 1: Foundation (Recommended First)

**Effort**: ~2–3 hours  
**Risk**: Low  
**Deliverables**: Package installed, collections schema, sync adapter skeleton, provider wired in

### Steps

#### 1.1 Install Package
```bash
bun add @tanstack/db
```

#### 1.2 Create Collection Definitions
**File**: `src/lib/tanstack-db/collections.ts`

```typescript
import { createCollection } from '@tanstack/db'
import { z } from 'zod'

// 1. Active Filters (for cross-filtering)
export const activeFiltersCollection = createCollection({
  id: 'active-filters',
  schema: z.object({
    id: z.string().default(() => crypto.randomUUID()),
    dashboardId: z.string(),
    widgetId: z.string(),
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
    createdAt: z.string().datetime(),
  }),
})

// 2. Chart Draft (for editor state)
export const chartDraftCollection = createCollection({
  id: 'chart-drafts',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    chartType: z.enum(['bar', 'line', 'area', 'pie', 'scatter', 'composed']),
    chartConfig: z.unknown(), // JSON object
    dataMapping: z.unknown(), // JSON object
    savedQueryId: z.string().optional(),
    lastEditedAt: z.string().datetime(),
  }),
})

// 3. Dashboard State (for layout, widget selection)
export const dashboardStateCollection = createCollection({
  id: 'dashboard-state',
  schema: z.object({
    dashboardId: z.string(),
    editMode: z.boolean().default(false),
    activeWidgetId: z.string().optional(),
    layoutConfig: z.unknown(), // Grid layout
    lastModified: z.string().datetime(),
  }),
})

// 4. Query History (for SQL editor)
export const queryHistoryCollection = createCollection({
  id: 'query-history',
  schema: z.object({
    id: z.string().default(() => crypto.randomUUID()),
    sql: z.string(),
    executedAt: z.string().datetime(),
    rowCount: z.number(),
    durationMs: z.number(),
    error: z.string().optional(),
  }),
})

// 5. Reports List (for instant search)
export const reportsCollection = createCollection({
  id: 'reports',
  schema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    dataSourceId: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),
})
```

#### 1.3 Create Sync Adapter Skeleton
**File**: `src/lib/tanstack-db/sync-adapter.ts`

```typescript
import { createSyncAdapter } from '@tanstack/db'
import {
  activeFiltersCollection,
  chartDraftCollection,
  dashboardStateCollection,
  queryHistoryCollection,
  reportsCollection,
} from './collections'

// Placeholder sync adapters — each collection can sync via server functions
export const filtersSync = createSyncAdapter({
  async load() {
    // Initial load from localStorage or server; for Phase 1, use defaults
    return []
  },
  async create(item) {
    // Phase 2+: persist to server
    return item
  },
  async update(id, patch) {
    // Phase 2+: persist to server
    return { id, ...patch }
  },
  async delete(id) {
    // Phase 2+: persist to server
    return true
  },
})

export const chartDraftSync = createSyncAdapter({
  async load() {
    // Restore from localStorage on app load
    return []
  },
  async create(item) {
    return item
  },
  async update(id, patch) {
    return { id, ...patch }
  },
  async delete(id) {
    return true
  },
})

// Similar stubs for dashboardStateSync, queryHistorySync, reportsSync
// In Phases 2–5, these will be connected to server functions
```

#### 1.4 Create TanStack DB Provider Wrapper
**File**: `src/lib/tanstack-db/provider.tsx`

```typescript
import React from 'react'
import { TanStackDBProvider } from '@tanstack/db'
import {
  activeFiltersCollection,
  chartDraftCollection,
  dashboardStateCollection,
  queryHistoryCollection,
  reportsCollection,
} from './collections'

export function TanStackDBWrapper({ children }: { children: React.ReactNode }) {
  return (
    <TanStackDBProvider
      collections={[
        activeFiltersCollection,
        chartDraftCollection,
        dashboardStateCollection,
        queryHistoryCollection,
        reportsCollection,
      ]}
      defaultSyncSettings={{
        // Optional: configure sync behavior globally
        // E.g. delay before sync, conflict resolution, etc.
      }}
    >
      {children}
    </TanStackDBProvider>
  )
}
```

#### 1.5 Wire Provider into Root Layout
**File**: `src/routes/__root.tsx`

Add the TanStackDB wrapper at the top level (before or alongside other providers):

```typescript
import { TanStackDBWrapper } from '@/lib/tanstack-db/provider'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <TanStackDBWrapper>
      {/* Existing providers: QueryClientProvider, RouterProvider, Toaster, etc. */}
      {/* ... */}
    </TanStackDBWrapper>
  )
}
```

---

## Phase 2: Cross-Filter Refactor (Optional)

**Effort**: ~4–5 hours  
**Risk**: Medium  
**Deliverables**: Refactored `CrossFilterProvider` backed by TanStack DB, updated `useCrossFilter` hook

### Dependency
- Phase 1 must be complete

### Files to Modify
1. `src/components/dashboard/CrossFilterProvider.tsx` — wire to `activeFiltersCollection`
2. `src/components/dashboard/ActiveFiltersBar.tsx` — use `useLiveQuery` instead of `useCrossFilter()`
3. `src/components/dashboard/DashboardState.tsx` — wire to `dashboardStateCollection`
4. `src/components/dashboard/dashboard-grid.tsx` — update widget rendering to use live queries

### Outline
- Replace React context state with `useLiveQuery(() => activeFiltersCollection.find(...))`
- Preserve `useCrossFilter()` hook API for backward compatibility
- Update `addFilter()`, `removeFilter()`, `clearFilters()` to mutate the collection instead of calling setState
- Test cross-tab state synchronization (optional multi-tab feature)

---

## Phase 3: Chart Editor Optimistic Preview (Optional)

**Effort**: ~6–8 hours  
**Risk**: Medium  
**Deliverables**: Chart draft state moved to TanStack DB, instant preview updates

### Dependency
- Phase 1 must be complete
- Phase 2 optional (independent)

### Files to Modify
1. `src/routes/_authed/charts/editor/$id.tsx` — initialize draft on mount
2. `src/components/charts/editor/chart-preview-panel.tsx` — subscribe to draft via `useLiveQuery`
3. `src/components/charts/editor/chart-appearance.tsx` — mutation updates go to draft collection
4. `src/components/charts/editor/chart-axis-config.tsx` — same
5. `src/components/charts/editor/chart-basic-info.tsx` — same

### Outline
- Load existing chart into draft collection on mount
- All editor tabs write to draft collection (not props)
- Preview panel subscribes to draft live query — updates instantly
- Save button persists draft to server via `updateChart()` server function
- Discard button clears draft from collection

---

## Phase 4: Report/Dataset Lists — Instant Search (Optional)

**Effort**: ~3–4 hours  
**Risk**: Low  
**Deliverables**: Synced reports/charts/dashboards collections with client-side search

### Dependency
- Phase 1 must be complete

### Files to Modify
1. `src/routes/_authed/reports/index.tsx` — sync reports into collection
2. `src/routes/_authed/charts/index.tsx` — sync charts into collection
3. `src/routes/_authed/dashboards/index.tsx` — sync dashboards into collection

### Outline
- On page load, fetch list via `listReports()` server function
- Populate `reportsCollection` with results
- Search input updates local state; `useLiveQuery` filters in real-time
- No network calls for search keystroke
- Background sync on mutations (create/delete report)

---

## Phase 5: SQL Editor Query History (Optional)

**Effort**: ~2–3 hours  
**Risk**: Low  
**Deliverables**: Query history persisted locally, synced to saved_queries on demand

### Dependency
- Phase 1 must be complete

### Files to Modify
1. `src/routes/_authed/sql-editor.tsx` — on query execution, add to `queryHistoryCollection`

### Outline
- Each successful query execution appends to `queryHistoryCollection`
- History list is instant (no server fetch needed)
- Optional: "Save to Queries" button syncs to `saved_queries` table

---

## Risk Mitigation Checklist

- [ ] **Phase 1**: Verify collections are properly typed with Zod schemas
- [ ] **Phase 1**: Confirm provider is wired into root layout and no TypeScript errors
- [ ] **Phase 2**: Test that filter mutations are reflected in all subscribed widgets simultaneously
- [ ] **Phase 2**: Test navigation away and back to dashboard — verify filters persist
- [ ] **Phase 3**: Test optimistic updates in chart editor; verify rollback on server error
- [ ] **Phase 4**: Test client-side search performance with 100+ items in collection
- [ ] **Phase 5**: Verify query history survives page refresh
- [ ] All phases: Monitor bundle size before/after (`bun run build`)

---

## Success Criteria

After implementation, verify:

1. ✅ No TypeScript errors
2. ✅ Dashboard cross-filter changes update UI in <50ms (Phase 2)
3. ✅ Chart editor preview updates instantly on config change (Phase 3)
4. ✅ Report search responds in <10ms to keystroke (Phase 4)
5. ✅ Query history available without network (Phase 5)
6. ✅ No regressions in existing tests (run `bun run test:e2e`)
7. ✅ Bundle size increase <50kb (TanStack DB is ~20kb)

---

## Next Steps

**Decision required**: Which phases should we implement?

- **Recommended starting point**: Phase 1 (Foundation) + Phase 2 (Cross-filters)
  - Provides immediate UX benefit (responsive dashboards)
  - Lowest risk to existing functionality
  - Unblocks Phases 3–5

- **Full commitment**: All 5 phases (~20–25 hours)
  - Complete reactive layer across dashboards, editors, lists, history
  - Maximum UX improvement

- **Minimal MVP**: Phase 1 only (~2–3 hours)
  - Sets up infrastructure
  - No UI changes yet
  - Allows later phases without rework

Please specify which scope you'd like to proceed with, and I'll create a detailed task breakdown.
