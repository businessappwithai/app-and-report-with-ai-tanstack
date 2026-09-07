/**
 * Current User Decorator
 *
 * Convenience decorator to extract the authenticated user from the request.
 * Works with SessionAuthGuard which attaches user to request object.
 *
 * Usage:
 * @Post()
 * async create(@CurrentUser() user: User, @Body() data: CreateDto) {
 *   data.created_by = user.id;
 *   return this.service.create(data);
 * }
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  sysUserId?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUser;
  }
);
