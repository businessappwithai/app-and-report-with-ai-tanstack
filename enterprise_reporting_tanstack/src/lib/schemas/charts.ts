import { z } from "zod";
import { uuidSchema } from "./common";

export const chartTypeSchema = z.enum([
  "line",
  "bar",
  "pie",
  "area",
  "scatter",
  "heatmap",
  "gauge",
  "funnel",
  "sankey",
  "treemap",
]);

export type ChartType = z.infer<typeof chartTypeSchema>;

export const createChartSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  chartType: chartTypeSchema,
  dataSourceId: uuidSchema,
  sqlQuery: z.string().min(1, "SQL query is required").max(50000, "SQL query too large"),
  chartConfig: z.record(z.unknown()).optional(),
  colorScheme: z.string().max(50).optional(),
  isPublic: z.boolean().default(false),
});

export type CreateChartInput = z.infer<typeof createChartSchema>;

export const updateChartSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  chartType: chartTypeSchema.optional(),
  sqlQuery: z.string().min(1, "SQL query is required").max(50000, "SQL query too large").optional(),
  chartConfig: z.record(z.unknown()).optional(),
  colorScheme: z.string().max(50).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateChartInput = z.infer<typeof updateChartSchema>;

export const getChartSchema = z.object({
  id: uuidSchema,
});

export type GetChartInput = z.infer<typeof getChartSchema>;

export const chartConfigSchema = z.object({
  xAxis: z.record(z.unknown()).optional(),
  yAxis: z.record(z.unknown()).optional(),
  legend: z.record(z.unknown()).optional(),
  grid: z.record(z.unknown()).optional(),
  series: z.array(z.record(z.unknown())).optional(),
  tooltip: z.record(z.unknown()).optional(),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;
