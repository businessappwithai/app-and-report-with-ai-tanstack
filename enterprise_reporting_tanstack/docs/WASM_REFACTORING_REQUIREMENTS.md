# Enterprise Reporting System — WASM-Centric Refactoring Requirements Document

**Document Version:** 1.1
**Date:** 2026-02-27 (Updated: 2026-03-04)
**Status:** 🟡 **Partially Implemented** - See [WASM_STATUS.md](./WASM_STATUS.md) for current status
**Author:** Architecture Team

---

## ⚠️ Implementation Status Notice

**This requirements document represents the target architecture for the WASM-centric refactoring.** The system is currently being migrated according to these requirements.

**Current Implementation Progress:**
| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Infrastructure (DuckDB, Parquet API, Arrow transport) | ✅ Complete | 100% |
| Phase 2: Table Replacement (Glide Data Grid) | ✅ Complete | 100% |
| Phase 3: Chart Replacement (ECharts) | ✅ Complete | 100% |
| Phase 4: Dashboard Integration (cross-filtering) | ✅ Complete | 100% |
| Phase 5: Advanced Features (offline, progressive) | ✅ Complete | 100% |

**Overall Progress:** ~100% complete (all core phases implemented)

**See [WASM_STATUS.md](./WASM_STATUS.md) for:**
- Detailed component-by-component status
- Feature flag configuration
- Usage examples
- Troubleshooting guide

---

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Target Architecture Overview](#3-target-architecture-overview)
4. [Detailed Requirements](#4-detailed-requirements)
5. [Component Replacement Matrix](#5-component-replacement-matrix)
6. [Data Flow Transformation](#6-data-flow-transformation)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Migration Constraints](#9-migration-constraints)
10. [Risk Assessment](#10-risk-assessment)
11. [Out of Scope](#11-out-of-scope)
12. [Glossary](#12-glossary)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the requirements for refactoring the Enterprise Reporting and Dashboard System from a **server-side SQL execution architecture** to a **WASM-centric, client-side processing architecture**. The goal is to achieve instant in-browser filtering, aggregation, and visualization on millions of rows without server round trips — delivering a Kepler-like interactive experience for tables, charts, and maps.

### 1.2 Target Stack

| Layer | Current Technology | Target Technology | License |
|-------|-------------------|-------------------|---------|
| Query Engine | Server-side SQLite via Kysely | **DuckDB-Wasm** (in-browser SQL) | MIT |
| Data Grid | TanStack Table + virtual scroll | **Glide Data Grid** (canvas-based) | MIT |
| Charts | Recharts (SVG-based) | **Apache ECharts** (canvas-based) | Apache-2.0 |
| Data Format | JSON over HTTP | **Apache Arrow / Parquet** | Apache-2.0 |
| Transport | REST API → JSON | Arrow IPC / Parquet files over HTTP | Apache-2.0 |

### 1.3 Key Value Proposition

- **Instant interactions**: Filters, aggregations, and sorts execute locally in DuckDB-Wasm — no server round trips
- **Millions of rows**: DuckDB's columnar engine + Arrow format handle large datasets efficiently in-browser
- **Rich visualizations**: ECharts provides maps, heatmaps, tree charts, graph charts, and 40+ chart types
- **Offline capability**: Once data is loaded, the browser can operate independently of the server
- **Reduced server load**: Server becomes a data provider (Parquet/Arrow files); computation moves to client

---

## 2. Current System Analysis

### 2.1 Architecture Overview

The current system is a **TanStack Start** application using **Bun runtime** with a classic server-centric data flow:

```
[Browser] → REST API → [TanStack Start Server] → Kysely → [SQLite/PostgreSQL/MySQL/MSSQL/Oracle]
                                          ↓
                                    JSON Response
                                          ↓
                                [Browser] → TanStack Table / Recharts
```

**Every data operation** (filter, sort, paginate, aggregate) requires a server round trip.

### 2.2 Current Dependencies Being Replaced

| Package | Current Role | Reason for Replacement |
|---------|-------------|----------------------|
| `recharts@2.12.7` | SVG-based charting (8 types: bar, line, area, pie, scatter, column, doughnut, composed) | Limited chart types, SVG performance degrades with large datasets, no maps/heatmaps/trees |
| `@tanstack/react-table@8.20.5` | Table rendering with virtual scrolling | Not canvas-based; DOM-based virtualization has limits at millions of rows |
| `@tanstack/react-virtual@3.10.7` | Row virtualization for QueryResults | Replaced by Glide's native canvas virtualization |
| `react-grid-layout@1.4.4` | Dashboard grid layout | **Retained** — orthogonal to data rendering concerns |
| `kysely@0.29.0` | Server-side SQL query builder | **Retained for config DB — DuckDB-Wasm handles analytical queries client-side |
| `better-sqlite3@11.3.0` | Server-side SQLite access | **Retained for config DB** — stores metadata, users, roles, permissions |
| `node-sql-parser@5.4.0` | SQL validation/AST parsing | Partially replaced — DuckDB-Wasm has its own SQL parser; server-side validation still needed for config queries |
| `sql-formatter@15.4.2` | SQL formatting | **Retained** — still useful for display formatting |

### 2.3 Current Dependencies Being Retained

| Package | Role | Why Retained |
|---------|------|-------------|
| `next@14.2.11` | App framework | Core framework — no change |
| `next-auth@5.0.0-beta.21` | Authentication | Auth layer is orthogonal to data processing |
| `@tanstack/react-query@5.56.2` | Data fetching/caching | Still useful for API calls, metadata fetching, caching |
| `@tanstack/react-form@1.28.3` | Form management | Forms unchanged |
| `@hookform/resolvers@3.9.0` + `react-hook-form@7.53.0` | Form validation | Forms unchanged |
| `@monaco-editor/react@4.6.0` | SQL editor | **Enhanced** — will target DuckDB SQL dialect |
| `zod@3.23.8` | Schema validation | General utility — retained |
| `bullmq@5.12.15` + `ioredis@5.4.1` | Background job processing | Server-side jobs still needed for exports, email batch |
| `exceljs@4.4.0` | XLSX export | Export still server-side for large files |
| `jspdf@2.5.2` | PDF export | Export still server-side |
| `nodemailer@7.0.13` | Email service | Server-side only |
| All `@radix-ui/*` | UI primitives | shadcn/ui foundation — retained |
| `tailwindcss@3.4.11` | Styling | Styling layer unchanged |
| `lucide-react@0.441.0` | Icons | UI unchanged |
| `sonner@1.5.0` | Toast notifications | UI unchanged |
| `@copilotkit/*` | AI integration | NL query feature — can target DuckDB SQL |
| `@mastra/core@1.4.0` | AI agent | Retained |
| `date-fns@3.6.0` | Date utilities | Utility — retained |
| `lodash@4.17.21` | General utilities | Utility — retained |

### 2.4 Current Data Flow (Being Transformed)

#### 2.4.1 SQL Editor Flow (Current)
```
User types SQL → POST /api/sql/execute → Server validates → Server executes via Kysely →
JSON response (max 500 rows) → Client renders in QueryResults (virtual scroll)
```

**Problem**: 500 row page limit, server round trip for every page/filter change.

#### 2.4.2 Report Viewing Flow (Current)
```
User opens report → GET /api/reports/[id] → Fetch saved query → Execute query server-side →
Apply filter-to-SQL → Return JSON (max 1000 rows) → DataTable with pagination
```

**Problem**: Server-side pagination means user must paginate to see more data; filtering requires re-execution.

#### 2.4.3 Chart Rendering Flow (Current)
```
Chart definition loaded → Fetch saved query → Execute query → Return JSON data →
Recharts SVG rendering → User interaction requires re-query
```

**Problem**: SVG performance limits, no drill-down without server calls, limited chart types.

#### 2.4.4 Dashboard Widget Flow (Current)
```
Dashboard loaded → Fetch all widgets → For each widget: fetch chart/report data via API →
Render independently → No cross-widget filtering
```

**Problem**: N+1 API calls, no linked filtering between widgets.

### 2.5 Current Feature Inventory

| Feature | Current Implementation | Files Involved |
|---------|----------------------|----------------|
| **8 chart types** | Recharts: bar, line, area, pie, scatter, column, doughnut, composed | `src/components/charts/ChartRenderer.tsx` |
| **Data tables** | TanStack Table + virtual scroll, client/server pagination | `src/components/reporting/DataTable.tsx`, `src/components/sql-editor/QueryResults.tsx` |
| **SQL editor** | Monaco Editor + server execution | `src/components/sql-editor/MonacoSQLEditorWrapper.tsx` |
| **Schema browser** | Server introspection via API | `src/components/sql-editor/SchemaBrowser.tsx` |
| **SQL validation** | Server-side AST parsing | `src/lib/sql/validator.ts` |
| **Dashboard grid** | react-grid-layout, 4 widget types | `src/components/dashboard/DashboardGrid.tsx`, `WidgetCard.tsx` |
| **Filter system** | Server-side filter-to-SQL, FilterBar UI | `src/lib/reports/filter-to-sql.ts`, `src/components/reporting/FilterBar.tsx` |
| **Report filters** | URL-based filter state | `src/components/reporting/FilterBar.tsx` |
| **Data export** | Server-side CSV/XLSX/PDF generation | `src/lib/jobs/workers/report-worker.ts`, `export-worker.ts` |
| **Email batch** | Server-side report + email via SMTP | `src/lib/jobs/workers/email-batch-worker.ts` |
| **NL query** | CopilotKit + OpenAI → SQL → server exec | `src/components/nl-query/NlQueryWorkspace.tsx` |
| **Multi-DB support** | pg, mysql, mssql, sqlite3, oracledb via Kysely | `src/lib/db/connection-manager.ts` |
| **RBAC** | Role-based permissions with entity-level access | `src/lib/auth/rbac.ts`, `src/lib/permissions/` |
| **Metadata system** | Entity/field introspection and management | `src/lib/metadata/` |
| **Audit logging** | Action logging for security | `src/lib/security/audit.ts` |
| **Job queue** | BullMQ + Redis for background processing | `src/lib/jobs/` |

### 2.6 Current Page Inventory

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard Home | `/` | Main dashboard with summary |
| SQL Editor | `/sql-editor` | Interactive SQL querying |
| Saved Queries | `/queries` | Manage saved queries |
| Reports | `/reports` | Report management and viewing |
| Charts | `/charts` | Chart management |
| Chart Editor | `/charts/editor/[id]` | Create/edit charts |
| Chart Viewer | `/charts/viewer/[id]` | View chart |
| Dashboards | `/dashboards` | Dashboard management |
| Dashboard Viewer | `/dashboards/[id]` | View/edit dashboard |
| Filters | `/filters` | Manage reusable filters |
| Jobs | `/jobs` | Job queue monitoring |
| NL Query | `/nl-query` | Natural language interface |
| Data Sources | `/data-sources` | Data source management |
| Metadata | `/metadata` | Entity metadata management |
| Email Templates | `/email-templates` | Email template management |
| Settings | `/settings` | Application settings |
| Admin Users | `/admin/users` | User management |
| Admin Roles | `/admin/roles` | Role management |
| Admin Permissions | `/admin/permissions` | Permission management |
| Login | `/login` | Authentication |

### 2.7 Current API Route Inventory

**Total API Routes:** 80+ endpoints across these groups:
- `api/auth/` — Authentication (Custom JWT)
- `api/admin/` — Admin operations (users, roles, permissions, queues, audit)
- `api/sql/` — SQL execution, validation, schema introspection
- `api/queries/` — Saved query CRUD + execution
- `api/reports/` — Report CRUD + export + filters
- `api/charts/` — Chart CRUD + filters + data
- `api/dashboards/` — Dashboard CRUD + widgets
- `api/data-sources/` — Data source CRUD + test + inspect + entities + permissions
- `api/filters/` — Filter CRUD + options
- `api/jobs/` — Job CRUD + execution + status + results + cleanup
- `api/metadata/` — Entity metadata CRUD + sync
- `api/email-templates/` — Email template CRUD + preview
- `api/notifications/` — Notification CRUD
- `api/settings/` — Application settings
- `api/health/` — Health check
- `api/nl-query/` — NL query execution + history + schema
- `api/copilotkit/` — CopilotKit integration
- `api/seed/`, `api/setup/`, `api/test/` — Development utilities

---

## 3. Target Architecture Overview

### 3.1 New Data Flow

```
[Server/Data Source]
       ↓
  Export to Parquet/Arrow IPC
       ↓
  HTTP Transfer (static files or streaming)
       ↓
[Browser: DuckDB-Wasm]
  ├── Load Parquet/Arrow into DuckDB tables
  ├── SQL queries execute locally (instant)
  ├── Filter/Sort/Aggregate/Window functions
  ├── Results as Arrow RecordBatch
  ↓
[Rendering Layer]
  ├── Glide Data Grid (canvas-based table)
  ├── Apache ECharts (canvas-based charts)
  └── Dashboard composition
```

### 3.2 Hybrid Architecture

The system will operate in a **hybrid mode**:

**Client-Side (DuckDB-Wasm):**
- All analytical queries (SELECT, filtering, aggregation, sorting, window functions)
- SQL editor execution (against loaded datasets)
- Chart data computation
- Report data computation
- Cross-widget dashboard filtering
- Schema browsing (of loaded datasets)

**Server-Side (Retained):**
- Authentication and session management
- RBAC and permission checks
- Configuration database (users, roles, reports, charts, dashboards definitions)
- Data source management (connection configs, encryption)
- Data export pipeline (Parquet/Arrow file generation from source databases)
- Background jobs (email batch, scheduled exports)
- Audit logging
- NL query AI processing (SQL generation — execution moves to client)

### 3.3 Data Pipeline

```
Source Database (pg/mysql/mssql/sqlite/oracle)
       ↓
[Server] Data Export Service
  ├── Kysely reads from source database
  ├── Converts to Arrow RecordBatch
  ├── Writes as Parquet file (compressed)
  ├── Stores in /data/exports/ (or cloud storage)
  └── Exposes via HTTP endpoint
       ↓
[Client] DuckDB-Wasm Data Loader
  ├── Fetches Parquet file via HTTP
  ├── Registers as DuckDB table
  ├── Caches in IndexedDB for offline
  └── Ready for SQL queries
```

---

## 4. Detailed Requirements

### 4.1 DuckDB-Wasm Integration Requirements

#### REQ-DDB-001: DuckDB-Wasm Engine Initialization
- System SHALL initialize DuckDB-Wasm engine on application load
- System SHALL use Web Workers for DuckDB execution to avoid blocking the UI thread
- System SHALL provide a React context/provider for DuckDB instance sharing
- System SHALL handle initialization failures gracefully with error boundaries

#### REQ-DDB-002: Data Loading
- System SHALL support loading Parquet files into DuckDB-Wasm tables
- System SHALL support loading Arrow IPC buffers into DuckDB-Wasm tables
- System SHALL support loading CSV data into DuckDB-Wasm tables (fallback)
- System SHALL support loading JSON data into DuckDB-Wasm tables (backward compat)
- System SHALL track loading progress and display it to users
- System SHALL support incremental/streaming data loading for very large datasets

#### REQ-DDB-003: Query Execution
- System SHALL execute SQL queries locally in DuckDB-Wasm
- System SHALL support the full DuckDB SQL dialect (extensions of PostgreSQL)
- System SHALL return results as Arrow RecordBatch for zero-copy rendering
- System SHALL provide query execution time metrics
- System SHALL support parameterized queries
- System SHALL support concurrent queries (via connection pooling in DuckDB-Wasm)

#### REQ-DDB-004: Schema Management
- System SHALL maintain a local schema registry of loaded datasets
- System SHALL provide schema introspection for loaded DuckDB tables
- System SHALL support the `DESCRIBE` and `SHOW TABLES` commands
- System SHALL expose column types, nullability, and statistics

#### REQ-DDB-005: Memory Management
- System SHALL monitor DuckDB-Wasm memory usage
- System SHALL warn users when approaching memory limits (configurable threshold)
- System SHALL support unloading datasets to free memory
- System SHALL gracefully handle out-of-memory conditions
- System SHALL support spilling to disk (IndexedDB) for large datasets when possible

#### REQ-DDB-006: Caching
- System SHALL cache loaded datasets in IndexedDB for faster subsequent loads
- System SHALL support cache invalidation (TTL-based and manual)
- System SHALL track cache freshness metadata (last loaded, source version)
- System SHALL support offline operation from cached data

### 4.2 Glide Data Grid Requirements

#### REQ-GDG-001: Table Rendering
- System SHALL render tabular data using Glide Data Grid's canvas-based renderer
- System SHALL support smooth scrolling across millions of rows
- System SHALL support dynamic column widths (auto-size + manual resize)
- System SHALL support column reordering via drag-and-drop
- System SHALL support frozen columns (left/right)
- System SHALL support row selection (single + multi)

#### REQ-GDG-002: Cell Types
- System SHALL render appropriate cell types based on data:
  - Text, Number, Boolean (checkbox), Date/DateTime, URL (clickable link)
  - NULL values (distinct visual indicator)
  - JSON/Object (expandable)
  - Image (thumbnail)
- System SHALL support custom cell renderers for domain-specific formatting

#### REQ-GDG-003: Inline Editing (Optional Phase 2)
- System MAY support inline cell editing for writable data sources
- System SHALL validate edited values against column type constraints
- System SHALL track dirty cells and support batch save

#### REQ-GDG-004: Data Integration
- System SHALL consume Arrow RecordBatch data directly from DuckDB-Wasm
- System SHALL implement efficient data callbacks (Glide's `getCellContent`)
- System SHALL avoid unnecessary data copying between DuckDB and grid
- System SHALL support lazy loading rows on demand (for datasets too large to fully materialize)

#### REQ-GDG-005: Column Features
- System SHALL support column sorting (click header) — triggers DuckDB ORDER BY
- System SHALL support column filtering (header filter row) — triggers DuckDB WHERE
- System SHALL support column aggregation footer (SUM, AVG, COUNT, MIN, MAX)
- System SHALL support column hiding/showing

#### REQ-GDG-006: Export from Grid
- System SHALL support copying selected cells to clipboard
- System SHALL support exporting visible/filtered data to CSV
- System SHALL support "Export All" that delegates to server-side job for large datasets

### 4.3 Apache ECharts Requirements

#### REQ-ECH-001: Chart Types
System SHALL support the following chart types (minimum):
- **Basic**: Bar, Line, Area, Pie, Doughnut, Scatter (replaces current Recharts types)
- **Advanced**: Heatmap, Treemap, Sunburst, Sankey, Funnel, Gauge
- **Geospatial**: Map (choropleth), Geo scatter
- **Relational**: Graph/Network, Tree
- **Statistical**: Boxplot, Candlestick, Parallel coordinates
- **3D** (optional): 3D bar, 3D scatter, 3D surface (via echarts-gl)

#### REQ-ECH-002: Interactivity
- System SHALL support zooming (dataZoom component)
- System SHALL support brushing/selection (brush component)
- System SHALL support tooltips with custom formatters
- System SHALL support legend toggling (show/hide series)
- System SHALL support drill-down (click chart element → filter dataset → re-render)
- System SHALL support linked charts (selecting in one chart filters others)

#### REQ-ECH-003: Data Integration
- System SHALL consume data from DuckDB-Wasm query results
- System SHALL support dataset component for declarative data binding
- System SHALL support data transforms (sort, filter, aggregate) within ECharts
- System SHALL support large dataset mode (`large: true`) for millions of points
- System SHALL support progressive rendering for very large datasets

#### REQ-ECH-004: Theming
- System SHALL support light/dark themes (matching application theme)
- System SHALL support custom color palettes
- System SHALL support responsive sizing
- System SHALL integrate with the existing HSL CSS variable system

#### REQ-ECH-005: Chart Editor
- System SHALL provide a visual chart editor for creating/editing chart configurations
- System SHALL support live preview during editing
- System SHALL support configuration via both form-based UI and raw JSON editor
- System SHALL validate chart configurations before saving

### 4.4 Data Format & Transport Requirements

#### REQ-FMT-001: Parquet Support
- System SHALL generate Parquet files server-side from source database queries
- System SHALL use Snappy compression for Parquet files (best decompression speed)
- System SHALL support Parquet metadata for schema discovery
- System SHALL support column pruning (load only needed columns)
- System SHALL support row group filtering (predicate pushdown where possible)

#### REQ-FMT-002: Arrow IPC Support
- System SHALL support Apache Arrow IPC format for streaming data
- System SHALL use Arrow IPC for real-time/incremental data updates
- System SHALL leverage zero-copy semantics where possible
- System SHALL support Arrow-to-DuckDB table registration

#### REQ-FMT-003: Server-Side Export API
- System SHALL provide API endpoints to export query results as Parquet
- System SHALL provide API endpoints to export query results as Arrow IPC
- System SHALL support streaming large exports (chunked transfer)
- System SHALL support caching exported files with ETags/Last-Modified
- System SHALL enforce RBAC on data exports (same permissions as query execution)

---

## 5. Component Replacement Matrix

### 5.1 Direct Replacements

| Current Component | File(s) | Replacement | Migration Complexity |
|---|---|---|---|
| `ChartRenderer.tsx` | `src/components/charts/ChartRenderer.tsx` | `EChartsRenderer.tsx` | **High** — 8 chart types to re-implement + new types to add |
| `DataTable.tsx` | `src/components/reporting/DataTable.tsx` | `GlideDataTable.tsx` | **High** — TanStack Table → Glide Data Grid, pagination → infinite scroll |
| `QueryResults.tsx` | `src/components/sql-editor/QueryResults.tsx` | `GlideQueryResults.tsx` | **Medium** — Virtual scroll → Glide, maintain metrics display |
| `FilterBar.tsx` | `src/components/reporting/FilterBar.tsx` | `DuckDBFilterBar.tsx` | **Medium** — URL filters → DuckDB WHERE clauses |
| SQL execution API | `src/app/api/sql/execute/route.ts` | Client-side DuckDB.exec() | **High** — Server→Client paradigm shift |
| Schema introspection | `src/lib/sql/schema-introspection.ts` | DuckDB `DESCRIBE` + `SHOW TABLES` | **Medium** — Replace per-dialect introspection |
| `WidgetCard.tsx` | `src/components/dashboard/WidgetCard.tsx` | `WasmWidgetCard.tsx` | **Medium** — Widget rendering uses new chart/table components |
| `NlResultsTable.tsx` | `src/components/nl-query/NlResultsTable.tsx` | `GlideNlResults.tsx` | **Low** — Simple table replacement |
| `NlResultsChart.tsx` | `src/components/nl-query/NlResultsChart.tsx` | `EChartsNlResults.tsx` | **Low** — ChartRenderer swap |

### 5.2 New Components (Required)

| Component | Purpose | Priority |
|-----------|---------|----------|
| `DuckDBProvider.tsx` | React context for DuckDB-Wasm instance | **Critical** |
| `DataLoader.tsx` | UI for loading/managing datasets in DuckDB | **Critical** |
| `ParquetExportAPI` | Server endpoint to generate Parquet from source DBs | **Critical** |
| `ArrowTransport` | Utility layer for Arrow IPC transfer | **High** |
| `EChartsThemeProvider.tsx` | ECharts theme integration with app theme | **High** |
| `DatasetManager.tsx` | Manage loaded datasets, memory, cache | **High** |
| `AdvancedChartEditor.tsx` | Extended chart editor for new ECharts types | **Medium** |
| `CrossFilterManager.tsx` | Linked filtering across dashboard widgets | **Medium** |
| `OfflineIndicator.tsx` | Show offline status + cached data availability | **Low** |

### 5.3 Unchanged Components

| Component | Reason |
|-----------|--------|
| `DashboardGrid.tsx` | Layout concerns, not data rendering |
| `AddWidgetDialog.tsx` | Widget creation UI — enhanced but not replaced |
| `ConfigureWidgetDialog.tsx` | Widget config UI — enhanced but not replaced |
| `MonacoSQLEditorWrapper.tsx` | SQL editor — enhanced for DuckDB dialect |
| `SchemaBrowser.tsx` | Schema display — data source changes, UI stays |
| `ValidationPanel.tsx` | Validation display — validation source changes |
| `AppShell.tsx` | Layout — unchanged |
| `Sidebar.tsx` | Navigation — may add "Datasets" link |
| `Header.tsx` | Top bar — unchanged |
| `Breadcrumb.tsx` | Navigation — unchanged |
| All `src/components/ui/*` | shadcn/ui primitives — unchanged |

---

## 6. Data Flow Transformation

### 6.1 SQL Editor Flow (New)

```
User types SQL
    ↓
[Client] DuckDB-Wasm validates syntax
    ↓
[Client] DuckDB-Wasm executes query locally
    ↓
Results as Arrow RecordBatch
    ↓
Glide Data Grid renders (canvas, smooth scroll)
    ↓
User filters/sorts → DuckDB re-executes → instant re-render
```

**Key changes:**
- No server round trip for query execution
- No 500-row page limit — DuckDB handles full results
- Filtering/sorting is instant (local SQL re-execution)
- Schema browser reads from DuckDB `information_schema`

### 6.2 Report Viewing Flow (New)

```
User opens report
    ↓
Fetch report definition (metadata from config DB)
    ↓
Fetch associated dataset (Parquet from server)
    ↓
Load into DuckDB-Wasm
    ↓
Apply report's saved SQL + filter config → DuckDB executes locally
    ↓
Glide Data Grid renders full results
    ↓
User applies filters → DuckDB re-executes → instant re-render
User sorts → DuckDB ORDER BY → instant re-render
User aggregates → DuckDB GROUP BY → instant re-render
```

### 6.3 Chart Rendering Flow (New)

```
Chart definition loaded (config from server)
    ↓
Dataset loaded into DuckDB-Wasm (if not already cached)
    ↓
Chart SQL query executes locally in DuckDB
    ↓
Results → Apache ECharts option object
    ↓
ECharts renders (canvas, progressive for large datasets)
    ↓
User interacts (zoom, brush, drill-down) → DuckDB re-query → instant re-render
```

### 6.4 Dashboard Flow (New)

```
Dashboard loaded
    ↓
Load all required datasets into DuckDB-Wasm (deduplicated)
    ↓
Each widget queries DuckDB locally
    ↓
Cross-widget filter manager:
  User clicks chart element in Widget A
    → CrossFilterManager propagates filter condition
    → All linked widgets re-query DuckDB with new WHERE clause
    → All widgets re-render instantly
```

### 6.5 Data Ingestion Flow (New)

```
Admin configures data source (unchanged)
    ↓
Admin triggers "Prepare Dataset" for a query/table
    ↓
Server executes query against source database (Kysely)
    ↓
Server converts results to Parquet (with Arrow intermediate)
    ↓
Parquet file stored on server with metadata (schema, row count, size, timestamp)
    ↓
Client requests dataset → HTTP GET → Parquet file streamed to browser
    ↓
DuckDB-Wasm loads Parquet → cached in IndexedDB
    ↓
Subsequent loads use cache if not stale
```

---

## 7. Functional Requirements

### 7.1 Data Management

| ID | Requirement | Priority |
|----|------------|----------|
| FR-DM-001 | Users SHALL be able to load datasets from configured data sources into the browser | Critical |
| FR-DM-002 | Users SHALL be able to see loaded datasets and their memory consumption | Critical |
| FR-DM-003 | Users SHALL be able to unload datasets to free memory | High |
| FR-DM-004 | System SHALL display loading progress for dataset transfers | High |
| FR-DM-005 | System SHALL cache datasets in IndexedDB for offline use | Medium |
| FR-DM-006 | System SHALL auto-refresh stale cached datasets | Medium |
| FR-DM-007 | System SHALL support loading datasets from file upload (CSV, Parquet) | Medium |

### 7.2 Query Execution

| ID | Requirement | Priority |
|----|------------|----------|
| FR-QE-001 | Users SHALL execute SQL queries against loaded datasets in the browser | Critical |
| FR-QE-002 | Query results SHALL render in Glide Data Grid with smooth scrolling | Critical |
| FR-QE-003 | System SHALL display query execution time and row count | High |
| FR-QE-004 | Users SHALL be able to save queries (stored in config DB on server) | High |
| FR-QE-005 | System SHALL validate SQL syntax client-side via DuckDB | High |
| FR-QE-006 | System SHALL support DuckDB SQL dialect (QUALIFY, EXCLUDE, etc.) | Medium |
| FR-QE-007 | System SHALL provide autocomplete for table/column names | Medium |

### 7.3 Visualization

| ID | Requirement | Priority |
|----|------------|----------|
| FR-VIS-001 | System SHALL support all current chart types (bar, line, area, pie, scatter, doughnut, composed) | Critical |
| FR-VIS-002 | System SHALL add heatmap chart type | High |
| FR-VIS-003 | System SHALL add treemap chart type | High |
| FR-VIS-004 | System SHALL add geographic map chart type | High |
| FR-VIS-005 | System SHALL add graph/network chart type | Medium |
| FR-VIS-006 | System SHALL add tree chart type | Medium |
| FR-VIS-007 | System SHALL add sunburst chart type | Medium |
| FR-VIS-008 | System SHALL add sankey diagram type | Low |
| FR-VIS-009 | System SHALL add gauge chart type | Low |
| FR-VIS-010 | Charts SHALL support drill-down interaction | High |
| FR-VIS-011 | Charts SHALL support data zoom | High |
| FR-VIS-012 | Charts SHALL support brush selection | Medium |

### 7.4 Dashboard

| ID | Requirement | Priority |
|----|------------|----------|
| FR-DSH-001 | Dashboards SHALL continue to support drag-and-drop layout | Critical |
| FR-DSH-002 | Dashboard widgets SHALL render using ECharts and Glide Data Grid | Critical |
| FR-DSH-003 | Dashboards SHALL support cross-widget filtering | High |
| FR-DSH-004 | Dashboard data SHALL load once and be shared across widgets | High |
| FR-DSH-005 | Dashboards SHALL support auto-refresh with configurable intervals | Medium |

### 7.5 Reports

| ID | Requirement | Priority |
|----|------------|----------|
| FR-RPT-001 | Reports SHALL render in Glide Data Grid with full dataset (no pagination) | Critical |
| FR-RPT-002 | Report filters SHALL execute as DuckDB WHERE clauses (instant) | Critical |
| FR-RPT-003 | Report sorting SHALL execute as DuckDB ORDER BY (instant) | Critical |
| FR-RPT-004 | Report export (CSV/XLSX/PDF) SHALL continue to work via server-side jobs | High |
| FR-RPT-005 | Reports SHALL support column aggregation footers | Medium |
| FR-RPT-006 | Reports SHALL support column grouping/pivoting via DuckDB | Low |

### 7.6 Backward Compatibility

| ID | Requirement | Priority |
|----|------------|----------|
| FR-BC-001 | All existing chart definitions SHALL continue to render correctly | Critical |
| FR-BC-002 | All existing report definitions SHALL continue to render correctly | Critical |
| FR-BC-003 | All existing dashboard layouts SHALL continue to render correctly | Critical |
| FR-BC-004 | All existing saved queries SHALL continue to execute | Critical |
| FR-BC-005 | The existing API contract SHALL be maintained for non-data endpoints | High |
| FR-BC-006 | All existing user/role/permission configurations SHALL be preserved | Critical |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| ID | Requirement | Target |
|----|------------|--------|
| NFR-P-001 | DuckDB-Wasm initialization time | < 2 seconds |
| NFR-P-002 | Simple query execution (SELECT with WHERE on 1M rows) | < 100ms |
| NFR-P-003 | Aggregation query (GROUP BY on 1M rows) | < 500ms |
| NFR-P-004 | Grid rendering (scroll to arbitrary position in 1M rows) | < 16ms (60fps) |
| NFR-P-005 | Chart rendering (10K data points) | < 500ms |
| NFR-P-006 | Chart rendering (1M data points, progressive) | < 2 seconds to first paint |
| NFR-P-007 | Filter application on loaded data | < 100ms |
| NFR-P-008 | Dashboard full load (5 widgets) | < 3 seconds |
| NFR-P-009 | Parquet file transfer (100MB) | Limited by network speed |
| NFR-P-010 | IndexedDB cache read (100MB dataset) | < 1 second |

### 8.2 Scalability

| ID | Requirement | Target |
|----|------------|--------|
| NFR-S-001 | Maximum rows in a single loaded dataset | 10M+ (depends on client RAM) |
| NFR-S-002 | Maximum concurrent loaded datasets | 5+ (depends on total data size) |
| NFR-S-003 | Maximum Parquet file size for transfer | 500MB |
| NFR-S-004 | Maximum chart data points (canvas) | 1M+ (via progressive render) |
| NFR-S-005 | Maximum grid rows (smooth scroll) | 10M+ (via canvas virtualization) |

### 8.3 Compatibility

| ID | Requirement | Target |
|----|------------|--------|
| NFR-C-001 | Browser support | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| NFR-C-002 | SharedArrayBuffer support | Required for DuckDB-Wasm performance |
| NFR-C-003 | COOP/COEP headers | Required (Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy) |
| NFR-C-004 | WebAssembly support | Required |
| NFR-C-005 | IndexedDB support | Required for caching |

### 8.4 Security

| ID | Requirement | Target |
|----|------------|--------|
| NFR-SEC-001 | Data access SHALL still be controlled by server-side RBAC | Mandatory |
| NFR-SEC-002 | Parquet files SHALL only be served to authenticated users | Mandatory |
| NFR-SEC-003 | Client-side data SHALL not bypass permission checks | Mandatory |
| NFR-SEC-004 | Cached data in IndexedDB SHALL respect session expiry | High |
| NFR-SEC-005 | DuckDB-Wasm SHALL not have access to server file system | By design |
| NFR-SEC-006 | COOP/COEP headers SHALL be configured correctly | Mandatory |

### 8.5 Reliability

| ID | Requirement | Target |
|----|------------|--------|
| NFR-R-001 | System SHALL gracefully degrade if DuckDB-Wasm fails to load | Required |
| NFR-R-002 | System SHALL fall back to server-side execution if WASM unavailable | Required |
| NFR-R-003 | System SHALL handle browser tab crashes from memory pressure | Required |
| NFR-R-004 | System SHALL recover cached state on page reload | Required |

---

## 9. Migration Constraints

### 9.1 Database Schema

- **No changes** to the configuration database schema (users, roles, reports, charts, dashboards, etc.)
- The `connection_config` encryption system remains unchanged
- Migration scripts are NOT needed for the config DB
- New server-side tables MAY be needed for:
  - `dataset_cache_registry` — tracks generated Parquet files
  - `dataset_refresh_schedule` — scheduled data exports

### 9.2 API Compatibility

- All `/api/admin/*` routes remain unchanged
- All `/api/auth/*` routes remain unchanged
- All `/api/data-sources/*` routes remain unchanged (enhanced with Parquet export)
- All `/api/jobs/*` routes remain unchanged
- All `/api/email-templates/*` routes remain unchanged
- All `/api/notifications/*` routes remain unchanged
- All `/api/settings/*` routes remain unchanged
- `/api/sql/execute` — **Enhanced**: add Parquet/Arrow output format option
- `/api/queries/[id]/execute` — **Enhanced**: add Parquet/Arrow output format option
- `/api/reports/[id]/data` — **New**: return Parquet for client-side rendering
- `/api/charts/[id]/data` — **New**: return Parquet for client-side rendering
- **New API routes**:
  - `api/datasets/` — Dataset management (list, generate, status, download)
  - `api/datasets/[id]/parquet` — Stream Parquet file
  - `api/datasets/[id]/arrow` — Stream Arrow IPC

### 9.3 Configuration Preservation

- All existing `chart_config` JSON (Recharts format) SHALL be supported via a compatibility adapter
- All existing `data_mapping` JSON SHALL be transformed to ECharts format
- All existing `filter_config` JSON SHALL work with both server and client execution
- All existing `layout_config` JSON for dashboards SHALL work without changes

### 9.4 Phased Migration

The refactoring MUST be done in phases to maintain a working system throughout:

1. **Phase 1**: Infrastructure (DuckDB-Wasm provider, Parquet API, Arrow transport)
2. **Phase 2**: Table replacement (Glide Data Grid for SQL editor + reports)
3. **Phase 3**: Chart replacement (ECharts for all chart types + new types)
4. **Phase 4**: Dashboard integration (cross-filtering, shared datasets)
5. **Phase 5**: Advanced features (offline, progressive loading, 3D charts)

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DuckDB-Wasm memory limits on low-RAM devices | High | Medium | Memory monitoring, dataset size warnings, server fallback |
| SharedArrayBuffer requirement limits browser compat | Medium | Low | COOP/COEP headers, fallback to single-threaded mode |
| Parquet file generation adds server complexity | Medium | Medium | Use established libraries (parquet-wasm, arrow-js) |
| ECharts bundle size increase | Low | High | Tree-shaking, lazy loading chart types on demand |
| Glide Data Grid learning curve | Low | Medium | Good documentation, similar API patterns |
| DuckDB SQL dialect differences from source DBs | Medium | Medium | Adapter layer for query translation |
| IndexedDB storage limits (Safari ~1GB) | Medium | Low | Storage quota monitoring, LRU eviction |

### 10.2 Project Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large scope — many components to replace | High | High | Phased approach, maintain old components as fallback |
| Breaking changes to chart config format | High | Medium | Compatibility adapter for Recharts→ECharts config |
| Performance regression during transition | Medium | Medium | Feature flags to toggle old/new components |
| Increased initial load time (WASM download) | Medium | Medium | Lazy load DuckDB-Wasm, CDN hosting |

---

## 11. Out of Scope

The following are explicitly **NOT** part of this refactoring:

1. **Authentication/Authorization changes** — Custom JWT + RBAC stays as-is
2. **Database schema changes** for the config DB — schema preserved
3. **Docker/deployment changes** — may need COOP/COEP header config in Nginx
4. **UI framework change** — TanStack Start, shadcn/ui, Tailwind stay as-is
5. **Background job system changes** — BullMQ + Redis stays as-is
6. **Email system changes** — Nodemailer stays as-is
7. **AI/NL query model changes** — OpenAI/CopilotKit stays (execution moves to client)
8. **Admin pages** — User/Role/Permission management pages stay as-is
9. **React upgrade** — Staying on React 18

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **DuckDB-Wasm** | In-browser analytical SQL database compiled to WebAssembly; runs SQL locally without a server |
| **Glide Data Grid** | Canvas-based React data grid that renders cells on HTML5 Canvas instead of DOM elements |
| **Apache ECharts** | JavaScript charting library using Canvas/SVG rendering with 40+ chart types |
| **Apache Arrow** | Columnar memory format for flat and hierarchical data; enables zero-copy data sharing |
| **Parquet** | Columnar file format optimized for analytics; supports compression and predicate pushdown |
| **Arrow IPC** | Arrow's Inter-Process Communication format for streaming columnar data |
| **COOP/COEP** | Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy — HTTP headers required for SharedArrayBuffer |
| **SharedArrayBuffer** | JavaScript API for shared memory between threads; required for DuckDB-Wasm multi-threading |
| **Progressive Rendering** | Rendering technique that shows partial results immediately, completing over time |
| **Cross-Widget Filtering** | Dashboard feature where interacting with one widget filters data in all linked widgets |
| **Predicate Pushdown** | Optimization that applies filter conditions during data loading rather than after |

---

## Appendix A: New Package Dependencies

```json
{
  "dependencies": {
    "@duckdb/duckdb-wasm": "^1.29.0",
    "@glideapps/glide-data-grid": "^6.0.0",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.0",
    "apache-arrow": "^17.0.0",
    "parquet-wasm": "^0.7.0"
  }
}
```

**Bundle size impact estimates:**
- DuckDB-Wasm: ~10MB (loaded async, cached by browser)
- Glide Data Grid: ~300KB (gzipped)
- Apache ECharts: ~800KB full, ~300KB tree-shaken (gzipped)
- Apache Arrow JS: ~150KB (gzipped)
- Parquet-Wasm: ~2MB (loaded async)

**Net removal:**
- Recharts: ~200KB (gzipped) — removed
- @tanstack/react-table: ~50KB — removed
- @tanstack/react-virtual: ~15KB — removed

---

## Appendix B: File Impact Summary

### Files to be REPLACED (new implementation):
- `src/components/charts/ChartRenderer.tsx` → `EChartsRenderer.tsx`
- `src/components/reporting/DataTable.tsx` → `GlideDataTable.tsx`
- `src/components/sql-editor/QueryResults.tsx` → `GlideQueryResults.tsx`
- `src/components/reporting/FilterBar.tsx` → `DuckDBFilterBar.tsx`
- `src/components/dashboard/WidgetCard.tsx` → `WasmWidgetCard.tsx`
- `src/components/nl-query/NlResultsTable.tsx` → `GlideNlResults.tsx`
- `src/components/nl-query/NlResultsChart.tsx` → `EChartsNlResults.tsx`

### Files to be CREATED (new capabilities):
- `src/lib/duckdb/` — DuckDB-Wasm integration layer
- `src/lib/arrow/` — Arrow/Parquet utilities
- `src/components/duckdb/` — DuckDB UI components
- `src/components/echarts/` — ECharts components
- `src/components/glide/` — Glide Data Grid components
- `src/app/api/datasets/` — Dataset management API routes

### Files to be MODIFIED (enhanced):
- `src/app/providers.tsx` — Add DuckDB provider
- `src/app/(dashboard)/layout.tsx` — May add dataset context
- `src/components/sql-editor/MonacoSQLEditorWrapper.tsx` — DuckDB SQL dialect
- `src/components/sql-editor/SchemaBrowser.tsx` — DuckDB schema source
- `src/components/dashboard/AddWidgetDialog.tsx` — New widget types
- `src/components/layout/Sidebar.tsx` — Add "Datasets" navigation
- `src/app/api/sql/execute/route.ts` — Add Parquet/Arrow output
- `src/app/api/queries/[id]/execute/route.ts` — Add Parquet/Arrow output
- `vite.config.ts` — COOP/COEP headers, WASM support
- `package.json` — New dependencies

### Files UNCHANGED:
- All `src/components/ui/*` (shadcn/ui)
- All `src/lib/auth/*`
- All `src/lib/permissions/*`
- All `src/lib/security/*`
- All `src/lib/email/*`
- All `src/lib/metadata/*`
- All `src/lib/jobs/*`
- All `src/lib/queue/*`
- All `src/lib/db/*` (config database layer)
- All admin pages and API routes
- All auth pages and API routes

---

*End of Requirements Document*
