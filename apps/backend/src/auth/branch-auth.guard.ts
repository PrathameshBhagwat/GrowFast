import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@growfast/shared-types';

export interface BranchContext {
  employeeId: string;
  employeeRole: Role;
  assignedStoreId: string;
  activeStoreId: string;
  isAllBranches: boolean;
  allowedStoreIds: string[];
}

/**
 * Branch Authorization Guard.
 *
 * Enforces strict multi-branch authorization and context resolution:
 * 1. OWNER:
 *    - Can access Charholi (store-kp-001) and Alephata (store-kp-002).
 *    - Can switch branches via header (x-branch-id / x-store-id) or query param.
 *    - Can select 'all' (All Branches) for safe read/reporting endpoints.
 *    - Operational mutations (POST, PUT, PATCH, DELETE) require a specific branch.
 * 2. COUNTER, MANAGER, DELIVERY:
 *    - Strictly restricted to their assigned branch (employee.storeId).
 *    - Any attempt to access another branch or 'all' via headers, query, or body is rejected (403 Forbidden).
 *
 * Attaches `req.branchContext` and updates `req.user.storeId` with the authoritative store ID.
 */
@Injectable()
export class BranchAuthGuard implements CanActivate {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // If no authenticated user (e.g. public endpoint), pass through
    if (!user || !user.role) {
      return true;
    }

    const assignedStoreId: string = user.storeId;
    const userRole: Role = user.role;

    // 1. Extract requested store ID from headers, query, or body (in order of precedence)
    const rawHeader =
      req.headers['x-branch-id'] ||
      req.headers['x-store-id'] ||
      req.headers['x-branch'] ||
      req.headers['x-store'];
    const rawQuery = req.query?.branchId || req.query?.storeId;
    const rawBody = req.body?.branchId || req.body?.storeId;

    const requestedRaw = (rawHeader || rawQuery || rawBody)?.toString().trim();

    let activeStoreId: string = assignedStoreId;
    let isAllBranches = false;

    // 2. Validate requested store ID against user role permissions
    if (requestedRaw) {
      const isAll =
        requestedRaw.toLowerCase() === 'all' ||
        requestedRaw.toLowerCase() === 'all_branches' ||
        requestedRaw === '*';

      if (isAll) {
        // Only OWNER can select All Branches
        if (userRole !== Role.OWNER) {
          throw new ForbiddenException(
            'Access denied: Only owners can access consolidated data across all branches.',
          );
        }

        // Operational mutations cannot target All Branches
        const method = req.method?.toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          throw new BadRequestException(
            'A specific branch must be selected for operational transactions. "All Branches" is only available for consolidated reporting.',
          );
        }

        isAllBranches = true;
        activeStoreId = 'all';
      } else {
        // Validate specific store ID or code exists in database if Prisma is available
        if (this.prisma) {
          let store = await this.prisma.store.findUnique({
            where: { id: requestedRaw },
            select: { id: true, isActive: true, code: true },
          });

          if (!store && typeof this.prisma.store?.findFirst === 'function') {
            store = await this.prisma.store.findFirst({
              where: {
                code: { equals: requestedRaw, mode: 'insensitive' },
              },
              select: { id: true, isActive: true, code: true },
            });
          }

          if (!store) {
            throw new NotFoundException(`Branch with ID "${requestedRaw}" not found`);
          }

          if (!store.isActive && userRole !== Role.OWNER) {
            throw new ForbiddenException(`Branch "${requestedRaw}" is inactive`);
          }

          activeStoreId = store.id;
        } else {
          activeStoreId = requestedRaw;
        }

        // Role-based validation
        if (userRole === Role.OWNER) {
          isAllBranches = false;
        } else {
          // Non-owner employees (COUNTER, MANAGER, DELIVERY) can ONLY access their assigned branch
          if (activeStoreId !== assignedStoreId) {
            throw new ForbiddenException(
              `Access denied: You are not authorized to access branch: ${requestedRaw}`,
            );
          }
          activeStoreId = assignedStoreId;
          isAllBranches = false;
        }
      }
    } else {
      // Default to employee's assigned store
      activeStoreId = assignedStoreId;
      isAllBranches = false;
    }

    // 3. Attach authoritative branch context to request
    req.branchContext = {
      employeeId: user.id,
      employeeRole: userRole,
      assignedStoreId,
      activeStoreId,
      isAllBranches,
      allowedStoreIds:
        userRole === Role.OWNER ? ['all', 'store-kp-001', 'store-kp-002'] : [assignedStoreId],
    };

    // 4. Update req.user.storeId with authoritative active store ID
    req.user.storeId = activeStoreId;

    return true;
  }
}
