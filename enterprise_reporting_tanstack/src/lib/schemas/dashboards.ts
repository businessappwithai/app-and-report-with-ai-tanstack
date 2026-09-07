import { z } from "zod";
import { uuidSchema } from "./common";

export const widgetSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["chart", "metric", "table", "text"]),
  title: z.string().max(255),
  config: z.record(z.unknown()),
  position: z
    .object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      w: z.number().int().positive(),
      h: z.number().int().positive(),
    })
    .optional(),
  dataSourceId: uuidSchema.optional(),
  sqlQuery: z.string().optional(),
});

export type Widget = z.infer<typeof widgetSchema>;

export const createDashboardSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  widgets: z.array(widgetSchema).optional().default([]),
  layout: z.enum(["grid", "flex"]).optional().default("grid"),
  refreshInterval: z.number().int().positive().optional(),
  isPublic: z.boolean().default(false),
});

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;

export const updateDashboardSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  widgets: z.array(widgetSchema).optional(),
  layout: z.enum(["grid", "flex"]).optional(),
  refreshInterval: z.number().int().positive().optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;

export const getDashboardSchema = z.object({
  id: uuidSchema,
});

export type GetDashboardInput = z.infer<typeof getDashboardSchema>;

export const addWidgetSchema = z.object({
  dashboardId: uuidSchema,
  widget: widgetSchema,
});

export type AddWidgetInput = z.infer<typeof addWidgetSchema>;

export const updateWidgetSchema = z.object({
  dashboardId: uuidSchema,
  widgetId: z.string(),
  widget: widgetSchema,
});

export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

export const removeWidgetSchema = z.object({
  dashboardId: uuidSchema,
  widgetId: z.string(),
});

export type RemoveWidgetInput = z.infer<typeof removeWidgetSchema>;
