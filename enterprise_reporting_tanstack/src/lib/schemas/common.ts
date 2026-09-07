import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid UUID format");
export const emailSchema = z.string().email("Invalid email format").toLowerCase();
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
export const pageSchema = z.number().int().min(0, "Page must be non-negative").default(0);
export const pageSizeSchema = z
  .number()
  .int()
  .min(1, "Page size must be at least 1")
  .max(1000, "Page size cannot exceed 1000")
  .default(20);

export const paginationSchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const limitOffsetSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().default(0),
});
