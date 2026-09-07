import { getDb } from "@/lib/db/config";
import type {
  AccessCheckDetail,
  DsEntityPermission,
  DsEntityPermissionLevel,
  DsRole,
  DsUserRoleJoinRow,
  ParsedSqlEntity,
} from "@/types/database";

/**
 * Get all data source roles for a specific data source
 */
export async function getDsRoles(dataSourceId: string): Promise<DsRole[]> {
  const db = getDb();
  const roles = await db
    .selectFrom("ds_roles")
    .selectAll()
    .where("data_source_id", "=", dataSourceId)
    .where("is_active", "=", true)
    .orderBy("name")
    .execute();
  return roles as unknown as DsRole[];
}

/**
 * Get a specific data source role by ID
 */
export async function getDsRole(roleId: string): Promise<DsRole | undefined> {
  const db = getDb();
  const role = await db
    .selectFrom("ds_roles")
    .selectAll()
    .where("id", "=", roleId)
    .executeTakeFirst();
  return role as unknown as DsRole | undefined;
}

/**
 * Create a new data source role
 */
export async function createDsRole(
  dataSourceId: string,
  name: string,
  description: string | undefined,
  createdBy: string
): Promise<DsRole> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insertInto("ds_roles")
    .values({
      id,
      data_source_id: dataSourceId,
      name,
      description: description || null,
      is_active: true,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const role = await db
    .selectFrom("ds_roles")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  return role as unknown as DsRole;
}

/**
 * Update a data source role
 */
export async function updateDsRole(
  roleId: string,
  updates: { name?: string; description?: string; is_active?: boolean }
): Promise<DsRole | undefined> {
  const db = getDb();
  await db
    .updateTable("ds_roles")
    .set({ ...updates, updated_at: new Date().toISOString() })
    .where("id", "=", roleId)
    .execute();

  const role = await db
    .selectFrom("ds_roles")
    .selectAll()
    .where("id", "=", roleId)
    .executeTakeFirst();
  return role as unknown as DsRole | undefined;
}

/**
 * Delete a data source role
 */
export async function deleteDsRole(roleId: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom("ds_roles").where("id", "=", roleId).execute();
}

/**
 * Get all user-role assignments for a data source
 */
export async function getDsUserRoles(dataSourceId: string): Promise<DsUserRoleJoinRow[]> {
  const db = getDb();
  const rows = await db
    .selectFrom("ds_user_roles")
    .innerJoin("users", "ds_user_roles.user_id", "users.id")
    .innerJoin("ds_roles", "ds_user_roles.ds_role_id", "ds_roles.id")
    .where("ds_user_roles.data_source_id", "=", dataSourceId)
    .select([
      "ds_user_roles.data_source_id",
      "ds_user_roles.user_id",
      "ds_user_roles.ds_role_id",
      "ds_user_roles.assigned_at",
      "users.email as user_email",
      "users.display_name as user_display_name",
      "ds_roles.name as role_name",
    ])
    .execute();
  return rows as unknown as DsUserRoleJoinRow[];
}

/**
 * Assign a user to a data source role
 */
export async function assignDsUserRole(
  dataSourceId: string,
  userId: string,
  dsRoleId: string
): Promise<void> {
  const db = getDb();
  await db
    .insertInto("ds_user_roles")
    .values({
      data_source_id: dataSourceId,
      user_id: userId,
      ds_role_id: dsRoleId,
      assigned_at: new Date().toISOString(),
    })
    .onConflict((oc) => oc.columns(["data_source_id", "user_id", "ds_role_id"]).doNothing())
    .execute();
}

/**
 * Remove a user from a data source role
 */
export async function removeDsUserRole(
  dataSourceId: string,
  userId: string,
  dsRoleId: string
): Promise<void> {
  const db = getDb();
  await db
    .deleteFrom("ds_user_roles")
    .where("data_source_id", "=", dataSourceId)
    .where("user_id", "=", userId)
    .where("ds_role_id", "=", dsRoleId)
    .execute();
}

/**
 * Get entity permissions for a data source role
 */
export async function getDsEntityPermissions(
  dataSourceId: string,
  dsRoleId?: string
): Promise<DsEntityPermission[]> {
  const db = getDb();
  let query = db
    .selectFrom("ds_entity_permissions")
    .selectAll()
    .where("data_source_id", "=", dataSourceId);

  if (dsRoleId) {
    query = query.where("ds_role_id", "=", dsRoleId);
  }

  const perms = await query.orderBy("entity_name").execute();
  return perms as unknown as DsEntityPermission[];
}

/**
 * Create or update an entity permission
 */
export async function upsertDsEntityPermission(
  dataSourceId: string,
  dsRoleId: string,
  entityName: string,
  entityType: "table" | "view",
  permissionLevel: DsEntityPermissionLevel,
  entitySchema?: string,
  columnRestrictions?: string[],
  rowFilter?: string,
  createdBy?: string
): Promise<DsEntityPermission> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .insertInto("ds_entity_permissions")
    .values({
      id,
      data_source_id: dataSourceId,
      ds_role_id: dsRoleId,
      entity_name: entityName,
      entity_type: entityType,
      entity_schema: entitySchema ? entitySchema : null,
      permission_level: permissionLevel,
      column_restrictions: columnRestrictions ? JSON.stringify(columnRestrictions) : null,
      row_filter: rowFilter ? rowFilter : null,
      created_by: createdBy ? createdBy : null,
      created_at: now,
      updated_at: now,
    } as any)
    .onConflict((oc) =>
      oc.columns(["data_source_id", "ds_role_id", "entity_name", "entity_schema"]).doUpdateSet({
        permission_level: permissionLevel,
        column_restrictions: columnRestrictions ? JSON.stringify(columnRestrictions) : null,
        row_filter: rowFilter || null,
        updated_at: now,
      })
    )
    .execute();

  let query = db
    .selectFrom("ds_entity_permissions")
    .selectAll()
    .where("data_source_id", "=", dataSourceId)
    .where("ds_role_id", "=", dsRoleId)
    .where("entity_name", "=", entityName);

  if (entitySchema) {
    query = query.where("entity_schema", "=", entitySchema);
  } else {
    query = query.where("entity_schema", "is", null as unknown as any);
  }

  const perm = await query.executeTakeFirstOrThrow();
  return perm as unknown as DsEntityPermission;
}

/**
 * Delete an entity permission
 */
export async function deleteDsEntityPermission(permissionId: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom("ds_entity_permissions").where("id", "=", permissionId).execute();
}

/**
 * Check if a user has access to specific entities in a data source.
 * Returns detailed access check results for each entity.
 */
export async function checkEntityAccess(
  userId: string,
  dataSourceId: string,
  entities: ParsedSqlEntity[]
): Promise<AccessCheckDetail[]> {
  const db = getDb();

  // First check if user is a system admin
  const userRoles = await db
    .selectFrom("user_roles")
    .innerJoin("roles", "user_roles.role_id", "roles.id")
    .where("user_roles.user_id", "=", userId)
    .select(["roles.permissions"])
    .execute();

  const isSystemAdmin = userRoles.some((r) => {
    const perms: string[] = JSON.parse(r.permissions);
    return perms.includes("admin:*");
  });

  if (isSystemAdmin) {
    return entities.map((entity) => ({
      entity: entity.name,
      entitySchema: entity.schema,
      hasAccess: true,
      grantedBy: "System Admin",
      permissionLevel: "all" as DsEntityPermissionLevel,
    }));
  }

  // Get user's DS roles for this data source
  const dsUserRoles = await db
    .selectFrom("ds_user_roles")
    .innerJoin("ds_roles", "ds_user_roles.ds_role_id", "ds_roles.id")
    .where("ds_user_roles.data_source_id", "=", dataSourceId)
    .where("ds_user_roles.user_id", "=", userId)
    .where("ds_roles.is_active", "=", true)
    .select(["ds_roles.id as role_id", "ds_roles.name as role_name"])
    .execute();

  if (dsUserRoles.length === 0) {
    return entities.map((entity) => ({
      entity: entity.name,
      entitySchema: entity.schema,
      hasAccess: false,
    }));
  }

  const roleIds = dsUserRoles.map((r) => r.role_id);

  // Get all entity permissions for user's DS roles
  const permissions = (await db
    .selectFrom("ds_entity_permissions")
    .selectAll()
    .where("data_source_id", "=", dataSourceId)
    .where((eb) => eb("ds_role_id", "in", roleIds))
    .execute()) as unknown as DsEntityPermission[];

  // Check each entity
  return entities.map((entity) => {
    if (entity.type === "subquery") {
      return {
        entity: entity.name,
        entitySchema: entity.schema,
        hasAccess: true,
        grantedBy: "Subquery (no direct table access)",
      };
    }

    const matchingPerms = permissions.filter((p) => {
      const nameMatch = p.entity_name.toLowerCase() === entity.name.toLowerCase();
      const schemaMatch = entity.schema
        ? p.entity_schema?.toLowerCase() === entity.schema.toLowerCase()
        : true;
      return nameMatch && schemaMatch;
    });

    if (matchingPerms.length === 0) {
      return {
        entity: entity.name,
        entitySchema: entity.schema,
        hasAccess: false,
      };
    }

    // Find the highest permission level
    const levelHierarchy: DsEntityPermissionLevel[] = [
      "select",
      "insert",
      "update",
      "delete",
      "all",
    ];
    let bestPerm = matchingPerms[0];
    let bestLevel = levelHierarchy.indexOf(bestPerm.permission_level);

    for (const perm of matchingPerms) {
      const level = levelHierarchy.indexOf(perm.permission_level);
      if (level > bestLevel) {
        bestLevel = level;
        bestPerm = perm;
      }
    }

    const grantingRole = dsUserRoles.find((r) => r.role_id === bestPerm.ds_role_id);
    const columnRestrictions: string[] | undefined = bestPerm.column_restrictions
      ? JSON.parse(bestPerm.column_restrictions)
      : undefined;

    return {
      entity: entity.name,
      entitySchema: entity.schema,
      hasAccess: true,
      grantedBy: grantingRole?.role_name,
      permissionLevel: bestPerm.permission_level as DsEntityPermissionLevel,
      columnRestrictions,
      rowFilter: bestPerm.row_filter || undefined,
    };
  });
}

/**
 * Get all entities a user has access to in a data source
 */
export async function getUserAccessibleEntities(
  userId: string,
  dataSourceId: string
): Promise<DsEntityPermission[]> {
  const db = getDb();

  // Check system admin
  const userRoles = await db
    .selectFrom("user_roles")
    .innerJoin("roles", "user_roles.role_id", "roles.id")
    .where("user_roles.user_id", "=", userId)
    .select(["roles.permissions"])
    .execute();

  const isSystemAdmin = userRoles.some((r) => {
    const perms: string[] = JSON.parse(r.permissions);
    return perms.includes("admin:*");
  });

  if (isSystemAdmin) {
    // Return empty array - admin has access to everything
    return [];
  }

  // Get user's DS roles
  const dsRoleIds = await db
    .selectFrom("ds_user_roles")
    .innerJoin("ds_roles", "ds_user_roles.ds_role_id", "ds_roles.id")
    .where("ds_user_roles.data_source_id", "=", dataSourceId)
    .where("ds_user_roles.user_id", "=", userId)
    .where("ds_roles.is_active", "=", true)
    .select(["ds_roles.id"])
    .execute()
    .then((rows) => rows.map((r) => r.id));

  if (dsRoleIds.length === 0) return [];

  const perms = await db
    .selectFrom("ds_entity_permissions")
    .selectAll()
    .where("data_source_id", "=", dataSourceId)
    .where((eb) => eb("ds_role_id", "in", dsRoleIds))
    .execute();
  return perms as unknown as DsEntityPermission[];
}
