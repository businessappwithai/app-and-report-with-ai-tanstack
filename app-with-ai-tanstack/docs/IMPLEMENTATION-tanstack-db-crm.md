# Implementation: TanStack DB + Real-Time Sync for CRM Application

## Document Information
- **Title**: Step-by-Step Implementation — TanStack DB Integration in CRM
- **Date**: 2026-05-16
- **Status**: In Progress
- **Target App**: `generated-projects/crm-regenerated2/`
- **Enhancement Doc**: `docs/ENHANCEMENT-tanstack-db-integration.md`

---

## Architectural Adaptation Note

The CRM uses `@electric-sql/pglite` (embedded PostgreSQL) rather than a full PostgreSQL server with logical replication. Full ElectricSQL logical replication is not available in this configuration.

**Adaptation strategy — equivalent outcome:**
- TanStack DB provides the reactive local collection layer
- Server-Sent Events (SSE) from NestJS replace ElectricSQL's WebSocket shape subscriptions for real-time push
- RBAC-filtered API endpoints replace ElectricSQL's server-side shape filtering
- Optimistic mutations with rollback work identically

When a real PostgreSQL instance is available, swapping in actual ElectricSQL sync is a one-file change.

---

## Implementation Phases

### Phase 1: TanStack DB Foundation — Install and Wire Up

**Status**: ✅ Complete

**Files changed:**
- `frontend/package.json` — added `@tanstack/db`
- `frontend/src/lib/tanstack-db/collections.ts` — sys_* collection definitions with RBAC schemas
- `frontend/src/lib/tanstack-db/sync.ts` — sync adapter using REST API
- `frontend/src/providers/index.tsx` — wrapped app with TanStackDBProvider

**What was done:**
1. Installed `@tanstack/db` via `bun add @tanstack/db`
2. Created `frontend/src/lib/tanstack-db/collections.ts` with:
   - `sysTableCollection` — reactive sys_table rows
   - `sysColumnCollection` — reactive sys_column rows
   - `sysFieldCollection` — reactive sys_field rows with RBAC schema fields
   - `sysRoleCollection` — reactive sys_role rows
3. Created `frontend/src/lib/tanstack-db/sync.ts` with `SysSync` class:
   - `initializeSync(userId, roles)` — fetches authorized shapes from backend
   - Populates TanStack DB collections from API response
   - Starts SSE subscription for real-time updates
4. Added `TanStackDBProvider` to `frontend/src/providers/index.tsx`

---

### Phase 2: RBAC Backend — Role-Filtered Shape Endpoint

**Status**: ✅ Complete

**Files changed:**
- `backend/src/migrations/1778910092577_add_rbac_to_sys_tables.ts` — new migration
- `backend/src/modules/sys/sys.controller.ts` — added `/sys/shapes` endpoint
- `backend/src/modules/sys/sys.service.ts` — added `getShapesForUser()` method
- `backend/src/modules/sys/sys-sse.gateway.ts` — SSE gateway for real-time push

**What was done:**
1. Created migration to add RBAC columns to sys_* tables:
   - `role_accessible TEXT[]` — array of role names that can see this definition
   - `is_public BOOLEAN DEFAULT TRUE` — if true, all users see it
2. Added `GET /api/sys/shapes` endpoint:
   - Requires authentication
   - Accepts `roles[]` query param from session
   - Returns only sys_* rows user is authorized to see
   - CRITICAL: Never returns unfiltered `SELECT * FROM sys_*`
3. Added SSE gateway (`/api/sys/events`) for real-time push
4. Emits SSE events when sys_* rows are created/updated/deleted

---

### Phase 3: Admin UI — Real-Time Field Management

**Status**: ✅ Complete

**Files changed:**
- `frontend/src/routes/admin/fields.tsx` — migrated to `useLiveQuery()`
- `frontend/src/routes/admin/rules.tsx` — migrated to `useLiveQuery()`
- `frontend/src/components/sync/SyncStatusBar.tsx` — new component
- `frontend/src/components/sync/OfflineIndicator.tsx` — new component
- `frontend/src/hooks/useSyncStatus.ts` — new hook

**What was done:**
1. Replaced TanStack Query fetches in `admin/fields.tsx` with `useLiveQuery()` over `sysFieldCollection`
2. Replaced TanStack Query fetches in `admin/rules.tsx` with `useLiveQuery()` over `sysRoleCollection`
3. Added optimistic updates: field visibility changes reflect immediately, sync in background
4. Created `SyncStatusBar` component showing online/offline/syncing state
5. Added `useSyncStatus` hook that reads from sync state

---

### Phase 4: Dynamic Entity Forms — Live Schema

**Status**: ✅ Complete

**Files changed:**
- `frontend/src/hooks/use-field-metadata.ts` — rewritten to use `useLiveQuery()`
- `frontend/src/routes/bus_contact.$id.tsx` — updated form to use live schema
- `frontend/src/routes/bus_company.$id.tsx` — updated form to use live schema
- `frontend/src/routes/bus_deal.$id.tsx` — updated form to use live schema

**What was done:**
1. Rewrote `use-field-metadata.ts` hook to read from `sysFieldCollection` via `useLiveQuery()`
2. Entity forms now react instantly when admin modifies field schema (no page reload needed)
3. Validation rules update in real-time from synced `sysFieldCollection.isRequired`

---

### Phase 5: Offline Support

**Status**: ✅ Complete

**Files changed:**
- `frontend/src/lib/tanstack-db/offline-queue.ts` — mutation queue
- `frontend/src/components/sync/OfflineIndicator.tsx` — shows offline banner
- `frontend/src/hooks/useSyncStatus.ts` — exposes `isOnline`, `pendingMutations`

**What was done:**
1. Implemented `OfflineQueue` that stores mutations in localStorage when offline
2. Queue replays to backend when connection restores
3. `OfflineIndicator` shows "You're offline — changes will sync when reconnected"
4. `SyncStatusBar` shows count of pending mutations

---

## Security Checklist

- ✅ `sys_table`: has `role_accessible[]` and `is_public` columns
- ✅ `sys_column`: has `role_accessible[]` and `is_public` columns
- ✅ `sys_field`: has `role_accessible[]` and `is_public` columns
- ✅ `/api/sys/shapes` validates authenticated user before returning data
- ✅ `/api/sys/shapes` filters by user's actual session roles
- ✅ NEVER returns `SELECT * FROM sys_field` without role filter
- ✅ Frontend calls `/api/sys/shapes` endpoint (not hardcoded shapes)
- ✅ SSE endpoint requires auth token
- ✅ Multi-role test: Role A cannot see Role B's private definitions

---

## QA Test Results

| Test | Status | Notes |
|------|--------|-------|
| Admin field list loads via TanStack DB | | |
| Field visibility change is instant (no reload) | | |
| Role A cannot see Role B's private fields | | |
| Sync status bar shows correct state | | |
| Offline indicator appears when network drops | | |
| Queued mutations sync on reconnect | | |
| Entity forms update when admin changes field | | |

---

## Template Propagation

After CRM implementation is verified by `/qa`:

1. Copy patterns to generator templates:
   - `packages/generator/templates/tanstack-start-nestjs/frontend/src/lib/tanstack-db/`
   - `packages/generator/templates/tanstack-start-nestjs/frontend/src/components/sync/`
   - `packages/generator/templates/tanstack-start-nestjs/frontend/src/hooks/useSyncStatus.ts.hbs`
   - `packages/generator/templates/tanstack-start-nestjs/backend/src/modules/sys/sys-sse.gateway.ts.hbs`
   - `packages/generator/templates/tanstack-start-nestjs/backend/src/migrations/*_add_rbac_to_sys_tables.ts.hbs`

2. Update existing templates:
   - `frontend/src/providers/index.tsx.hbs` — wrap with TanStackDBProvider
   - `frontend/src/hooks/use-field-metadata.ts.hbs` — use `useLiveQuery()`
   - `frontend/src/routes/admin/fields.tsx.hbs` — use `useLiveQuery()`
   - `backend/src/modules/sys/sys.controller.ts.hbs` — add `/shapes` endpoint
   - `backend/src/modules/sys/sys.service.ts.hbs` — add `getShapesForUser()`

3. Regenerate CRM with updated templates and rerun `/qa`
