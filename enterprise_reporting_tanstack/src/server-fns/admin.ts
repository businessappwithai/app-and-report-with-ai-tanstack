import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
  getUserSchema,
  changePasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ListUsersInput,
  type GetUserInput,
  type ChangePasswordInput,
} from "@/lib/schemas/users";
import {
  createRoleSchema,
  updateRoleSchema,
  getRoleSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
  type GetRoleInput,
} from "@/lib/schemas/roles";
import { requireAuth } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/config";
import { logAudit } from "@/lib/security/audit";
import { isAdmin } from "@/lib/permissions/permissions";
import { withErrorHandler } from "@/lib/server-fns/with-error-handler";

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export const listUsers = createServerFn({ method: "GET" }).handler(async (input) => {
  const session = await requireAuth();

  return withErrorHandler(
    async () => {
      const validated = await listUsersSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const page = validated.page ?? 0;
      const pageSize = Math.min(validated.pageSize ?? 20, 100);

      const db = getDb();
      const users = await db
        .selectFrom("users")
        .select([
          "id",
          "email",
          "display_name",
          "avatar_url",
          "is_active",
          "created_at",
          "updated_at",
        ])
        .orderBy("created_at", "desc")
        .offset(page * pageSize)
        .limit(pageSize)
        .execute();

      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const roles = await db
            .selectFrom("user_roles as ur")
            .innerJoin("roles as r", "r.id", "ur.role_id")
            .select(["r.id", "r.name"])
            .where("ur.user_id", "=", user.id)
            .execute();
          return { ...user, roles };
        })
      );

      const countResult = await db
        .selectFrom("users")
        .select(db.fn.count<number>("id").as("count"))
        .executeTakeFirst();
      const total = Number(countResult?.count ?? 0);

      return {
        items: usersWithRoles,
        meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      };
    },
    {
      user: session.user,
      action: "listUsers",
      resourceType: "user",
      details: { operation: "list" },
    }
  );
});

export const getUser = createServerFn({ method: "GET" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await getUserSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const user = await db
        .selectFrom("users")
        .select([
          "id",
          "email",
          "display_name",
          "avatar_url",
          "is_active",
          "created_at",
          "updated_at",
        ])
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!user) {
        throw new Error("NOT_FOUND");
      }

      return user;
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "getUser", userId: validated.id },
    }
  );
});

export const createUser = createServerFn({ method: "POST" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await createUserSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();

      // Check for existing user
      const existing = await db
        .selectFrom("users")
        .select("id")
        .where("email", "=", validated.email)
        .executeTakeFirst();

      if (existing) {
        throw new Error("CONFLICT: User with this email already exists");
      }

      const userId = randomUUID();
      const passwordHash = await bcrypt.hash(validated.password, 10);
      const now = new Date().toISOString();

      await db
        .insertInto("users")
        .values({
          id: userId,
          email: validated.email,
          password_hash: passwordHash,
          display_name: validated.displayName,
          avatar_url: null,
          is_active: validated.isActive ?? true,
          created_at: now,
          updated_at: now,
        })
        .execute();

      // Assign roles if provided
      if (validated.roleIds && validated.roleIds.length > 0) {
        await db
          .insertInto("user_roles")
          .values(
            validated.roleIds.map((roleId) => ({
              user_id: userId,
              role_id: roleId,
            }))
          )
          .execute();
      }

      await logAudit({
        userId: session.user.id,
        action: "create",
        resourceType: "user",
        resourceId: userId,
        details: { email: validated.email, displayName: validated.displayName },
      });

      return { id: userId };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "createUser", email: validated.email },
    }
  );
});

export const updateUser = createServerFn({ method: "PUT" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await updateUserSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const existing = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (validated.email !== undefined) updates.email = validated.email;
      if (validated.displayName !== undefined) updates.display_name = validated.displayName;
      if (validated.isActive !== undefined) updates.is_active = validated.isActive;

      await db.updateTable("users").set(updates).where("id", "=", validated.id).execute();

      // Update roles if provided
      if (validated.roleIds !== undefined) {
        await db.deleteFrom("user_roles").where("user_id", "=", validated.id).execute();
        if (validated.roleIds.length > 0) {
          await db
            .insertInto("user_roles")
            .values(
              validated.roleIds.map((roleId) => ({
                user_id: validated.id,
                role_id: roleId,
              }))
            )
            .execute();
        }
      }

      await logAudit({
        userId: session.user.id,
        action: "update",
        resourceType: "user",
        resourceId: validated.id,
        details: { email: validated.email },
      });

      return { success: true };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "updateUser", userId: input.id },
    }
  );
});

export const deleteUser = createServerFn({ method: "DELETE" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await getUserSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      // Prevent deletion of self
      if (validated.id === session.user.id) {
        throw new Error("FORBIDDEN: Cannot delete your own account");
      }

      const db = getDb();
      const existing = await db
        .selectFrom("users")
        .selectAll()
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      await db.deleteFrom("user_roles").where("user_id", "=", validated.id).execute();
      await db.deleteFrom("users").where("id", "=", validated.id).execute();

      await logAudit({
        userId: session.user.id,
        action: "delete",
        resourceType: "user",
        resourceId: validated.id,
      });

      return { success: true };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "deleteUser", userId: input.id },
    }
  );
});

export const changePassword = createServerFn({ method: "POST" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await changePasswordSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin && validated.id !== session.user.id) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const user = await db
        .selectFrom("users")
        .select(["id", "password_hash"])
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!user) {
        throw new Error("NOT_FOUND");
      }

      // Verify current password
      const isValid = await bcrypt.compare(validated.currentPassword, user.password_hash);
      if (!isValid) {
        throw new Error("UNAUTHORIZED: Current password is incorrect");
      }

      const newPasswordHash = await bcrypt.hash(validated.newPassword, 10);
      await db
        .updateTable("users")
        .set({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
        .where("id", "=", validated.id)
        .execute();

      await logAudit({
        userId: session.user.id,
        action: "update",
        resourceType: "user",
        resourceId: validated.id,
        details: { operation: "changePassword" },
      });

      return { success: true };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "changePassword", userId: input.id },
    }
  );
});

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

export const listRoles = createServerFn({ method: "GET" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const roles = await db.selectFrom("roles").selectAll().orderBy("name", "asc").execute();

      return roles.map((r) => ({
        ...r,
        permissions: typeof r.permissions === "string" ? JSON.parse(r.permissions) : r.permissions,
      }));
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "listRoles" },
    }
  );
});

export const getRole = createServerFn({ method: "GET" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await getRoleSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const role = await db
        .selectFrom("roles")
        .selectAll()
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!role) {
        throw new Error("NOT_FOUND");
      }

      return {
        ...role,
        permissions:
          typeof role.permissions === "string" ? JSON.parse(role.permissions) : role.permissions,
      };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "getRole", roleId: validated.id },
    }
  );
});

export const createRole = createServerFn({ method: "POST" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await createRoleSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const roleId = randomUUID();
      const now = new Date().toISOString();

      await db
        .insertInto("roles")
        .values({
          id: roleId,
          name: validated.name,
          description: validated.description ?? null,
          permissions: JSON.stringify(validated.permissions || []),
          created_at: now,
        })
        .execute();

      await logAudit({
        userId: session.user.id,
        action: "create",
        resourceType: "role",
        resourceId: roleId,
        details: { name: validated.name },
      });

      return { id: roleId };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "createRole", name: input.name },
    }
  );
});

export const updateRole = createServerFn({ method: "PUT" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await updateRoleSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const existing = await db
        .selectFrom("roles")
        .selectAll()
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const updates: Record<string, unknown> = {};
      if (validated.name !== undefined) updates.name = validated.name;
      if (validated.description !== undefined) updates.description = validated.description;
      if (validated.permissions !== undefined)
        updates.permissions = JSON.stringify(validated.permissions);

      await db.updateTable("roles").set(updates).where("id", "=", validated.id).execute();

      await logAudit({
        userId: session.user.id,
        action: "update",
        resourceType: "role",
        resourceId: validated.id,
        details: { name: validated.name },
      });

      return { success: true };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "updateRole", roleId: input.id },
    }
  );
});

export const deleteRole = createServerFn({ method: "DELETE" }).handler(async (input) => {
  return withErrorHandler(
    async () => {
      const validated = await getRoleSchema.parseAsync(input).catch((err) => {
        throw new Error(`Validation failed: ${err.message}`);
      });

      const session = await requireAuth();
      const admin = await isAdmin(session.user.id);
      if (!admin) {
        throw new Error("FORBIDDEN");
      }

      const db = getDb();
      const existing = await db
        .selectFrom("roles")
        .selectAll()
        .where("id", "=", validated.id)
        .executeTakeFirst();

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      // Check if role is in use
      const usageCount = await db
        .selectFrom("user_roles")
        .select(db.fn.count<number>("role_id").as("count"))
        .where("role_id", "=", validated.id)
        .executeTakeFirst();

      if ((usageCount?.count ?? 0) > 0) {
        throw new Error("IN_USE: Cannot delete role that is assigned to users");
      }

      await db.deleteFrom("roles").where("id", "=", validated.id).execute();

      await logAudit({
        userId: session.user.id,
        action: "delete",
        resourceType: "role",
        resourceId: validated.id,
      });

      return { success: true };
    },
    {
      userId: (await requireAuth()).user.id,
      action: "execute",
      details: { operation: "deleteRole", roleId: input.id },
    }
  );
});
