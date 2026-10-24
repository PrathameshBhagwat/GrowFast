import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
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

const EMPLOYEE_ID = 'emp-001';
const STORE_ID = 'store-main';
const OTHER_STORE_ID = 'store-secondary';
const ORDER_ID = 'order-test-001';

describe('PaymentService — Idempotency Readiness', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockNotification: any;

  function makeOrder(overrides: any = {}) {
    return {
      id: ORDER_ID,
      storeId: STORE_ID,
      totalAmount: 1000,
      amountPaid: 0,
      amountDue: 1000,
      paymentStatus: PaymentStatus.PENDING,
      status: OrderStatus.RECEIVED,
      adjustments: [],
      payments: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockNotification = {
      createNotificationEvent: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    mockPrisma = {
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('1. First Successful Payment Recording', () => {
    it('records a new payment with an idempotencyKey and persists it atomically', async () => {
      const order = makeOrder();
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.findUnique.mockResolvedValue(null); // No previous payment with this key

      const paymentRecord = {
        id: 'pay-001',
        orderId: ORDER_ID,
        amount: 500,
        mode: 'UPI',
        reference: 'UPI-REF-001',
        receivedById: EMPLOYEE_ID,
        idempotencyKey: 'idemp-key-12345',
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Staff User' },
      };
      mockPrisma.payment.create.mockResolvedValue(paymentRecord);
      mockPrisma.order.update.mockResolvedValue({ ...order, amountPaid: 500, amountDue: 500 });

      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500,
        mode: PaymentMode.UPI,
        reference: 'UPI-REF-001',
        idempotencyKey: 'idemp-key-12345',
      };

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, dto);

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: 'idemp-key-12345' },
        include: { receivedBy: true },
      });
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: ORDER_ID,
          amount: 500,
          mode: PaymentMode.UPI,
          reference: 'UPI-REF-001',
          receivedById: EMPLOYEE_ID,
          idempotencyKey: 'idemp-key-12345',
        },
        include: { receivedBy: true },
      });
      expect(result.id).toBe('pay-001');
      expect(result.idempotencyKey).toBe('idemp-key-12345');
    });
  });

  describe('2. Repeated Payment Submission (Same Key & Same Payload)', () => {
    it('returns the existing payment record without creating duplicate payment or double charging', async () => {
      const existingPayment = {
        id: 'pay-001',
        orderId: ORDER_ID,
        amount: 500,
        mode: 'UPI',
        reference: 'UPI-REF-001',
        receivedById: EMPLOYEE_ID,
        idempotencyKey: 'idemp-key-12345',
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Staff User' },
      };

      // Mock finding the existing payment
      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500,
        mode: PaymentMode.UPI,
        reference: 'UPI-REF-001',
        idempotencyKey: 'idemp-key-12345',
      };

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, dto);

      // Verify payment was NOT created again
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
      // Verify order totals were NOT updated again
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      // Result matches existing payment
      expect(result.id).toBe('pay-001');
      expect(result.amount).toBe(500);
      expect(result.idempotencyKey).toBe('idemp-key-12345');
    });
  });

  describe('3. Conflicting Payment Payload Reuse (Same Key, Different Payload)', () => {
    it('rejects with ConflictException (409) if the amount differs', async () => {
      const existingPayment = {
        id: 'pay-001',
        orderId: ORDER_ID,
        amount: 500,
        mode: 'UPI',
        reference: 'UPI-REF-001',
        receivedById: EMPLOYEE_ID,
        idempotencyKey: 'idemp-key-12345',
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Staff User' },
      };
      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const conflictingDto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 700, // Different amount!
        mode: PaymentMode.UPI,
        idempotencyKey: 'idemp-key-12345',
      };

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, conflictingDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });

    it('rejects with ConflictException (409) if the payment mode differs', async () => {
      const existingPayment = {
        id: 'pay-001',
        orderId: ORDER_ID,
        amount: 500,
        mode: 'UPI',
        reference: 'UPI-REF-001',
        receivedById: EMPLOYEE_ID,
        idempotencyKey: 'idemp-key-12345',
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Staff User' },
      };
      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const conflictingDto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500,
        mode: PaymentMode.CASH, // Different mode!
        idempotencyKey: 'idemp-key-12345',
      };

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, conflictingDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects with ConflictException (409) if the orderId differs', async () => {
      const existingPayment = {
        id: 'pay-001',
        orderId: ORDER_ID,
        amount: 500,
        mode: 'UPI',
        reference: 'UPI-REF-001',
        receivedById: EMPLOYEE_ID,
        idempotencyKey: 'idemp-key-12345',
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Staff User' },
      };
      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const conflictingDto: RecordPaymentRequest = {
        orderId: 'order-different-999', // Different order!
        amount: 500,
        mode: PaymentMode.UPI,
        idempotencyKey: 'idemp-key-12345',
      };

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, conflictingDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('4. Concurrent Duplicate Payment Requests (Simulated DB Constraint Conflict)', () => {
    it('gracefully recovers from P2002 unique constraint conflict and returns existing payment', async () => {
      const order = makeOrder();
      mockPrisma.order.findUnique.mockResolvedValue(order);

      // In a race condition:
      // Inside transaction, payment was not yet found initially
      mockPrisma.payment.findUnique
        .mockResolvedValueOnce(null)
        // But after transaction fails with P2002, re-query finds the winner's payment
        .mockResolvedValueOnce({
          id: 'pay-concurrent-winner',
          orderId: ORDER_ID,
          amount: 500,
          mode: 'UPI',
          reference: 'REF-CONCURRENT',
          receivedById: EMPLOYEE_ID,
          idempotencyKey: 'idemp-key-race',
          createdAt: new Date('2026-10-22T10:00:00Z'),
          receivedBy: { name: 'Staff User' },
        });

      // Payment creation throws P2002 unique constraint on idempotency_key due to concurrent insert
      const p2002Error: any = new Error(
        'Unique constraint failed on the fields: (`idempotency_key`)',
      );
      p2002Error.code = 'P2002';
      mockPrisma.payment.create.mockRejectedValueOnce(p2002Error);

      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500,
        mode: PaymentMode.UPI,
        reference: 'REF-CONCURRENT',
        idempotencyKey: 'idemp-key-race',
      };

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, dto);

      expect(result.id).toBe('pay-concurrent-winner');
      expect(result.idempotencyKey).toBe('idemp-key-race');
    });
  });

  describe('5. Website Clients without Idempotency Key (Backward Compatibility)', () => {
    it('successfully processes payment when idempotencyKey is omitted', async () => {
      const order = makeOrder();
      mockPrisma.order.findUnique.mockResolvedValue(order);

      const paymentRecord = {
        id: 'pay-legacy-001',
        orderId: ORDER_ID,
        amount: 250,
        mode: 'CASH',
        reference: null,
        receivedById: EMPLOYEE_ID,
        idempotencyKey: null,
        createdAt: new Date('2026-10-22T10:00:00Z'),
        receivedBy: { name: 'Counter Staff' },
      };
      mockPrisma.payment.create.mockResolvedValue(paymentRecord);
      mockPrisma.order.update.mockResolvedValue({ ...order, amountPaid: 250, amountDue: 750 });

      // Client does not supply idempotencyKey
      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 250,
        mode: PaymentMode.CASH,
      };

      const result = await service.recordPayment(EMPLOYEE_ID, STORE_ID, dto);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: {
          orderId: ORDER_ID,
          amount: 250,
          mode: PaymentMode.CASH,
          reference: null,
          receivedById: EMPLOYEE_ID,
          idempotencyKey: null,
        },
        include: { receivedBy: true },
      });
      expect(result.id).toBe('pay-legacy-001');
      expect(result.idempotencyKey).toBeNull();
    });
  });

  describe('6. Store Isolation and Financial Validation', () => {
    it('rejects payment for order belonging to a different store (IDOR)', async () => {
      const foreignOrder = makeOrder({ storeId: OTHER_STORE_ID });
      mockPrisma.order.findUnique.mockResolvedValue(foreignOrder);
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500,
        mode: PaymentMode.CASH,
        idempotencyKey: 'key-cross-store',
      };

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects overpayment even when idempotencyKey is provided', async () => {
      const order = makeOrder({ amountDue: 200 });
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      const dto: RecordPaymentRequest = {
        orderId: ORDER_ID,
        amount: 500, // Exceeds 200
        mode: PaymentMode.CASH,
        idempotencyKey: 'key-overpay',
      };

      await expect(service.recordPayment(EMPLOYEE_ID, STORE_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
