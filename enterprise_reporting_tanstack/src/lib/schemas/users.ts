import { z } from "zod";
import { uuidSchema, emailSchema, passwordSchema, paginationSchema } from "./common";

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().min(1, "Display name is required").max(255, "Display name too long"),
  isActive: z.boolean().default(true),
  roleIds: z.array(uuidSchema).optional().default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: uuidSchema,
  email: emailSchema.optional(),
  displayName: z.string().min(1, "Display name is required").max(255, "Display name too long").optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(uuidSchema).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const listUsersSchema = paginationSchema;

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const getUserSchema = z.object({
  id: uuidSchema,
});

export type GetUserInput = z.infer<typeof getUserSchema>;

export const changePasswordSchema = z.object({
  id: uuidSchema,
  currentPassword: passwordSchema,
  newPassword: passwordSchema.refine((val) => val.length >= 8, "Password too short"),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  {
    message: "New password must be different from current password",
    path: ["newPassword"],
  }
);

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
