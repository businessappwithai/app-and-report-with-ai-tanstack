/**
 * SQL AST Validator with RBAC Checks
 *
 * Uses pgsql-ast-parser to:
 * 1. Parse generated SQL into AST
 * 2. Extract all accessed tables/views
 * 3. Validate RBAC permissions for accessed entities
 * 4. Provide detailed access violation reports
 */

import { parse } from "pgsql-ast-parser";
import { getDb } from "@/lib/db/config";
import type { User } from "@/types/database";

export interface SQLAccessValidation {
  isValid: boolean;
  accessAllowed: boolean;
  tablesAccessed: string[];
  deniedTables: string[];
  warnings: string[];
  error?: string;
}

/**
 * Extract table names from SQL using AST parser
 */
export function extractTablesFromSQL(sql: string): string[] {
  try {
    const ast = parse(sql);
    const tables = new Set<string>();

    // Traverse AST to find all table references
    traverseAST(ast, (node: any) => {
      // Handle FROM clause table references
      if (node.from && Array.isArray(node.from)) {
        for (const fromClause of node.from) {
          if (fromClause.name) {
            tables.add(fromClause.name);
          } else if (fromClause.table) {
            tables.add(fromClause.table);
          }
        }
      }

      // Handle JOIN clauses
      if (node.join && Array.isArray(node.join)) {
        for (const joinClause of node.join) {
          if (joinClause.on?.left?.table) {
            tables.add(joinClause.on.left.table);
          }
          if (joinClause.table?.name) {
            tables.add(joinClause.table.name);
          }
        }
      }

      // Handle table in WITH (CTE) clauses
      if (node.with && Array.isArray(node.with)) {
        for (const cte of node.with) {
          if (cte.name) {
            tables.add(cte.name);
          }
          // Recursively process CTE definition
          if (cte.statement) {
            const cteTables = extractTablesFromSQL(cte.statement);
            cteTables.forEach((t) => tables.add(t));
          }
        }
      }
    });

    return Array.from(tables);
  } catch (error) {
    console.error("[SQLValidator] Failed to parse SQL with AST:", error);
    return [];
  }
}

/**
 * Recursively traverse AST nodes
 */
function traverseAST(node: any, callback: (node: any) => void): void {
  if (!node || typeof node !== "object") {
    return;
  }

  callback(node);

  // Traverse common properties
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        traverseAST(item, callback);
      }
    } else if (typeof value === "object" && value !== null) {
      traverseAST(value, callback);
    }
  }
}

/**
 * Validate SQL RBAC access for a user on a data source
 *
 * Checks that the user's role has permission to access all tables
 * mentioned in the generated SQL
 */
export async function validateSQLRBACAccess(
  userId: string,
  dataSourceId: string,
  sql: string
): Promise<SQLAccessValidation> {
  try {
    // Step 1: Extract tables from SQL
    const tablesAccessed = extractTablesFromSQL(sql);

    if (tablesAccessed.length === 0) {
      return {
        isValid: true,
        accessAllowed: true,
        tablesAccessed: [],
        deniedTables: [],
        warnings: [],
      };
    }

    // Step 2: Get user's roles and accessible entities for this data source
    const db = getDb();
    const userRoles = await db
      .selectFrom("ds_user_roles")
      .selectAll()
      .where("data_source_id", "=", dataSourceId)
      .where("user_id", "=", userId)
      .execute();

    if (userRoles.length === 0) {
      return {
        isValid: true,
        accessAllowed: false,
        tablesAccessed,
        deniedTables: tablesAccessed,
        warnings: [`User has no roles assigned to data source ${dataSourceId}`],
        error: "User does not have any roles in this data source",
      };
    }

    // Step 3: Get entity permissions for user's roles
    const roleIds = userRoles.map((ur) => ur.ds_role_id);
    const entityPerms = await db
      .selectFrom("ds_entity_permissions")
      .selectAll()
      .where("data_source_id", "=", dataSourceId)
      .where("ds_role_id", "in", roleIds)
      .execute();

    // Build map of accessible tables
    const accessibleTables = new Set<string>();
    for (const perm of entityPerms) {
      if (perm.entity_type === "table" || perm.entity_type === "view") {
        // Only allow if permission level is at least 'read'
        if (
          perm.permission_level === "read" ||
          perm.permission_level === "write" ||
          perm.permission_level === "admin"
        ) {
          accessibleTables.add(perm.entity_name.toLowerCase());
        }
      }
    }

    // Step 4: Check if all accessed tables are permitted
    const deniedTables: string[] = [];
    for (const table of tablesAccessed) {
      if (!accessibleTables.has(table.toLowerCase())) {
        deniedTables.push(table);
      }
    }

    // Step 5: Return validation result
    return {
      isValid: true,
      accessAllowed: deniedTables.length === 0,
      tablesAccessed,
      deniedTables,
      warnings:
        deniedTables.length > 0
          ? [
              `Access denied to tables: ${deniedTables.join(", ")}. These tables are not accessible in your role.`,
            ]
          : [],
      ...(deniedTables.length > 0 && {
        error: `Permission denied for tables: ${deniedTables.join(", ")}`,
      }),
    };
  } catch (error) {
    console.error("[SQLValidator] RBAC validation error:", error);
    return {
      isValid: false,
      accessAllowed: false,
      tablesAccessed: [],
      deniedTables: [],
      warnings: [],
      error: `Failed to validate RBAC access: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if table exists in accessible schema for a data source
 */
export async function isTableAccessible(
  userId: string,
  dataSourceId: string,
  tableName: string
): Promise<boolean> {
  try {
    const db = getDb();

    // Get user's accessible tables
    const userRoles = await db
      .selectFrom("ds_user_roles")
      .select("ds_role_id")
      .where("data_source_id", "=", dataSourceId)
      .where("user_id", "=", userId)
      .execute();

    if (userRoles.length === 0) {
      return false;
    }

    const roleIds = userRoles.map((ur) => ur.ds_role_id);

    // Check if user has read or higher access to the table
    const perm = await db
      .selectFrom("ds_entity_permissions")
      .selectAll()
      .where("data_source_id", "=", dataSourceId)
      .where("ds_role_id", "in", roleIds)
      .where("entity_name", "=", tableName)
      .where((eb) =>
        eb("permission_level", "in", ["read" as const, "write" as const, "admin" as const])
      )
      .executeTakeFirst();

    return !!perm;
  } catch (error) {
    console.error("[SQLValidator] Table access check failed:", error);
    return false;
  }
}
