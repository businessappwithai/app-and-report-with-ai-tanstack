# Architecture Guide

Enterprise Reporting System - Technical architecture and key design decisions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun >= 1.3.0 |
| Framework | TanStack Start 1.167+ (Full-stack React, Vite-based) |
| Language | TypeScript (strict mode, ES2022) |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS 3) |
| State/Data | TanStack Query, TanStack Table, TanStack Form |
| Database | SQLite via better-sqlite3 + Kysely query builder |
| Auth | Custom JWT auth (beta) with credentials provider |
| Charts | Recharts |
| Job Queue | BullMQ + Redis (ioredis) |
| Styling | Tailwind CSS with CSS variables (HSL color system) |

## Project Structure

```
enterprise-reporting-system/
├── src/
│   ├── app/                          # TanStack Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── providers.tsx             # Client providers
│   │   ├── (auth)/                   # Auth route group
│   │   │   └── login/                # Login page
│   │   ├── (dashboard)/              # Main app (authenticated)
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── sql-editor/           # SQL editor page
│   │   │   ├── reports/              # Report pages
│   │   │   ├── charts/               # Chart pages
│   │   │   ├── dashboards/           # Dashboard pages
│   │   │   └── ...                   # Other features
│   │   └── api/                      # API routes
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── charts/                   # Chart components
│   │   ├── dashboard/                # Dashboard components
│   │   ├── reporting/                # Report components
│   │   ├── sql-editor/               # SQL editor components
│   │   └── layout/                   # Layout components
│   ├── lib/                          # Core libraries
│   │   ├── db/                       # Database layer
│   │   ├── auth/                     # Authentication
│   │   ├── permissions/              # Permission system
│   │   ├── security/                 # Security utilities
│   │   ├── sql/                      # SQL utilities
│   │   └── jobs/                     # Job processing
│   ├── types/                        # TypeScript definitions
│   └── styles/                       # Global styles
├── e2e/                              # Playwright E2E tests
├── database/                         # SQLite database files
└── docs/                             # Documentation
```

## Database

### Connection
- **Config DB**: `data/config.sqlite` (users, roles, reports, etc.)
- **Get connection**: `getDb()` from `@/lib/db/config`
- **Query builder**: Kysely
- **Migrations**: Timestamp-based in `src/lib/db/migrations/`

### Schema Tables
- `users` - User accounts
- `roles` - Role definitions with permissions JSON
- `user_roles` - User-role associations
- `data_sources` - Database connections
- `saved_queries` - SQL query templates
- `report_definitions` - Report configurations
- `chart_definitions` - Chart configurations
- `dashboard_layouts` - Dashboard layouts
- `dashboard_widgets` - Widget definitions
- `job_definitions` - Job definitions
- `job_executions` - Job execution logs
- `audit_log` - Audit trail
- `email_templates` - Email templates
- `resource_permissions` - Resource-level permissions

## Authentication & Authorization

### JWT Configuration
- **Provider**: Custom implementation with jose library
- **Session**: JWT with HTTP-only cookies
- **Location**: `src/lib/auth/middleware.ts`

### RBAC (Role-Based Access Control)
- **Permission levels**: `view`, `edit`, `execute`, `admin`
- **Permission format**: `{resource_type}:{action}`
- **Resource types**: `data_source`, `query`, `report`, `chart`, `dashboard`, `job`, `user`, `role`
- **Location**: `src/lib/auth/rbac.ts`, `src/lib/permissions/permissions.ts`

### Permission Checks
```typescript
import { hasPermission } from '@/lib/permissions/permissions';

// Check permission
if (hasPermission(user, 'report:edit')) {
  // Allow edit
}

// Check resource access
if (hasResourceAccess(user, 'report', reportId)) {
  // Allow access
}
```

## Server-Side Pagination (Critical)

**All data queries MUST use server-side pagination.**

### Configuration
```bash
# .env.local
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=1000
DATA_TABLE_PAGE_SIZE=100
EXPORT_PAGE_SIZE=1000
VIRTUAL_SCROLL_THRESHOLD=500
```

### Usage
```typescript
import { validatePageSize, buildSqlPagination } from '@/lib/config/pagination';

// Validate page size
const safeSize = validatePageSize(5000); // Returns 1000 (max)

// Build SQL pagination
const { limit, offset } = buildSqlPagination(page, pageSize);
```

## API Routes

### Major Route Groups
| Route | Purpose |
|-------|---------|
| `api/auth/` | Authentication endpoints |
| `api/admin/` | Admin operations (users, roles, permissions) |
| `api/reports/` | Report data and management |
| `api/dashboards/` | Dashboard CRUD |
| `api/charts/` | Chart configuration |
| `api/data-sources/` | Data source management |
| `api/sql/` | SQL execution, validation, schema |
| `api/jobs/` | Job queue management |
| `api/filters/` | Filter management |
| `api/queries/` | Saved query management |
| `api/metadata/` | Metadata entity operations |
| `api/health/` | Health check |

### Route Pattern (TanStack Start)
```typescript
// src/routes/api/your-route.ts (file-based routing)
import { createAPIFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/auth/middleware'
import { getDb } from '@/lib/db/config'

export const Route = createAPIFileRoute('/api/your-route')({
  async GET() {
    const session = await requireAuth()
    const db = getDb()
    // ... logic
    return Response.json({ data: ... })
  }
})
```

## Security

### Encryption
- **Library**: AES-256-GCM
- **Location**: `src/lib/security/encryption.ts`
- **Used for**: Data source connection configs
- **Key**: `ENCRYPTION_KEY` env var (32-byte hex)

### SQL Injection Prevention
- Parameterized queries via Kysely
- Input validation in `src/lib/sql/validator.ts`
- Read-only query enforcement

### Audit Logging
- **Location**: `src/lib/security/audit.ts`
- **Logs to**: `audit_log` table
- **Includes**: User ID, action, resource type, execution time

## Job Queue (Background Jobs)

### BullMQ Configuration
- **Queue**: Job processing
- **Backend**: Redis (ioredis)
- **Location**: `src/lib/jobs/queue.ts`

### Workers
- **Location**: `src/lib/jobs/workers/`
- **Types**: Export, Report, Email Batch
- **Runner**: `src/lib/jobs/worker-runner.ts`

## Key Design Decisions

### Why SQLite?
- Zero configuration
- Single file database
- Fast for read-heavy workloads
- Embedded in application
- Sufficient for config/metadata storage

### Why Kysely?
- Query builder with type safety
- Database agnostic (supports multiple DBs)
- Migration system built-in
- Good TypeScript support

### Why TanStack Router?
- Server components by default
- Better performance
- Streaming support
- Improved data fetching patterns

### Why TanStack Query?
- Automatic caching
- Background refetching
- Optimistic updates
- Good TypeScript support

## Environment Variables

```bash
# Database
DATABASE_PATH=./data/config.sqlite

# Authentication
AUTH_SECRET=<32-char random string>
AUTH_URL=http://localhost:4050/api/auth

# Encryption
ENCRYPTION_KEY=<32-byte hex>

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=<password>

# Job Processing
MAX_CONCURRENT_JOBS=5

# Pagination
DEFAULT_PAGE_SIZE=50
MAX_PAGE_SIZE=1000
DATA_TABLE_PAGE_SIZE=100

# Error Reporting
NEXT_PUBLIC_ERROR_REPORTING_EMAIL=admin@example.com
```

## SQL Editor

### Monaco Editor Configuration
- **Language**: SQL
- **Height**: 400px
- **Options**:
  - `automaticLayout: false` (prevents resize loops)
  - `readOnly: false`
  - Theme switches with app theme

### Keyboard Shortcuts
- `Cmd/Ctrl + Enter`: Execute query
- `Shift + Alt + F`: Format SQL

### Panel System
Resizable panels using `react-resizable-panels`:
- Schema Browser (left, 10-40% width)
- SQL Editor (top, 20-80% height)
- Results Panel (bottom, 20-80% height)

## Performance

### Virtual Scrolling
- **Library**: `@tanstack/react-virtual`
- **Threshold**: 500 rows
- **Location**: `src/components/sql-editor/query-results.tsx`

### Connection Pooling
- SQLite: Single connection (better-sqlite3)
- Other DBs: Pool of 10 (min: 0, max: 10)
- **Location**: `src/lib/db/connection-manager.ts`

## Quick Reference

### Default Credentials
- Admin: `admin@admin.com` / `admin`
- Analyst: `analyst@example.com` / `analyst123`

### Database Paths
- Main: `data/config.sqlite`
- Sakila Demo: `data/uploads/sakila.db`

### URLs
- App: http://localhost:4050
- Login: http://localhost:4050/login
- SQL Editor: http://localhost:4050/sql-editor

## WASM Hybrid Architecture (Partially Implemented)

The system supports **dual execution modes** - server-side (original) and client-side WASM.

### Status Overview

| Component | Status | Feature Flag |
|-----------|--------|--------------|
| DuckDB-Wasm | ✅ Implemented | `NEXT_PUBLIC_WASM_ENABLED=true` |
| TanStack Table | ✅ Implemented | Always enabled |
| Apache ECharts | ✅ Implemented | `NEXT_PUBLIC_ECHARTS_ENABLED=true` |
| Parquet Export API | ⚠️ Partial | Dataset cache table exists |
| Arrow IPC Streaming | ⚠️ Functional | Uses Arrow IPC (functionally equivalent) |
| Cross-Widget Filtering | ✅ Implemented | `NEXT_PUBLIC_CROSSFILTER_ENABLED=true` |
| Offline Mode | ✅ Implemented | `NEXT_PUBLIC_OFFLINE_ENABLED=true` |
| Progressive Loading | ✅ Implemented | `NEXT_PUBLIC_PROGRESSIVE_ENABLED=true` |

### Execution Mode Selection

The system automatically chooses execution mode based on:
- Feature flags (`.env` configuration)
- Browser capabilities (WebAssembly, SharedArrayBuffer, IndexedDB)
- Dataset size thresholds:
  - ≤100MB: Client-side (DuckDB-Wasm)
  - 100-500MB: Based on available memory
  - >500MB: Server-side (forced)

**Location:** `src/lib/query/query-adapter.ts`

### WASM Components

| Component | File | Purpose |
|-----------|------|---------|
| DuckDBProvider | `src/components/duckdb/DuckDBProvider.tsx` | React context for DuckDB instance |
| MemoryMonitor | `src/components/duckdb/MemoryMonitor.tsx` | Track WASM memory usage |
| DataTable | `src/components/reporting/DataTable.tsx` | TanStack Table with virtual scrolling |
| EChartsRenderer | `src/components/echarts/EChartsRenderer.tsx` | Chart rendering |
| Datasets API | `src/app/api/datasets/` | Dataset management |
| CrossFilterProvider | `src/components/dashboard/CrossFilterProvider.tsx` | Dashboard cross-filtering |
| OfflineIndicator | `src/components/wasm/OfflineIndicator.tsx` | Offline status indicator |

See `WASM_STATUS.md` for detailed implementation status.
