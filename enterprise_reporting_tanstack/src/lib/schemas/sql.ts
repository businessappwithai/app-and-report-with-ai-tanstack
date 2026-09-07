import { z } from "zod";
import { uuidSchema, limitOffsetSchema } from "./common";

export const executeSqlSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(50000, "SQL query too large"),
  dataSourceId: uuidSchema,
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().default(0),
  timeout: z.number().int().positive().max(300000, "Timeout cannot exceed 5 minutes").default(30000),
});

export type ExecuteSqlInput = z.infer<typeof executeSqlSchema>;

export const validateSqlSchema = z.object({
  sql: z.string().min(1, "SQL query is required").max(50000, "SQL query too large"),
  dataSourceId: uuidSchema.optional(),
});

export type ValidateSqlInput = z.infer<typeof validateSqlSchema>;

export const introspectSchemaSchema = z.object({
  dataSourceId: uuidSchema,
});

export type IntrospectSchemaInput = z.infer<typeof introspectSchemaSchema>;

export const columnSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const queryResultSchema = z.object({
  columns: z.array(columnSchema),
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative().optional(),
  executionTime: z.number().int().nonnegative(),
  truncated: z.boolean(),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    serverSide: z.boolean(),
  }),
});

export type QueryResult = z.infer<typeof queryResultSchema>;
