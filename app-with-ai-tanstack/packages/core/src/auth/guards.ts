/**
 * Guard Implementations
 * Provides authentication and authorization guards for both stacks
 */

import type { AuthService } from "./auth.service.js";
import type {
  AuthGuardOptions,
  GuardContext,
  GuardResult,
  IGuard,
  PermissionGuardOptions,
  RoleGuardOptions,
} from "./guards.types.js";

/**
 * Authentication Guard
 * Validates that the user has a valid session
 */
export class AuthGuard implements IGuard {
  constructor(
    private authService: AuthService,
    private options: AuthGuardOptions = {}
  ) {}

  async canProceed(context: GuardContext): Promise<GuardResult> {
    // Allow anonymous access if configured
    if (this.options.allowAnonymous) {
      return { granted: true, reason: "ANONYMOUS_ACCESS" };
    }

    // Check if session token is present
    if (!context.sessionToken) {
      return {
        granted: false,
        reason: "NO_SESSION_TOKEN",
      };
    }

    // Validate session
    const session = await this.authService.getSession(context.sessionToken);

    if (!session) {
      return {
        granted: false,
        reason: "INVALID_SESSION",
      };
    }

    // Check email verification if required
    if (this.options.requireEmailVerification && !session.user.emailVerified) {
      return {
        granted: false,
        reason: "EMAIL_NOT_VERIFIED",
      };
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return {
        granted: false,
        reason: "SESSION_EXPIRED",
      };
    }

    return {
      granted: true,
      user: session.user,
    };
  }
}

/**
 * Role Guard
 * Checks if the user has the required role(s)
 */
export class RoleGuard implements IGuard {
  constructor(
    private authService: AuthService,
    private options: RoleGuardOptions
  ) {}

  async canProceed(context: GuardContext): Promise<GuardResult> {
    // First, authenticate the user
    const authGuard = new AuthGuard(this.authService);
    const authResult = await authGuard.canProceed(context);

    if (!authResult.granted) {
      return authResult;
    }

    // Get user roles
    if (!authResult.user) {
      return { granted: false, reason: "NO_USER_CONTEXT" };
    }
    const userId = authResult.user.id;
    const userRoles = await this.authService.getUserRoles(userId);

    // Check if user has required roles
    const requiredRoles = Array.isArray(this.options.roles)
      ? this.options.roles
      : [this.options.roles];

    const hasRole = this.options.requireAll
      ? requiredRoles.every((role) => userRoles.includes(role))
      : requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return {
        granted: false,
        reason: "INSUFFICIENT_ROLE",
        user: authResult.user,
      };
    }

    return {
      granted: true,
      user: authResult.user,
    };
  }
}

/**
 * Permission Guard
 * Checks if the user has permission for the entity operation
 */
export class PermissionGuard implements IGuard {
  constructor(
    private authService: AuthService,
    private options: PermissionGuardOptions
  ) {}

  async canProceed(context: GuardContext): Promise<GuardResult> {
    // First, authenticate the user
    const authGuard = new AuthGuard(this.authService);
    const authResult = await authGuard.canProceed(context);

    if (!authResult.granted) {
      return authResult;
    }

    // Check if user is admin (admin bypass)
    if (!authResult.user) {
      return { granted: false, reason: "NO_USER_CONTEXT" };
    }
    const userId = authResult.user.id;
    const isAdmin = await this.authService.hasRole(userId, "admin");

    if (isAdmin && this.options.adminBypass !== false) {
      return {
        granted: true,
        user: authResult.user,
      };
    }

    // Check permission
    const permission = await this.authService.hasPermission(
      userId,
      this.options.entityName,
      this.options.operation
    );

    if (!permission.granted) {
      return {
        granted: false,
        reason: permission.reason || "INSUFFICIENT_PERMISSION",
        user: authResult.user,
      };
    }

    return {
      granted: true,
      user: authResult.user,
    };
  }
}

/**
 * Combined Guard
 * Combines multiple guards with AND logic (all must pass)
 */
export class CombinedGuard implements IGuard {
  constructor(private guards: IGuard[]) {}

  async canProceed(context: GuardContext): Promise<GuardResult> {
    for (const guard of this.guards) {
      const result = await guard.canProceed(context);

      if (!result.granted) {
        return result;
      }
    }

    return {
      granted: true,
      user: this.guards[0] ? (await this.guards[0].canProceed(context)).user : undefined,
    };
  }
}

/**
 * Public Guard
 * Always allows access (useful for public endpoints)
 */
export class PublicGuard implements IGuard {
  async canProceed(_context: GuardContext): Promise<GuardResult> {
    return { granted: true };
  }
}

/**
 * Guard factory
 * Helper function to create guards
 */
export class GuardFactory {
  constructor(private authService: AuthService) {}

  /**
   * Create authentication guard
   */
  auth(options?: AuthGuardOptions): AuthGuard {
    return new AuthGuard(this.authService, options);
  }

  /**
   * Create role guard
   */
  role(options: RoleGuardOptions): RoleGuard {
    return new RoleGuard(this.authService, options);
  }

  /**
   * Create permission guard
   */
  permission(options: PermissionGuardOptions): PermissionGuard {
    return new PermissionGuard(this.authService, options);
  }

  /**
   * Create combined guard
   */
  combined(guards: IGuard[]): CombinedGuard {
    return new CombinedGuard(guards);
  }

  /**
   * Create public guard
   */
  public(): PublicGuard {
    return new PublicGuard();
  }

  /**
   * Create a guard that requires authentication and specific roles
   */
  authAndRole(options: AuthGuardOptions & RoleGuardOptions): CombinedGuard {
    return new CombinedGuard([
      new AuthGuard(this.authService, options),
      new RoleGuard(this.authService, { roles: options.roles, requireAll: options.requireAll }),
    ]);
  }

  /**
   * Create a guard that requires authentication and permission
   */
  authAndPermission(options: AuthGuardOptions & PermissionGuardOptions): CombinedGuard {
    return new CombinedGuard([
      new AuthGuard(this.authService, options),
      new PermissionGuard(this.authService, {
        entityName: options.entityName,
        operation: options.operation,
        adminBypass: options.adminBypass,
      }),
    ]);
  }
}
