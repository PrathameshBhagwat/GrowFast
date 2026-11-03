import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BranchAuthGuard } from './branch-auth.guard';
import { CustomerService } from '../customer/customer.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { DeliveryService } from '../delivery/delivery.service';
import { PhotoService } from '../photo/photo.service';
import { Role } from '@growfast/shared-types';

describe('Phase 5 — Full Multi-Branch End-to-End Security & Isolation Suite', () => {
  const CHARHOLI_ID = 'store-kp-001';
  const ALEPHATA_ID = 'store-kp-002';

  let guard: BranchAuthGuard;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
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
      },
    };

    guard = new BranchAuthGuard(mockPrisma);
  });

  const createMockContext = (
    user: any,
    headers: Record<string, string> = {},
    method: string = 'GET',
    query: any = {},
    body: any = {},
  ): { context: ExecutionContext; req: any } => {
    const req: any = {
      user,
      headers: { ...headers },
      method,
      query,
      body,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
    return { context, req };
  };

  describe('1. Role-Based Branch Access Verification', () => {
    it('1.1 OWNER can access Charholi branch explicitly via header', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-owner', role: Role.OWNER, storeId: CHARHOLI_ID },
        { 'x-branch-id': CHARHOLI_ID },
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe(CHARHOLI_ID);
      expect(req.branchContext.activeStoreId).toBe(CHARHOLI_ID);
      expect(req.branchContext.isAllBranches).toBe(false);
    });

    it('1.2 OWNER can switch to Alephata branch explicitly via header', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-owner', role: Role.OWNER, storeId: CHARHOLI_ID },
        { 'x-branch-id': ALEPHATA_ID },
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe(ALEPHATA_ID);
      expect(req.branchContext.activeStoreId).toBe(ALEPHATA_ID);
      expect(req.branchContext.isAllBranches).toBe(false);
    });

    it('1.3 OWNER can select "all" (All Branches) for reporting queries', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-owner', role: Role.OWNER, storeId: CHARHOLI_ID },
        { 'x-branch-id': 'all' },
        'GET',
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe('all');
      expect(req.branchContext.isAllBranches).toBe(true);
      expect(req.branchContext.allowedStoreIds).toEqual(
        expect.arrayContaining([CHARHOLI_ID, ALEPHATA_ID]),
      );
    });

    it('1.4 COUNTER can access only their assigned branch (Charholi)', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-counter', role: Role.COUNTER, storeId: CHARHOLI_ID },
        {},
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe(CHARHOLI_ID);
      expect(req.branchContext.activeStoreId).toBe(CHARHOLI_ID);
    });

    it('1.5 MANAGER can access only their assigned branch', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-mgr', role: Role.MANAGER, storeId: ALEPHATA_ID },
        {},
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe(ALEPHATA_ID);
      expect(req.branchContext.activeStoreId).toBe(ALEPHATA_ID);
    });

    it('1.6 DELIVERY can access only their assigned branch', async () => {
      const { context, req } = createMockContext(
        { id: 'emp-rider', role: Role.DELIVERY, storeId: CHARHOLI_ID },
        {},
      );
      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(req.user.storeId).toBe(CHARHOLI_ID);
      expect(req.branchContext.activeStoreId).toBe(CHARHOLI_ID);
    });
  });

  describe('2. Unauthorized Branch Spoofing & Rejection', () => {
    it('2.1 rejects COUNTER attempting to pass Alephata header', async () => {
      const { context } = createMockContext(
        { id: 'emp-counter', role: Role.COUNTER, storeId: CHARHOLI_ID },
        { 'x-branch-id': ALEPHATA_ID },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('2.2 rejects MANAGER attempting to pass All Branches ("all") header', async () => {
      const { context } = createMockContext(
        { id: 'emp-mgr', role: Role.MANAGER, storeId: CHARHOLI_ID },
        { 'x-branch-id': 'all' },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('2.3 rejects DELIVERY attempting to pass query param branchId for another store', async () => {
      const { context } = createMockContext(
        { id: 'emp-rider', role: Role.DELIVERY, storeId: CHARHOLI_ID },
        {},
        'GET',
        { branchId: ALEPHATA_ID },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('2.4 rejects non-existent branch ID with 404 NotFoundException for OWNER', async () => {
      const { context } = createMockContext(
        { id: 'emp-owner', role: Role.OWNER, storeId: CHARHOLI_ID },
        { 'x-branch-id': 'store-nonexistent' },
      );
      await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Mutation Rejection Under "All Branches" Context', () => {
    const mutations = ['POST', 'PUT', 'PATCH', 'DELETE'];

    for (const method of mutations) {
      it(`3.1 rejects ${method} request with "all" branch context`, async () => {
        const { context } = createMockContext(
          { id: 'emp-owner', role: Role.OWNER, storeId: CHARHOLI_ID },
          { 'x-branch-id': 'all' },
          method,
        );
        await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
      });
    }
  });

  describe('4. Cross-Branch Resource Access Protection', () => {
    let customerService: CustomerService;
    let orderService: OrderService;
    let paymentService: PaymentService;
    let deliveryService: DeliveryService;
    let photoService: PhotoService;

    beforeEach(() => {
      // Mock Prisma with isolated multi-branch data
      const mockCustomerCharholi = {
        id: 'cust-ch-001',
        customerCode: 'CUST-001',
        name: 'Charholi Resident',
        phone: '9822001122',
        storeId: CHARHOLI_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrderAlephata = {
        id: 'ord-al-001',
        orderNumber: 'ORD-ALE-101',
        storeId: ALEPHATA_ID,
        customerId: 'cust-al-001',
        subtotal: 300,
        taxAmount: 54,
        totalAmount: 354,
        amountPaid: 0,
        amountDue: 354,
        orderStatus: 'RECEIVED',
        paymentStatus: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };

      const customMockPrisma = {
        ...mockPrisma,
        customer: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'cust-ch-001') return Promise.resolve(mockCustomerCharholi);
            return Promise.resolve(null);
          }),
          findFirst: jest.fn().mockImplementation(({ where }) => {
            if (where.customerCode === 'cust-ch-001') return Promise.resolve(mockCustomerCharholi);
            return Promise.resolve(null);
          }),
        },
        order: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'ord-al-001') return Promise.resolve(mockOrderAlephata);
            return Promise.resolve(null);
          }),
          findFirst: jest.fn().mockImplementation(({ where }) => {
            if (where.orderNumber === 'ord-al-001') return Promise.resolve(mockOrderAlephata);
            return Promise.resolve(null);
          }),
        },
        deliveryRecord: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.id === 'del-al-001') {
              return Promise.resolve({
                id: 'del-al-001',
                orderId: 'ord-al-001',
                order: mockOrderAlephata,
              });
            }
            return Promise.resolve(null);
          }),
        },
        orderPhoto: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn().mockImplementation(async (cb) => cb(customMockPrisma)),
      };

      const mockNotificationService: any = {
        emitNotificationEvent: jest.fn().mockResolvedValue(null),
      };

      customerService = new CustomerService(customMockPrisma as any);
      orderService = new OrderService(
        customMockPrisma as any,
        undefined as any,
        mockNotificationService,
        undefined as any,
      );
      paymentService = new PaymentService(customMockPrisma as any, mockNotificationService);
      deliveryService = new DeliveryService(
        customMockPrisma as any,
        mockNotificationService,
        undefined as any,
      );
      photoService = new PhotoService(customMockPrisma as any, undefined as any);
    });

    it('4.1 getCustomerById returns null when Alephata COUNTER attempts to view Charholi customer', async () => {
      const result = await customerService.getCustomerById(
        'cust-ch-001',
        ALEPHATA_ID,
        Role.COUNTER,
      );
      expect(result).toBeNull();
    });

    it('4.2 getCustomerById succeeds when Charholi COUNTER requests Charholi customer', async () => {
      const result = await customerService.getCustomerById(
        'cust-ch-001',
        CHARHOLI_ID,
        Role.COUNTER,
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('cust-ch-001');
    });

    it('4.3 getCustomerById succeeds for OWNER across any branch', async () => {
      const result = await customerService.getCustomerById('cust-ch-001', ALEPHATA_ID, Role.OWNER);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('cust-ch-001');
    });

    it('4.4 findOrderById throws NotFoundException when Charholi staff requests Alephata order ID', async () => {
      await expect(orderService.findOrderById('ord-al-001', CHARHOLI_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('4.5 recordPayment rejects payment on Alephata order when requested by Charholi storeId', async () => {
      await expect(
        paymentService.recordPayment('emp-counter', CHARHOLI_ID, {
          orderId: 'ord-al-001',
          amount: 100,
          mode: 'CASH' as any,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('4.6 findDeliveryById throws NotFoundException when Charholi staff requests Alephata delivery ID', async () => {
      await expect(
        deliveryService.findDeliveryById('del-al-001', CHARHOLI_ID, 'emp-counter', Role.COUNTER),
      ).rejects.toThrow(NotFoundException);
    });

    it('4.7 getOrderPhotos throws NotFoundException when Charholi staff requests photos of Alephata order', async () => {
      await expect(photoService.getOrderPhotos('ord-al-001', CHARHOLI_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
