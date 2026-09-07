import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ResourceType } from "@/types/database";

interface UserPermissions {
  userId: string;
  roles: Array<{
    id: string;
    name: string;
    permissions: string;
  }>;
  rolePermissions: string[];
  resourcePermissions: Array<{
    id: string;
    resource_type: ResourceType;
    resource_id: string;
    role_id: string;
    permission_level: string;
  }>;
  isAdmin: boolean;
}

/**
 * Hook to get all permissions for the current user.
 * Fetches from /api/auth/permissions which reads the session cookie server-side.
 * Only fetches once after login and caches indefinitely to prevent sidebar flicker.
 */
export function usePermissions() {
  return useQuery<UserPermissions>({
    queryKey: ["user-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/auth/permissions");
      if (!res.ok) {
        // Not authenticated or error — return empty permissions
        return {
          userId: "",
          roles: [],
          rolePermissions: [],
          resourcePermissions: [],
          isAdmin: false,
        };
      }
      return res.json();
    },
    staleTime: Infinity, // Never refetch automatically
    gcTime: Infinity, // Keep cached indefinitely
  });
}

/**
 * Hook to check if user can view a specific resource type
 */
export function useCanView(resourceType: ResourceType) {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    return permissions.rolePermissions.some(
      (perm) => perm === `${resourceType}:view` || perm === `${resourceType}:*` || perm === "*:*"
    );
  }, [permissions, resourceType]);
}

/**
 * Hook to check if user can edit a specific resource type
 */
export function useCanEdit(resourceType: ResourceType) {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    return permissions.rolePermissions.some(
      (perm) => perm === `${resourceType}:edit` || perm === `${resourceType}:*` || perm === "*:*"
    );
  }, [permissions, resourceType]);
}

/**
 * Hook to check if user can create resources of a specific type
 */
export function useCanCreate(resourceType: ResourceType) {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    return permissions.rolePermissions.some(
      (perm) =>
        perm === `${resourceType}:create` ||
        perm === `${resourceType}:edit` ||
        perm === `${resourceType}:*` ||
        perm === "*:*"
    );
  }, [permissions, resourceType]);
}

/**
 * Hook to check if user can delete resources of a specific type
 */
export function useCanDelete(resourceType: ResourceType) {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    return permissions.rolePermissions.some(
      (perm) =>
        perm === `${resourceType}:delete` ||
        perm === `${resourceType}:admin` ||
        perm === `${resourceType}:*` ||
        perm === "*:*"
    );
  }, [permissions, resourceType]);
}

/**
 * Hook to check if user has specific permission on a resource
 */
export function useHasResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  action: "view" | "edit" | "execute" | "delete" = "view"
) {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    if (permissions.isAdmin) return true;

    // Check role permissions
    const hasRolePermission = permissions.rolePermissions.some(
      (perm) =>
        perm === `${resourceType}:${action}` || perm === `${resourceType}:*` || perm === "*:*"
    );

    if (hasRolePermission) return true;

    // Check resource-level permissions
    const resourcePerm = permissions.resourcePermissions.find(
      (p) => p.resource_type === resourceType && p.resource_id === resourceId
    );

    if (resourcePerm) {
      const permissionStrength: Record<string, number> = {
        view: 1,
        execute: 2,
        edit: 3,
        delete: 4,
        admin: 5,
      };

      const requiredStrength = permissionStrength[action] || 0;
      const grantedStrength = permissionStrength[resourcePerm.permission_level] || 0;

      return grantedStrength >= requiredStrength;
    }

    return false;
  }, [permissions, resourceType, resourceId, action]);
}

/**
 * Hook to get user's role names
 */
export function useUserRoles() {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return [];
    return permissions.roles.map((r) => r.name);
  }, [permissions]);
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin() {
  const { data: permissions } = usePermissions();

  return useMemo(() => {
    if (!permissions) return false;
    return permissions.isAdmin;
  }, [permissions]);
}
