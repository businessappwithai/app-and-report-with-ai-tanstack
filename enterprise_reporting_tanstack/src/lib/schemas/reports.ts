import { z } from "zod";
import { uuidSchema, paginationSchema } from "./common";

export const listReportsSchema = paginationSchema;

export type ListReportsInput = z.infer<typeof listReportsSchema>;

export const createReportSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  savedQueryId: uuidSchema.optional(),
  columnConfig: z.array(z.unknown()).optional(),
  filterConfig: z.unknown().optional(),
  sortConfig: z.unknown().optional(),
  paginationConfig: z.unknown().optional(),
  exportFormats: z.array(z.enum(["csv", "xlsx", "pdf"])).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const updateReportSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  columnConfig: z.array(z.unknown()).optional(),
  filterConfig: z.unknown().optional(),
  sortConfig: z.unknown().optional(),
});

export type UpdateReportInput = z.infer<typeof updateReportSchema>;

export const getReportSchema = z.object({
  id: uuidSchema,
});

export type GetReportInput = z.infer<typeof getReportSchema>;
