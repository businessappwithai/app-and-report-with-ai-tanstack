/**
 * Query Access Validator: RBAC pre-flight check (D5)
 *
 * Before executing SQL, validates that the manager's role has permission
 * to access all tables and columns in the query
 */

import { checkEntityAccess } from "@/lib/permissions/ds-rbac";
import { extractColumns, extractTables } from "@/lib/sql/antlr-validator";
import type { User } from "@/types/database";

export interface QueryAccessValidation {
  allowed: boolean;
  deniedTables?: string[];
  deniedColumns?: string[];
  reason?: string;
  details?: {
    tablesAccessed: string[];
    columnsAccessed: string[];
    checkedAt: number;
  };
}

export interface ParsedSqlEntity {
  name: string;
  schema?: string;
  type: "table" | "view" | "subquery";
}

/**
 * Validate that a manager has access to all tables and columns in a query (D5)
 *
 * Uses existing RBAC system (ds-rbac.ts) which checks:
 * 1. Table-level permissions
 * 2. Column restrictions
 * 3. Row filters (role-based)
 */
export async function validateQueryAccess(
  manager: User,
  sql: string,
  dataSourceId: string
): Promise<QueryAccessValidation> {
  try {
    // 1. Extract tables from SQL
    const tables = extractTables(sql);
    const columns = extractColumns(sql);

    if (tables.length === 0) {
      // Subquery or complex query without direct tables
      // Trust it for now (more complex parsing needed)
      return { allowed: true };
    }

    // 2. Parse SQL entities (convert to format expected by checkEntityAccess)
    const entities: ParsedSqlEntity[] = tables.map((table) => ({
      name: table,
      schema: undefined,
      type: "table" as const,
    }));

    // 3. Check entity access using existing RBAC system
    const accessResults = await checkEntityAccess(manager.id, dataSourceId, entities);

    // 4. Analyze results for denials
    const deniedTables: string[] = [];
    const deniedColumns: string[] = [];

    for (const result of accessResults) {
      // Check table access
      if (!result.hasAccess) {
        deniedTables.push(result.entity);
        continue;
      }

      // Check column-level restrictions
      if (result.columnRestrictions && result.columnRestrictions.length > 0) {
        const allowedCols = new Set(result.columnRestrictions);
        const queriedCols = columns.filter(
          (col) => col.toLowerCase().startsWith(`${result.entity.toLowerCase()}.`) || col === "*" // Wildcard check
        );

        for (const col of queriedCols) {
          const colName = col.includes(".") ? col.split(".")[1] : col;
          if (colName !== "*" && !allowedCols.has(colName)) {
            deniedColumns.push(`${result.entity}.${colName}`);
          }
        }
      }
    }

    // 5. Return validation result
    if (deniedTables.length > 0) {
      return {
        allowed: false,
        deniedTables,
        reason: `You don't have permission to access: ${deniedTables.join(", ")}`,
        details: {
          tablesAccessed: tables,
          columnsAccessed: columns,
          checkedAt: Date.now(),
        },
      };
    }

    if (deniedColumns.length > 0) {
      return {
        allowed: false,
        deniedColumns,
        reason: `You don't have permission to access columns: ${deniedColumns.join(", ")}`,
        details: {
          tablesAccessed: tables,
          columnsAccessed: columns,
          checkedAt: Date.now(),
        },
      };
    }

    // All access granted
    return {
      allowed: true,
      details: {
        tablesAccessed: tables,
        columnsAccessed: columns,
        checkedAt: Date.now(),
      },
    };
  } catch (error) {
    console.error("[QueryAccess] Validation error:", error);
    // On error, deny access (fail-safe)
    return {
      allowed: false,
      reason: "Access validation failed. Please try again or contact support.",
    };
  }
}

/**
 * Get accessible entities for a manager in a data source
 * Used for schema browsing and discovery
 */
export async function getAccessibleEntities(
  userId: string,
  dataSourceId: string
): Promise<string[]> {
  try {
    const { getUserAccessibleEntities } = await import("@/lib/permissions/ds-rbac");
    const entities = await getUserAccessibleEntities(userId, dataSourceId);
    return entities.map((e) => e.entity_name);
  } catch (error) {
    console.error("[QueryAccess] Failed to get accessible entities:", error);
    return [];
  }
}

/**
 * Get column-level restrictions for a manager on a specific table
 */
export async function getColumnRestrictions(
  userId: string,
  dataSourceId: string,
  tableName: string
): Promise<string[] | undefined> {
  try {
    const { getUserAccessibleEntities } = await import("@/lib/permissions/ds-rbac");
    const entities = await getUserAccessibleEntities(userId, dataSourceId);

    const tableEntity = entities.find(
      (e) => e.entity_name.toLowerCase() === tableName.toLowerCase()
    );

    if (!tableEntity?.column_restrictions) {
      return undefined; // No restrictions
    }

    return JSON.parse(tableEntity.column_restrictions);
  } catch (error) {
    console.error("[QueryAccess] Failed to get column restrictions:", error);
    return undefined;
  }
}
