import { z } from "zod";
import { uuidSchema } from "./common";

export const permissionSchema = z.enum([
  "view_dashboard",
  "edit_dashboard",
  "delete_dashboard",
  "view_reports",
  "create_report",
  "edit_report",
  "delete_report",
  "execute_sql",
  "manage_data_sources",
  "manage_users",
  "manage_roles",
  "manage_permissions",
  "view_jobs",
  "manage_jobs",
  "export_data",
  "share_report",
  "create_chart",
  "edit_chart",
  "delete_chart",
]);

export type Permission = z.infer<typeof permissionSchema>;

export const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  permissions: z.array(permissionSchema).default([]),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Name is required").max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  permissions: z.array(permissionSchema).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const getRoleSchema = z.object({
  id: uuidSchema,
});

export type GetRoleInput = z.infer<typeof getRoleSchema>;
