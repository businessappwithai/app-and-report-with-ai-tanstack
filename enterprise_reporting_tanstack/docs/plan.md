# WASM Architecture Refactoring - Implementation Plan

## Overview
Refactor the Enterprise Reporting System from server-side SQL execution to a WASM-centric, client-side processing architecture based on `WASM_ARCHITECTURE_DESIGN.md`.

## Phase 1: Infrastructure Foundation

### Step 1: Install New Dependencies
Install DuckDB-Wasm, Apache Arrow, Parquet-Wasm, TanStack Table, Apache ECharts, and supporting libraries.

### Step 2: Feature Flags System
- Create `src/lib/feature-flags.ts` with environment-variable-driven feature flags
- Flags: `wasmEnabled`, `echartsEnabled`, `crossFilterEnabled`, `offlineEnabled`, `progressiveEnabled`

### Step 3: WASM Type Definitions
- Create `src/types/wasm.ts` with all WASM-related types (DuckDBResult, ArrowTable, ChartConfig, DatasetInfo, etc.)

### Step 4: DuckDB-Wasm Core Library
- Create `src/lib/duckdb/index.ts` - Main exports
- Create `src/lib/duckdb/instance.ts` - DuckDB instance management (singleton, Web Worker)
- Create `src/lib/duckdb/query.ts` - Query execution helpers
- Create `src/lib/duckdb/schema.ts` - Schema operations
- Create `src/lib/duckdb/memory.ts` - Memory management (MemoryManager class)
- Create `src/lib/duckdb/types.ts` - DuckDB-specific type definitions

### Step 5: Arrow/Parquet Client Library
- Create `src/lib/arrow/index.ts` - Main exports
- Create `src/lib/arrow/converter.ts` - JS → Arrow conversion, type mappings
- Create `src/lib/arrow/reader.ts` - Arrow reader utilities
- Create `src/lib/arrow/writer.ts` - Arrow writer utilities
- Create `src/lib/arrow/parquet.ts` - Parquet-specific utilities
- Create `src/lib/arrow/types.ts` - Arrow type definitions

### Step 6: DuckDB React Provider & Hooks
- Create `src/components/duckdb/DuckDBProvider.tsx` - React Context provider
- Create `src/components/duckdb/DuckDBInstance.ts` - Instance wrapper
- Create `src/components/duckdb/QueryExecutor.tsx` - Query execution component
- Create `src/components/duckdb/SchemaRegistry.tsx` - Schema introspection component
- Create `src/components/duckdb/MemoryMonitor.tsx` - Memory usage tracking component
- Create `src/hooks/useDuckDB.ts` - DuckDB instance hook
- Create `src/hooks/useDataset.ts` - Dataset loading/management hook
- Create `src/hooks/useQuery.ts` - DuckDB query execution hook
- Create `src/hooks/useMemory.ts` - Memory monitoring hook

### Step 7: Server-Side Parquet Export Service
- Create `src/lib/export/index.ts` - Main exports
- Create `src/lib/export/parquet-exporter.ts` - Parquet export service
- Create `src/lib/export/arrow-exporter.ts` - Arrow IPC export
- Create `src/lib/export/source-connector.ts` - Source DB connector
- Create `src/lib/export/compression.ts` - Compression utilities
- Create `src/lib/export/storage.ts` - File storage management

### Step 8: Dataset API Routes
- Create `src/app/api/datasets/route.ts` - List datasets (GET), generate dataset (POST)
- Create `src/app/api/datasets/[id]/route.ts` - Get/delete dataset
- Create `src/app/api/datasets/[id]/parquet/route.ts` - Stream Parquet
- Create `src/app/api/datasets/[id]/arrow/route.ts` - Stream Arrow IPC
- Create `src/app/api/datasets/[id]/refresh/route.ts` - Refresh dataset
- Create `src/app/api/datasets/generate/route.ts` - Trigger Parquet generation

### Step 9: Database Migration for Dataset Registry
- Create migration for `dataset_cache` table
- Create migration for `dataset_refresh_jobs` table

### Step 10: Dataset Management UI
- Create `src/components/datasets/DatasetManager.tsx`
- Create `src/components/datasets/DatasetLoader.tsx`
- Create `src/components/datasets/DatasetCard.tsx`
- Create `src/components/datasets/DatasetSelector.tsx`
- Create `src/components/datasets/CacheManager.tsx`
- Create `src/app/(dashboard)/datasets/page.tsx`

### Step 11: Update Providers
- Update `src/app/providers.tsx` to include DuckDBProvider
- Update `next.config.js` with COOP/COEP security headers for SharedArrayBuffer

## Phase 2: Table Enhancement (TanStack Table)

### Step 12: TanStack Table Components
- `src/components/reporting/DataTable.tsx` - Main table component with virtual scrolling
- `src/components/sql-editor/QueryResults.tsx` - Query results table with virtual scroll
- TanStack React Virtual for efficient row rendering
- Server-side pagination integration

### Step 13: SQL Editor Enhancement
- Create `src/components/sql-editor/MonacoSQLEditorWrapper.tsx` - Monaco + DuckDB dialect support
- Create `src/components/sql-editor/SchemaBrowser.tsx` (enhanced) - DuckDB schema browser
- Create `src/components/sql-editor/QueryValidation.tsx` (enhanced) - Client-side validation
- Create `src/components/sql-editor/AutocompleteProvider.ts` - DuckDB-aware autocomplete

### Step 14: Enhanced Filters
- Create `src/components/filters/DuckDBFilterBar.tsx` - DuckDB-aware filter bar
- Create `src/components/filters/FilterBuilder.tsx` - Visual filter builder
- Create `src/components/filters/FilterToSQL.ts` - Filter → DuckDB SQL

### Step 15: Update Report Data Table
- Reporting components use TanStack Table with virtual scrolling for large datasets

## Phase 3: Chart Replacement (Apache ECharts)

### Step 16: ECharts Core Components
- Create `src/components/echarts/EChartsRenderer.tsx` - Main chart renderer
- Create `src/components/echarts/EChartsProvider.tsx` - Chart context provider
- Create `src/components/echarts/ChartTypeFactory.ts` - Chart type builder factory
- Create `src/components/echarts/ThemeAdapter.tsx` - App theme integration
- Create `src/components/echarts/DataAdapter.ts` - Arrow → ECharts data conversion
- Create `src/components/echarts/InteractionManager.tsx` - Zoom, brush, drill-down

### Step 17: Chart Type Builders
- Create `src/components/echarts/chart-types/BasicCharts.ts` - Bar, line, area, pie
- Create `src/components/echarts/chart-types/AdvancedCharts.ts` - Heatmap, treemap, sunburst, sankey, funnel, gauge
- Create `src/components/echarts/chart-types/GeoCharts.ts` - Map, geo scatter
- Create `src/components/echarts/chart-types/StatisticalCharts.ts` - Boxplot, candlestick, parallel

### Step 18: Backward Compatibility
- Create Recharts → ECharts config adapter
- Update chart-renderer.tsx to conditionally use ECharts based on feature flag

## Phase 4: Dashboard Integration

### Step 19: Cross-Widget Filtering
- Create `src/components/filters/CrossFilterManager.tsx`
- Create `src/hooks/useCrossFilter.ts`

### Step 20: Dashboard Enhancements
- Create `src/components/dashboard/WasmWidgetCard.tsx` - WASM-aware widget card
- Create `src/components/dashboard/WidgetRenderer.tsx` - Unified widget renderer
- Create `src/components/dashboard/LinkedFilters.tsx` - Cross-widget filter UI
- Create `src/components/dashboard/DashboardState.tsx` - State management

## Phase 5: Advanced Features

### Step 21: Query Utilities
- Create `src/lib/query/duckdb-dialect.ts` - DuckDB SQL specifics
- Create `src/lib/query/query-adapter.ts` - Cross-dialect adapter
- Create `src/lib/query/validation.ts` - DuckDB query validation

### Step 22: Execution Mode Selector
- Create hybrid execution model with auto fallback between client and server modes

### Step 23: Update SQL Execute API
- Enhance `src/app/api/sql/execute` to support both server and client execution modes with `outputFormat` parameter

### Step 24: Lint, Typecheck & Verify
- Run `bun run lint` and fix issues
- Run `bun run typecheck` and fix issues
- Verify the build compiles
