import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BranchAuthGuard } from './branch-auth.guard';
import { Role } from '@growfast/shared-types';

describe('BranchAuthGuard', () => {
  let guard: BranchAuthGuard;
  let mockPrismaService: any;

  beforeEach(() => {
    mockPrismaService = {
      store: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'store-kp-001') {
            return Promise.resolve({
              id: 'store-kp-001',
              name: 'Charholi Branch',
              isActive: true,
              code: 'CHARHOLI',
            });
          }
          if (where.id === 'store-kp-002') {
            return Promise.resolve({
              id: 'store-kp-002',
              name: 'Alephata Branch',
              isActive: true,
              code: 'ALEPHATA',
            });
          }
          if (where.id === 'store-inactive') {
            return Promise.resolve({
              id: 'store-inactive',
              name: 'Inactive Branch',
              isActive: false,
              code: 'INACTIVE',
            });
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const codeVal = where?.code?.equals?.toUpperCase();
          if (codeVal === 'CHARHOLI') {
            return Promise.resolve({
              id: 'store-kp-001',
              name: 'Charholi Branch',
              isActive: true,
              code: 'CHARHOLI',
            });
          }
          if (codeVal === 'ALEPHATA') {
            return Promise.resolve({
              id: 'store-kp-002',
              name: 'Alephata Branch',
              isActive: true,
              code: 'ALEPHATA',
            });
          }
          return Promise.resolve(null);
        }),
      },
    };

    guard = new BranchAuthGuard(mockPrismaService);
  });

  function createMockContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Unauthenticated / Public routes', () => {
    it('allows public routes when no user is attached to request', async () => {
      const req = { headers: {}, query: {} };
      const context = createMockContext(req);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Default store assignment (no header/query/body)', () => {
    it('assigns user home store by default when no branch is specified', async () => {
      const req: any = {
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: {},
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('store-kp-001');
      expect(req.branchContext.activeStoreId).toBe('store-kp-001');
      expect(req.branchContext.isAllBranches).toBe(false);
    });
  });

  describe('OWNER branch access and switching', () => {
    it('1. OWNER can access Charholi branch', async () => {
      const req: any = {
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-001' },
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('store-kp-001');
      expect(req.branchContext.activeStoreId).toBe('store-kp-001');
      expect(req.branchContext.isAllBranches).toBe(false);
    });

    it('2. OWNER can switch to Alephata branch via x-store-id header', async () => {
      const req: any = {
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-002' },
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('store-kp-002');
      expect(req.branchContext.activeStoreId).toBe('store-kp-002');
      expect(req.branchContext.isAllBranches).toBe(false);
    });

    it('3. OWNER can switch branch via x-branch-id header', async () => {
      const req: any = {
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-branch-id': 'store-kp-002' },
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('store-kp-002');
    });

    it('4. OWNER can select All Branches (all) for GET reporting queries', async () => {
      const req: any = {
        method: 'GET',
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'all' },
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('all');
      expect(req.branchContext.isAllBranches).toBe(true);
    });

    it('5. OWNER cannot use All Branches (all) for operational mutations (POST/PUT/PATCH/DELETE)', async () => {
      const req: any = {
        method: 'POST',
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'all' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
    });

    it('rejection when requested branch ID does not exist', async () => {
      const req: any = {
        user: { id: 'emp-owner-001', role: Role.OWNER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-nonexistent' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Non-Owner role restrictions (COUNTER, MANAGER, DELIVERY)', () => {
    it('6. COUNTER is allowed access to their assigned branch', async () => {
      const req: any = {
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-001' },
        query: {},
      };
      const context = createMockContext(req);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('store-kp-001');
    });

    it('7. COUNTER attempting to access another branch via header is rejected (403 Forbidden)', async () => {
      const req: any = {
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-002' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('8. COUNTER attempting to access another branch via query param is rejected (403 Forbidden)', async () => {
      const req: any = {
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: {},
        query: { storeId: 'store-kp-002' },
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('9. COUNTER attempting to modify store ID via request body is rejected (403 Forbidden)', async () => {
      const req: any = {
        method: 'POST',
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: {},
        query: {},
        body: { storeId: 'store-kp-002', name: 'Tampered Customer' },
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('10. COUNTER attempting to request All Branches (all) is rejected (403 Forbidden)', async () => {
      const req: any = {
        method: 'GET',
        user: { id: 'emp-counter-001', role: Role.COUNTER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'all' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('11. MANAGER attempting to access another branch is rejected (403 Forbidden)', async () => {
      const req: any = {
        user: { id: 'emp-manager-001', role: Role.MANAGER, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-002' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('12. DELIVERY attempting to access another branch is rejected (403 Forbidden)', async () => {
      const req: any = {
        user: { id: 'emp-delivery-001', role: Role.DELIVERY, storeId: 'store-kp-001' },
        headers: { 'x-store-id': 'store-kp-002' },
        query: {},
      };
      const context = createMockContext(req);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
