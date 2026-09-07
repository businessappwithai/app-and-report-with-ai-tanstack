/**
 * Authentication and Authorization Guards
 * Platform-agnostic guard implementations that can be used by both NestJS and OData V4 stacks
 */

import type { EntityOperation, UserRole } from "./auth.types.js";

/**
 * User context from session
 */
export interface SessionContext {
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
  };
  session: {
    token: string;
    expiresAt: Date;
  };
  roles?: UserRole[];
}

/**
 * Guard check result
 */
export interface GuardResult {
  granted: boolean;
  reason?: string;
  user?: SessionContext["user"];
}

/**
 * Base guard interface
 */
export interface IGuard {
  /**
   * Check if request can proceed
   */
  canProceed(context: GuardContext): Promise<GuardResult>;
}

/**
 * Guard context - passed to guards
 */
export interface GuardContext {
  /**
   * Session token from Authorization header or cookie
   */
  sessionToken?: string;

  /**
   * Entity name being accessed
   */
  entityName?: string;

  /**
   * Operation being performed
   */
  operation?: EntityOperation;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Authentication guard options
 */
export interface AuthGuardOptions {
  /**
   * Allow anonymous access (no authentication required)
   * @default false
   */
  allowAnonymous?: boolean;

  /**
   * Require email verification
   * @default false
   */
  requireEmailVerification?: boolean;
}

/**
 * Role guard options
 */
export interface RoleGuardOptions {
  /**
   * Required roles
   */
  roles: UserRole | UserRole[];

  /**
   * Require all roles (AND) or any role (OR)
   * @default false (any role)
   */
  requireAll?: boolean;
}

/**
 * Permission guard options
 */
export interface PermissionGuardOptions {
  /**
   * Entity name
   */
  entityName: string;

  /**
   * Operation
   */
  operation: EntityOperation;

  /**
   * Allow access if permission check fails but user is admin
   * @default true
   */
  adminBypass?: boolean;
}
