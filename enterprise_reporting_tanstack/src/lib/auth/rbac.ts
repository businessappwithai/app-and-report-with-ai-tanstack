import { getDb } from "@/lib/db/config";
import type { PermissionLevel, ResourcePermission, ResourceType } from "@/types/database";
import { auth } from "./config";

export interface SecurityContext {
  userId: string;
  roles: string[];
  permissions: string[];
}

export async function getSecurityContext(): Promise<SecurityContext | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    userId: session.user.id,
    roles: session.user.roles,
    permissions: session.user.permissions,
  };
}

function isAdminRole(context: SecurityContext): boolean {
  return context.roles.some((r) => r.toLowerCase() === "admin");
}

export function hasPermission(context: SecurityContext, permission: string): boolean {
  // Admin role — full access regardless of JWT permissions
  if (isAdminRole(context)) return true;

  // Super wildcard
  if (context.permissions.includes("*:*")) return true;

  // Admin permission wildcard
  if (context.permissions.includes("admin:*")) return true;

  // Exact match
  if (context.permissions.includes(permission)) return true;

  // Resource wildcard (e.g. "report:*" matches "report:view")
  const [resource] = permission.split(":");
  if (context.permissions.includes(`${resource}:*`)) return true;

  return false;
}

export function hasAnyPermission(context: SecurityContext, permissions: string[]): boolean {
  return permissions.some((permission) => hasPermission(context, permission));
}

export function hasAllPermissions(context: SecurityContext, permissions: string[]): boolean {
  return permissions.every((permission) => hasPermission(context, permission));
}

export function hasRole(context: SecurityContext, role: string): boolean {
  return context.roles.includes(role);
}

export function hasAnyRole(context: SecurityContext, roles: string[]): boolean {
  return roles.some((role) => hasRole(context, role));
}

export async function canAccessResource(
  context: SecurityContext,
  resourceType: ResourceType,
  resourceId: string,
  requiredLevel: PermissionLevel
): Promise<boolean> {
  // Admin role — unconditional full access
  if (isAdminRole(context)) return true;

  // Check general permission for the resource type
  const generalPermission = `${resourceType}:${requiredLevel}`;
  if (hasPermission(context, generalPermission)) return true;

  // Check specific resource permissions
  const db = getDb();

  const roleIds = await db
    .selectFrom("roles")
    .where("name", "in", context.roles)
    .select("id")
    .execute()
    .then((rows) => rows.map((r) => r.id));

  if (roleIds.length === 0) return false;

  const permission = (await db
    .selectFrom("resource_permissions")
    .where("resource_type", "=", resourceType)
    .where("resource_id", "=", resourceId)
    .where("role_id", "in", roleIds)
    .selectAll()
    .executeTakeFirst()) as ResourcePermission | undefined;

  if (!permission) return false;

  // Check permission hierarchy
  const levelHierarchy: PermissionLevel[] = ["view", "edit", "execute", "admin"];
  const requiredIndex = levelHierarchy.indexOf(requiredLevel);
  const grantedIndex = levelHierarchy.indexOf(permission.permission_level);

  return grantedIndex >= requiredIndex;
}

export async function getAccessibleResourceIds(
  context: SecurityContext,
  resourceType: ResourceType,
  minimumLevel: PermissionLevel = "view"
): Promise<string[]> {
  // Admin can access all resources — empty array signals "no filtering needed"
  if (isAdminRole(context)) return [];

  const db = getDb();

  const roleIds = await db
    .selectFrom("roles")
    .where("name", "in", context.roles)
    .select("id")
    .execute()
    .then((rows) => rows.map((r) => r.id));

  if (roleIds.length === 0) return [];

  const levelHierarchy: PermissionLevel[] = ["view", "edit", "execute", "admin"];
  const minimumIndex = levelHierarchy.indexOf(minimumLevel);
  const validLevels = levelHierarchy.slice(minimumIndex);

  const permissions = (await db
    .selectFrom("resource_permissions")
    .where("resource_type", "=", resourceType)
    .where("role_id", "in", roleIds)
    .where("permission_level", "in", validLevels)
    .select("resource_id")
    .execute()) as Pick<ResourcePermission, "resource_id">[];

  return Array.from(new Set(permissions.map((p) => p.resource_id)));
}

export async function grantResourcePermission(
  resourceType: ResourceType,
  resourceId: string,
  roleId: string,
  permissionLevel: PermissionLevel
): Promise<void> {
  const db = getDb();

  await db
    .insertInto("resource_permissions")
    .values({
      id: crypto.randomUUID() as string,
      resource_type: resourceType,
      resource_id: resourceId,
      role_id: roleId,
      permission_level: permissionLevel,
      created_at: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc
        .columns(["resource_type", "resource_id", "role_id"])
        .doUpdateSet({ permission_level: permissionLevel })
    );
}

export async function revokeResourcePermission(
  resourceType: ResourceType,
  resourceId: string,
  roleId: string
): Promise<void> {
  const db = getDb();

  await db
    .deleteFrom("resource_permissions")
    .where("resource_type", "=", resourceType)
    .where("resource_id", "=", resourceId)
    .where("role_id", "=", roleId);
}

export function requirePermission(permission: string) {
  return async () => {
    const context = await getSecurityContext();
    if (!context) {
      throw new Error("Unauthorized: Not authenticated");
    }
    if (!hasPermission(context, permission)) {
      throw new Error(`Forbidden: Missing permission ${permission}`);
    }
    return context;
  };
}

export function requireAnyPermission(permissions: string[]) {
  return async () => {
    const context = await getSecurityContext();
    if (!context) {
      throw new Error("Unauthorized: Not authenticated");
    }
    if (!hasAnyPermission(context, permissions)) {
      throw new Error(`Forbidden: Missing one of permissions ${permissions.join(", ")}`);
    }
    return context;
  };
}
