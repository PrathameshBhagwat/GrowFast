import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role-based Authorization Guard.
 * Checks if the authenticated user's role is in the allowed roles list.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('OWNER', 'MANAGER')
 *
 * IMPORTANT: Authorization MUST be enforced server-side.
 * Frontend role checks are for UX only, NOT security.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no role assigned');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], but you have [${user.role}]`,
      );
    }

    return true;
  }
}
