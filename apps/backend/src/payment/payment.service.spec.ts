import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService, derivePaymentStatus } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PaymentStatus, OrderStatus } from '@prisma/client';
import { RecordPaymentRequest, PaymentMode } from '@growfast/shared-types';

// ─── Test Fixtures ──────────────────────────────────────────────────

const EMPLOYEE_ID = 'emp-123';
const EMPLOYEE_NAME = 'Test Employee';
const STORE_ID = 'store-1';
const OTHER_STORE_ID = 'store-other';
const ORDER_ID = 'order-1';

/** Factory: create a mock order with sensible defaults */
function makeOrder(
  overrides: Partial<{
    id: string;
    storeId: string;
    totalAmount: number;
    amountPaid: number;
    amountDue: number;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
  }> = {},
) {
  return {
    id: ORDER_ID,
    storeId: STORE_ID,
    totalAmount: 1000,
    amountPaid: 0,
    amountDue: 1000,
    paymentStatus: PaymentStatus.PENDING,
    status: OrderStatus.RECEIVED,
    ...overrides,
  };
}

/** Factory: create a mock payment result */
function makePaymentResult(
  amount: number,
  overrides: Partial<{
    id: string;
    orderId: string;
    mode: string;
    reference: string | null;
    receivedById: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'pay-1',
    orderId: overrides.orderId ?? ORDER_ID,
    amount,
    mode: overrides.mode ?? 'CASH',
    reference: overrides.reference ?? null,
    receivedById: overrides.receivedById ?? EMPLOYEE_ID,
    receivedBy: { name: EMPLOYEE_NAME },
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

/** Factory: create a valid RecordPaymentRequest */
function makeDto(overrides: Partial<RecordPaymentRequest> = {}): RecordPaymentRequest {
  return {
    orderId: ORDER_ID,
    amount: 400,
    mode: PaymentMode.CASH,
    ...overrides,
  };
}

// ─── Test Suite ─────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService;

  // Prisma mock — $transaction delegates to callback with a mock tx object.
  // order.findUnique on the top-level prisma is used by getOrderPayments.
  const mockPrisma = {
    $transaction: jest.fn(),
    order: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: { createNotificationEvent: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Helper: setup $transaction mock ────────────────────────────

  /**
   * Configure mockPrisma.$transaction to call the user callback with
   * a transaction client whose order.findUnique / order.update /
   * payment.create are individually controllable.
   */
  function setupTransaction(opts: {
    order?: any;
    onUpdate?: (data: any) => void;
    paymentResult?: any;
    shouldFailOnCreate?: Error;
    shouldFailOnUpdate?: Error;
  }) {
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(opts.order ?? null),
          update: jest.fn().mockImplementation(({ data }: any) => {
            if (opts.shouldFailOnUpdate) throw opts.shouldFailOnUpdate;
            opts.onUpdate?.(data);
            return {};
          }),
        },
        payment: {
          create: jest.fn().mockImplementation(() => {
            if (opts.shouldFailOnCreate) throw opts.shouldFailOnCreate;
            return opts.paymentResult ?? makePaymentResult(400);
          }),
        },
      };
      return cb(tx);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1. RECORDING PAYMENTS — HAPPY PATH
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — happy path', () => {
    it('should record a valid partial payment (₹400 on ₹1000 order)', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400),
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 400 }));

      expect(result).toBeDefined();
      expect(result.amount).toBe(400);
      expect(result.orderId).toBe(ORDER_ID);
      expect(result.receivedById).toBe(EMPLOYEE_ID);
      expect(result.receivedByName).toBe(EMPLOYEE_NAME);
      expect(result.createdAt).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should record a full payment (₹1000 on ₹1000 order)', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(1000),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 1000 }));

      expect(result.amount).toBe(1000);
      expect(capturedUpdate.amountPaid).toBe(1000);
      expect(capturedUpdate.amountDue).toBe(0);
      expect(capturedUpdate.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('should record payment with UPI mode and reference', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(500, { mode: 'UPI', reference: 'UPI-REF-123' }),
      });

      const result = await service.recordPayment(
        EMPLOYEE_ID,
        STORE_ID,
        makeDto({
          amount: 500,
          mode: PaymentMode.UPI,
          reference: 'UPI-REF-123',
        }),
      );

      expect(result.amount).toBe(500);
      expect(result.reference).toBe('UPI-REF-123');
    });

    it('should record payment without reference (defaults to null)', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(200),
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 200 }));

      expect(result.reference).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. PARTIAL PAYMENTS — FINANCIAL CALCULATIONS
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — partial payment flow', () => {
    it('should transition paymentStatus from PENDING → PARTIAL on first partial', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ amountPaid: 0, amountDue: 1000, paymentStatus: PaymentStatus.PENDING }),
        paymentResult: makePaymentResult(400),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 400 }));

      expect(capturedUpdate.amountPaid).toBe(400);
      expect(capturedUpdate.amountDue).toBe(600);
      expect(capturedUpdate.paymentStatus).toBe(PaymentStatus.PARTIAL);
    });

    it('should correctly handle second partial payment (₹400 paid + ₹300 new)', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ amountPaid: 400, amountDue: 600, paymentStatus: PaymentStatus.PARTIAL }),
        paymentResult: makePaymentResult(300),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 300 }));

      expect(capturedUpdate.amountPaid).toBe(700);
      expect(capturedUpdate.amountDue).toBe(300);
      expect(capturedUpdate.paymentStatus).toBe(PaymentStatus.PARTIAL);
    });

    it('should transition PARTIAL → PAID when remaining balance is paid', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ amountPaid: 700, amountDue: 300, paymentStatus: PaymentStatus.PARTIAL }),
        paymentResult: makePaymentResult(300),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 300 }));

      expect(capturedUpdate.amountPaid).toBe(1000);
      expect(capturedUpdate.amountDue).toBe(0);
      expect(capturedUpdate.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. FINANCIAL CALCULATION TESTS
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — financial calculations', () => {
    it('₹1000 - ₹0 paid → amountDue = ₹1000 (no payment yet)', async () => {
      // This tests that a ₹400 payment against a ₹1000 order with ₹0 paid yields correct state
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 0, amountDue: 1000 }),
        paymentResult: makePaymentResult(400),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 400 }));

      expect(capturedUpdate.amountPaid).toBe(400);
      expect(capturedUpdate.amountDue).toBe(600);
    });

    it('₹1000 - ₹400 paid - ₹300 new = amountDue ₹300', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 400, amountDue: 600 }),
        paymentResult: makePaymentResult(300),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 300 }));

      expect(capturedUpdate.amountPaid).toBe(700);
      expect(capturedUpdate.amountDue).toBe(300);
    });

    it('₹1000 - ₹1000 = amountDue ₹0', async () => {
      let capturedUpdate: any;
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 0, amountDue: 1000 }),
        paymentResult: makePaymentResult(1000),
        onUpdate: (data) => {
          capturedUpdate = data;
        },
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 1000 }));

      expect(capturedUpdate.amountPaid).toBe(1000);
      expect(capturedUpdate.amountDue).toBe(0);
      expect(capturedUpdate.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('₹1000 - ₹1001 = rejected (overpayment)', async () => {
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 0, amountDue: 1000 }),
      });

      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 1001 })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. AMOUNT VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — amount validation', () => {
    it('should reject zero amount', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 0 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative amount', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: -100 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject NaN amount', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: NaN })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject Infinity amount', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: Infinity })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject -Infinity amount', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: -Infinity })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overpayment (₹301 when ₹300 due)', async () => {
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 700, amountDue: 300 }),
      });

      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 301 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT silently clamp overpayment — ₹301 is rejected, not clamped to ₹300', async () => {
      setupTransaction({
        order: makeOrder({ totalAmount: 1000, amountPaid: 700, amountDue: 300 }),
      });

      try {
        await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 301 }));
        fail('Expected BadRequestException');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.message).toContain('301');
        expect(e.message).toContain('300');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. PAYMENT MODE VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — PaymentMode validation', () => {
    it('should accept valid mode: CASH', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400, { mode: 'CASH' }),
      });

      const result = await service.recordPayment(
        EMPLOYEE_ID,
        STORE_ID,
        makeDto({ mode: PaymentMode.CASH }),
      );
      expect(result).toBeDefined();
    });

    it('should accept valid mode: UPI', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400, { mode: 'UPI' }),
      });

      const result = await service.recordPayment(
        EMPLOYEE_ID,
        STORE_ID,
        makeDto({ mode: PaymentMode.UPI }),
      );
      expect(result).toBeDefined();
    });

    it('should accept valid mode: CARD', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400, { mode: 'CARD' }),
      });

      const result = await service.recordPayment(
        EMPLOYEE_ID,
        STORE_ID,
        makeDto({ mode: PaymentMode.CARD }),
      );
      expect(result).toBeDefined();
    });

    it('should reject invalid payment mode', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ mode: 'BITCOIN' as any })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty string payment mode', async () => {
      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ mode: '' as any })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. ORDER VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — order validation', () => {
    it('should reject payment for non-existent order (404)', async () => {
      setupTransaction({ order: null });

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject payment for cancelled order', async () => {
      setupTransaction({
        order: makeOrder({ status: OrderStatus.CANCELLED }),
      });

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should accept payment for RECEIVED order', async () => {
      setupTransaction({
        order: makeOrder({ status: OrderStatus.RECEIVED }),
        paymentResult: makePaymentResult(400),
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto());
      expect(result).toBeDefined();
    });

    it('should accept payment for PROCESSING order', async () => {
      setupTransaction({
        order: makeOrder({ status: OrderStatus.PROCESSING }),
        paymentResult: makePaymentResult(400),
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto());
      expect(result).toBeDefined();
    });

    it('should accept payment for READY order', async () => {
      setupTransaction({
        order: makeOrder({ status: OrderStatus.READY }),
        paymentResult: makePaymentResult(400),
      });

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto());
      expect(result).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. STORE ISOLATION — SECURITY
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — store isolation', () => {
    it('should reject payment for order in a different store (IDOR)', async () => {
      setupTransaction({
        order: makeOrder({ storeId: OTHER_STORE_ID }),
      });

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. RECORDED EMPLOYEE IDENTITY
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — employee identity', () => {
    it('should record the authenticated employee as receivedBy', async () => {
      let createdPaymentData: any;

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(makeOrder()),
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            create: jest.fn().mockImplementation(({ data }: any) => {
              createdPaymentData = data;
              return makePaymentResult(400);
            }),
          },
        };
        return cb(tx);
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto());

      // The employee ID must come from the controller (JWT), not from the DTO
      expect(createdPaymentData.receivedById).toBe(EMPLOYEE_ID);
    });

    it('should NOT use client-supplied employee identity', async () => {
      let createdPaymentData: any;

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(makeOrder()),
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            create: jest.fn().mockImplementation(({ data }: any) => {
              createdPaymentData = data;
              return makePaymentResult(400);
            }),
          },
        };
        return cb(tx);
      });

      // Even if someone tried to inject a different employee ID in the DTO,
      // the service uses the employeeId parameter (from JWT), not the DTO
      const dto = makeDto();
      (dto as any).recordedBy = 'malicious-emp-id';

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, dto);

      expect(createdPaymentData.receivedById).toBe(EMPLOYEE_ID);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 9. TRANSACTION CONSISTENCY
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — transaction consistency', () => {
    it('should use Serializable isolation level for concurrency safety', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400),
      });

      await service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto());

      // Verify $transaction was called with the Serializable isolation option
      const txCall = mockPrisma.$transaction.mock.calls[0];
      expect(txCall[1]).toEqual({
        isolationLevel: 'Serializable',
      });
    });

    it('should not create inconsistent state if payment.create fails', async () => {
      setupTransaction({
        order: makeOrder(),
        shouldFailOnCreate: new Error('DB write failed'),
      });

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto())).rejects.toThrow(
        'DB write failed',
      );

      // The transaction should roll back — no order update should persist
    });

    it('should not create inconsistent state if order.update fails', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400),
        shouldFailOnUpdate: new Error('Order update failed'),
      });

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto())).rejects.toThrow(
        'Order update failed',
      );

      // The transaction should roll back — payment should not persist
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 10. DUPLICATE / RETRY SAFETY
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — duplicate/retry behavior', () => {
    it('should reject second full payment after order is fully paid (amountDue = 0)', async () => {
      setupTransaction({
        order: makeOrder({
          totalAmount: 1000,
          amountPaid: 1000,
          amountDue: 0,
          paymentStatus: PaymentStatus.PAID,
        }),
      });

      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 1000 })),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject any payment when amountDue is 0', async () => {
      setupTransaction({
        order: makeOrder({
          totalAmount: 500,
          amountPaid: 500,
          amountDue: 0,
          paymentStatus: PaymentStatus.PAID,
        }),
      });

      await expect(
        service.recordPayment(EMPLOYEE_ID, STORE_ID, makeDto({ amount: 1 })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 11. DTO MAPPING
  // ═══════════════════════════════════════════════════════════════════

  describe('recordPayment — DTO mapping', () => {
    it('should return PaymentDTO with correct shape', async () => {
      setupTransaction({
        order: makeOrder(),
        paymentResult: makePaymentResult(400, { id: 'pay-abc', mode: 'UPI', reference: 'REF-X' }),
      });

      const result = await service.recordPayment(
        EMPLOYEE_ID,
        STORE_ID,
        makeDto({
          amount: 400,
          mode: PaymentMode.UPI,
          reference: 'REF-X',
        }),
      );

      expect(result).toEqual({
        id: 'pay-abc',
        orderId: ORDER_ID,
        amount: 400,
        mode: 'UPI',
        reference: 'REF-X',
        receivedById: EMPLOYEE_ID,
        receivedByName: EMPLOYEE_NAME,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 12. PAYMENT RETRIEVAL
  // ═══════════════════════════════════════════════════════════════════

  describe('getOrderPayments', () => {
    it('should return payments for the order in the same store', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        storeId: STORE_ID,
        payments: [
          {
            id: 'pay-1',
            orderId: ORDER_ID,
            amount: 400,
            mode: 'CASH',
            reference: null,
            receivedById: EMPLOYEE_ID,
            receivedBy: { name: EMPLOYEE_NAME },
            createdAt: new Date('2026-01-01T00:00:00Z'),
          },
          {
            id: 'pay-2',
            orderId: ORDER_ID,
            amount: 300,
            mode: 'UPI',
            reference: 'UPI-123',
            receivedById: EMPLOYEE_ID,
            receivedBy: { name: EMPLOYEE_NAME },
            createdAt: new Date('2026-01-02T00:00:00Z'),
          },
        ],
      });

      const result = await service.getOrderPayments(ORDER_ID, STORE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(400);
      expect(result[1].amount).toBe(300);
      expect(result[1].reference).toBe('UPI-123');
    });

    it('should return empty array when order has no payments', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        storeId: STORE_ID,
        payments: [],
      });

      const result = await service.getOrderPayments(ORDER_ID, STORE_ID);

      expect(result).toEqual([]);
    });

    it('should reject retrieval for non-existent order (404)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderPayments('non-existent-order', STORE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject cross-store payment retrieval (IDOR)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        storeId: OTHER_STORE_ID,
        payments: [
          {
            id: 'pay-secret',
            orderId: ORDER_ID,
            amount: 999,
            mode: 'CASH',
            reference: null,
            receivedById: 'emp-other',
            receivedBy: { name: 'Other Employee' },
            createdAt: new Date(),
          },
        ],
      });

      await expect(service.getOrderPayments(ORDER_ID, STORE_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not expose payment data when cross-store access is attempted', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: ORDER_ID,
        storeId: OTHER_STORE_ID,
        payments: [{ id: 'pay-secret', amount: 999 }],
      });

      try {
        await service.getOrderPayments(ORDER_ID, STORE_ID);
        fail('Expected ForbiddenException');
      } catch (e: any) {
        // The error message should NOT contain payment details
        expect(e.message).not.toContain('999');
        expect(e.message).not.toContain('pay-secret');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // C4: PAYMENT SUMMARY & RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════

  describe('getPaymentSummary', () => {
    function makeOrderWithPayments(
      overrides: Partial<{
        id: string;
        storeId: string;
        totalAmount: number;
        amountPaid: number;
        amountDue: number;
        paymentStatus: PaymentStatus;
        status: OrderStatus;
      }> = {},
      payments: { amount: number }[] = [],
    ) {
      return {
        id: overrides.id ?? ORDER_ID,
        storeId: overrides.storeId ?? STORE_ID,
        totalAmount: overrides.totalAmount ?? 1000,
        amountPaid: overrides.amountPaid ?? 0,
        amountDue: overrides.amountDue ?? 1000,
        paymentStatus: overrides.paymentStatus ?? PaymentStatus.PENDING,
        status: overrides.status ?? OrderStatus.RECEIVED,
        payments,
      };
    }

    it('should return correct summary with no payments', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(makeOrderWithPayments());

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.orderId).toBe(ORDER_ID);
      expect(summary.totalAmount).toBe(1000);
      expect(summary.amountPaid).toBe(0);
      expect(summary.amountDue).toBe(1000);
      expect(summary.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(summary.paymentCount).toBe(0);
      expect(summary.isConsistent).toBe(true);
    });

    it('should return PARTIAL status with one partial payment', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 400, amountDue: 600, paymentStatus: PaymentStatus.PARTIAL },
          [{ amount: 400 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.amountPaid).toBe(400);
      expect(summary.amountDue).toBe(600);
      expect(summary.paymentStatus).toBe(PaymentStatus.PARTIAL);
      expect(summary.paymentCount).toBe(1);
      expect(summary.isConsistent).toBe(true);
    });

    it('should return PARTIAL status with multiple partial payments (₹400 + ₹300)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 700, amountDue: 300, paymentStatus: PaymentStatus.PARTIAL },
          [{ amount: 400 }, { amount: 300 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.amountPaid).toBe(700);
      expect(summary.amountDue).toBe(300);
      expect(summary.paymentStatus).toBe(PaymentStatus.PARTIAL);
      expect(summary.paymentCount).toBe(2);
      expect(summary.isConsistent).toBe(true);
    });

    it('should return PAID status with full payment (₹1000)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 1000, amountDue: 0, paymentStatus: PaymentStatus.PAID },
          [{ amount: 1000 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.amountPaid).toBe(1000);
      expect(summary.amountDue).toBe(0);
      expect(summary.paymentStatus).toBe(PaymentStatus.PAID);
      expect(summary.paymentCount).toBe(1);
      expect(summary.isConsistent).toBe(true);
    });

    it('should handle floating-point edge: ₹400 + ₹600 = ₹1000 exactly', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 1000, amountDue: 0, paymentStatus: PaymentStatus.PAID },
          [{ amount: 400 }, { amount: 600 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.amountPaid).toBe(1000);
      expect(summary.amountDue).toBe(0);
      expect(summary.paymentStatus).toBe(PaymentStatus.PAID);
      expect(summary.isConsistent).toBe(true);
    });

    it('should preserve REFUNDED status and not overwrite it', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          {
            amountPaid: 1000,
            amountDue: 0,
            paymentStatus: PaymentStatus.REFUNDED,
          },
          [{ amount: 1000 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.paymentStatus).toBe(PaymentStatus.REFUNDED);
      expect(summary.isConsistent).toBe(true);
    });

    it('should detect inconsistency when persisted amountPaid differs from computed sum (Case A)', async () => {
      // Persisted says 600 paid, but actual payments sum to 700
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 600, amountDue: 300, paymentStatus: PaymentStatus.PARTIAL },
          [{ amount: 400 }, { amount: 300 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.amountPaid).toBe(700); // authoritative
      expect(summary.amountDue).toBe(300); // authoritative
      expect(summary.isConsistent).toBe(false);
    });

    it('should detect inconsistency when persisted amountDue differs from computed (Case B)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 700, amountDue: 400, paymentStatus: PaymentStatus.PARTIAL },
          [{ amount: 400 }, { amount: 300 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.isConsistent).toBe(false);
    });

    it('should detect inconsistency when persisted paymentStatus differs from computed (Case C)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 700, amountDue: 300, paymentStatus: PaymentStatus.PENDING },
          [{ amount: 400 }, { amount: 300 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.isConsistent).toBe(false);
    });

    it('should return true for isConsistent when all three match (Case D)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 700, amountDue: 300, paymentStatus: PaymentStatus.PARTIAL },
          [{ amount: 400 }, { amount: 300 }],
        ),
      );

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      expect(summary.isConsistent).toBe(true);
    });

    it('should detect overpayment as an invalid state and throw ConflictException', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments(
          { amountPaid: 1200, amountDue: -200, paymentStatus: PaymentStatus.PAID },
          [{ amount: 600 }, { amount: 600 }],
        ),
      );

      await expect(service.getPaymentSummary(ORDER_ID, STORE_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject non-existent order (404)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentSummary('non-existent', STORE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject cross-store access (IDOR)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments({ storeId: OTHER_STORE_ID }),
      );

      await expect(service.getPaymentSummary(ORDER_ID, STORE_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should never modify OrderStatus — payment reconciliation is independent', async () => {
      const orderData = makeOrderWithPayments(
        {
          status: OrderStatus.PROCESSING,
          amountPaid: 1000,
          amountDue: 0,
          paymentStatus: PaymentStatus.PAID,
        },
        [{ amount: 1000 }],
      );
      mockPrisma.order.findUnique.mockResolvedValue(orderData);

      const summary = await service.getPaymentSummary(ORDER_ID, STORE_ID);

      // Summary contains payment info, never OrderStatus
      expect(summary.paymentStatus).toBe(PaymentStatus.PAID);
      expect(summary).not.toHaveProperty('status');
      expect(summary).not.toHaveProperty('orderStatus');
    });

    it('should not leak cross-store financial data in error messages', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(
        makeOrderWithPayments({ storeId: OTHER_STORE_ID, totalAmount: 9999 }, [{ amount: 5000 }]),
      );

      try {
        await service.getPaymentSummary(ORDER_ID, STORE_ID);
        fail('Expected ForbiddenException');
      } catch (e: any) {
        expect(e.message).not.toContain('9999');
        expect(e.message).not.toContain('5000');
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// C4: derivePaymentStatus — Canonical Unit Tests
// ═══════════════════════════════════════════════════════════════════

describe('derivePaymentStatus', () => {
  it('should return PENDING when amountPaid is 0', () => {
    expect(derivePaymentStatus(0, 1000, PaymentStatus.PENDING)).toBe(PaymentStatus.PENDING);
  });

  it('should return PARTIAL when 0 < amountPaid < totalAmount', () => {
    expect(derivePaymentStatus(400, 1000, PaymentStatus.PENDING)).toBe(PaymentStatus.PARTIAL);
  });

  it('should return PAID when amountPaid equals totalAmount', () => {
    expect(derivePaymentStatus(1000, 1000, PaymentStatus.PENDING)).toBe(PaymentStatus.PAID);
  });

  it('should throw ConflictException when amountPaid exceeds totalAmount', () => {
    expect(() => derivePaymentStatus(1200, 1000, PaymentStatus.PARTIAL)).toThrow(ConflictException);
  });

  it('should preserve REFUNDED status and never overwrite it', () => {
    expect(derivePaymentStatus(0, 1000, PaymentStatus.REFUNDED)).toBe(PaymentStatus.REFUNDED);
    expect(derivePaymentStatus(500, 1000, PaymentStatus.REFUNDED)).toBe(PaymentStatus.REFUNDED);
    expect(derivePaymentStatus(1000, 1000, PaymentStatus.REFUNDED)).toBe(PaymentStatus.REFUNDED);
  });

  it('should handle floating-point precision: 1000 - 400 - 600 = 0', () => {
    const paid = Number((400 + 600).toFixed(2));
    expect(derivePaymentStatus(paid, 1000, PaymentStatus.PARTIAL)).toBe(PaymentStatus.PAID);
  });

  it('should not produce false PARTIAL for tiny float residuals', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    const paid = Number((0.1 + 0.2).toFixed(2));
    expect(derivePaymentStatus(paid, 0.3, PaymentStatus.PENDING)).toBe(PaymentStatus.PAID);
  });

  it('should transition from PARTIAL to PAID correctly', () => {
    expect(derivePaymentStatus(1000, 1000, PaymentStatus.PARTIAL)).toBe(PaymentStatus.PAID);
  });

  it('should transition from PENDING to PARTIAL correctly', () => {
    expect(derivePaymentStatus(1, 1000, PaymentStatus.PENDING)).toBe(PaymentStatus.PARTIAL);
  });
});
