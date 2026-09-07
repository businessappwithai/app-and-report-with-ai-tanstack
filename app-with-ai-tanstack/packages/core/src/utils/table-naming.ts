/**
 * Table Naming Utilities
 * Handles sys_ and bus_ prefixed table names
 */

import {
  BUS_TABLE_PREFIX,
  isBusinessTable,
  isSystemTable,
  SYS_TABLE_PREFIX,
} from "../types/sys-dictionary.types";
import { camelCase, pascalCase, snakeCase } from "./naming";

// Re-export for convenience
export { BUS_TABLE_PREFIX, isBusinessTable, isSystemTable, SYS_TABLE_PREFIX };

// ============================================================================
// System Table Names
// ============================================================================

export const SystemTables = {
  // Core Application Dictionary
  TABLE: "sys_table",
  COLUMN: "sys_column",
  WINDOW: "sys_window",
  TAB: "sys_tab",
  FIELD: "sys_field",
  FIELD_GROUP: "sys_field_group",
  REFERENCE: "sys_reference",
  REF_LIST: "sys_ref_list",
  REF_TABLE: "sys_ref_table",
  VAL_RULE: "sys_val_rule",

  // Security
  USER: "sys_user",
  ROLE: "sys_role",
  USER_ROLES: "sys_user_roles",
  ACCESS: "sys_access",

  // Audit
  CHANGE_LOG: "sys_change_log",
  SESSION: "sys_session",
} as const;

export type SystemTableName = (typeof SystemTables)[keyof typeof SystemTables];

// ============================================================================
// Prefix Functions
// ============================================================================

/**
 * Adds bus_ prefix to a table name if not already present
 */
export function addBusPrefix(name: string): string {
  if (name.startsWith(BUS_TABLE_PREFIX)) {
    return name;
  }
  if (name.startsWith(SYS_TABLE_PREFIX)) {
    return name; // Don't convert sys_ tables to bus_
  }
  return `${BUS_TABLE_PREFIX}${snakeCase(name)}`;
}

/**
 * Adds sys_ prefix to a table name if not already present
 */
export function addSysPrefix(name: string): string {
  if (name.startsWith(SYS_TABLE_PREFIX)) {
    return name;
  }
  if (name.startsWith(BUS_TABLE_PREFIX)) {
    return name; // Don't convert bus_ tables to sys_
  }
  return `${SYS_TABLE_PREFIX}${snakeCase(name)}`;
}

/**
 * Removes bus_ or sys_ prefix from a table name
 */
export function removeTablePrefix(name: string): string {
  if (name.startsWith(BUS_TABLE_PREFIX)) {
    return name.slice(BUS_TABLE_PREFIX.length);
  }
  if (name.startsWith(SYS_TABLE_PREFIX)) {
    return name.slice(SYS_TABLE_PREFIX.length);
  }
  return name;
}

/**
 * Gets the prefix from a table name
 */
export function getTablePrefix(name: string): "sys_" | "bus_" | null {
  if (name.startsWith(SYS_TABLE_PREFIX)) {
    return "sys_";
  }
  if (name.startsWith(BUS_TABLE_PREFIX)) {
    return "bus_";
  }
  return null;
}

/**
 * Checks if a table name is a known system table
 */
export function isKnownSystemTable(name: string): name is SystemTableName {
  return Object.values(SystemTables).includes(name as SystemTableName);
}

// ============================================================================
// Name Conversion
// ============================================================================

/**
 * Converts table name to entity name (PascalCase, no prefix)
 * Example: 'bus_customer' -> 'Customer'
 */
export function tableNameToEntityName(tableName: string): string {
  const withoutPrefix = removeTablePrefix(tableName);
  return pascalCase(withoutPrefix);
}

/**
 * Converts entity name to bus_ table name
 * Example: 'Customer' -> 'bus_customer'
 */
export function entityNameToTableName(entityName: string): string {
  return addBusPrefix(snakeCase(entityName));
}

/**
 * Converts table name to model name (PascalCase with prefix)
 * Example: 'bus_customer' -> 'BusCustomer'
 */
export function tableNameToModelName(tableName: string): string {
  return pascalCase(tableName.replace(/_/g, " ")).replace(/ /g, "");
}

/**
 * Converts table name to camelCase variable name (no prefix)
 * Example: 'bus_customer' -> 'customer'
 */
export function tableNameToVariableName(tableName: string): string {
  const withoutPrefix = removeTablePrefix(tableName);
  return camelCase(withoutPrefix);
}

/**
 * Converts table name to controller name
 * Example: 'bus_customer' -> 'BusCustomerController'
 */
export function tableNameToControllerName(tableName: string): string {
  return `${tableNameToModelName(tableName)}Controller`;
}

/**
 * Converts table name to service name
 * Example: 'bus_customer' -> 'BusCustomerService'
 */
export function tableNameToServiceName(tableName: string): string {
  return `${tableNameToModelName(tableName)}Service`;
}

/**
 * Converts table name to module name
 * Example: 'bus_customer' -> 'BusCustomerModule'
 */
export function tableNameToModuleName(tableName: string): string {
  return `${tableNameToModelName(tableName)}Module`;
}

/**
 * Converts table name to DTO name
 * Example: 'bus_customer' -> 'BusCustomerDto'
 */
export function tableNameToDtoName(tableName: string): string {
  return `${tableNameToModelName(tableName)}Dto`;
}

/**
 * Converts table name to route path
 * Example: 'bus_customer' -> '/bus/customer' or '/customer'
 */
export function tableNameToRoutePath(tableName: string, includePrefix: boolean = false): string {
  if (includePrefix) {
    const prefix = getTablePrefix(tableName);
    const name = removeTablePrefix(tableName);
    return prefix
      ? `/${prefix.replace("_", "")}/${name.replace(/_/g, "-")}`
      : `/${name.replace(/_/g, "-")}`;
  }
  return `/${removeTablePrefix(tableName).replace(/_/g, "-")}`;
}

/**
 * Converts table name to OData entity set name
 * Example: 'bus_customer' -> 'BusCustomers' (pluralized)
 */
export function tableNameToEntitySetName(tableName: string): string {
  const modelName = tableNameToModelName(tableName);
  // Simple pluralization - in real usage, consider a proper pluralization library
  if (modelName.endsWith("y")) {
    return `${modelName.slice(0, -1)}ies`;
  }
  if (modelName.endsWith("s") || modelName.endsWith("x") || modelName.endsWith("ch")) {
    return `${modelName}es`;
  }
  return `${modelName}s`;
}

// ============================================================================
// Column Naming
// ============================================================================

/**
 * Generates primary key column name for a table
 * Example: 'bus_customer' -> 'bus_customer_id'
 */
export function generatePrimaryKeyName(tableName: string): string {
  return `${tableName}_id`;
}

/**
 * Generates foreign key column name for a referenced table
 * Example: 'bus_customer' -> 'bus_customer_id' (as FK)
 */
export function generateForeignKeyName(referencedTableName: string): string {
  return `${referencedTableName}_id`;
}

/**
 * Checks if a column name looks like a foreign key
 */
export function isForeignKeyColumn(columnName: string): boolean {
  return columnName.endsWith("_id") && columnName !== "id";
}

/**
 * Extracts referenced table name from a foreign key column
 * Example: 'bus_customer_id' -> 'bus_customer'
 */
export function foreignKeyToTableName(fkColumnName: string): string | null {
  if (!isForeignKeyColumn(fkColumnName)) {
    return null;
  }
  return fkColumnName.slice(0, -3); // Remove '_id'
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Converts an array of entity names to bus_ table names
 */
export function entityNamesToTableNames(entityNames: string[]): string[] {
  return entityNames.map(entityNameToTableName);
}

/**
 * Filters an array of table names to only system tables
 */
export function filterSystemTables(tableNames: string[]): string[] {
  return tableNames.filter(isSystemTable);
}

/**
 * Filters an array of table names to only business tables
 */
export function filterBusinessTables(tableNames: string[]): string[] {
  return tableNames.filter(isBusinessTable);
}

/**
 * Groups table names by their prefix
 */
export function groupTablesByPrefix(tableNames: string[]): {
  system: string[];
  business: string[];
  other: string[];
} {
  return tableNames.reduce(
    (acc, name) => {
      if (isSystemTable(name)) {
        acc.system.push(name);
      } else if (isBusinessTable(name)) {
        acc.business.push(name);
      } else {
        acc.other.push(name);
      }
      return acc;
    },
    { system: [] as string[], business: [] as string[], other: [] as string[] }
  );
}

// ============================================================================
// Migration Naming
// ============================================================================

/**
 * Generates migration file name for system tables
 */
export function generateSysMigrationName(version: string = "001"): string {
  return `${version}_create_sys_tables`;
}

/**
 * Generates migration file name for a business entity
 */
export function generateBusMigrationName(entityName: string, version: string = "002"): string {
  return `${version}_create_${snakeCase(entityName)}`;
}

/**
 * Generates seed file name for system reference data
 */
export function generateSysSeedName(version: string = "001"): string {
  return `${version}_seed_sys_references`;
}

/**
 * Generates seed file name for dictionary entries
 */
export function generateDictionarySeedName(version: string = "002"): string {
  return `${version}_seed_sys_dictionary`;
}
