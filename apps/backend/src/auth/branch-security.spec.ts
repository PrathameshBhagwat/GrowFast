import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BranchAuthGuard } from './branch-auth.guard';
import { CustomerService } from '../customer/customer.service';
import { StoreService } from '../store/store.service';
import { Role } from '@growfast/shared-types';

describe('Phase 2 — Multi-Branch Backend Security Verification', () => {
  const CHARHOLI_ID = 'store-kp-001';
  const ALEPHATA_ID = 'store-kp-002';

  let guard: BranchAuthGuard;
  let mockPrismaService: any;

  beforeEach(() => {
    mockPrismaService = {
      store: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === CHARHOLI_ID) {
            return Promise.resolve({
              id: CHARHOLI_ID,
              name: 'Charholi Branch',
              code: 'CHARHOLI',
              isActive: true,
            });
          }
          if (where.id === ALEPHATA_ID) {
            return Promise.resolve({
              id: ALEPHATA_ID,
              name: 'Alephata Branch',
              code: 'ALEPHATA',
              isActive: true,
            });
          }
          if (where.id === 'inactive-branch') {
            return Promise.resolve({
              id: 'inactive-branch',
              name: 'Closed Store',
              code: 'CLOSED',
              isActive: false,
            });
          }
          return Promise.resolve(null);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const codeVal = where?.code?.equals?.toUpperCase();
          if (codeVal === 'CHARHOLI') {
            return Promise.resolve({
              id: CHARHOLI_ID,
              name: 'Charholi Branch',
              code: 'CHARHOLI',
              isActive: true,
            });
          }
          if (codeVal === 'ALEPHATA') {
            return Promise.resolve({
              id: ALEPHATA_ID,
              name: 'Alephata Branch',
              code: 'ALEPHATA',
              isActive: true,
            });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          const all = [
            {
              id: CHARHOLI_ID,
              name: 'Charholi Branch',
              code: 'CHARHOLI',
              isActive: true,
              createdAt: new Date(),
              _count: { orders: 680, customers: 106, employees: 3 },
            },
            {
              id: ALEPHATA_ID,
              name: 'Alephata Branch',
              code: 'ALEPHATA',
              isActive: true,
              createdAt: new Date(),
              _count: { orders: 0, customers: 0, employees: 0 },
            },
          ];
          if (where?.id) {
            return Promise.resolve(all.filter((s) => s.id === where.id));
          }
          return Promise.resolve(all);
        }),
      },
      customer: {
        findUnique: jest.fn(),
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

  describe('Security Constraint 1: Non-Owner Branch Isolation', () => {
    it('COUNTER at Charholi cannot access Alephata via x-branch-id header (403 Forbidden)', async () => {
      const req: any = {
        headers: { 'x-branch-id': ALEPHATA_ID },
        query: {},
        body: {},
        user: { id: 'emp-counter-1', role: Role.COUNTER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('COUNTER at Charholi cannot access Alephata via storeId query param (403 Forbidden)', async () => {
      const req: any = {
        headers: {},
        query: { storeId: ALEPHATA_ID },
        body: {},
        user: { id: 'emp-counter-1', role: Role.COUNTER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('COUNTER at Charholi cannot access Alephata via request body storeId (403 Forbidden)', async () => {
      const req: any = {
        headers: {},
        query: {},
        body: { storeId: ALEPHATA_ID },
        user: { id: 'emp-counter-1', role: Role.COUNTER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('MANAGER at Charholi cannot access Alephata (403 Forbidden)', async () => {
      const req: any = {
        headers: { 'x-store-id': ALEPHATA_ID },
        query: {},
        body: {},
        user: { id: 'emp-mgr-1', role: Role.MANAGER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('DELIVERY driver at Charholi cannot access Alephata (403 Forbidden)', async () => {
      const req: any = {
        headers: { 'x-branch-id': ALEPHATA_ID },
        query: {},
        body: {},
        user: { id: 'emp-del-1', role: Role.DELIVERY, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });

    it('Non-owner role cannot access "all" branches (403 Forbidden)', async () => {
      const req: any = {
        headers: { 'x-branch-id': 'all' },
        query: {},
        body: {},
        user: { id: 'emp-counter-1', role: Role.COUNTER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Security Constraint 2: OWNER Branch Switching and Constraints', () => {
    it('OWNER can access Charholi by default or via header', async () => {
      const req: any = {
        headers: { 'x-branch-id': CHARHOLI_ID },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      const result = await guard.canActivate(createMockContext(req));
      expect(result).toBe(true);
      expect(req.user.storeId).toBe(CHARHOLI_ID);
      expect(req.branchContext.activeStoreId).toBe(CHARHOLI_ID);
      expect(req.branchContext.isAllBranches).toBe(false);
    });

    it('OWNER can switch to Alephata branch seamlessly', async () => {
      const req: any = {
        headers: { 'x-branch-id': ALEPHATA_ID },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      const result = await guard.canActivate(createMockContext(req));
      expect(result).toBe(true);
      expect(req.user.storeId).toBe(ALEPHATA_ID);
      expect(req.branchContext.activeStoreId).toBe(ALEPHATA_ID);
    });

    it('OWNER can switch to Alephata using branch code "ALEPHATA"', async () => {
      const req: any = {
        headers: { 'x-branch-id': 'ALEPHATA' },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      const result = await guard.canActivate(createMockContext(req));
      expect(result).toBe(true);
      expect(req.user.storeId).toBe(ALEPHATA_ID);
    });

    it('OWNER can access All Branches ("all") for safe GET queries', async () => {
      const req: any = {
        method: 'GET',
        headers: { 'x-branch-id': 'all' },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      const result = await guard.canActivate(createMockContext(req));
      expect(result).toBe(true);
      expect(req.user.storeId).toBe('all');
      expect(req.branchContext.isAllBranches).toBe(true);
    });

    it('OWNER cannot use All Branches ("all") for operational POST mutation (400 Bad Request)', async () => {
      const req: any = {
        method: 'POST',
        headers: { 'x-branch-id': 'all' },
        query: {},
        body: { totalAmount: 500 },
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(BadRequestException);
    });

    it('OWNER cannot use All Branches ("all") for operational PATCH mutation (400 Bad Request)', async () => {
      const req: any = {
        method: 'PATCH',
        headers: { 'x-branch-id': 'all' },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(BadRequestException);
    });

    it('Rejects non-existent branch ID (404 Not Found)', async () => {
      const req: any = {
        headers: { 'x-branch-id': 'non-existent-store' },
        query: {},
        body: {},
        user: { id: 'emp-owner-1', role: Role.OWNER, storeId: CHARHOLI_ID },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(NotFoundException);
    });

    it('Rejects inactive branch for non-owner (403 Forbidden)', async () => {
      const req: any = {
        headers: { 'x-branch-id': 'inactive-branch' },
        query: {},
        body: {},
        user: { id: 'emp-counter-1', role: Role.COUNTER, storeId: 'inactive-branch' },
      };
      await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Security Constraint 3: Customer Cross-Branch Isolation', () => {
    it('CustomerService.getCustomerById returns 404 when non-owner requests customer of another branch', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: 'cust-alephata-1',
        name: 'Alephata Customer',
        phone: '9876543210',
        storeId: ALEPHATA_ID,
      });

      const customerService = new CustomerService(mockPrismaService);

      // Charholi COUNTER attempting to fetch Alephata customer
      const result = await customerService.getCustomerById(
        'cust-alephata-1',
        CHARHOLI_ID,
        Role.COUNTER,
      );
      expect(result).toBeNull();
    });

    it('CustomerService.getCustomerById allows OWNER to view customer from any branch', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: 'cust-alephata-1',
        name: 'Alephata Customer',
        phone: '9876543210',
        storeId: ALEPHATA_ID,
        membershipTier: 'REGULAR',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const customerService = new CustomerService(mockPrismaService);

      // OWNER viewing Alephata customer even when active branch context is Charholi
      const result = await customerService.getCustomerById(
        'cust-alephata-1',
        CHARHOLI_ID,
        Role.OWNER,
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('cust-alephata-1');
    });
  });

  describe('Security Constraint 4: Store Branches Metadata Discovery', () => {
    it('StoreService.getBranches returns all branches for OWNER', async () => {
      const storeService = new StoreService(mockPrismaService);
      const branches = await storeService.getBranches({ role: Role.OWNER, storeId: CHARHOLI_ID });
      expect(branches).toHaveLength(2);
      expect(branches.map((b) => b.id)).toEqual([CHARHOLI_ID, ALEPHATA_ID]);
    });

    it('StoreService.getBranches returns ONLY assigned branch for COUNTER', async () => {
      const storeService = new StoreService(mockPrismaService);
      const branches = await storeService.getBranches({ role: Role.COUNTER, storeId: CHARHOLI_ID });
      expect(branches).toHaveLength(1);
      expect(branches[0].id).toBe(CHARHOLI_ID);
    });
  });
});
