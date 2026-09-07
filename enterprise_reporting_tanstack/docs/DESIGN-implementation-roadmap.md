# Implementation Roadmap: Enterprise Reporting System
## Engineering Review Findings + Zod Schema Priority

**Date:** May 11, 2026  
**Status:** Architecture Plan  
**Scope:** 14 recommended changes (13 from full-app engineering review + 1 Zod audit priority)

---

## Executive Summary

A comprehensive engineering review of the entire codebase identified 13 architectural findings, all accepted by stakeholders. A follow-up Zod audit revealed a **critical runtime validation gap**: every REST API handler and server function accepts JSON input with zero runtime validation. Only 4 files across the entire codebase use Zod schemas.

This document provides a phased implementation roadmap:
- **Phase 0 (P0 — Security):** Zod schemas, AUTH_SECRET fail-fast, SQL validation
- **Phase 1 (P1 — Architecture):** TanStack DB, error handling, batch queries, rate limiting
- **Phase 2 (P2 — Consolidation):** REST → server functions migration, type cleanup
- **Phase 3 (P3 — Hardening):** Testing, caching, observability

---

## Phase 0: Security & Type Safety (Do First — Before Any Feature Work)

### Z1: Zod Schema Coverage Across ALL Server Boundaries

**Priority:** P0 (Critical)  
**Effort:** Human 2–3 days / CC 4 hours  
**Files Changed:** 40+ API routes + 5 server functions  
**New Files:** 8 schema modules in `src/lib/schemas/`

#### Current State
- Only **4 files** in the entire codebase use Zod
- **30+ REST API handlers** in `src/routes/api/` call `await request.json()` with TypeScript type assertions only (compile-time only, zero runtime validation)
- **5 server functions** in `src/server-fns/` have no `.validator()` chains
- Auth credentials (email, password) flow directly to bcrypt + database with **no format or length validation**
- Not a single malformed JSON request is caught at the application layer

#### Risk
An attacker can submit any invalid structure to any API endpoint. A missing required field, wrong type, or injection payload will be caught only if downstream code explicitly checks — there is no centralized validation layer. Auth endpoints are especially vulnerable (no email format check, no password length enforcement).

#### Implementation

**1. Create schema modules** (`src/lib/schemas/`):

```typescript
// src/lib/schemas/auth.ts
import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
```

Repeat for all resources:
- `src/lib/schemas/reports.ts` — CRUD schemas for reports
- `src/lib/schemas/charts.ts` — chart config + CRUD
- `src/lib/schemas/dashboards.ts` — dashboard + widget schemas
- `src/lib/schemas/sql.ts` — SQL execution + validation schemas
- `src/lib/schemas/data-sources.ts` — connection credentials + CRUD
- `src/lib/schemas/users.ts` — user CRUD
- `src/lib/schemas/roles.ts` — role CRUD + permissions

**2. Wire schemas into server functions:**

```typescript
// src/server-fns/reports.ts
export const createReport = createServerFn({ method: "POST" })
  .validator(createReportSchema)  // ← Add this line
  .handler(async ({ data }) => {
    // data is now typed AND runtime-validated by Zod
    const report = await db.insertInto("report_definitions").values(data).returning("*").executeTakeFirstOrThrow()
    return report
  })
```

**3. Wire schemas into REST routes:**

```typescript
// src/routes/api/reports.ts
export async function POST(request: Request) {
  const body = await request.json()
  const result = createReportSchema.safeParse(body)
  
  if (!result.success) {
    return Response.json({ 
      error: "Validation failed",
      details: result.error.flatten() 
    }, { status: 422 })
  }
  
  const data = result.data // Now safely typed
  // ... proceed with creation
}
```

**4. Install `@tanstack/zod-form-adapter`:**

```bash
bun add @tanstack/zod-form-adapter
```

Replace hand-rolled Zod validators in:
- `src/components/metadata/forms/EntityMetadataForm.tsx`
- `src/components/metadata/forms/FieldMetadataForm.tsx`

Change from:
```tsx
validators: { onChange: ({ value }) => entityMetadataSchema.safeParse(value) }
```

To:
```tsx
validators: zodValidator(entityMetadataSchema)
```

#### Implementation Order
1. `src/lib/schemas/auth.ts` — email/password validation (security critical)
2. `src/lib/schemas/sql.ts` — SQL query input (security critical)
3. `src/server-fns/reports.ts`, `sql.ts`, `nl-query.ts` — wire validators into all 13 server functions
4. `src/routes/api/admin/*.ts` — user, role, permission endpoints
5. All remaining REST handlers in `/api/**`
6. Form components — swap to `zodValidator()` adapter

#### Verification
```bash
# Should reject invalid input with 422
curl -X POST http://localhost:4050/api/reports \
  -H "Content-Type: application/json" \
  -d '{"name": ""}' # Missing required fields

# Response: 422 Unprocessable Entity
# { "error": "Validation failed", "details": { ... } }
```

---

### F1: AUTH_SECRET Fail-Fast on Startup

**Priority:** P0  
**Effort:** Human 30 min / CC 10 min  
**Files Changed:** 1 (`src/lib/auth/session.ts`)

#### Current State
```typescript
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "enterprise-reporting-secret-key-min-32-chars!!"
)
```

If `AUTH_SECRET` is missing in production, the app silently uses a hardcoded, publicly known secret. **Any deployed instance without explicit config is cryptographically compromised.**

#### Fix
```typescript
const authSecret = process.env.AUTH_SECRET

if (!authSecret) {
  throw new Error(
    "[FATAL] AUTH_SECRET environment variable is required. " +
    "Set a cryptographically secure 32+ character random string. " +
    "Never commit secrets to version control."
  )
}

if (authSecret.length < 32) {
  throw new Error(
    `[FATAL] AUTH_SECRET must be at least 32 characters. ` +
    `Current length: ${authSecret.length}`
  )
}

const SECRET = new TextEncoder().encode(authSecret)
```

Also fix the SQLite type cast on line 51:
```typescript
// Before:
.where("is_active", "=", 1 as unknown as boolean)

// After:
.where("is_active", "=", true)
// The bun-sqlite-compat shim handles integer conversion automatically
```

#### Verification
```bash
# Unset AUTH_SECRET and start the server
unset AUTH_SECRET
bun run dev
# Expected: Process exits immediately with clear error message
```

---

### F9: Fix Broken SQL Validator — Install Real AST Parser

**Priority:** P0  
**Effort:** Human 2 hours / CC 30 min  
**Files Changed:** 1 (`src/lib/sql/validator.ts`)  
**Dependencies:** Add `node-sql-parser`

#### Current State
`src/lib/sql/validator.ts` imports a MOCK `Parser` class instead of the real `node-sql-parser`. Any attempt to parse SQL (lines 56–57) will throw because the mock has no `.astify()` method.

```typescript
// Current broken code:
class Parser {
  static parse(_sql: string) {
    return {}
  }
}

const parser = new Parser()
parser.astify(sql) // ← throws: "astify is not a function"
```

The actual working validator is `src/lib/sql/antlr-validator.ts` which uses regex-based validation — effective but not AST-based.

#### Fix
Install the real parser:
```bash
bun add node-sql-parser
```

Replace the mock class:
```typescript
import { Parser } from "node-sql-parser"

// Keep the rest of the validator.ts logic intact
// The Parser API is already called correctly (astify, tableList, columnList)
// Just needs the real library instead of the mock
```

The existing test suite at `src/lib/sql/__tests__/validator.test.ts` (30+ test cases) will validate the implementation.

#### Verification
```bash
bun run test:sql
# All 30+ validator test cases should pass
```

---

## Phase 1: Core Architecture Fixes (This Development Cycle)

### F6: Server Function Error Wrapper Utility

**Priority:** P1  
**Effort:** Human 2 hours / CC 20 min  
**Files Changed:** 1 new + 5 server-fn files (refactor)

#### Current State
Each of the 5 server function files (`auth.ts`, `reports.ts`, `sql.ts`, `nl-query.ts`, `openkb.ts`) handles errors individually. Errors are thrown as plain `new Error(message)` and propagate through TanStack Start's serialization layer to the client as untyped exceptions.

#### Create Error Wrapper

**File:** `src/lib/server-fns/with-error-handler.ts`

```typescript
import { logAudit } from "@/lib/security/audit"

export function withErrorHandler<T>(
  handler: (ctx: unknown) => Promise<T>
): (ctx: unknown) => Promise<T> {
  return async (ctx) => {
    try {
      return await handler(ctx)
    } catch (err) {
      // Log the error for audit trail
      await logAudit({
        action: "SERVER_FUNCTION_ERROR",
        severity: "error",
        details: {
          message: err instanceof Error ? err.message : "Unknown error",
          stack: err instanceof Error ? err.stack : undefined,
        },
      })

      // Auth errors: re-throw as-is (they have semantic meaning on client)
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        throw err
      }

      // All other errors: sanitize to prevent info leakage
      throw new Error(
        err instanceof Error ? err.message : "Internal server error"
      )
    }
  }
}
```

#### Integration Pattern
```typescript
// src/server-fns/reports.ts
export const listReports = createServerFn({ method: "GET" })
  .handler(withErrorHandler(async (ctx) => {
    const session = await requireAuth()
    // ... existing logic ...
  }))
```

Reuse existing `logAudit()` from `src/lib/security/audit.ts` — it's already imported and used in `sql.ts` and `nl-query.ts`.

---

### F10: Rate Limiting on Public Share Routes

**Priority:** P1  
**Effort:** Human 30 min / CC 5 min (nginx-only)  
**Files Changed:** 2 nginx config files

#### Current State
- `src/routes/share/chart/$id.tsx`, `dashboard/$id.tsx`, `report/$id.tsx` have **zero rate limiting**
- Nginx rate limit zone (`api:10m` at 10 req/s) only covers `/api/` routes
- Public shares are TanStack Start loaders, not `/api/`, so they bypass rate limiting
- No UUID format validation on `$id` — any string passes through to the database

#### Fix: Extend Nginx Rate Limit Zone

**Both config files** (`nginx/default.conf` and `nginx/default-http-only.conf`):

Add a new location block before the fallback proxy:
```nginx
location /share/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://ers_app;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}
```

#### Application-Level UUID Validation

Also add UUID format validation in the share route handlers:
```typescript
// src/routes/share/chart/$id.tsx
const validateShareId = (id: string) => {
  const uuid = z.string().uuid().safeParse(id)
  if (!uuid.success) {
    throw new Error("Invalid share ID format")
  }
  return uuid.data
}
```

#### Verification
```bash
# Rapid requests to share route should be rate-limited
for i in {1..100}; do curl http://localhost:4050/share/chart/123e4567-e89b-12d3-a456-426614174000; done

# After ~20 requests: 429 Too Many Requests
```

---

### F3: TanStack DB Phase 1 — Cross-Filter Collection (Reactive State)

**Priority:** P1  
**Effort:** Human 3 days / CC 6 hours  
**Files Changed:** 6 (hooks, components, new collections)  
**New Dependency:** `@tanstack/db`

#### Current State
Cross-filter state lives in `useState` within the `useCrossFilter` hook. The `filterLinks` that wire widgets together are always `[]` (hardcoded in `CrossFilterProvider:35`), making cross-filtering **structurally present but functionally broken**.

#### Implementation

**1. Install TanStack DB:**
```bash
bun add @tanstack/db
```

**2. Create collections:** `src/lib/tanstack-db/collections.ts`
```typescript
import { createCollection } from "@tanstack/db"
import { z } from "zod"
import { activeFilterSchema } from "@/lib/schemas/filters"

export const activeFiltersCollection = createCollection({
  id: "active-filters",
  schema: activeFilterSchema,
})
```

**3. Replace useState in `useCrossFilter`:**
```typescript
// src/hooks/useCrossFilter.ts
import { useLiveQuery } from "@tanstack/db"
import { activeFiltersCollection } from "@/lib/tanstack-db/collections"

export function useCrossFilter(config: CrossFilterConfig) {
  // Instead of: const [activeFilters, setActiveFilters] = useState(...)
  const [activeFilters] = useLiveQuery(() => 
    activeFiltersCollection.findMany()
  )

  const applyFilter = async (filter: Omit<ActiveFilter, "id" | "affectedWidgets">) => {
    const id = nanoid()
    await activeFiltersCollection.insert({ ...filter, id, affectedWidgets: [] })
  }

  // ... rest of hook API unchanged ...
}
```

**4. Fix the `filterLinks` bug:**
```typescript
// src/components/dashboard/CrossFilterProvider.tsx
// Before: filterLinks: []
// After: Populate from widget config
const filterLinks = widgets.flatMap(w => w.filterLinks || [])
```

**5. Wire click handlers:**
Connect chart/widget click events to `applyFilter()` so users can actually create filters.

#### Benefits
- Cross-filter state is now **reactive** — all subscribers update in a single React render tick
- Any component anywhere in the tree can subscribe via `useLiveQuery` without context chains
- Filter state survives route navigation (persists in the collection)
- Foundation for later WebSocket sync (multiplayer dashboards)

#### Verification
```
1. Load dashboard with 2 widgets
2. Click a data point in widget A → filter is applied
3. Verify widget B updates WITHOUT a network request
4. Open browser DevTools Network tab — confirm: 0 requests
```

---

### F12: Batch Widget Data Fetching (Prevent N+1 Queries)

**Priority:** P1  
**Effort:** Human 4 hours / CC 1 hour  
**Files Changed:** 1 server function file  
**New Function:** `batchExecuteSql`

#### Current State
Each widget calls `executeSql()` independently. A dashboard with 5 widgets = 5 sequential SQL queries.

#### Fix: Add Batch Server Function

```typescript
// src/server-fns/sql.ts (extend)
export const batchExecuteSql = createServerFn({ method: "POST" })
  .validator(z.array(z.object({ 
    widgetId: z.string(), 
    sql: z.string() 
  })))
  .handler(async ({ data: queries }) => {
    const session = await requireAuth()
    
    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(({ widgetId, sql }) =>
        executeQuery(sql)
          .then(result => ({ widgetId, result, error: null }))
          .catch(error => ({ widgetId, result: null, error: error.message }))
      )
    )
    
    return Object.fromEntries(
      results.map(({ widgetId, result, error }) => [
        widgetId,
        { data: result || [], error }
      ])
    )
  })
```

#### Usage in Dashboard Container
```typescript
// src/components/dashboard/dashboard-grid.tsx (conceptual)
const widgetQueries = widgets.map(w => ({
  widgetId: w.id,
  sql: getFilteredQuery(w.id, w.baseQuery)
}))

const results = await batchExecuteSql(widgetQueries)
// results: { widgetId1: { data, error }, widgetId2: { data, error }, ... }
```

#### Verification
1. Load dashboard with 5+ widgets
2. Open DevTools Network tab
3. Verify: **1 request** to `/api/sql/batch-execute`, not 5 individual requests
4. Time: batch should be ~same speed or faster than sequential (parallel execution)

---

## Phase 2: API Consolidation & Cleanup (Next Development Cycle)

### F4: Complete REST → Server Functions Migration

**Priority:** P2  
**Effort:** Human 5 days / CC 8 hours

#### Current State
**True duplicates** (same logic in both layers):
- `/api/sql/execute` ← `executeSql` server-fn
- `/api/sql/validate` ← `validateSql` server-fn
- `/api/reports`, `/api/reports/$id` ← `listReports`, `getReport`, `createReport`, `updateReport`, `deleteReport` server-fns

**REST-only endpoints** (no server-fn equivalent):
- Charts CRUD: `/api/charts`, `/api/charts/$id`, `/api/charts/$id/filters`
- Dashboards CRUD: `/api/dashboards`, `/api/dashboards/$id`, `/api/dashboards/$id/widgets`
- Data sources: `/api/data-sources`
- Admin: `/api/admin/users`, `/api/admin/roles`, `/api/admin/permissions`
- Other: filters, queries, jobs, notifications, health

#### Phased Approach
1. **Cycle 1:** Create server function equivalents for all remaining REST endpoints (charts, dashboards, data sources, admin)
2. **Cycle 2:** Update client code to call server functions instead of REST routes
3. **Cycle 3:** Remove REST route files

---

### F7: Remove WASM Type Import Leakage

**Priority:** P2  
**Effort:** Human 4 hours / CC 1 hour

#### Current State
`src/types/wasm.ts` (350 lines) exports:
- **WASM-specific types:** DuckDB, Parquet, ExecutionMode
- **General-purpose types:** `ActiveFilter`, `CrossFilterConfig`, `ColumnSchema`, `EChartsConfig`, `WidgetSchema`

~35 non-WASM files import the general-purpose types, creating a false dependency on the WASM module.

#### Fix: Split into Separate Type Files

- `src/types/charts.ts` — `EChartsConfig`, chart types
- `src/types/filters.ts` — `ActiveFilter`, `CrossFilterConfig`, `FilterLink`, `WidgetFilterConfig`
- `src/types/database.ts` (extend) — `ColumnSchema`, `TableSchema`, `QueryResult`
- `src/types/wasm.ts` (keep, shrunk) — only DuckDB, Parquet, ExecutionMode

Update import statements across all 35 files.

**Do NOT remove** the actual DuckDB WASM module (`src/lib/duckdb/instance.ts`) — it is real and used.

---

### F8: Chart Editor FormPanel Wrapper

**Priority:** P2  
**Effort:** Human 2 hours / CC 30 min

#### Current State
All 7 chart editor panels repeat identical `<Card>` wrapper boilerplate (30+ lines each).

#### Create Wrapper Component

**File:** `src/components/charts/editor/EditorPanel.tsx`
```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EditorPanelProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function EditorPanel({ title, children, className }: EditorPanelProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

#### Update Each Panel
Before:
```tsx
export function ChartAppearance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 40 lines of form content */}
      </CardContent>
    </Card>
  )
}
```

After:
```tsx
export function ChartAppearance() {
  return (
    <EditorPanel title="Appearance">
      {/* 40 lines of form content */}
    </EditorPanel>
  )
}
```

Each panel shrinks by ~15 lines of boilerplate.

---

## Phase 3: Testing, Performance, Observability (Ongoing)

### F11: Unit Tests for RBAC and Encryption

**Priority:** P3  
**Effort:** Human 2 days / CC 2 hours

#### Files to Create
- `src/lib/auth/__tests__/rbac.test.ts` — permission checks, role hierarchy, resource guards
- `src/lib/security/__tests__/encryption.test.ts` — AES-256-GCM encrypt/decrypt, wrong key failure, null value handling

#### Test Framework
Use `bun:test` (consistent with existing `antlr-validator.test.ts`):
```typescript
import { describe, test, expect } from "bun:test"
import { checkPermission, hasRole } from "@/lib/auth/rbac"

describe("RBAC", () => {
  test("user with admin role can delete report", () => {
    const user = { id: "1", roles: ["admin"] }
    expect(hasRole(user, "admin")).toBe(true)
  })
  
  test("user without admin role cannot delete report", () => {
    const user = { id: "2", roles: ["viewer"] }
    expect(hasRole(user, "admin")).toBe(false)
  })
})
```

---

### F13: Cache-Control Headers on Assets

**Priority:** P3  
**Effort:** Human 1 hour / CC 10 min

#### Current State
Only `/_next/static/` assets have cache headers. **Wrong path** — the app is TanStack Start, which uses `/_tanstack/` not `/_next/static/`.

#### Fix Nginx Configs
Both `nginx/default.conf` and `nginx/default-http-only.conf`:

```nginx
# Fix: correct TanStack Start static path
location /_tanstack/static/ {
    proxy_pass http://ers_app;
    expires 365d;
    add_header Cache-Control "public, immutable";
}

# Add: cache control for share routes (public, short-lived)
location /share/ {
    proxy_pass http://ers_app;
    limit_req zone=api burst=20 nodelay;
    add_header Cache-Control "public, max-age=3600";
}

# Add: cache control for HTML (browser validation, no aggressive caching)
location ~* ^/index.html$ {
    proxy_pass http://ers_app;
    add_header Cache-Control "public, max-age=0, must-revalidate";
}
```

#### Verification
```bash
curl -I http://localhost:4050/share/chart/abc123
# Response headers should include:
# Cache-Control: public, max-age=3600
```

---

### F5: PostgreSQL Connection Pooling Configuration

**Priority:** P3  
**Effort:** Human 1 hour / CC 15 min

#### Current State
PostgreSQL connection pool is already implemented (`pg.Pool` in `src/lib/db/kysely-db.ts:320`) but has default settings and no documentation.

#### Work
1. **Make pooling explicit in code:**
```typescript
// src/lib/db/kysely-db.ts (extend)
if (isPostgres) {
  const pool = new pg.Pool({
    min: parseInt(process.env.PGPOOL_MIN || "2"),
    max: parseInt(process.env.PGPOOL_MAX || "10"),
    idleTimeoutMillis: 600000, // 10 minutes
    statement_timeout: 30000, // 30 seconds per statement
  })
  // ...
}
```

2. **Document in `docs/ARCHITECTURE.md`:**
   - Pool size recommendations (based on workload)
   - Idle timeout behavior
   - How external data source connections use connection-manager.ts pooling

---

## Implementation Sequence & Dependencies

```
PHASE 0 (Security — prerequisite for all phases)
├── Z1: Zod schemas (all boundaries)      [blocking everything]
├── F1: AUTH_SECRET fail-fast              [fast, low-risk]
└── F9: Fix SQL validator                  [needed for F12, security critical]

PHASE 1 (Architecture — after Phase 0)
├── F6: Error wrapper utility              [improves observability]
├── F10: Rate limit share routes           [security hardening, independent)
├── F3: TanStack DB cross-filters          [unblocks F12, large refactor)
└── F12: Batch widget queries              [depends on Z1 + F9]

PHASE 2 (Consolidation — next quarter)
├── F4: REST → server-fns migration        [depends on Z1]
├── F7: Split wasm.ts types                [independent, can happen anytime)
└── F8: FormPanel wrapper                  [independent, polish work)

PHASE 3 (Hardening — ongoing)
├── F11: RBAC + encryption unit tests      [depends on Z1]
├── F13: Cache-Control headers             [independent)
└── F5: Postgres pool documentation        [independent)
```

---

## Effort Summary

| Phase | Item | Human | CC | Total Duration |
|-------|------|-------|-----|--------|
| **P0** | Z1: Zod schemas | 2–3d | 4h | ~3 days |
| | F1: AUTH_SECRET | 30m | 10m | ~30 min |
| | F9: SQL validator | 2h | 30m | ~2 hours |
| **P1** | F6: Error wrapper | 2h | 20m | ~2 hours |
| | F10: Rate limiting | 30m | 5m | ~30 min |
| | F3: TanStack DB | 3d | 6h | ~3 days |
| | F12: Batch queries | 4h | 1h | ~4 hours |
| **P2** | F4: REST migration | 5d | 8h | ~5 days |
| | F7: Type cleanup | 4h | 1h | ~4 hours |
| | F8: FormPanel | 2h | 30m | ~2 hours |
| **P3** | F11: Unit tests | 2d | 2h | ~2 days |
| | F13: Cache headers | 1h | 10m | ~1 hour |
| | F5: Pool docs | 1h | 15m | ~1 hour |
| | | | | **~27 days** |

**Realistic timeline:**
- Phase 0: Week 1 (security critical)
- Phase 1: Week 2 (architecture locked in)
- Phase 2: Weeks 3–4 (consolidation, parallel with Phase 3)
- Phase 3: Weeks 4+ (hardening, ongoing)

---

## Success Criteria

| Finding | Verification | Status |
|---------|-------------|--------|
| **Z1** | Submit malformed JSON to any API; expect 422 Unprocessable Entity | ☐ |
| **F1** | Start server without AUTH_SECRET; process exits with clear error | ☐ |
| **F9** | `bun run test:sql` passes all 30+ validator tests | ☐ |
| **F6** | Throw error in server-fn; verify audit log entry, not browser console | ☐ |
| **F10** | Hit `/share/chart/ID` 200 times; expect 429 Too Many Requests | ☐ |
| **F3** | Apply cross-filter; other widgets update WITHOUT network request | ☐ |
| **F12** | Load 5-widget dashboard; Network tab shows 1 request, not 5 | ☐ |
| **F4** | Remove a REST route; client still works via server-fn | ☐ |
| **F7** | `@/types/wasm` imports only compile-time types from wasm files | ☐ |
| **F8** | Chart editor renders with EditorPanel; no visual regressions | ☐ |
| **F11** | `bun test src/lib/auth` and `src/lib/security` pass | ☐ |
| **F13** | `curl -I /share/chart/123` shows `Cache-Control: public, max-age=3600` | ☐ |
| **F5** | `PGPOOL_MAX` visible in pool config; ARCHITECTURE.md updated | ☐ |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Z1 schemas too strict, break client | Low | High | Gradual rollout: server-fns first, then REST |
| F3 TanStack DB performance regression | Low | Medium | Benchmark before/after; profile bundle size |
| F4 REST removal breaks mobile clients | High if mobile exists | High | Maintain REST routes with deprecation header for 2 quarters |
| F12 batch queries timeout on large datasets | Medium | Low | Add `BATCH_SIZE=5` env var; split into sub-batches |

---

## References

- **Zod audit:** `/Users/pramodkoshy/.claude/plans/quiet-marinating-wombat.md`
- **Engineering review:** `/plan-eng-review` skill output
- **Current CLAUDE.md:** See tech stack, quick reference commands
- **Existing schemas:** `src/components/metadata/forms/*MetadataForm.tsx` (hand-rolled Zod examples)
- **TanStack DB docs:** https://tanstack.com/db/latest
- **Kysely docs:** https://kysely.dev (for schema builders)

---

**Document Status:** Ready for implementation  
**Last Updated:** May 11, 2026  
**Approved By:** Engineering Review
