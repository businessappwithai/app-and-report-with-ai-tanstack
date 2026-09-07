/**
 * Platform-Agnostic Decorators for Auth
 *
 * Metadata keys and decorator factories for authentication and authorization.
 * These can be used to create framework-specific decorators (NestJS, Express, etc.)
 *
 * For NestJS: Use @Roles(), @RequirePermission() in your NestJS app
 * For Express: Use the metadata keys with your own middleware
 */

import type { EntityOperation, UserRole } from "./auth.types.js";

/**
 * Public route metadata key
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Required roles metadata key
 */
export const REQUIRED_ROLES_KEY = "requiredRoles";

/**
 * Required permissions metadata key
 */
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

/**
 * Require all roles (AND) or any role (OR)
 */
export const REQUIRE_ALL_ROLES_KEY = "requireAllRoles";

/**
 * Metadata structure for role requirements
 */
export interface RoleMetadata {
  roles: UserRole[];
  requireAll: boolean;
}

/**
 * Metadata structure for permission requirements
 */
export interface PermissionMetadata {
  entityName: string;
  operation: EntityOperation;
}

/**
 * Create role metadata for guards
 *
 * @param roles - Array of roles required
 * @param requireAll - Require all roles (default: false - any role)
 *
 * @example
 * // Returns metadata for guards to process
 * const roleMeta = createRoleMetadata(['admin', 'doctor'], false);
 */
export function createRoleMetadata(
  roles: UserRole | UserRole[],
  requireAll: boolean = false
): RoleMetadata {
  const roleList = Array.isArray(roles) ? roles : [roles];
  return {
    roles: roleList,
    requireAll,
  };
}

/**
 * Create permission metadata for guards
 *
 * @param entityName - Name of the entity (e.g., 'patient', 'appointment')
 * @param operation - Operation type (CREATE, READ, UPDATE, DELETE)
 *
 * @example
 * // Returns metadata for guards to process
 * const permMeta = createPermissionMetadata('patient', 'CREATE');
 */
export function createPermissionMetadata(
  entityName: string,
  operation: EntityOperation
): PermissionMetadata {
  return {
    entityName,
    operation,
  };
}

/**
 * Check if route is marked as public
 *
 * This helper can be used by guards/middleware to check metadata
 */
export function isPublicRoute(metadata: Record<string, unknown>): boolean {
  return metadata[IS_PUBLIC_KEY] === true;
}

/**
 * Get required roles from metadata
 *
 * This helper can be used by guards/middleware to extract role requirements
 */
export function getRequiredRoles(metadata: Record<string, unknown>): RoleMetadata | null {
  const roles = metadata[REQUIRED_ROLES_KEY] as UserRole[] | undefined;
  if (!roles) return null;

  return {
    roles,
    requireAll: (metadata[REQUIRE_ALL_ROLES_KEY] as boolean | undefined) ?? false,
  };
}

/**
 * Get required permissions from metadata
 *
 * This helper can be used by guards/middleware to extract permission requirements
 */
export function getRequiredPermissions(
  metadata: Record<string, unknown>
): PermissionMetadata | null {
  const permissions = metadata[REQUIRED_PERMISSIONS_KEY] as PermissionMetadata | undefined;
  return permissions ?? null;
}
