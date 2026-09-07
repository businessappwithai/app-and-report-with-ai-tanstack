import { z } from "zod";
import { uuidSchema } from "./common";

export const createDataSourceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  clientType: z.enum(["postgres", "mysql", "sqlite3"], {
    errorMap: () => ({ message: "Invalid client type" }),
  }),
  connectionConfig: z.record(z.unknown()).refine(
    (config) => {
      if (!config || typeof config !== "object") return false;
      if (config.clientType === "postgres" || config.clientType === "postgresql") {
        return "host" in config && "database" in config;
      }
      if (config.clientType === "mysql") {
        return "host" in config && "database" in config;
      }
      if (config.clientType === "sqlite3") {
        return "filename" in config;
      }
      return false;
    },
    { message: "Invalid connection config for client type" }
  ),
});

export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;

export const updateDataSourceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  connectionConfig: z.record(z.unknown()).optional(),
});

export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;

export const dataSourceConnectionConfigSchema = z
  .object({
    clientType: z.enum(["postgres", "mysql", "sqlite3"]),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    database: z.string(),
    user: z.string().optional(),
    password: z.string().optional(),
    filename: z.string().optional(),
    ssl: z.boolean().optional(),
  })
  .strict();

export type DataSourceConnectionConfig = z.infer<typeof dataSourceConnectionConfigSchema>;
