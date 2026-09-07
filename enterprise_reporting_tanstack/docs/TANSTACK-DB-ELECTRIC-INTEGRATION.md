# TanStack DB + ElectricSQL Integration Strategy

**Status**: API Analysis & Planning  
**Created**: 2026-05-13  
**Requires Clarification**: User has requested both TanStack DB and ElectricSQL integration

---

## Current Situation

1. **@tanstack/db v0.6** installed  
2. **API Discrepancy**: The enhancement doc (ENHANCEMENT-tanstack-db-integration.md) describes an API with `TanStackDBProvider`, `createSyncAdapter`, and `createCollection(schema)` signatures that don't match v0.6's actual exports
3. **User Request**: "add ElectricSQL to the docs" — implies combining TanStack DB with ElectricSQL for sync layer
4. **Implementation Status**: Phase 1 files created but have TypeScript errors due to API mismatch

---

## @tanstack/db v0.6 Actual API

The package exports:
- `createCollection(config)` — but API signature differs from enhancement doc
- `createOptimisticAction()` — for optimistic mutations
- `localStorageCollectionOptions` — for local-only persistence
- No built-in React provider or sync adapter
- Uses `@tanstack/db-ivm` for reactive queries

**Key difference**: Collections in v0.6 are more low-level; you manage sync independently.

---

## ElectricSQL Overview

ElectricSQL is a **real-time sync engine** that bridges local SQLite and server Postgres:
- Automatically syncs local collections to server
- Supports offline-first workflows
- Provides conflict resolution
- Works with TanStack DB collections

**Recommended architecture**:
```
React Component
   ↓ useLiveQuery()
TanStack DB Collection (local cache)
   ↓ ElectricSQL sync adapter
PostgreSQL / SQLite (server)
```

---

## Decision Required

To proceed with all 5 phases, please clarify:

### Option A: TanStack DB v0.6 + ElectricSQL (Recommended)
- Use actual v0.6 API for collections
- Wire ElectricSQL as the sync layer
- Benefit: Real-time sync, offline support, conflict resolution
- Effort: ~25–30 hours for all phases
- Complexity: Medium (ElectricSQL learning curve)

### Option B: Simplify to TanStack DB v0.6 Only (No ElectricSQL)
- Use v0.6's native API with localStorage persistence
- No server sync in Phase 1–3
- Phase 4–5 would need custom sync functions
- Benefit: Simpler, faster implementation
- Effort: ~15–20 hours for all phases
- Limitation: No real-time sync without extra work

### Option C: Use Different TanStack DB Version
- Check if older/newer TanStack DB versions have the documented API
- May not be compatible with current Bun version
- Effort: Uncertain (possible integration issues)

---

## Recommended Path Forward

**I recommend Option A** (TanStack DB v0.6 + ElectricSQL):

1. **Phase 1 (Updated)**: Wire TanStack DB v0.6 with actual API + install ElectricSQL
2. **Phases 2–3**: Use TanStack DB + local optimistic updates (no server sync yet)
3. **Phases 4–5**: Connect ElectricSQL sync adapter for real-time server persistence

This gives you:
- Reactive UI state (TanStack DB)
- Offline-capable dashboard filtering
- Real-time sync when online (ElectricSQL)
- Automatic conflict handling
- Full feature set by end of Phase 5

---

## What Do You Prefer?

Please respond with:

```
A) TanStack DB v0.6 + ElectricSQL (full real-time sync)
B) TanStack DB v0.6 only (simpler, no server sync yet)  
C) Other (please specify)
```

Once you choose, I'll:
1. Update the implementation plan with correct APIs
2. Clean up the Phase 1 files I created with corrected code
3. Resume Phases 2–5 with proper ElectricSQL integration

---

## Reference Files

- Enhancement doc: `docs/ENHANCEMENT-tanstack-db-integration.md` (describes v0.6+ aspirational API)
- Implementation plan: `docs/IMPLEMENTATION-PLAN-tanstack-db.md` (needs API update)
- Created but incomplete Phase 1 files:
  - `src/lib/tanstack-db/collections.ts` (needs API fix)
  - `src/lib/tanstack-db/sync-adapter.ts` (will be ElectricSQL adapter instead)
  - `src/lib/tanstack-db/provider.tsx` (needs removal or modification)
  - `src/routes/__root.tsx` (TanStackDBWrapper import added but won't work as-is)
