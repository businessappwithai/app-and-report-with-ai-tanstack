# Enterprise Reporting System — WASM-Centric Architecture & Design Document

**Document Version:** 1.2
**Date:** 2025-02-27 (Updated: 2026-03-04)
**Status:** 🟢 **Fully Implemented** - See [WASM_STATUS.md](./WASM_STATUS.md) for current implementation status
**Author:** Architecture Team
**Related Documents:**
- [WASM_REFACTORING_REQUIREMENTS.md](./WASM_REFACTORING_REQUIREMENTS.md) - Requirements
- [WASM_STATUS.md](./WASM_STATUS.md) - Implementation Status

---

## ⚠️ Implementation Status Notice

**This architecture design is being actively implemented.** The system currently operates in a **hybrid mode** with both server-side and client-side (WASM) execution available.

**Current Implementation Status:**
- ✅ DuckDB-Wasm integration complete
- ✅ Glide Data Grid implemented
- ✅ Apache ECharts implemented
- ✅ Feature flags system operational
- ✅ Cross-widget filtering implemented
- ✅ Offline mode with IndexedDB caching implemented
- ✅ Progressive loading for large datasets implemented
- ⚠️ Parquet export pipeline uses Arrow IPC (functionally equivalent)

See [WASM_STATUS.md](./WASM_STATUS.md) for detailed implementation status, feature flags, and usage examples.

---

---

## Table of Contents

1. [Document Overview](#1-document-overview)
2. [Executive Summary](#2-executive-summary)
3. [System Architecture](#3-system-architecture)
4. [Component Architecture](#4-component-architecture)
5. [Data Architecture](#5-data-architecture)
6. [API Design](#6-api-design)
7. [Security Architecture](#7-security-architecture)
8. [Performance Architecture](#8-performance-architecture)
9. [Implementation Design](#9-implementation-design)
10. [Migration Strategy](#10-migration-strategy)
11. [Testing Architecture](#11-testing-architecture)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Appendices](#14-appendices)

---

## 1. Document Overview

### 1.1 Purpose

This document provides the comprehensive architectural and technical design for refactoring the Enterprise Reporting System from a server-side SQL execution architecture to a WASM-centric, client-side processing architecture. It serves as the blueprint for implementation teams, detailing component structures, data flows, security models, and operational considerations.

### 1.2 Scope

This document covers:
- Complete system architecture transformation
- Detailed component designs and interfaces
- Data pipeline and storage strategies
- API contracts and protocols
- Security controls and compliance
- Performance optimization strategies
- Implementation phases and delivery milestones
- Testing and quality assurance approaches
- Deployment and operational procedures

### 1.3 Audience

| Role | Sections of Interest |
|------|---------------------|
| Software Engineers | All sections (primary reference) |
| Technical Leads | Sections 3-9 (architecture focus) |
| DevOps Engineers | Sections 10, 12, 13 (deployment focus) |
| QA Engineers | Section 11 (testing focus) |
| Product Managers | Sections 2, 10 (business impact) |
| Security Architects | Section 7 (security focus) |

---

## 2. Executive Summary

### 2.1 Business Problem

The current Enterprise Reporting System suffers from:
- **Poor user experience**: Every filter, sort, or pagination triggers a server round-trip (200-500ms latency)
- **Limited data scale**: 500-1000 row limits prevent meaningful analysis of large datasets
- **Limited visualizations**: Only 8 basic chart types; no maps, heatmaps, or advanced analytics
- **Server dependency**: Offline operation impossible; server load scales with user activity

### 2.2 Proposed Solution

Transform to a **WASM-centric architecture** where:
- Analytical queries execute in-browser via DuckDB-Wasm (instant response)
- Data transferred once as compressed Parquet files
- Canvas-based rendering (Glide Data Grid, Apache ECharts) handles millions of rows
- Server shifts from compute engine to data provider

### 2.3 Key Benefits

| Area | Current | Target |
|------|---------|--------|
| Query Response | 200-500ms (server round-trip) | <100ms (local execution) |
| Max Rows | 500-1000 | 10M+ (limited by RAM) |
| Chart Types | 8 | 40+ |
| Offline Capability | None | Full (once data loaded) |
| Server Load | Scales with queries | Scales with data transfer only |
| Cross-Widget Filtering | Not supported | Instant, client-side |

### 2.4 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client-Side (Browser)                        │
├─────────────────────────────────────────────────────────────────┤
│ Query Engine    │ DuckDB-Wasm (MIT)                             │
│ Data Grid       │ Glide Data Grid (MIT)                         │
│ Charts          │ Apache ECharts (Apache-2.0)                   │
│ Data Format     │ Apache Arrow / Parquet (Apache-2.0)           │
│ Framework       │ TanStack Start + React 18                         │
│ UI Components   │ shadcn/ui (Radix UI + Tailwind)              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Server-Side (Node/Bun)                       │
├─────────────────────────────────────────────────────────────────┤
│ Runtime         │ Bun >= 1.3.0                                  │
│ Framework       │ TanStack Start (App Router)                       │
│ Config DB       │ SQLite via better-sqlite3                     │
│ Export Engine   │ Apache Arrow JS + Parquet-Wasm                │
│ Auth            │ Custom JWT with jose                          │
│ Jobs            │ BullMQ + Redis                                │
│ Deployment      │ Docker (Bun Alpine) + Nginx                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.5 Delivery Phases

| Phase | Duration | Focus | Value Delivered |
|-------|----------|-------|-----------------|
| **Phase 1** | 4 weeks | Infrastructure (DuckDB, Parquet API) | Foundation |
| **Phase 2** | 4 weeks | Table replacement (Glide Data Grid) | Better data browsing |
| **Phase 3** | 5 weeks | Chart replacement (ECharts) | 40+ chart types |
| **Phase 4** | 3 weeks | Dashboard integration | Cross-widget filtering |
| **Phase 5** | 3 weeks | Advanced features | Offline, 3D, progressive |

**Total Timeline**: 19 weeks (~4.5 months)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER (Browser)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Application Layer (TanStack Start)                      │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐  │   │
│  │  │   Pages       │ │  Components   │ │   Hooks       │ │  Context    │  │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Layer (Client)                             │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │              DuckDB-Wasm Runtime (Web Worker)                     │  │   │
│  │  │  ┌───────────────┐ ┌───────────────┐ ┌─────────────────────────┐ │  │   │
│  │  │  │ Query Engine  │ │ Data Loader   │ │ Schema Registry         │ │  │   │
│  │  │  └───────────────┘ └───────────────┘ └─────────────────────────┘ │  │   │
│  │  └───────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                 │   │
│  │  │ IndexedDB     │ │ Memory Cache  │ │ Query Cache   │                 │   │
│  │  │ (Persistent)  │ │ (Ephemeral)   │ │ (LRU)         │                 │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Rendering Layer                                  │   │
│  │  ┌───────────────────────┐ ┌─────────────────────────────────────────┐  │   │
│  │  │   Glide Data Grid     │ │        Apache ECharts                   │  │   │
│  │  │   (Canvas-based)      │ │        (Canvas-based)                   │  │   │
│  │  └───────────────────────┘ └─────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↕ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SERVER LAYER (Bun/Node)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway (TanStack Start)                            │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │  │   Auth       │ │   RBAC       │ │  Validation  │ │  Rate Limit  │   │   │
│  │  │  (JWT)       │ │  (Custom)    │ │   (Zod)      │ │   (Optional) │   │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     Business Logic Layer                                │   │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    Data Export Service                            │  │   │
│  │  │  ┌───────────────┐ ┌───────────────┐ ┌─────────────────────────┐ │  │   │
│  │  │  │ Source Query  │ │ Arrow         │ │ Parquet Writer          │ │  │   │
│  │  │  │ Executor      │ │ Converter    │ │ (Compressed)            │ │  │   │
│  │  │  └───────────────┘ └───────────────┘ └─────────────────────────┘ │  │   │
│  │  └───────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌───────────────────────┐ ┌───────────────────────┐ ┌────────────────┐ │   │
│  │  │ Metadata Service      │ │ Job Queue Service     │ │ Email Service  │ │   │
│  │  └───────────────────────┘ └───────────────────────┘ └────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                       Data Access Layer                                │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐  │   │
│  │  │ Config DB     │ │ Source DBs    │ │ File Storage  │ │ Redis Cache │  │   │
│  │  │ (SQLite)      │ │ (External)    │ │ (Parquet)     │ │ (BullMQ)    │  │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        ↓
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL DATA SOURCES                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL │ MySQL │ MSSQL │ Oracle │ SQLite │ (Customer's Production DBs)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Architectural Principles

#### 3.2.1 Client-Side Computation
- **Philosophy**: Move computation to data, not data to computation
- **Implementation**: DuckDB-Wasm executes queries on loaded datasets
- **Benefits**: Zero-latency interactions, reduced server load, offline capability

#### 3.2.2 Columnar Data Storage
- **Philosophy**: Store data in columnar format for efficient analytics
- **Implementation**: Apache Arrow for in-memory, Parquet for storage/transfer
- **Benefits**: Compression, predicate pushdown, vectorized processing

#### 3.2.3 Canvas-Based Rendering
- **Philosophy**: Render visual elements on canvas, not DOM
- **Implementation**: Glide Data Grid for tables, ECharts for visualizations
- **Benefits**: Handles millions of rows/points, 60fps scrolling

#### 3.2.4 Progressive Enhancement
- **Philosophy**: Graceful degradation when advanced features unavailable
- **Implementation**: Feature detection, fallback to server-side execution
- **Benefits**: Works on older browsers, low-memory devices

#### 3.2.5 Immutable Data Pipelines
- **Philosophy**: Datasets are immutable snapshots; views are computed queries
- **Implementation**: Parquet files with version hashes, query results cached
- **Benefits**: Reproducible results, easy cache invalidation, time-travel

### 3.3 Hybrid Execution Model

The system supports two execution modes with automatic fallback:

```
┌─────────────────────────────────────────────────────────────────┐
│                   Execution Mode Selection                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Feature Detection                                          │
│     ├─ WASM supported?                                         │
│     ├─ SharedArrayBuffer available?                            │
│     ├─ Sufficient memory (>2GB)?                               │
│     └─ IndexedDB available?                                    │
│                                                                 │
│  2. Capability Evaluation                                      │
│     ├─ Dataset size < 100MB? → Client mode                     │
│     ├─ Dataset size 100MB-500MB? → Ask user                    │
│     └─ Dataset size > 500MB? → Server mode                     │
│                                                                 │
│  3. Mode Selection                                             │
│     ├─ CLIENT_MODE: DuckDB-Wasm + local rendering              │
│     └─ SERVER_MODE: Traditional server execution (fallback)    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Technology Decisions Rationale

| Technology | Chosen Because | Alternatives Considered |
|------------|----------------|------------------------|
| **DuckDB-Wasm** | Full SQL dialect, columnar, excellent performance, MIT license | SQLite-Wasm (no columnar), Perspective (limited SQL) |
| **Glide Data Grid** | Canvas-based, smooth scrolling, MIT license, React-native | AG Grid (commercial license), react-window (DOM-based) |
| **Apache ECharts** | 40+ chart types, maps, canvas rendering, Apache-2.0 | D3.js (too low-level), Plotly (limited types), Highcharts (commercial) |
| **Apache Arrow** | Zero-copy sharing, language-agnostic, excellent compression | JSON (inefficient), MessagePack (no columnar) |
| **Parquet** | Columnar, compression, predicate pushdown, widely adopted | CSV (no compression), Feather (less compression) |
| **IndexedDB** | Browser-native, large storage (~1GB), persistent | localStorage (too small), WebSQL (deprecated) |

---

## 4. Component Architecture

### 4.1 Client-Side Component Hierarchy

```
src/
├── components/
│   ├── duckdb/                          # DuckDB-Wasm integration
│   │   ├── DuckDBProvider.tsx           # React context provider
│   │   ├── DuckDBInstance.ts            # Instance wrapper
│   │   ├── QueryExecutor.tsx            # Query execution interface
│   │   ├── SchemaRegistry.tsx           # Schema introspection
│   │   └── MemoryMonitor.tsx            # Memory usage tracking
│   │
│   ├── datasets/                        # Dataset management UI
│   │   ├── DatasetManager.tsx           # Main dataset manager
│   │   ├── DatasetLoader.tsx            # Loading UI
│   │   ├── DatasetCard.tsx              # Dataset display
│   │   ├── DatasetSelector.tsx          # Selection component
│   │   └── CacheManager.tsx             # Cache management UI
│   │
│   ├── glide/                           # Glide Data Grid components
│   │   ├── GlideDataTable.tsx           # Main table component
│   │   ├── GlideQueryResults.tsx        # Query results table
│   │   ├── GlideNlResults.tsx           # NL query results
│   │   ├── CellRenderers.tsx            # Custom cell renderers
│   │   ├── ColumnFeatures.tsx           # Sort/filter/aggregate
│   │   └── GridTheme.tsx                # Theme integration
│   │
│   ├── echarts/                         # Apache ECharts components
│   │   ├── EChartsRenderer.tsx          # Main chart renderer
│   │   ├── EChartsProvider.tsx          # Chart context provider
│   │   ├── ChartTypeFactory.ts          # Chart type builders
│   │   ├── ThemeAdapter.tsx             # App theme integration
│   │   ├── DataAdapter.ts               # Arrow → ECharts data
│   │   ├── InteractionManager.tsx       # Zoom, brush, drill-down
│   │   └── chart-types/                 # Specific chart type builders
│   │       ├── BasicCharts.ts           # Bar, line, area, pie
│   │       ├── AdvancedCharts.ts        # Heatmap, treemap, sunburst
│   │       ├── GeoCharts.ts             # Map, geo scatter
│   │       └── StatisticalCharts.ts     # Boxplot, candlestick
│   │
│   ├── filters/                         # Filter system (enhanced)
│   │   ├── DuckDBFilterBar.tsx          # DuckDB-aware filter bar
│   │   ├── FilterBuilder.tsx            # Visual filter builder
│   │   ├── FilterToSQL.ts               # Filter → DuckDB SQL
│   │   └── CrossFilterManager.tsx       # Cross-widget filtering
│   │
│   ├── dashboard/                       # Dashboard (enhanced)
│   │   ├── WasmWidgetCard.tsx           # Widget card (new renderer)
│   │   ├── WidgetRenderer.tsx           # Unified widget renderer
│   │   ├── LinkedFilters.tsx            # Cross-widget filter UI
│   │   └── DashboardState.tsx           # State management
│   │
│   ├── sql-editor/                      # SQL editor (enhanced)
│   │   ├── MonacoSQLEditorWrapper.tsx   # Monaco + DuckDB dialect
│   │   ├── SchemaBrowser.tsx            # DuckDB schema browser
│   │   ├── QueryValidation.tsx          # Client-side validation
│   │   └── AutocompleteProvider.ts      # DuckDB-aware autocomplete
│   │
│   └── ui/                              # shadcn/ui (unchanged)
│       └── ...
│
├── lib/
│   ├── duckdb/                          # DuckDB-Wasm library
│   │   ├── index.ts                     # Main exports
│   │   ├── instance.ts                  # Instance management
│   │   ├── query.ts                     # Query execution
│   │   ├── schema.ts                    # Schema operations
│   │   ├── memory.ts                    # Memory management
│   │   └── types.ts                     # Type definitions
│   │
│   ├── arrow/                           # Arrow/Parquet library
│   │   ├── index.ts                     # Main exports
│   │   ├── converter.ts                 # JS → Arrow conversion
│   │   ├── reader.ts                    # Arrow reader utilities
│   │   ├── writer.ts                    # Arrow writer utilities
│   │   ├── parquet.ts                   # Parquet-specific utilities
│   │   └── types.ts                     # Type definitions
│   │
│   ├── export/                          # Server-side export
│   │   ├── index.ts                     # Main exports
│   │   ├── parquet-exporter.ts          # Parquet export service
│   │   ├── arrow-exporter.ts            # Arrow IPC export
│   │   ├── source-connector.ts          # Source DB connector
│   │   ├── compression.ts               # Compression utilities
│   │   └── storage.ts                   # File storage management
│   │
│   └── query/                           # Query utilities
│       ├── duckdb-dialect.ts            # DuckDB SQL specifics
│       ├── query-adapter.ts             # Cross-dialect adapter
│       └── validation.ts                # Query validation
│
├── hooks/
│   ├── useDuckDB.ts                     # DuckDB instance hook
│   ├── useDataset.ts                    # Dataset loading/management
│   ├── useQuery.ts                      # Query execution hook
│   ├── useChart.ts                      # Chart data hook
│   ├── useMemory.ts                     # Memory monitoring
│   └── useCrossFilter.ts                # Cross-filtering
│
└── app/
    ├── api/
    │   └── datasets/                    # Dataset API routes
    │       ├── route.ts                 # List datasets
    │       ├── [id]/
    │       │   ├── route.ts             # Get dataset info
    │       │   ├── parquet/
    │       │   │   └── route.ts         # Stream Parquet
    │       │   └── arrow/
    │       │       └── route.ts         # Stream Arrow IPC
    │       └── generate/
    │           └── route.ts             # Trigger Parquet generation
    │
    └── (dashboard)/
        └── datasets/                    # Datasets management page
            └── page.tsx
```

### 4.2 Component Specifications

#### 4.2.1 DuckDBProvider

**Purpose**: React Context provider for DuckDB-Wasm instance sharing.

```typescript
// src/components/duckdb/DuckDBProvider.tsx

interface DuckDBConfig {
  /**
   * Maximum memory allowed for DuckDB (in bytes)
   * @default 2GB
   */
  maxMemory?: number;

  /**
   * Path to DuckDB-Wasm worker script
   * @default '/duckdb-wasm/duckdb-browser.mjs'
   */
  workerPath?: string;

  /**
   * Enable query performance logging
   * @default false
   */
  enableLogging?: boolean;

  /**
   * Custom logger function
   */
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;
}

interface DuckDBContextValue {
  /**
   * DuckDB instance (null until initialized)
   */
  instance: DuckDBInstance | null;

  /**
   * Initialization status
   */
  status: 'initializing' | 'ready' | 'error';

  /**
   * Error if initialization failed
   */
  error: Error | null;

  /**
   * Execute a SQL query
   */
  executeQuery: (sql: string) => Promise<QueryResult>;

  /**
   * Load a Parquet file into a table
   */
  loadParquet: (tableName: string, url: string) => Promise<void>;

  /**
   * Load Arrow data into a table
   */
  loadArrow: (tableName: string, data: ArrowTable) => Promise<void>;

  /**
   * Get table schema
   */
  getTableSchema: (tableName: string) => Promise<TableSchema>;

  /**
   * List all tables
   */
  listTables: () => Promise<string[]>;

  /**
   * Drop a table
   */
  dropTable: (tableName: string) => Promise<void>;

  /**
   * Get current memory usage
   */
  getMemoryUsage: () => Promise<MemoryUsage>;

  /**
   * Register a custom function
   */
  registerFunction: (name: string, fn: Function) => Promise<void>;
}

export const DuckDBProvider: React.FC<{
  config?: DuckDBConfig;
  children: React.ReactNode;
}>;

export const useDuckDB: () => DuckDBContextValue;
```

**Key Features**:
- Initializes DuckDB-Wasm in a Web Worker
- Provides singleton instance across app
- Handles initialization errors gracefully
- Exposes type-safe query execution interface
- Monitors memory usage

**Error Handling**:
```
┌─────────────────────────────────────────────────────────────┐
│                   DuckDB Initialization                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Feature Detection                                       │
│     ├─ Check WASM support                                   │
│     ├─ Check SharedArrayBuffer                              │
│     └─ Check IndexedDB                                      │
│          ↓                                                  │
│  2. Load Worker Script                                      │
│     ├─ Fetch worker file                                    │
│     ├─ Initialize Web Worker                                │
│     └─ Establish communication channel                      │
│          ↓                                                  │
│  3. Initialize DuckDB                                       │
│     ├─ Create DuckDB instance                               │
│     ├─ Configure memory limits                              │
│     └─ Register custom functions                           │
│          ↓                                                  │
│  4. Ready State                                             │
│     └─ Provider status = 'ready'                           │
│                                                             │
│  Error Paths:                                               │
│  ├─ WASM not supported → Show feature unsupported banner   │
│  ├─ SharedArrayBuffer not available → Fallback to single-thread│
│  └─ Init failure → Show error, offer server-side fallback  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 GlideDataTable

**Purpose**: Canvas-based data table using Glide Data Grid for high-performance rendering.

```typescript
// src/components/glide/GlideDataTable.tsx

interface GlideDataTableProps {
  /**
   * Data from DuckDB query result (Arrow format)
   */
  data: ArrowTable | QueryResult;

  /**
   * Column definitions
   */
  columns: ColumnDef[];

  /**
   * Initial sort state
   */
  initialSort?: SortState;

  /**
   * Initial filter state
   */
  initialFilter?: FilterState;

  /**
   * Enable row selection
   * @default true
   */
  enableSelection?: boolean;

  /**
   * Enable column reordering
   * @default true
   */
  enableColumnReorder?: boolean;

  /**
   * Enable column resizing
   * @default true
   */
  enableColumnResize?: boolean;

  /**
   * Frozen columns (left side)
   */
  frozenColumns?: number;

  /**
   * Row height
   * @default 36 (pixels)
   */
  rowHeight?: number;

  /**
   * Theme
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Callbacks
   */
  onSort?: (sortState: SortState) => void;
  onFilter?: (filterState: FilterState) => void;
  onSelectionChange?: (selectedRows: Row[]) => void;
  onCellClick?: (cell: Cell) => void;
  onCellDoubleClick?: (cell: Cell) => void;
}

interface ColumnDef {
  id: string;
  title: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'url' | 'json';
  width?: number;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  aggregable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string;
  customRenderer?: CellRenderer;
}

interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

interface FilterState {
  columnId: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith';
  value: any;
}[]
```

**Key Features**:
- Canvas-based rendering (60fps scrolling)
- Virtual scrolling (handles millions of rows)
- Built-in sort, filter, aggregation
- Custom cell renderers
- Theme support (light/dark)
- Keyboard navigation
- Accessibility support

**Data Flow**:
```
┌─────────────────────────────────────────────────────────────┐
│                    GlideDataTable Data Flow                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Initial Render                                          │
│     ├─ Receive Arrow Table from DuckDB                      │
│     ├─ Create GridModel wrapper                             │
│     ├─ Initialize Glide Data Grid                           │
│     └─ Render visible viewport                              │
│                                                             │
│  2. User Interactions                                       │
│     ├─ Scroll → Lazy load rows on demand                    │
│     ├─ Sort → Execute DuckDB ORDER BY, refresh data         │
│     ├─ Filter → Execute DuckDB WHERE, refresh data          │
│     ├─ Resize column → Update column width                  │
│     └─ Select row → Update selection state                  │
│                                                             │
│  3. Data Refresh                                            │
│     ├─ Receive new Arrow Table                              │
│     ├─ Update GridModel                                     │
│     ├─ Preserve scroll position                             │
│     └─ Re-render viewport                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 EChartsRenderer

**Purpose**: Universal chart renderer supporting all Apache ECharts chart types.

```typescript
// src/components/echarts/EChartsRenderer.tsx

interface EChartsRendererProps {
  /**
   * Chart configuration
   */
  config: ChartConfig;

  /**
   * Data from DuckDB query result
   */
  data: ArrowTable | QueryResult;

  /**
   * Chart type
   */
  type: ChartType;

  /**
   * Theme
   */
  theme?: 'light' | 'dark' | 'auto';

  /**
   * Enable interactivity
   * @default true
   */
  interactive?: boolean;

  /**
   * Enable data zoom
   * @default true
   */
  enableZoom?: boolean;

  /**
   * Enable brush selection
   * @default false
   */
  enableBrush?: boolean;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Error state
   */
  error?: Error;

  /**
   * Callbacks
   */
  onChartClick?: (params: ChartClickParams) => void;
  onChartDoubleClick?: (params: ChartClickParams) => void;
  onDataZoom?: (params: DataZoomParams) => void;
  onBrushSelected?: (params: BrushSelectedParams) => void;
  onRenderComplete?: () => void;
}

type ChartType =
  // Basic
  | 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter'
  // Advanced
  | 'heatmap' | 'treemap' | 'sunburst' | 'sankey' | 'funnel' | 'gauge'
  // Geospatial
  | 'map' | 'geoScatter'
  // Relational
  | 'graph' | 'tree'
  // Statistical
  | 'boxplot' | 'candlestick' | 'parallel'
  // 3D (optional)
  | 'bar3d' | 'scatter3d' | 'surface3d';

interface ChartConfig {
  /**
   * Chart title
   */
  title?: string;

  /**
   * Chart subtitle
   */
  subtitle?: string;

  /**
   * Dimensions (width, height)
   */
  width?: string | number;
  height?: string | number;

  /**
   * Axis configuration
   */
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;

  /**
   * Color palette
   */
  colors?: string[];

  /**
   * Legend configuration
   */
  legend?: boolean | LegendConfig;

  /**
   * Tooltip configuration
   */
  tooltip?: boolean | TooltipConfig;

  /**
   * Data mapping (which columns to use)
   */
  dataMapping: DataMapping;

  /**
   * Custom ECharts options (merged)
   */
  customOptions?: EChartsOption;

  /**
   * Animation configuration
   */
  animation?: boolean | AnimationConfig;
}

interface DataMapping {
  /**
   * Column for x-axis/category
   */
  x?: string;

  /**
   * Column(s) for y-axis/value
   */
  y?: string | string[];

  /**
   * Column for color encoding
   */
  color?: string;

  /**
   * Column for size encoding
   */
  size?: string;

  /**
   * Column for grouping (series)
   */
  group?: string;

  /**
   * Aggregation function (when grouping)
   */
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';

  /**
   * Custom transform function
   */
  transform?: (data: ArrowTable) => ChartData;
}
```

**Key Features**:
- Supports all 40+ ECharts chart types
- Automatic Arrow → ECharts data conversion
- Theme integration (light/dark mode)
- Interactive features (zoom, brush, drill-down)
- Progressive rendering for large datasets
- Responsive sizing
- Export to PNG/SVG

**Chart Type Builders**:
```typescript
// src/components/echarts/chart-types/

export class ChartTypeFactory {
  static build(config: ChartConfig, data: ArrowTable): EChartsOption {
    switch (config.type) {
      case 'bar':
        return BasicCharts.buildBar(config, data);
      case 'line':
        return BasicCharts.buildLine(config, data);
      case 'heatmap':
        return AdvancedCharts.buildHeatmap(config, data);
      case 'map':
        return GeoCharts.buildMap(config, data);
      // ... etc
    }
  }
}

// Example: Bar chart builder
class BasicCharts {
  static buildBar(config: ChartConfig, data: ArrowTable): EChartsOption {
    const { dataMapping } = config;
    const xData = data.getChild(dataMapping.x)?.toArray() ?? [];
    const yData = data.getChild(dataMapping.y as string)?.toArray() ?? [];

    return {
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar',
        data: yData,
        // ... merged with config.customOptions
      }]
    };
  }
}
```

#### 4.2.4 DatasetManager

**Purpose**: UI for managing loaded datasets, memory usage, and cache.

```typescript
// src/components/datasets/DatasetManager.tsx

interface DatasetManagerProps {
  /**
   * Enable offline mode indicator
   */
  showOfflineStatus?: boolean;

  /**
   * Enable cache management
   */
  showCacheControls?: boolean;
}

interface DatasetInfo {
  /**
   * Dataset ID (unique identifier)
   */
  id: string;

  /**
   * Dataset name (user-friendly)
   */
  name: string;

  /**
   * Source data source ID
   */
  dataSourceId: string;

  /**
   * Table name in DuckDB
   */
  tableName: string;

  /**
   * Number of rows
   */
  rowCount: number;

  /**
   * File size (in bytes)
   */
  fileSize: number;

  /**
   * In-memory size (in bytes)
   */
  memorySize: number;

  /**
   * Schema
   */
  schema: TableSchema;

  /**
   * Load timestamp
   */
  loadedAt: Date;

  /**
   * Last refreshed timestamp
   */
  refreshedAt?: Date;

  /**
   * Cache status
   */
  cacheStatus: 'not-cached' | 'cached' | 'stale';

  /**
   * Is currently loading
   */
  isLoading: boolean;

  /**
   * Load progress (0-1)
   */
  loadProgress?: number;
}

interface DatasetManagerState {
  /**
   * List of loaded datasets
   */
  datasets: DatasetInfo[];

  /**
   * Total memory usage
   */
  totalMemoryUsage: number;

  /**
   * Memory limit
   */
  memoryLimit: number;

  /**
   * Currently selected dataset
   */
  selectedDataset: DatasetInfo | null;

  /**
   * Offline mode status
   */
  isOffline: boolean;
}

interface DatasetManagerActions {
  /**
   * Load a dataset
   */
  loadDataset: (dataSourceId: string, query?: string) => Promise<void>;

  /**
   * Reload/refresh a dataset
   */
  refreshDataset: (datasetId: string) => Promise<void>;

  /**
   * Unload a dataset (free memory)
   */
  unloadDataset: (datasetId: string) => Promise<void>;

  /**
   * Clear cache for a dataset
   */
  clearCache: (datasetId: string) => Promise<void>;

  /**
   * Clear all cache
   */
  clearAllCache: () => Promise<void>;

  /**
   * Export dataset (for offline use)
   */
  exportDataset: (datasetId: string) => Promise<void>;
}
```

**UI Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│                        Dataset Manager                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Memory: 245.8 MB / 2 GB  ▓▓▓░░░░░░░░░░░░░░░░░░░░░  [Limit] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [+ Load Dataset]    [Clear Cache]      [Export All]       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Dataset Cards                                              │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ Sales Data                            [Loaded] ●     │   │ │
│  │ │ Rows: 1.2M │ Size: 45.2 MB │ Memory: 78.5 MB        │   │ │
│  │ │ ┌─────────────────────────────────────────────────┐ │   │ │
│  │ │ │ schema: [id, date, product, region, amount...]  │ │   │ │
│  │ │ └─────────────────────────────────────────────────┘ │   │ │
│  │ │ [Refresh] [Unload] [Clear Cache] [Export]          │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  │ ┌─────────────────────────────────────────────────────┐   │ │
│  │ │ Customer Analytics                 [Cached] ◐       │   │ │
│  │ │ Rows: 856K │ Size: 32.1 MB │ Memory: 0 MB           │   │ │
│  │ │ [Load] [Clear Cache] [Export]                       │   │ │
│  │ └─────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2.5 CrossFilterManager

**Purpose**: Manages linked filtering across dashboard widgets.

```typescript
// src/components/filters/CrossFilterManager.tsx

interface CrossFilterConfig {
  /**
   * Dashboard ID
   */
  dashboardId: string;

  /**
   * Widget definitions and their filter links
   */
  widgets: WidgetFilterConfig[];
}

interface WidgetFilterConfig {
  /**
   * Widget ID
   */
  widgetId: string;

  /**
   * Widget type (chart, table, etc.)
   */
  type: 'chart' | 'table' | 'metric';

  /**
   * Dataset used by this widget
   */
  datasetId: string;

  /**
   * Base SQL query for this widget
   */
  baseQuery: string;

  /**
   * Filter links (which filters affect this widget)
   */
  filterLinks: FilterLink[];

  /**
   * Does this widget broadcast filters?
   */
  broadcastsFilters?: boolean;

  /**
   * Columns that can be clicked to filter
   */
  filterableColumns?: string[];
}

interface FilterLink {
  /**
   * Source widget ID
   */
  sourceWidgetId: string;

  /**
   * Column mapping (source column → target column)
   */
  columnMapping: Record<string, string>;

  /**
   * Filter operator
   */
  operator?: 'eq' | 'in' | 'range';
}

interface CrossFilterState {
  /**
   * Active filters
   */
  activeFilters: ActiveFilter[];

  /**
   * Filter propagation graph
   */
  filterGraph: FilterGraph;
}

interface ActiveFilter {
  /**
   * Unique filter ID
   */
  id: string;

  /**
   * Source widget ID
   */
  sourceWidgetId: string;

  /**
   * Column name
   */
  column: string;

  /**
   * Filter values
   */
  values: any[];

  /**
   * Filter operator
   */
  operator: 'eq' | 'in' | 'range';

  /**
   * Affected widget IDs
   */
  affectedWidgets: string[];
}

interface CrossFilterManagerActions {
  /**
   * Apply a filter from a widget interaction
   */
  applyFilter: (filter: Omit<ActiveFilter, 'id' | 'affectedWidgets'>) => void;

  /**
   * Remove a filter
   */
  removeFilter: (filterId: string) => void;

  /**
   * Clear all filters
   */
  clearFilters: () => void;

  /**
   * Get modified SQL with filters applied
   */
  getFilteredQuery: (widgetId: string, baseQuery: string) => string;

  /**
   * Subscribe to filter changes
   */
  subscribe: (widgetId: string, callback: (filters: ActiveFilter[]) => void) => void;
}
```

**Filter Propagation Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                     Cross-Widget Filtering                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Widget A (Bar Chart)         Widget B (Table)                  │
│  ┌───────────────────┐       ┌───────────────────┐              │
│  │ Region Sales      │       │ Product Details   │              │
│  │ ▓▓▓▓▓▓  East     │       │ ┌─────┬─────┬─────┐│              │
│  │ ░░░░░░  West     │  ←──→ │ │...  │...  │...  ││              │
│  │ ▒▒▒▒▒▒  North    │       │ └─────┴─────┴─────┘│              │
│  │ ──────  South     │       └───────────────────┘              │
│  └───────────────────┘                                         │
│         ↓ Click "East" bar                                      │
│                                                                 │
│  1. User clicks "East" bar in Widget A                          │
│  2. CrossFilterManager captures event                           │
│  3. Filter: { region: 'East' }                                  │
│  4. Propagates to Widget B (linked by region)                  │
│  5. Widget B re-queries with:                                   │
│     SELECT * FROM products WHERE region = 'East'                │
│  6. Both widgets update instantly                               │
│                                                                 │
│  Filter UI:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Active Filters:                                          │   │
│  │ [Region = East] ×     [Category = Electronics] ×         │   │
│  │ ───────────────────────────────────────────────────────  │   │
│  │ 2 filters applied │ Clear All                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Server-Side Components

#### 4.3.1 ParquetExportService

**Purpose**: Server-side service to export database queries to Parquet format.

```typescript
// src/lib/export/parquet-exporter.ts

interface ParquetExportConfig {
  /**
   * Data source connection
   */
  dataSource: DataSourceConfig;

  /**
   * SQL query to execute
   */
  query: string;

  /**
   * Output file name (without extension)
   */
  outputFileName: string;

  /**
   * Compression codec
   * @default 'snappy'
   */
  compression?: 'uncompressed' | 'snappy' | 'gzip' | 'brotli' | 'lz4' | 'zstd';

  /**
   * Row group size (rows per group)
   * @default 1000000
   */
  rowGroupSize?: number;

  /**
   * Max file size (bytes) - for splitting
   * @default 500MB
   */
  maxFileSize?: number;

  /**
   * Enable statistics
   * @default true
   */
  enableStatistics?: boolean;

  /**
   * Enable dictionary encoding
   * @default true
   */
  enableDictionary?: boolean;
}

interface ParquetExportResult {
  /**
   * Export ID
   */
  id: string;

  /**
   * File paths (one or more if split)
   */
  files: string[];

  /**
   * Total row count
   */
  rowCount: number;

  /**
   * Total file size
   */
  totalSize: number;

  /**
   * Compression ratio
   */
  compressionRatio: number;

  /**
   * Schema
   */
  schema: ParquetSchema;

  /**
   * Export duration
   */
  duration: number;

  /**
   * Created timestamp
   */
  createdAt: Date;
}

class ParquetExporter {
  /**
   * Export a query to Parquet format
   */
  async export(config: ParquetExportConfig): Promise<ParquetExportResult>;

  /**
   * Get export progress
   */
  async getProgress(exportId: string): Promise<ExportProgress>;

  /**
   * Cancel an export
   */
  async cancel(exportId: string): Promise<void>;

  /**
   * Clean up old exports
   */
  async cleanup(olderThan: Date): Promise<number>;
}
```

**Export Flow**:
```
┌─────────────────────────────────────────────────────────────────┐
│                   Parquet Export Process                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Validate Request                                           │
│     ├─ Check data source permissions                           │
│     ├─ Validate SQL syntax                                     │
│     └─ Estimate row count                                      │
│          ↓                                                      │
│  2. Execute Query                                              │
│     ├─ Connect to source database                              │
│     ├─ Stream results (batch size: 10000 rows)                 │
│     └─ Track progress                                          │
│          ↓                                                      │
│  3. Convert to Arrow                                           │
│     ├─ Create Arrow Schema from query results                  │
│     ├─ Build Arrow RecordBatches                               │
│     └─ Apply type conversions                                  │
│          ↓                                                      │
│  4. Write Parquet                                              │
│     ├─ Create Parquet file writer                              │
│     ├─ Write row groups                                        │
│     ├─ Apply compression                                       │
│     └─ Flush to file system                                    │
│          ↓                                                      │
│  5. Store and Register                                         │
│     ├─ Move to export directory                                │
│     ├─ Register in database                                    │
│     ├─ Generate download URL                                   │
│     └─ Return result                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Dataset API

**Purpose**: REST API for dataset management.

```typescript
// src/app/api/datasets/route.ts

/**
 * GET /api/datasets
 * List all available datasets
 */
interface ListDatasetsResponse {
  datasets: DatasetMetadata[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/datasets/[id]
 * Get dataset metadata
 */
interface GetDatasetResponse {
  id: string;
  name: string;
  dataSourceId: string;
  query: string;
  rowCount: number;
  fileSize: number;
  compressedSize: number;
  schema: ColumnSchema[];
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  downloadUrl: string;
}

/**
 * POST /api/datasets/generate
 * Trigger a new Parquet export
 */
interface GenerateDatasetRequest {
  dataSourceId: string;
  query: string;
  name: string;
  description?: string;
  options?: ParquetExportConfig;
}

interface GenerateDatasetResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedTime?: number;
  progressUrl: string;
}

/**
 * GET /api/datasets/[id]/parquet
 * Stream Parquet file
 *
 * Headers:
 * - Content-Type: application/octet-stream
 * - Content-Disposition: attachment; filename="dataset.parquet"
 * - Content-Length: [file size]
 * - ETag: [file hash]
 * - Last-Modified: [timestamp]
 *
 * Supports:
 * - Range requests (for resumable downloads)
 * - Compression (gzip)
 * - Caching (ETag, Last-Modified)
 */

/**
 * GET /api/datasets/[id]/arrow
 * Stream Arrow IPC format
 *
 * Similar to Parquet endpoint but returns Arrow IPC format
 */
```

---

## 5. Data Architecture

### 5.1 Data Formats

#### 5.1.1 Apache Arrow (In-Memory)

**Purpose**: Primary in-memory format for zero-copy data sharing between DuckDB and rendering components.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Apache Arrow Structure                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Arrow Table                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Schema: [id: int32, name: string, value: float64]       │   │
│  │                                                          │   │
│  │ RecordBatch 0 (64K rows)                                │   │
│  │ ┌────────────────────────────────────────────────────┐  │   │
│  │ │ id:     [1, 2, 3, ...]       (int32 array)        │  │   │
│  │ │ name:   ["A", "B", "C", ...] (string array)       │  │   │
│  │ │ value:  [1.5, 2.3, 3.7, ...]  (float64 array)     │  │   │
│  │ └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │ RecordBatch 1 (64K rows)                                │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Properties:                                                    │
│  - Columnar storage (efficient caching)                        │
│  - Contiguous memory (SIMD-friendly)                           │
│  - Zero-copy sharing (no serialization)                        │
│  - Random access by column                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Type Mappings**:
```typescript
// SQL → Arrow → JavaScript type mappings

const TYPE_MAPPINGS: Record<string, ArrowType> = {
  // Integer types
  'tinyint': new Arrow.Int8(),
  'smallint': new Arrow.Int16(),
  'int': new Arrow.Int32(),
  'integer': new Arrow.Int32(),
  'bigint': new Arrow.Int64(),

  // Unsigned integer types
  'unsigned tinyint': new Arrow.Uint8(),
  'unsigned smallint': new Arrow.Uint16(),
  'unsigned int': new Arrow.Uint32(),
  'unsigned bigint': new Arrow.Uint64(),

  // Floating point
  'float': new Arrow.Float32(),
  'double': new Arrow.Float64(),
  'real': new Arrow.Float32(),

  // String/Binary
  'varchar': new Arrow.Utf8(),
  'char': new Arrow.Utf8(),
  'text': new Arrow.Utf8(),
  'binary': new Arrow.Binary(),
  'varbinary': new Arrow.Binary(),
  'blob': new Arrow.Binary(),

  // Boolean
  'boolean': new Arrow.Bool(),

  // Date/Time
  'date': new Arrow.DateDay(),
  'datetime': new Arrow.TimestampMilli(),
  'timestamp': new Arrow.TimestampMilli(),
  'time': new Arrow.TimeMilli(),

  // JSON
  'json': new Arrow.Utf8(), // Store as string, parse on access

  // Decimal
  'decimal': new Arrow.Decimal(38, 10), // Precision, scale

  // Null handling
  'null': new Arrow.Null(),
};
```

#### 5.1.2 Parquet (Storage/Transfer)

**Purpose**: Compressed columnar format for efficient data transfer and storage.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Parquet File Structure                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Parquet File                                             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 1. File Metadata (4 bytes magic + metadata)             │  │
│  │    - Schema                                             │  │
│  │    - Row groups                                         │  │
│  │    - Column chunks                                      │  │
│  │    - Statistics                                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 2. Row Group 0 (1M rows)                                │  │
│  │    ┌────────────────────────────────────────────────┐   │  │
│  │    │ Column Chunk: id                               │   │  │
│  │    │   - Pages: [Data Page 1][Data Page 2]...      │   │  │
│  │    │   - Compression: Snappy                        │   │  │
│  │    │   - Encoding: Dictionary + Bit-Packed         │   │  │
│  │    │   - Statistics: min, max, null_count, distinct │   │  │
│  │    ├────────────────────────────────────────────────┤   │  │
│  │    │ Column Chunk: name                             │   │  │
│  │    │   - Pages: [Dict Page][Data Page 1]...        │   │  │
│  │    │   - Compression: Snappy                        │   │  │
│  │    │   - Encoding: Dictionary (RLE)                │   │  │
│  │    └────────────────────────────────────────────────┘   │  │
│  │    └─ ... (one column chunk per column)                 │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 3. Row Group 1 (1M rows)                                │  │
│  │    ...                                                   │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 4. File Footer (metadata length + metadata + magic)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Optimizations:                                                │
│  - Column pruning: load only needed columns                   │
│  - Row group filtering: skip groups via statistics            │
│  - Dictionary encoding: efficient for low-cardinality        │
│  - Compression: 5-10x reduction typical                       │
│  - Predicate pushdown: filter during load                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Parquet Configuration**:
```typescript
// Recommended Parquet settings for different use cases

const PARQUET_PRESETS = {
  // Fast query (less compression, faster decompression)
  fast: {
    compression: 'snappy',
    rowGroupSize: 100000,
    enableDictionary: true,
    enableStatistics: true,
  },

  // Balanced (default)
  balanced: {
    compression: 'snappy',
    rowGroupSize: 1000000,
    enableDictionary: true,
    enableStatistics: true,
  },

  // Maximum compression (slower, smaller files)
  compressed: {
    compression: 'zstd',
    compressionLevel: 9,
    rowGroupSize: 1000000,
    enableDictionary: true,
    enableStatistics: true,
  },

  // For low-cardinality data
  categorical: {
    compression: 'snappy',
    rowGroupSize: 1000000,
    enableDictionary: true,
    dictionaryPageSize: 100000,
    enableStatistics: true,
  },

  // For time-series data
  timeSeries: {
    compression: 'zstd',
    rowGroupSize: 500000, // Smaller for time-range queries
    enableDictionary: false, // Typically high cardinality
    enableStatistics: true,
    sorting: ['timestamp'], // Sort by time for efficient range scans
  },
};
```

### 5.2 Data Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                       Data Lifecycle                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CREATION (Server-Side)                                     │
│     Source Database                                             │
│        ↓  Kysely query                                        │
│     Arrow RecordBatches                                        │
│        ↓  ParquetWriter                                        │
│     Parquet File (compressed)                                  │
│        ↓  Store to /data/exports/                              │
│     Metadata in database                                       │
│                                                                 │
│  2. TRANSFER (HTTP)                                            │
│     Client requests dataset                                     │
│        ↓  GET /api/datasets/[id]/parquet                       │
│     Server streams Parquet file                                │
│        ↓  HTTP transfer (supports Range)                       │
│     Client receives file                                       │
│                                                                 │
│  3. LOADING (Client-Side)                                      │
│     Parquet file received                                      │
│        ↓  ParquetReader (parquet-wasm)                         │
│     Arrow RecordBatches                                        │
│        ↓  DuckDB-Wasm (register table)                         │
│     DuckDB Table (queryable)                                  │
│        ↓  Cache to IndexedDB                                   │
│     Persistent cache (offline support)                         │
│                                                                 │
│  4. QUERYING (Client-Side)                                     │
│     User executes SQL                                          │
│        ↓  DuckDB query execution                               │
│     Arrow RecordBatch (result)                                 │
│        ↓  Zero-copy to component                               │
│     Glide Data Grid / ECharts render                           │
│                                                                 │
│  5. REFRESH (Periodic)                                         │
│     Server checks data freshness                               │
│        ↓  Compare source timestamp vs cached                   │
│     New data available?                                        │
│        ↓  Re-export to Parquet                                 │
│     New Parquet file                                          │
│        ↓  Client detects stale cache                           │
│     Background refresh                                         │
│        ↓  Swap in new data                                     │
│     Updated query results                                      │
│                                                                 │
│  6. EVICTION (Memory Management)                               │
│     Memory pressure detected                                   │
│        ↓  LRU eviction                                        │
│     Least recently used dataset unloaded                      │
│        ↓  DuckDB DROP TABLE                                   │
│     Memory freed, cache remains                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Schema Evolution

The system must handle schema evolution over time:

```typescript
// Schema versioning strategy

interface SchemaVersion {
  /**
   * Schema version (incrementing integer)
   */
  version: number;

  /**
   * Schema definition
   */
  schema: ArrowSchema;

  /**
   * Created at
   */
  createdAt: Date;

  /**
   * Is this the current version?
   */
  isCurrent: boolean;
}

interface SchemaChange {
  type: 'add_column' | 'remove_column' | 'rename_column' | 'change_type';
  column?: string;
  oldType?: ArrowType;
  newType?: ArrowType;
  breaking: boolean;
}

// Schema compatibility rules
const SCHEMA_COMPATIBILITY = {
  // Compatible changes (can read old data with new schema)
  addColumn: true,           // Add new column (with default)
  removeColumn: false,       // Breaking (column missing)
  renameColumn: false,       // Breaking (column name changed)
  changeType: 'maybe',       // Depends on type compatibility

  // Type compatibility matrix
  typeWidening: {
    int8 → int16: true,
    int16 → int32: true,
    int32 → int64: true,
    float32 → float64: true,
    // ... etc
  },

  // Safe conversions
  typeConversion: {
    varchar → text: true,    // Same underlying type
    date → datetime: true,   // Safe (time = 00:00:00)
    // ... etc
  },
};
```

### 5.4 Data Partitioning

For very large datasets, implement partitioning:

```
/data/exports/
├── sales_data/
│   ├── dataset_metadata.json           # Overall metadata
│   ├── partition_2024/
│   │   ├── sales_2024_Q1.parquet
│   │   ├── sales_2024_Q2.parquet
│   │   ├── sales_2024_Q3.parquet
│   │   └── sales_2024_Q4.parquet
│   ├── partition_2023/
│   │   ├── sales_2023_Q1.parquet
│   │   └── ...
│   └── _latest → sales_2024_Q4.parquet  # Symlink to latest
```

```typescript
// Partition strategy interface

interface PartitionStrategy {
  type: 'time' | 'hash' | 'range' | 'none';
  column?: string;
  format?: 'year' | 'quarter' | 'month' | 'day' | 'hour';
  partitions: Partition[];
}

interface Partition {
  name: string;
  value: any;
  path: string;
  rowCount: number;
  fileSize: number;
  min?: any;
  max?: any;
}

// DuckDB can query partitioned Parquet datasets
const loadPartitionedDataset = (basePath: string) => {
  return `
    CREATE VIEW sales AS
    SELECT * FROM read_parquet('${basePath}/**/*.parquet',
      hive_partitioning = true);
  `;
};
```

---

## 6. API Design

### 6.1 API Contract Specification

#### 6.1.1 Dataset Management APIs

```typescript
/**
 * @route GET /api/datasets
 * @description List all available datasets
 * @authentication Required
 * @permission data_sources:read
 */
interface ListDatasetsRequest {
  query?: {
    page?: number;
    pageSize?: number;
    dataSourceId?: string;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'rowCount';
    sortOrder?: 'asc' | 'desc';
  };
}

interface ListDatasetsResponse {
  success: true;
  data: {
    datasets: Array<{
      id: string;
      name: string;
      description: string | null;
      dataSourceId: string;
      dataSourceName: string;
      rowCount: number;
      fileSize: number;
      compressedSize: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
      }>;
      createdAt: string; // ISO 8601
      updatedAt: string; // ISO 8601
      lastAccessedAt: string | null; // ISO 8601
      downloadUrl: string;
      isCached: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}

/**
 * @route POST /api/datasets/generate
 * @description Generate a new Parquet dataset from a data source
 * @authentication Required
 * @permission data_sources:write
 */
interface GenerateDatasetRequest {
  dataSourceId: string;
  query: string;
  name: string;
  description?: string;
  options?: {
    compression?: 'snappy' | 'gzip' | 'zstd';
    rowGroupSize?: number;
    maxFileSize?: number;
    partitionBy?: {
      type: 'time' | 'range';
      column: string;
      format?: 'year' | 'quarter' | 'month';
    };
  };
}

interface GenerateDatasetResponse {
  success: true;
  data: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    estimatedRows?: number;
    estimatedSize?: number;
    estimatedTime?: number; // seconds
    progressUrl: string;
  };
}

/**
 * @route GET /api/datasets/[id]
 * @description Get dataset metadata
 * @authentication Required
 * @permission data_sources:read
 */
interface GetDatasetResponse {
  success: true;
  data: {
    id: string;
    name: string;
    description: string | null;
    dataSourceId: string;
    dataSourceName: string;
    query: string;
    rowCount: number;
    fileSize: number;
    compressedSize: number;
    compressionRatio: number;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      distinctCount?: number;
      min?: any;
      max?: any;
      nullCount?: number;
    }>;
    partitionInfo?: {
      type: string;
      column: string;
      partitions: Array<{
        name: string;
        rowCount: number;
        min: any;
        max: any;
      }>;
    };
    createdAt: string;
    updatedAt: string;
    lastAccessedAt: string | null;
    downloadUrl: string;
    arrowDownloadUrl: string;
    refreshSchedule?: {
      interval: string; // cron expression
      nextRun: string;
    };
  };
}

/**
 * @route DELETE /api/datasets/[id]
 * @description Delete a dataset
 * @authentication Required
 * @permission data_sources:write
 */
interface DeleteDatasetResponse {
  success: true;
  data: {
    id: string;
    deleted: true;
  };
}

/**
 * @route POST /api/datasets/[id]/refresh
 * @description Refresh a dataset (re-export from source)
 * @authentication Required
 * @permission data_sources:write
 */
interface RefreshDatasetResponse {
  success: true;
  data: {
    id: string;
    status: 'pending' | 'processing';
    jobId: string;
  };
}

/**
 * @route GET /api/datasets/[id]/parquet
 * @description Stream Parquet file
 * @authentication Required
 * @permission data_sources:read
 *
 * @headers
 * - Content-Type: application/octet-stream
 * - Content-Disposition: attachment; filename="dataset.parquet"
 * - Content-Length: [file size]
 * - ETag: [file hash]
 * - Last-Modified: [RFC 1123 date]
 * - Cache-Control: public, max-age=3600
 * - Accept-Ranges: bytes
 *
 * @response Binary Parquet file
 *
 * @supports Range requests for resumable downloads
 */
interface GetDatasetParquetRequest {
  headers?: {
    Range?: string; // bytes=0-1023
    'If-None-Match'?: string; // ETag for conditional request
    'If-Modified-Since'?: string; // RFC 1123 date
  };
}

/**
 * @route GET /api/datasets/[id]/arrow
 * @description Stream Arrow IPC format
 * @authentication Required
 * @permission data_sources:read
 *
 * Similar to Parquet endpoint but returns Arrow IPC format
 * @headers
 * - Content-Type: application/vnd.apache.arrow.stream
 */
```

#### 6.1.2 Query Execution APIs (Enhanced)

```typescript
/**
 * @route POST /api/sql/execute
 * @description Execute SQL query (supports both server and client modes)
 * @authentication Required
 * @permission sql:execute
 */
interface ExecuteSQLRequest {
  dataSourceId: string;
  sql: string;
  /**
   * Execution mode
   * - 'auto': System decides based on dataset size
   * - 'server': Force server execution
   * - 'client': Return data for client execution
   */
  mode?: 'auto' | 'server' | 'client';
  /**
   * Output format (only applicable when mode='client')
   * - 'json': Traditional JSON response
   * - 'arrow': Arrow IPC format
   * - 'parquet': Parquet file
   */
  outputFormat?: 'json' | 'arrow' | 'parquet';
  /**
   * Query parameters (for prepared statements)
   */
  parameters?: Record<string, any>;
  /**
   * Max rows (for JSON output)
   */
  maxRows?: number;
}

interface ExecuteSQLResponse {
  success: true;
  data: {
    executionMode: 'server' | 'client';

    // Server execution results
    server?: {
      rows: Array<Record<string, any>>;
      rowCount: number;
      columns: Array<{ name: string; type: string }>;
      executionTime: number; // milliseconds
      truncated: boolean; // true if maxRows exceeded
    };

    // Client execution data
    client?: {
      datasetId?: string; // If new dataset was created
      dataUrl?: string; // URL to download Arrow/Parquet
      dataFormat: 'arrow' | 'parquet';
      schema: Array<{ name: string; type: string }>;
      estimatedRows: number;
    };
  };
}

/**
 * @route POST /api/sql/validate
 * @description Validate SQL syntax (client-side validation)
 * @authentication Required
 * @permission sql:execute
 */
interface ValidateSQLRequest {
  sql: string;
  dialect?: 'duckdb' | 'postgresql' | 'mysql' | 'sqlite';
}

interface ValidateSQLResponse {
  success: true;
  data: {
    valid: boolean;
    errors?: Array<{
      message: string;
      line: number;
      column: number;
      offset: number;
    }>;
    warnings?: Array<{
      message: string;
      code: string;
    }>;
    suggested?: {
      original: string;
      suggestion: string;
    };
  };
}
```

#### 6.1.3 Chart APIs (Enhanced)

```typescript
/**
 * @route GET /api/charts/[id]/data
 * @description Get chart data (supports Parquet output)
 * @authentication Required
 * @permission charts:read
 */
interface GetChartDataRequest {
  query?: {
    format?: 'json' | 'arrow' | 'parquet';
    filters?: Record<string, any>;
  };
}

interface GetChartDataResponse {
  success: true;
  data: {
    chartId: string;
    format: 'json' | 'arrow' | 'parquet';

    // JSON format (legacy)
    json?: {
      data: Array<Record<string, any>>;
      schema: Array<{ name: string; type: string }>;
    };

    // Arrow/Parquet format
    file?: {
      url: string;
      size: number;
      hash: string;
    };
  };
}
```

### 6.2 Websocket API (Optional)

For real-time dataset updates and collaborative dashboards:

```typescript
// WebSocket endpoint: /api/ws

interface WebSocketMessage {
  type: MessageType;
  payload: any;
}

type MessageType =
  // Client → Server
  | 'subscribe:dataset'
  | 'unsubscribe:dataset'
  | 'subscribe:dashboard'
  | 'unsubscribe:dashboard'
  | 'query:execute'

  // Server → Client
  | 'dataset:updated'
  | 'dataset:refreshing'
  | 'query:result'
  | 'query:error'
  | 'dashboard:filter';

interface SubscribeDatasetMessage {
  type: 'subscribe:dataset';
  payload: {
    datasetId: string;
  };
}

interface DatasetUpdatedMessage {
  type: 'dataset:updated';
  payload: {
    datasetId: string;
    version: number;
    rowCount: number;
    updatedAt: string;
  };
}

interface DashboardFilterMessage {
  type: 'dashboard:filter';
  payload: {
    dashboardId: string;
    widgetId: string;
    filter: {
      column: string;
      operator: string;
      value: any;
    };
  };
}
```

### 6.3 Error Handling

Standardized error response format:

```typescript
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string; // Only in development
    requestId: string;
    timestamp: string;
  };
}

// Error codes
const ERROR_CODES = {
  // Authentication/Authorization
  UNAUTHORIZED: 'AUTH_001',
  FORBIDDEN: 'AUTH_002',
  SESSION_EXPIRED: 'AUTH_003',

  // Validation
  VALIDATION_ERROR: 'VAL_001',
  INVALID_SQL: 'VAL_002',
  INVALID_FILTER: 'VAL_003',

  // Resources
  DATASET_NOT_FOUND: 'RES_001',
  DATA_SOURCE_NOT_FOUND: 'RES_002',
  CHART_NOT_FOUND: 'RES_003',

  // Operations
  EXPORT_FAILED: 'OPS_001',
  QUERY_FAILED: 'OPS_002',
  MEMORY_LIMIT_EXCEEDED: 'OPS_003',

  // Rate limiting
  RATE_LIMITED: 'RT_001',

  // Server errors
  INTERNAL_ERROR: 'SRV_001',
  SERVICE_UNAVAILABLE: 'SRV_002',
};
```

---

## 7. Security Architecture

### 7.1 Security Model Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. NETWORK LAYER                                               │
│     ├─ HTTPS/TLS 1.3 (all traffic)                             │
│     ├─ Nginx reverse proxy                                     │
│     └─ DDoS protection (optional)                              │
│                                                                 │
│  2. AUTHENTICATION LAYER                                        │
│     ├─ Custom JWT (jose library)                               │
│     ├─ Session management (httpOnly cookies)                   │
│     ├─ CSRF protection (SameSite cookie policy)                │
│     └─ Session expiration (configurable)                       │
│                                                                 │
│  3. AUTHORIZATION LAYER                                         │
│     ├─ RBAC (role-based access control)                        │
│     ├─ Entity-level permissions                               │
│     ├─ Data source RBAC                                        │
│     └─ API route guards                                       │
│                                                                 │
│  4. DATA ACCESS LAYER                                           │
│     ├─ Connection encryption (AES-256-GCM)                     │
│     ├─ Dataset access control                                 │
│     ├─ Parquet file access (signed URLs)                       │
│     └─ Query validation                                        │
│                                                                 │
│  5. CLIENT-SIDE SECURITY                                        │
│     ├─ Content Security Policy (CSP)                          │
│     ├─ COOP/COEP headers                                       │
│     ├─ Data isolation (per-session)                            │
│     ├─ IndexedDB encryption (optional)                        │
│     └─ Memory sandboxing                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Dataset Access Control

Dataset access follows the same RBAC model as data sources:

```typescript
// Dataset access control

interface DatasetPermissions {
  /**
   * Can view dataset metadata
   */
  canView: boolean;

  /**
   * Can download dataset
   */
  canDownload: boolean;

  /**
   * Can query dataset
   */
  canQuery: boolean;

  /**
   * Can refresh dataset
   */
  canRefresh: boolean;

  /**
   * Can delete dataset
   */
  canDelete: boolean;

  /**
   * Row-level security (optional)
   */
  rowFilter?: string; // WHERE clause
}

// Access check middleware
const checkDatasetAccess = async (
  userId: string,
  datasetId: string,
  requiredPermission: keyof DatasetPermissions
): Promise<boolean> => {
  const dataset = await getDataset(datasetId);
  const permissions = await getUserDatasetPermissions(userId, dataset.dataSourceId);

  // Check data source permissions
  if (!permissions[requiredPermission]) {
    return false;
  }

  // Check entity-level permissions if applicable
  if (dataset.entityId) {
    const entityPerms = await getEntityPermissions(userId, dataset.entityId);
    if (!entityPerms.canAccess) {
      return false;
    }
  }

  return true;
};

// Parquet download with access control
app.get('/api/datasets/:id/parquet', async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;

  // Check download permission
  const hasAccess = await checkDatasetAccess(userId, id, 'canDownload');
  if (!hasAccess) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'No access to this dataset' });
  }

  // Generate signed URL (time-limited)
  const signedUrl = await generateSignedUrl(id, { expiresIn: '1h' });

  // Redirect to signed URL (or stream directly)
  res.redirect(signedUrl);
});

// Signed URL generator
const generateSignedUrl = async (
  datasetId: string,
  options: { expiresIn: string }
): Promise<string> => {
  const token = jwt.sign(
    { datasetId, exp: Math.floor(Date.now() / 1000) + parseDuration(options.expiresIn) },
    process.env.DATASET_URL_SECRET
  );
  return `${process.env.BASE_URL}/api/datasets/${datasetId}/parquet?token=${token}`;
};
```

### 7.3 Client-Side Data Protection

```typescript
// Client-side data isolation

interface DataSecurityContext {
  /**
   * Current session ID
   */
  sessionId: string;

  /**
   * Isolated storage key prefix
   */
  storagePrefix: string;

  /**
   * Clear data on logout
   */
  clearOnLogout: boolean;
}

// Isolate IndexedDB by session
class IsolatedStorage {
  private prefix: string;

  constructor(sessionId: string) {
    this.prefix = `session_${sessionId}_`;
  }

  async set(key: string, value: any): Promise<void> {
    const fullKey = this.prefix + key;
    await idb.setItem(fullKey, value);
  }

  async get(key: string): Promise<any> {
    const fullKey = this.prefix + key;
    return await idb.getItem(fullKey);
  }

  async clearSession(): Promise<void> {
    // Clear all keys with this session's prefix
    const keys = await idb.keys();
    const sessionKeys = keys.filter(k => k.startsWith(this.prefix));
    await Promise.all(sessionKeys.map(k => idb.removeItem(k)));
  }
}

// DuckDB instance per session (isolate data)
class SessionDuckDBManager {
  private instances: Map<string, DuckDBInstance> = new Map();

  async getInstance(sessionId: string): Promise<DuckDBInstance> {
    if (!this.instances.has(sessionId)) {
      const instance = await createDuckDBInstance();
      this.instances.set(sessionId, instance);
    }
    return this.instances.get(sessionId)!;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const instance = this.instances.get(sessionId);
    if (instance) {
      await instance.close();
      this.instances.delete(sessionId);
    }
    // Also clear IndexedDB
    const storage = new IsolatedStorage(sessionId);
    await storage.clearSession();
  }
}
```

### 7.4 Security Headers

```typescript
// vite.config.ts - Security headers for TanStack Start

const serverConfig = {
  port: 4050,
  headers: {
    // COOP/COEP for SharedArrayBuffer (required for DuckDB-Wasm)
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
}

  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval for WASM
      "worker-src 'self' blob:", // Workers for DuckDB
      "connect-src 'self'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },

  // Other security headers
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 7.5 Audit Logging

```typescript
// Audit log for dataset operations

interface AuditEvent {
  id: string;
  userId: string;
  sessionId: string;
  action: string;
  resourceType: 'dataset' | 'data_source' | 'query' | 'chart';
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

const AUDIT_ACTIONS = {
  // Dataset actions
  DATASET_GENERATED: 'dataset.generated',
  DATASET_DOWNLOADED: 'dataset.downloaded',
  DATASET_LOADED: 'dataset.loaded',
  DATASET_REFRESHED: 'dataset.refreshed',
  DATASET_DELETED: 'dataset.deleted',

  // Query actions
  QUERY_EXECUTED: 'query.executed',
  QUERY_FAILED: 'query.failed',

  // Chart actions
  CHART_VIEWED: 'chart.viewed',
  CHART_FILTERED: 'chart.filtered',
};

const logAuditEvent = async (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
  await db.insert('audit_log', {
    ...event,
    id: generateId(),
    timestamp: new Date(),
  });
};

// Usage examples
await logAuditEvent({
  userId: session.userId,
  sessionId: session.id,
  action: AUDIT_ACTIONS.DATASET_DOWNLOADED,
  resourceType: 'dataset',
  resourceId: datasetId,
  details: { format: 'parquet', size: fileSize },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

---

## 8. Performance Architecture

### 8.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| DuckDB Initialization | < 2s | Time to ready state |
| Simple Query (1M rows) | < 100ms | SELECT with WHERE |
| Aggregation (1M rows) | < 500ms | GROUP BY |
| Grid Scroll (60fps) | < 16ms | Frame render time |
| Chart Render (10K points) | < 500ms | Initial paint |
| Chart Render (1M points) | < 2s | Progressive render |
| Parquet Transfer (100MB) | Network limited | Transfer time |
| IndexedDB Read (100MB) | < 1s | Cache load |

### 8.2 Optimization Strategies

#### 8.2.1 DuckDB Optimization

```typescript
// DuckDB performance tuning

const DUCKDB_CONFIG = {
  // Memory settings
  maxMemory: 2 * 1024 * 1024 * 1024, // 2GB

  // Query optimization
  enableOptimizer: true,
  enableObjectCache: true,

  // Parallelization
  threads: navigator.hardwareConcurrency || 4,

  // Extension loading (optional)
  extensions: [], // 'full', 'fts', etc.
};

// Query optimization hints
const executeOptimizedQuery = async (duckdb: DuckDBInstance, sql: string) => {
  // Add query hints for common patterns

  // 1. Use EXPLAIN to analyze query plan
  const plan = await duckdb.explain(sql);

  // 2. Check for missing indexes (if applicable)
  // 3. Suggest query rewrites

  // 4. Execute optimized query
  return await duckdb.execute(sql);
};

// Materialized views for common aggregations
const createMaterializedView = async (
  duckdb: DuckDBInstance,
  viewName: string,
  query: string
) => {
  // Create a table that stores pre-computed results
  await duckdb.execute(`
    CREATE TABLE ${viewName} AS ${query}
  `);

  // Refresh periodically
  const refresh = async () => {
    await duckdb.execute(`
      DELETE FROM ${viewName};
      INSERT INTO ${viewName} ${query}
    `);
  };

  return { refresh };
};
```

#### 8.2.2 Data Loading Optimization

```typescript
// Progressive data loading

interface ProgressiveLoadConfig {
  /**
   * Load in chunks
   */
  chunkSize?: number; // rows per chunk

  /**
   * Display initial results quickly
   */
  progressive?: boolean;

  /**
   * Load columns on demand
   */
  lazyColumns?: boolean;
}

class ProgressiveDataLoader {
  async loadProgressive(
    url: string,
    config: ProgressiveLoadConfig
  ): AsyncIterable<ArrowTable> {
    const chunkSize = config.chunkSize || 100000;

    // Open Parquet file
    const reader = await ParquetReader.open(url);

    // Get metadata
    const rowCount = reader.rowCount;
    const chunks = Math.ceil(rowCount / chunkSize);

    // Load and yield chunks
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, rowCount);
      const chunk = await reader.readRows(start, end);
      yield chunk;
    }

    await reader.close();
  }
}

// Usage: Show initial data, then progressively load more
const loader = new ProgressiveDataLoader();
for await (const chunk of loader.loadProgressive(url, { chunkSize: 50000 })) {
  // Update grid with new data
  grid.appendData(chunk);
  // Scroll position maintained
}
```

#### 8.2.3 Rendering Optimization

```typescript
// Glide Data Grid optimization

const GRID_CONFIG = {
  // Virtual scrolling
  bufferSize: 10, // rows above/below viewport

  // Cell rendering
  drawIcons: false, // Disable icons in cells
  freezeColumns: 0, // No frozen columns by default

  // Performance
  debounceScroll: true, // Debounce scroll events
  throttleDrag: true, // Throttle drag operations
};

// ECharts optimization

const ECHARTS_CONFIG = {
  // Progressive rendering for large datasets
  progressive: 1000, // threshold for progressive mode
  progressiveThreshold: 10000, // start progressive at this point

  // Animation
  animation: true,
  animationDuration: 300,
  animationEasing: 'cubicOut',

  // Large mode
  large: true,
  largeThreshold: 2000, //启用large模式的阈值

  // DataZoom for large datasets
  dataZoom: [
    { type: 'inside', start: 0, end: 100 },
    { type: 'slider', start: 0, end: 100 },
  ],
};
```

### 8.3 Memory Management

```typescript
// Memory monitoring and management

class MemoryManager {
  private limit: number;
  private datasets: Map<string, number> = new Map(); // datasetId → memory

  constructor(limit: number) {
    this.limit = limit;
  }

  /**
   * Estimate memory usage of a dataset
   */
  estimateMemory(dataset: ArrowTable): number {
    // Arrow table size in bytes
    return dataset.byteLength;
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): number {
    let total = 0;
    for (const size of this.datasets.values()) {
      total += size;
    }
    return total;
  }

  /**
   * Get memory usage by dataset
   */
  getDatasetUsage(datasetId: string): number {
    return this.datasets.get(datasetId) || 0;
  }

  /**
   * Check if adding a dataset would exceed limit
   */
  canAdd(estimatedSize: number): boolean {
    return this.getCurrentUsage() + estimatedSize <= this.limit;
  }

  /**
   * Evict least recently used dataset
   */
  evictLRU(): string | null {
    // Find dataset with oldest access time
    let lruDataset: string | null = null;
    let oldestAccess = Date.now();

    for (const [id, _] of this.datasets) {
      const accessTime = this.getAccessTime(id);
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        lruDataset = id;
      }
    }

    return lruDataset;
  }

  /**
   * Register a loaded dataset
   */
  register(datasetId: string, size: number): void {
    this.datasets.set(datasetId, size);
  }

  /**
   * Unregister a dataset
   */
  unregister(datasetId: string): void {
    this.datasets.delete(datasetId);
  }

  /**
   * Get memory usage breakdown
   */
  getBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const [id, size] of this.datasets) {
      breakdown[id] = size;
    }
    return breakdown;
  }
}

// Usage in DuckDBProvider
const memoryManager = new MemoryManager(2 * 1024 * 1024 * 1024); // 2GB

const loadDataset = async (url: string) => {
  const estimatedSize = await estimateFileSize(url);

  if (!memoryManager.canAdd(estimatedSize)) {
    const evict = memoryManager.evictLRU();
    if (evict) {
      await unloadDataset(evict);
    } else {
      throw new Error('Insufficient memory to load dataset');
    }
  }

  const dataset = await duckdb.loadParquet(url);
  const actualSize = memoryManager.estimateMemory(dataset);
  memoryManager.register(dataset.id, actualSize);

  return dataset;
};
```

### 8.4 Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                       Cache Hierarchy                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. IN-MEMORY (Fastest)                                         │
│     └─ DuckDB query result cache                               │
│        ├─ Key: query hash + filter hash                        │
│        ├─ Value: Arrow RecordBatch                             │
│        └─ TTL: 5 minutes                                       │
│                                                                 │
│  2. IndexedDB (Persistent)                                     │
│     └─ Parquet file cache                                     │
│        ├─ Key: dataset ID + version hash                       │
│        ├─ Value: Complete Parquet file                        │
│        ├─ TTL: Configurable (default: 7 days)                  │
│        └─ LRU eviction when quota reached                      │
│                                                                 │
│  3. HTTP Cache (Browser)                                       │
│     └─ Parquet file downloads                                 │
│        ├─ ETag header for validation                          │
│        ├─ Cache-Control: public, max-age=3600                 │
│        └─ Revalidation on reload                               │
│                                                                 │
│  4. Server Cache (Shared)                                      │
│     └─ Generated Parquet files                                │
│        ├─ Stored in /data/exports/                            │
│        ├─ Served with ETag                                    │
│        └─ Only re-exported when source changes                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
// Multi-level cache implementation

class CacheManager {
  private memoryCache: LRUCache<string, ArrowTable>;
  private indexedDBCache: IndexedDBCache;

  async get(query: string, filters: FilterState): Promise<ArrowTable | null> {
    const cacheKey = this.hash(query, filters);

    // 1. Check memory cache
    const memResult = this.memoryCache.get(cacheKey);
    if (memResult) {
      return memResult;
    }

    // 2. Check IndexedDB cache
    const idbResult = await this.indexedDBCache.get(cacheKey);
    if (idbResult) {
      // Promote to memory cache
      this.memoryCache.set(cacheKey, idbResult);
      return idbResult;
    }

    return null;
  }

  async set(query: string, filters: FilterState, data: ArrowTable): Promise<void> {
    const cacheKey = this.hash(query, filters);

    // Store in memory cache
    this.memoryCache.set(cacheKey, data);

    // Store in IndexedDB (async, non-blocking)
    this.indexedDBCache.set(cacheKey, data).catch(console.error);
  }
}
```

---

## 9. Implementation Design

### 9.1 Phase 1: Infrastructure (4 weeks)

**Goal**: Establish foundation for WASM-centric architecture.

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | DuckDB-Wasm integration, provider setup | `DuckDBProvider.tsx`, `useDuckDB` hook |
| 2 | Parquet export service, Arrow utilities | `ParquetExporter`, Arrow converters |
| 3 | Dataset API routes, storage management | `/api/datasets/*` endpoints |
| 4 | IndexedDB caching, memory monitoring | `CacheManager`, `MemoryMonitor` |

**Key Files**:
- `src/components/duckdb/DuckDBProvider.tsx`
- `src/lib/export/parquet-exporter.ts`
- `src/app/api/datasets/route.ts`
- `src/lib/arrow/`

**Acceptance Criteria**:
- DuckDB initializes successfully in browser
- Can load a Parquet file into DuckDB table
- Can execute basic SQL queries
- Dataset can be cached to IndexedDB
- Memory usage can be monitored

### 9.2 Phase 2: Table Replacement (4 weeks)

**Goal**: Replace TanStack Table with Glide Data Grid.

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Glide Data Grid integration, basic table | `GlideDataTable.tsx` |
| 2 | Cell renderers, column features (sort/filter) | `CellRenderers.tsx`, `ColumnFeatures.tsx` |
| 3 | SQL Editor integration, query results | `GlideQueryResults.tsx` |
| 4 | Report table replacement, pagination removal | `GlideDataTable.tsx` in reports |

**Key Files**:
- `src/components/glide/GlideDataTable.tsx`
- `src/components/glide/GlideQueryResults.tsx`
- `src/components/glide/CellRenderers.tsx`

**Acceptance Criteria**:
- Glide Data Grid renders Arrow data
- Smooth scrolling with 1M+ rows
- Sort/filter/aggregate work
- SQL editor displays results
- Reports render without pagination

### 9.3 Phase 3: Chart Replacement (5 weeks)

**Goal**: Replace Recharts with Apache ECharts.

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | ECharts integration, basic chart types | `EChartsRenderer.tsx`, basic charts |
| 2 | Advanced chart types (heatmap, treemap, etc.) | Advanced chart builders |
| 3 | Geospatial and statistical charts | Geo/statistical charts |
| 4 | Chart editor, configuration UI | `AdvancedChartEditor.tsx` |
| 5 | Backward compatibility, Recharts adapter | `RechartsCompatAdapter.tsx` |

**Key Files**:
- `src/components/echarts/EChartsRenderer.tsx`
- `src/components/echarts/chart-types/`
- `src/components/charts/AdvancedChartEditor.tsx`

**Acceptance Criteria**:
- All 8 existing chart types render correctly
- 10+ new chart types available
- Chart editor works for all types
- Existing chart configs work via adapter
- Interactive features (zoom, drill-down) work

### 9.4 Phase 4: Dashboard Integration (3 weeks)

**Goal**: Implement cross-widget filtering and shared datasets.

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Cross-filter manager, filter propagation | `CrossFilterManager.tsx` |
| 2 | Widget dataset management, shared loading | `DatasetManager` integration |
| 3 | Dashboard optimizations, auto-refresh | Dashboard state management |

**Key Files**:
- `src/components/filters/CrossFilterManager.tsx`
- `src/components/dashboard/WasmWidgetCard.tsx`
- `src/components/dashboard/DashboardState.tsx`

**Acceptance Criteria**:
- Widgets load shared datasets (no duplication)
- Clicking a chart element filters other widgets
- Filter UI shows active filters
- Dashboard refreshes work

### 9.5 Phase 5: Advanced Features (3 weeks)

**Goal**: Add offline mode, progressive loading, and optional features.

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Offline indicator, cache management | `OfflineIndicator.tsx` |
| 2 | Progressive loading, infinite scroll | Progressive data loader |
| 3 | Optional 3D charts, performance tuning | echarts-gl integration |

**Key Files**:
- `src/components/datasets/OfflineIndicator.tsx`
- `src/lib/duckdb/progressive-loader.ts`
- `src/components/echarts/chart-types/3d/`

**Acceptance Criteria**:
- App works offline with cached data
- Large datasets load progressively
- 3D charts render (optional)
- Performance targets met

---

## 10. Migration Strategy

### 10.1 Feature Flags

```typescript
// Feature flags for gradual rollout

interface FeatureFlags {
  /**
   * Enable DuckDB-Wasm (client-side execution)
   */
  wasmEnabled: boolean;

  /**
   * Enable Glide Data Grid
   */
  glideGridEnabled: boolean;

  /**
   * Enable ECharts
   */
  echartsEnabled: boolean;

  /**
   * Enable cross-widget filtering
   */
  crossFilterEnabled: boolean;

  /**
   * Enable offline mode
   */
  offlineEnabled: boolean;

  /**
   * Enable progressive loading
   */
  progressiveEnabled: boolean;
}

// Configuration
const featureFlags: FeatureFlags = {
  wasmEnabled: process.env.NEXT_PUBLIC_WASM_ENABLED === 'true',
  glideGridEnabled: process.env.NEXT_PUBLIC_GLIDE_ENABLED === 'true',
  echartsEnabled: process.env.NEXT_PUBLIC_ECHARTS_ENABLED === 'true',
  crossFilterEnabled: process.env.NEXT_PUBLIC_CROSSFILTER_ENABLED === 'true',
  offlineEnabled: process.env.NEXT_PUBLIC_OFFLINE_ENABLED === 'true',
  progressiveEnabled: process.env.NEXT_PUBLIC_PROGRESSIVE_ENABLED === 'true',
};

// Usage in components
const DataTable = featureFlags.glideGridEnabled
  ? GlideDataTable
  : TanStackTable;
```

### 10.2 Backward Compatibility

```typescript
// Recharts → ECharts config adapter

class RechartsCompatAdapter {
  static convertConfig(rechartsConfig: RechartsConfig): EChartsConfig {
    const { type, data, ...options } = rechartsConfig;

    const baseConfig: EChartsConfig = {
      type: this.mapChartType(type),
      data: this.convertData(data, type),
      ...this.convertOptions(options, type),
    };

    return baseConfig;
  }

  private static mapChartType(rechartsType: string): ChartType {
    const typeMap: Record<string, ChartType> = {
      'bar': 'bar',
      'line': 'line',
      'area': 'area',
      'pie': 'pie',
      'scatter': 'scatter',
      // ...
    };
    return typeMap[rechartsType] || 'bar';
  }

  private static convertData(data: any[], type: string): ChartData {
    // Convert Recharts data format to ECharts format
    switch (type) {
      case 'pie':
        return data.map(item => ({
          name: item.name,
          value: item.value,
        }));
      default:
        return data;
    }
  }

  private static convertOptions(options: any, type: string): Partial<EChartsConfig> {
    // Convert Recharts-specific options to ECharts options
    // ...
  }
}

// Usage
const renderChart = (config: ChartConfig) => {
  if (isRechartsConfig(config)) {
    const echartsConfig = RechartsCompatAdapter.convertConfig(config);
    return <EChartsRenderer config={echartsConfig} />;
  }
  return <EChartsRenderer config={config} />;
};
```

### 10.3 Data Migration

No database migration needed for the config database. New tables added:

```sql
-- Dataset registry
CREATE TABLE dataset_cache (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  data_source_id TEXT NOT NULL REFERENCES data_sources(id),
  query TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  file_size INTEGER NOT NULL,
  compressed_size INTEGER NOT NULL,
  schema TEXT NOT NULL, -- JSON
  file_path TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT,
  refresh_schedule TEXT, -- cron expression
  last_refresh_at TEXT,
  status TEXT NOT NULL, -- 'pending', 'ready', 'error'
  error_message TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  permissions TEXT NOT NULL -- JSON (RBAC)
);

CREATE INDEX idx_dataset_cache_ds ON dataset_cache(data_source_id);
CREATE INDEX idx_dataset_cache_status ON dataset_cache(status);
CREATE INDEX idx_dataset_cache_updated ON dataset_cache(updated_at DESC);

-- Dataset refresh jobs
CREATE TABLE dataset_refresh_jobs (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL REFERENCES dataset_cache(id),
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  started_at TEXT,
  completed_at TEXT,
  row_count INTEGER,
  file_size INTEGER,
  error_message TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_refresh_jobs_dataset ON dataset_refresh_jobs(dataset_id);
CREATE INDEX idx_refresh_jobs_status ON dataset_refresh_jobs(status);
```

### 10.4 Rollback Plan

```typescript
// Graceful fallback to server-side execution

class ExecutionModeSelector {
  static async selectMode(
    dataSourceId: string,
    query: string
  ): Promise<'client' | 'server'> {
    // 1. Check if feature flag enabled
    if (!featureFlags.wasmEnabled) {
      return 'server';
    }

    // 2. Check browser capabilities
    const capabilities = await this.checkCapabilities();
    if (!capabilities.wasmSupported || !capabilities.sharedArrayBuffer) {
      return 'server';
    }

    // 3. Estimate dataset size
    const estimate = await this.estimateSize(dataSourceId, query);
    if (estimate > 500 * 1024 * 1024) { // 500MB threshold
      return 'server'; // Too large for client
    }

    // 4. Check memory availability
    const availableMemory = await this.getAvailableMemory();
    if (availableMemory < estimate * 2) { // Need 2x for processing
      return 'server';
    }

    return 'client';
  }

  private static async checkCapabilities(): Promise<Capabilities> {
    return {
      wasmSupported: typeof WebAssembly === 'object',
      sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      sufficientMemory: navigator.deviceMemory >= 4, // GB
    };
  }
}

// Usage in API
app.post('/api/sql/execute', async (req, res) => {
  const mode = await ExecutionModeSelector.selectMode(
    req.body.dataSourceId,
    req.body.sql
  );

  if (mode === 'server') {
    // Traditional server execution
    const result = await executeServerSide(req.body);
    return res.json({ executionMode: 'server', data: result });
  } else {
    // Return data for client execution
    const datasetId = await getOrCreateDataset(req.body);
    return res.json({
      executionMode: 'client',
      data: { datasetId, url: `/api/datasets/${datasetId}/parquet` }
    });
  }
});
```

---

## 11. Testing Architecture

### 11.1 Testing Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      Testing Pyramid                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                      ┌─────────┐                               │
│                     /    E2E   \      10% - Playwright         │
│                    /  (25 tests) \                             │
│                   ────────────────                             │
│                  /                \                            │
│                 /     Integration   \   30% - DuckDB tests      │
│                /      (75 tests)    \                           │
│               ────────────────────────                          │
│              /                      \                           │
│             /        Unit            \  60% - Jest/Vitest       │
│            /        (150 tests)       \                          │
│           ─────────────────────────────                         │
│                                                                 │
│  Total: ~250 tests                                             │
│  Target: >90% code coverage                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Unit Tests

```typescript
// Example unit tests

describe('RechartsCompatAdapter', () => {
  describe('convertConfig', () => {
    it('should convert bar chart config', () => {
      const rechartsConfig = {
        type: 'bar',
        data: [{ name: 'A', value: 10 }, { name: 'B', value: 20 }],
        layout: 'vertical',
      };

      const echartsConfig = RechartsCompatAdapter.convertConfig(rechartsConfig);

      expect(echartsConfig.type).toBe('bar');
      expect(echartsConfig.data).toHaveLength(2);
    });

    it('should handle unknown chart types', () => {
      const rechartsConfig = {
        type: 'unknown',
        data: [],
      };

      const echartsConfig = RechartsCompatAdapter.convertConfig(rechartsConfig);

      expect(echartsConfig.type).toBe('bar'); // fallback
    });
  });
});

describe('FilterToSQL', () => {
  it('should convert simple equality filter', () => {
    const filters = [
      { column: 'status', operator: 'eq', value: 'active' },
    ];

    const sql = FilterToSQL.convert(filters);

    expect(sql).toBe("WHERE status = 'active'");
  });

  it('should convert multiple filters with AND', () => {
    const filters = [
      { column: 'status', operator: 'eq', value: 'active' },
      { column: 'amount', operator: 'gt', value: 100 },
    ];

    const sql = FilterToSQL.convert(filters);

    expect(sql).toBe("WHERE status = 'active' AND amount > 100");
  });
});
```

### 11.3 Integration Tests

```typescript
// DuckDB-Wasm integration tests

describe('DuckDB Integration', () => {
  let duckdb: DuckDBInstance;

  beforeEach(async () => {
    duckdb = await createDuckDBInstance();
  });

  afterEach(async () => {
    await duckdb.close();
  });

  it('should load Parquet file', async () => {
    const parquetData = await createTestParquet();
    await duckdb.loadParquet('test', parquetData);

    const tables = await duckdb.listTables();
    expect(tables).toContain('test');
  });

  it('should execute SQL query', async () => {
    await duckdb.loadParquet('test', await createTestParquet());

    const result = await duckdb.query('SELECT COUNT(*) as count FROM test');

    expect(result[0].count).toBeGreaterThan(0);
  });

  it('should handle aggregation', async () => {
    await duckdb.loadParquet('test', await createTestParquet());

    const result = await duckdb.query(`
      SELECT category, SUM(amount) as total
      FROM test
      GROUP BY category
    `);

    expect(result).toHaveLength.greaterThan(0);
    expect(result[0]).toHaveProperty('category');
    expect(result[0]).toHaveProperty('total');
  });
});
```

### 11.4 E2E Tests

```typescript
// Playwright E2E tests

test.describe('SQL Editor with DuckDB', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await navigateTo(page, '/sql-editor');
  });

  test('should execute query client-side', async ({ page }) => {
    // Load a dataset
    await page.click('[data-testid="load-dataset-button"]');
    await page.selectOption('[data-testid="dataset-select"]', 'test-data');
    await page.click('[data-testid="confirm-load"]');

    // Wait for load to complete
    await page.waitForSelector('[data-testid="dataset-loaded"]');

    // Execute query
    await page.fill('[data-testid="sql-editor"]', 'SELECT * FROM test_data LIMIT 10');
    await page.click('[data-testid="execute-query"]');

    // Verify results
    await expect(page.locator('[data-testid="query-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="result-rows"]')).toHaveText('10 rows');
  });

  test('should show execution time', async ({ page }) => {
    await executeQuery(page, 'SELECT COUNT(*) FROM test_data');

    const executionTime = await page.textContent('[data-testid="execution-time"]');
    expect(executionTime).toMatch(/\d+ms/);
  });
});

test.describe('Cross-Widget Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await navigateTo(page, '/dashboards/test-dashboard');
  });

  test('should filter linked widgets', async ({ page }) => {
    // Click on a bar in the chart
    await page.click('[data-testid="chart-bar-east"]');

    // Verify filter applied to table widget
    const tableRows = await page.locator('[data-testid="table-widget"] tr').count();
    const allRows = await page.textContent('[data-testid="total-rows"]');

    // Filtered rows should be less than total
    expect(tableRows).toBeLessThan(parseInt(allRows || '0'));
  });

  test('should show active filters', async ({ page }) => {
    await page.click('[data-testid="chart-bar-east"]');

    await expect(page.locator('[data-testid="active-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-region"]')).toHaveText('region = East');
  });
});
```

### 11.5 Performance Tests

```typescript
// Performance benchmarks

describe('Performance Benchmarks', () => {
  it('should load 1M row dataset in < 2s', async () => {
    const start = performance.now();

    await duckdb.loadParquet('large', largeParquetFile);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(2000);
  });

  it('should execute simple query in < 100ms', async () => {
    await duckdb.loadParquet('test', testParquet);

    const start = performance.now();
    await duckdb.query("SELECT * FROM test WHERE category = 'A'");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it('should execute aggregation in < 500ms', async () => {
    await duckdb.loadParquet('test', testParquet);

    const start = performance.now();
    await duckdb.query('SELECT category, COUNT(*) FROM test GROUP BY category');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
```

---

## 12. Deployment Architecture

### 12.1 Deployment Configuration

```yaml
# docker-compose.yml (updated)

version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./data/exports:/data/exports:ro  # Parquet files
    depends_on:
      - app
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/database.sqlite
      - DATASET_EXPORT_PATH=/data/exports
      - REDIS_URL=redis://redis:6379
      # ... other env vars
    volumes:
      - ./data:/data  # Database and exports
    restart: unless-stopped
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### 12.2 Nginx Configuration

```nginx
# nginx/nginx.conf

user nginx;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy no-referrer-when-downgrade always;

    # COOP/COEP for SharedArrayBuffer
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;

    # Cache control for Parquet files
    map $sent_http_content_type $cache_control {
        application/octet-stream "public, max-age=3600";
        application/vnd.apache.arrow.stream "public, max-age=3600";
    }

    # Upstream
    upstream app {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=download:10m rate=2r/s;

    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name example.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Gzip compression
        gzip on;
        gzip_types text/plain application/json application/javascript text/css;
        gzip_min_length 1000;

        # TanStack Start app
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # API routes (rate limited)
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
        }

        # Dataset downloads (rate limited, supports range)
        location /data/exports/ {
            limit_req zone=download burst=5 nodelay;

            # Enable CORS if needed
            add_header Access-Control-Allow-Origin *;

            # ETag support
            etag on;

            # Range request support
            add_header Accept-Ranges bytes;

            # Cache control
            add_header Cache-Control $cache_control;

            alias /data/exports/;
        }

        # WASM files (no cache during development, cache in production)
        location /duckdb-wasm/ {
            add_header Cache-Control "public, max-age=31536000, immutable";

            # COOP/COEP require these files to be same-origin
            alias /app/public/duckdb-wasm/;
        }
    }
}
```

### 12.3 Environment Variables

```bash
# .env.production

# Application
NODE_ENV=production
PORT=4050
BASE_URL=https://example.com

# Database
DATABASE_PATH=/data/database.sqlite

# Dataset Exports
DATASET_EXPORT_PATH=/data/exports
DATASET_MAX_FILE_SIZE=536870912  # 500MB
DATASET_CACHE_TTL=604800  # 7 days

# DuckDB-Wasm
DUCKDB_WASM_ENABLED=true
DUCKDB_WASM_MAX_MEMORY=2147483648  # 2GB
DUCKDB_WASM_WORKER_PATH=/duckdb-wasm/duckdb-browser.mjs

# Feature Flags
NEXT_PUBLIC_WASM_ENABLED=true
NEXT_PUBLIC_GLIDE_ENABLED=true
NEXT_PUBLIC_ECHARTS_ENABLED=true
NEXT_PUBLIC_CROSSFILTER_ENABLED=true
NEXT_PUBLIC_OFFLINE_ENABLED=true
NEXT_PUBLIC_PROGRESSIVE_ENABLED=true

# Redis
REDIS_URL=redis://redis:6379

# Auth
AUTH_SECRET=<min 32 chars>
NEXTAUTH_URL=https://example.com
NEXTAUTH_SECRET=<min 32 chars>

# Encryption
ENCRYPTION_KEY=<32 bytes>

# OpenAI (for NL query)
OPENAI_API_KEY=sk-...

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=...

# URL Signing
DATASET_URL_SECRET=<signing secret>
```

---

## 13. Monitoring & Observability

### 13.1 Metrics

```typescript
// Metrics collection

interface Metrics {
  // DuckDB metrics
  duckdb: {
    initializationTime: number;
    queryExecutionTime: number;
    memoryUsage: number;
    loadedDatasets: number;
    cacheHitRate: number;
  };

  // Dataset metrics
  datasets: {
    totalGenerated: number;
    totalDownloaded: number;
    averageFileSize: number;
    compressionRatio: number;
  };

  // Performance metrics
  performance: {
    pageLoadTime: number;
    firstContentfulPaint: number;
    timeToInteractive: number;
  };
}

// Export to monitoring system (Prometheus, etc.)
const exportMetrics = (metrics: Metrics) => {
  // Send to monitoring backend
};
```

### 13.2 Logging

```typescript
// Structured logging

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  timestamp: string;
  sessionId: string;
  userId?: string;
  event: string;
  data: Record<string, any>;
}

const logger = {
  info: (event: string, data: Record<string, any>) => {
    logEntry({ level: 'info', event, data });
  },
  warn: (event: string, data: Record<string, any>) => {
    logEntry({ level: 'warn', event, data });
  },
  error: (event: string, data: Record<string, any>) => {
    logEntry({ level: 'error', event, data });
  },
};
```

### 13.3 Error Tracking

```typescript
// Error boundary with reporting

class WasmErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error tracking service
    errorTracker.captureException(error, {
      context: {
        componentStack: errorInfo.componentStack,
        sessionId: getSessionId(),
      },
    });

    // Check if WASM-related error
    if (isWasmError(error)) {
      // Offer server-side fallback
      this.props.onFallback();
    }
  }
}
```

---

## 14. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Arrow IPC** | Apache Arrow's Inter-Process Communication format for streaming |
| **Columnar Storage** | Data organized by columns rather than rows |
| **DuckDB-Wasm** | DuckDB compiled to WebAssembly for in-browser execution |
| **Glide Data Grid** | Canvas-based React data grid component |
| **IndexedDB** | Browser API for persistent storage |
| **Parquet** | Columnar file format with compression |
| **Predicate Pushdown** | Applying filters during data load, not after |
| **Progressive Rendering** | Showing partial results immediately |
| **SharedArrayBuffer** | JavaScript API for shared memory between threads |
| **Zero-Copy** | Data sharing without serialization/deserialization |

### Appendix B: Reference Links

| Resource | URL |
|----------|-----|
| DuckDB-Wasm | https://duckdb.org/docs/api/wasm |
| Apache Arrow | https://arrow.apache.org/ |
| Apache Parquet | https://parquet.apache.org/ |
| Glide Data Grid | https://grid.glideapps.com/ |
| Apache ECharts | https://echarts.apache.org/ |
| TanStack Start | https://nextjs.org/docs |
| COOP/COEP | https://web.dev/coop-coep/ |

### Appendix C: Type Definitions

```typescript
// Complete type definitions for key interfaces

/**
 * DuckDB query result
 */
interface DuckDBResult {
  /**
   * Result data as Arrow table
   */
  data: ArrowTable;

  /**
   * Number of rows
   */
  rowCount: number;

  /**
   * Column schema
   */
  schema: ColumnSchema[];

  /**
   * Query execution time (ms)
   */
  executionTime: number;

  /**
   * Query that was executed
   */
  query: string;
}

/**
 * Arrow table interface
 */
interface ArrowTable {
  /**
   * Schema of the table
   */
  schema: ArrowSchema;

  /**
   * Number of rows
   */
  numRows: number;

  /**
   * Number of columns
   */
  numCols: number;

  /**
   * Get child column by name
   */
  getChild(name: string): ArrowVector | null;

  /**
   * Get child column by index
   */
  getChildAt(index: number): ArrowVector;

  /**
   * Convert to array of objects
   */
  toArray(): Record<string, any>[];

  /**
   * Byte length
   */
  byteLength: number;
}

/**
 * Arrow schema
 */
interface ArrowSchema {
  /**
   * Schema fields
   */
  fields: ArrowField[];

  /**
   * Get field by name
   */
  field(name: string): ArrowField | null;
}

/**
 * Arrow field
 */
interface ArrowField {
  /**
   * Field name
   */
  name: string;

  /**
   * Field type
   */
  type: ArrowType;

  /**
   * Is nullable?
   */
  nullable: boolean;

  /**
   * Metadata
   */
  metadata: Record<string, string>;
}

/**
 * Arrow data types
 */
type ArrowType =
  | Arrow.Int8
  | Arrow.Int16
  | Arrow.Int32
  | Arrow.Int64
  | Arrow.Uint8
  | Arrow.Uint16
  | Arrow.Uint32
  | Arrow.Uint64
  | Arrow.Float32
  | Arrow.Float64
  | Arrow.Utf8
  | Arrow.Bool
  | Arrow.DateDay
  | Arrow.TimestampMilli
  | Arrow.Binary;

/**
 * ECharts option
 */
interface EChartsOption {
  /**
   * Chart title
   */
  title?: {
    text?: string;
    subtext?: string;
    left?: string | number;
    top?: string | number;
  };

  /**
   * Tooltip
   */
  tooltip?: {
    trigger?: 'item' | 'axis' | 'none';
    formatter?: string | ((params: any) => string);
  };

  /**
   * Legend
   */
  legend?: {
    data?: string[];
    orient?: 'horizontal' | 'vertical';
    left?: string | number;
    top?: string | number;
  };

  /**
   * X-axis
   */
  xAxis?: {
    type?: 'category' | 'value' | 'time' | 'log';
    data?: any[];
    name?: string;
  } | XAxisObject[];

  /**
   * Y-axis
   */
  yAxis?: {
    type?: 'category' | 'value' | 'time' | 'log';
    name?: string;
  } | YAxisObject[];

  /**
   * Series
   */
  series?: SeriesObject[];

  /**
   * Data zoom
   */
  dataZoom?: DataZoomObject[];

  /**
   * Visual map (for choropleth maps)
   */
  visualMap?: VisualMapObject;

  /**
   * Geo component (for maps)
   */
  geo?: GeoObject;

  /**
   * Grid (layout)
   */
  grid?: GridObject;

  /**
   * Color palette
   */
  color?: string[];
}

/**
 * Glide Data Grid cell
 */
interface GridCell {
  /**
   * Cell kind
   */
  kind: 'text' | 'number' | 'boolean' | 'image' | 'uri' | 'markdown';

  /**
   * Display data
   */
  displayData: string;

  /**
   * Raw data
   */
  data: any;

  /**
   * Allow overlay
   */
  allowOverlay: boolean;

  /**
   * Content align
   */
  contentAlign?: 'left' | 'center' | 'right';
}

/**
 * Glide Data Grid model
 */
interface GridModel {
  /**
   * Get column count
   */
  getColumnCount(): number;

  /**
   * Get row count
   */
  getRowCount(): number;

  /**
   * Get cell content
   */
  getCellContent(cell: { column: number; row: number }): GridCell;
}
```

---

**End of Architecture & Design Document**

*Document Version: 1.0*
*Last Updated: 2025-02-27*
*Next Review: Upon completion of each implementation phase*
