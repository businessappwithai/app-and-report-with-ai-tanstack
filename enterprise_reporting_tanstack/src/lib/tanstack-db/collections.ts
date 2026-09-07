import { createCollection } from '@tanstack/db'
import { z } from 'zod'
import { createElectricSyncAdapter, getElectricSyncConfig } from './electric-sync'

// Active Filters schema
const activeFiltersSchema = z.object({
  id: z.string(),
  dashboardId: z.string(),
  widgetId: z.string(),
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
  createdAt: z.string(),
})

export type ActiveFilter = z.infer<typeof activeFiltersSchema>

export const activeFiltersCollection = createCollection({
  id: 'active-filters',
  schema: activeFiltersSchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('active-filters', 'active_filters')
  ),
})

// Chart Draft schema
const chartDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  chartType: z.string(),
  chartConfig: z.unknown(),
  dataMapping: z.unknown(),
  savedQueryId: z.string().optional(),
  lastEditedAt: z.string(),
})

export type ChartDraft = z.infer<typeof chartDraftSchema>

export const chartDraftCollection = createCollection({
  id: 'chart-drafts',
  schema: chartDraftSchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('chart-drafts', 'chart_drafts')
  ),
})

// Dashboard State schema
const dashboardStateSchema = z.object({
  dashboardId: z.string(),
  editMode: z.boolean(),
  activeWidgetId: z.string().optional(),
  layoutConfig: z.unknown(),
  lastModified: z.string(),
})

export type DashboardState = z.infer<typeof dashboardStateSchema>

export const dashboardStateCollection = createCollection({
  id: 'dashboard-state',
  schema: dashboardStateSchema,
  getKey: (item) => item.dashboardId,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('dashboard-state', 'dashboard_state')
  ),
})

// Query History schema
const queryHistorySchema = z.object({
  id: z.string(),
  sql: z.string(),
  executedAt: z.string(),
  rowCount: z.number(),
  durationMs: z.number(),
  error: z.string().optional(),
})

export type QueryHistory = z.infer<typeof queryHistorySchema>

export const queryHistoryCollection = createCollection({
  id: 'query-history',
  schema: queryHistorySchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('query-history', 'query_history')
  ),
})

// Reports List schema
const reportsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  dataSourceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Report = z.infer<typeof reportsSchema>

export const reportsCollection = createCollection({
  id: 'reports',
  schema: reportsSchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('reports', 'reports')
  ),
})

// Charts List schema
const chartsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  chartType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Chart = z.infer<typeof chartsSchema>

export const chartsCollection = createCollection({
  id: 'charts',
  schema: chartsSchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('charts', 'charts')
  ),
})

// Dashboards List schema
const dashboardsSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Dashboard = z.infer<typeof dashboardsSchema>

export const dashboardsCollection = createCollection({
  id: 'dashboards',
  schema: dashboardsSchema,
  getKey: (item) => item.id,
  ...createElectricSyncAdapter(
    getElectricSyncConfig('dashboards', 'dashboards')
  ),
})
