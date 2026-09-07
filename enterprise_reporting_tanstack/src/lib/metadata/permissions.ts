/**
 * Metadata Permissions
 *
 * Provides permission checking helpers for metadata entity operations.
 */

import type { MetadataEntityField } from "@/types/database";

/**
 * Metadata Permission Level
 * Simplified permissions for metadata management (no create/delete as metadata is auto-created)
 */
export type MetadataPermissionLevel = "view" | "edit" | "admin";

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  permission_level?: MetadataPermissionLevel;
}

/**
 * Metadata Permissions Helper
 */
// biome-ignore lint/complexity/noStaticOnlyClass: permission check class with cohesive static methods
export class MetadataPermissions {
  /**
   * Check if user can view entity metadata
   */
  static canView(
    userPermissions: string[],
    _resourceType: string = "metadata_entity"
  ): PermissionCheckResult {
    // Check for wildcard admin permission
    if (MetadataPermissions.hasWildcardAdmin(userPermissions)) {
      return { allowed: true, permission_level: "admin" };
    }

    // Check for metadata_entity:view or higher
    const requiredPermissions = ["metadata_entity:edit", "metadata_entity:admin"];
    const hasView = requiredPermissions.some((p) => userPermissions.includes(p));

    if (hasView) {
      return { allowed: true, permission_level: "admin" };
    }

    // Check for exact view permission
    if (userPermissions.includes("metadata_entity:view")) {
      return { allowed: true, permission_level: "view" };
    }

    return { allowed: false, reason: "No view permission on metadata_entity" };
  }

  /**
   * Check if user can edit entity metadata
   */
  static canEdit(
    userPermissions: string[],
    _resourceType: string = "metadata_entity"
  ): PermissionCheckResult {
    // Check for wildcard admin permission
    if (MetadataPermissions.hasWildcardAdmin(userPermissions)) {
      return { allowed: true, permission_level: "admin" };
    }

    // Check for metadata_entity:edit or admin
    const hasEdit = userPermissions.includes("metadata_entity:edit");

    if (hasEdit) {
      return { allowed: true, permission_level: "edit" };
    }

    // Check for wildcard metadata_entity permission
    if (userPermissions.includes("metadata_entity:*")) {
      return { allowed: true, permission_level: "edit" };
    }

    return { allowed: false, reason: "No edit permission on metadata_entity" };
  }

  /**
   * Check if user can admin entity metadata
   */
  static canAdmin(
    userPermissions: string[],
    _resourceType: string = "metadata_entity"
  ): PermissionCheckResult {
    // Check for wildcard admin permission
    if (MetadataPermissions.hasWildcardAdmin(userPermissions)) {
      return { allowed: true, permission_level: "admin" };
    }

    // Check for metadata_entity:admin
    const hasAdmin = userPermissions.includes("metadata_entity:admin");

    if (hasAdmin) {
      return { allowed: true, permission_level: "admin" };
    }

    return { allowed: false, reason: "No admin permission on metadata_entity" };
  }

  /**
   * Check if user can perform action on metadata
   */
  static canPerformAction(
    action: "view" | "edit" | "admin",
    userPermissions: string[]
  ): PermissionCheckResult {
    switch (action) {
      case "view":
        return MetadataPermissions.canView(userPermissions);
      case "edit":
        return MetadataPermissions.canEdit(userPermissions);
      case "admin":
        return MetadataPermissions.canAdmin(userPermissions);
      default:
        return { allowed: false, reason: "Invalid action" };
    }
  }

  /**
   * Filter editable fields based on permissions
   * Returns only fields that the user is allowed to edit
   */
  static getEditableFields(
    fields: MetadataEntityField[],
    userPermissions: string[]
  ): MetadataEntityField[] {
    const canEdit = MetadataPermissions.canEdit(userPermissions).allowed;

    if (!canEdit) {
      // User cannot edit anything - return empty array or read-only view
      return [];
    }

    // Return all fields (in the future we might support field-level permissions)
    return fields;
  }

  /**
   * Check if user has wildcard admin permission
   */
  private static hasWildcardAdmin(userPermissions: string[]): boolean {
    return userPermissions.includes("admin:*") || userPermissions.includes("*");
  }

  /**
   * Validate permission level for metadata operations
   */
  static validatePermissionLevel(level: string): level is MetadataPermissionLevel {
    return ["view", "edit", "admin"].includes(level);
  }

  /**
   * Get required permission level for an action
   */
  static getRequiredPermission(
    action: "view" | "update" | "delete" | "manage_permissions"
  ): MetadataPermissionLevel {
    switch (action) {
      case "view":
        return "view";
      case "update":
        return "edit";
      case "delete":
      case "manage_permissions":
        return "admin";
      default:
        return "view";
    }
  }
}

/**
 * Format permissions for API response
 */
export interface EntityPermissionSummary {
  can_view: boolean;
  can_edit: boolean;
  can_admin: boolean;
  permission_level?: MetadataPermissionLevel;
}

/**
 * Get permission summary for an entity
 */
export function getEntityPermissionSummary(userPermissions: string[]): EntityPermissionSummary {
  const viewResult = MetadataPermissions.canView(userPermissions);
  const editResult = MetadataPermissions.canEdit(userPermissions);
  const adminResult = MetadataPermissions.canAdmin(userPermissions);

  return {
    can_view: viewResult.allowed,
    can_edit: editResult.allowed,
    can_admin: adminResult.allowed,
    permission_level: editResult.allowed ? "edit" : viewResult.allowed ? "view" : undefined,
  };
}
