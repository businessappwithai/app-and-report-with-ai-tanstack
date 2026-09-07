import { getDb } from "@/lib/db/config";
import { canAccessResource, getAccessibleResourceIds } from "@/lib/auth/rbac";
import type { SecurityContext } from "@/lib/auth/rbac";
import { getUserAccessibleEntities } from "@/lib/permissions/ds-rbac";
import type {
  RBACWorkflowSnapshot,
  AccessibleDataSource,
  RBACDriftResult,
} from "@/types/monitoring";

/**
 * Resolve the full RBAC context for a user into a snapshot that can be
 * persisted alongside a monitoring rule.  The snapshot records exactly which
 * data sources, tables, columns, and row-filters the user had access to at
 * the moment the rule was created so that subsequent runs can detect drift.
 */
export async function resolveRBACContext(
  userId: string,
  securityContext: SecurityContext
): Promise<RBACWorkflowSnapshot> {
  const db = getDb();

  // Resolve user roles from DB so the snapshot is authoritative
  const userRoleRows = await db
    .selectFrom("user_roles")
    .innerJoin("roles", "user_roles.role_id", "roles.id")
    .where("user_roles.user_id", "=", userId)
    .select(["roles.name"])
    .execute();

  const userRoles = userRoleRows.map((r) => (r as unknown as { name: string }).name);

  // Get all data source IDs the user can view
  // An empty array from getAccessibleResourceIds means "admin – all sources"
  const accessibleIds = await getAccessibleResourceIds(
    securityContext,
    "data_source" as any,
    "view"
  );

  // Fetch the data source records we need to build the snapshot
  let dataSourceQuery = db
    .selectFrom("data_sources")
    .where("is_active", "=", true)
    .select(["id", "name"]);

  if (accessibleIds.length > 0) {
    dataSourceQuery = dataSourceQuery.where("id", "in", accessibleIds);
  }

  const dataSources = await dataSourceQuery.execute();

  // For each data source, resolve entity-level permissions
  const accessibleDataSources: AccessibleDataSource[] = await Promise.all(
    dataSources.map(async (ds) => {
      const entityPerms = await getUserAccessibleEntities(userId, ds.id);

      const allowedTables: string[] = [];
      const allowedColumns: Record<string, string[]> = {};
      const rowFilters: Record<string, string> = {};

      for (const perm of entityPerms) {
        const tableName = perm.entity_name;
        if (!allowedTables.includes(tableName)) {
          allowedTables.push(tableName);
        }

        // Column restrictions: if present they are the allowed set; if absent
        // the role grants access to all columns (represented as empty array).
        if (perm.column_restrictions) {
          try {
            const restricted: string[] = JSON.parse(perm.column_restrictions);
            if (!allowedColumns[tableName]) {
              allowedColumns[tableName] = restricted;
            } else {
              // Merge: union of allowed columns across multiple role grants
              for (const col of restricted) {
                if (!allowedColumns[tableName].includes(col)) {
                  allowedColumns[tableName].push(col);
                }
              }
            }
          } catch {
            // Malformed JSON — treat as no restrictions
            allowedColumns[tableName] = [];
          }
        } else {
          // No column restrictions → full column access
          allowedColumns[tableName] = [];
        }

        if (perm.row_filter) {
          // Last writer wins; caller should be aware of multi-role merging limitations
          rowFilters[tableName] = perm.row_filter;
        }
      }

      return {
        id: ds.id,
        name: (ds as unknown as { name: string }).name,
        allowedTables,
        allowedColumns,
        rowFilters,
      };
    })
  );

  return {
    userId,
    userRoles,
    accessibleDataSources,
    resolvedAt: new Date().toISOString(),
    snapshotVersion: 1,
  };
}

/**
 * Detect whether current RBAC state has drifted from the persisted snapshot.
 * Returns a RBACDriftResult describing whether the rule can still safely run.
 */
export async function detectRBACDrift(
  snapshot: RBACWorkflowSnapshot,
  userId: string,
  securityContext: SecurityContext
): Promise<RBACDriftResult> {
  let current: RBACWorkflowSnapshot;

  try {
    current = await resolveRBACContext(userId, securityContext);
  } catch (err) {
    return {
      driftType: "PERMISSION_REVOKED",
      canProceed: false,
      details: `Failed to resolve current RBAC context: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const snapshotDsIds = new Set(snapshot.accessibleDataSources.map((ds) => ds.id));
  const currentDsIds = new Set(current.accessibleDataSources.map((ds) => ds.id));

  // Check for data sources that existed in snapshot but are now gone entirely
  for (const snapshotDs of snapshot.accessibleDataSources) {
    if (!currentDsIds.has(snapshotDs.id)) {
      // Determine if the data source was deleted vs permissions revoked
      let dsExists = false;
      try {
        const db = getDb();
        const row = await db
          .selectFrom("data_sources")
          .where("id", "=", snapshotDs.id)
          .select(["id"])
          .executeTakeFirst();
        dsExists = row !== undefined;
      } catch {
        // Ignore lookup error; assume deleted
      }

      if (!dsExists) {
        return {
          driftType: "DATA_SOURCE_DELETED",
          canProceed: false,
          details: `Data source '${snapshotDs.name}' (${snapshotDs.id}) has been deleted.`,
        };
      }

      return {
        driftType: "PERMISSION_REVOKED",
        canProceed: false,
        details: `Access to data source '${snapshotDs.name}' (${snapshotDs.id}) has been revoked.`,
      };
    }

    // Data source still accessible — check table-level permissions
    const currentDs = current.accessibleDataSources.find((ds) => ds.id === snapshotDs.id);
    if (!currentDs) continue;

    const currentTableSet = new Set(currentDs.allowedTables);
    const snapshotTableSet = new Set(snapshotDs.allowedTables);

    // Tables that snapshot had but current does not
    const revokedTables = snapshotDs.allowedTables.filter((t) => !currentTableSet.has(t));
    if (revokedTables.length > 0) {
      return {
        driftType: "PERMISSION_REDUCED",
        canProceed: false,
        details: `Access to tables [${revokedTables.join(", ")}] in data source '${snapshotDs.name}' has been revoked.`,
      };
    }

    // Check column-level reductions for each table
    for (const table of snapshotDs.allowedTables) {
      const snapshotCols = snapshotDs.allowedColumns[table] ?? [];
      const currentCols = currentDs.allowedColumns[table] ?? [];

      // If snapshot had full column access (empty array) and now has restrictions
      if (snapshotCols.length === 0 && currentCols.length > 0) {
        return {
          driftType: "PERMISSION_REDUCED",
          canProceed: false,
          details: `Column access for table '${table}' in data source '${snapshotDs.name}' has been restricted.`,
        };
      }

      // If snapshot had specific columns allowed, check none were removed
      if (snapshotCols.length > 0) {
        const currentColSet = new Set(currentCols);
        const removedCols = snapshotCols.filter((c) => !currentColSet.has(c));
        if (removedCols.length > 0) {
          return {
            driftType: "PERMISSION_REDUCED",
            canProceed: false,
            details: `Access to columns [${removedCols.join(", ")}] in table '${table}' of data source '${snapshotDs.name}' has been revoked.`,
          };
        }
      }
    }
  }

  // Check for newly gained data sources (expansion — informational, not blocking)
  const newlyAccessible = current.accessibleDataSources.filter((ds) => !snapshotDsIds.has(ds.id));
  if (newlyAccessible.length > 0) {
    return {
      driftType: "PERMISSION_EXPANDED",
      canProceed: true,
      details: `User has gained access to additional data sources: [${newlyAccessible.map((ds) => ds.name).join(", ")}]. Rule can proceed with original snapshot scope.`,
    };
  }

  return {
    driftType: "NO_DRIFT",
    canProceed: true,
    details: "RBAC context matches snapshot. No drift detected.",
  };
}
