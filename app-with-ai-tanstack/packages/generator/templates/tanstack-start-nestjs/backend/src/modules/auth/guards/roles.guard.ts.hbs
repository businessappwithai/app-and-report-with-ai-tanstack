/**
 * Roles Guard - Role-Based Access Control
 *
 * Enforces role-based access control for protected routes.
 * Works in conjunction with SessionAuthGuard (must be applied first).
 *
 * Usage:
 * @Roles('admin', 'doctor')
 * @UseGuards(SessionAuthGuard, RolesGuard)
 * async getPatients() { ... }
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (set by SessionAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated. Please sign in.');
    }

    // Collect roles from every source a caller can arrive with:
    // - user.sysRoles: application roles read out of sys_user_roles by
    //   SessionAuthGuard. This is the field that guard actually sets; this
    //   guard read `user.roles`, which nothing ever populated, so a user whose
    //   only roles came from sys_user_roles was refused by every @Roles()
    //   endpoint no matter what roles they held.
    // - user.roles: kept for any caller enriched by other middleware.
    // - user.role: BetterAuth's own role field ('admin', 'user', etc.).
    const userRoles: string[] = [];
    for (const value of [...(user.sysRoles || []), ...(user.roles || [])]) {
      if (typeof value === 'string' && value && !userRoles.includes(value)) {
        userRoles.push(value);
      }
    }
    if (user.role && !userRoles.includes(user.role)) {
      userRoles.push(user.role);
    }

    // A master role is the dictionary's administrator escape hatch; it would be
    // surprising for it to hold everywhere except here.
    if (user.isMaster === true) {
      return true;
    }

    // Check if user has any of the required roles
    // Case-insensitive: the seeded role is `Administrator` and a decorator
    // writes `admin`/`administrator`. Matching exactly refuses a user who holds
    // precisely the role the endpoint asks for, which is the failure this guard
    // exists to prevent.
    const held = new Set(userRoles.map((role) => role.toLowerCase()));
    const hasRole = requiredRoles.some((role) => held.has(role.toLowerCase()));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your roles: ${userRoles.join(', ') || 'none'}.`
      );
    }

    return true;
  }
}
