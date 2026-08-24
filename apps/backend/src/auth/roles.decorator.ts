import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator — specify which roles can access a route.
 *
 * Usage:
 *   @Roles('OWNER', 'MANAGER')
 *   @Roles(Role.OWNER, Role.MANAGER)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
