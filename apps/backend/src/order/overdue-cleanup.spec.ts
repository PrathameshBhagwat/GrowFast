import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { BusinessSequenceService } from '../prisma/business-sequence.service';
import { OrderStatus, PaymentStatus } from '@growfast/shared-types';

describe('90-Day Overdue Cleanup & Overdue Filtering Service Tests', () => {
  let orderService: OrderService;
  let mockPrisma: any;
  let mockPaymentService: any;

  const FIXED_NOW = new Date('2026-11-03T12:00:00.000Z');
  const STORE_ID = 'store-test-1';
  const OWNER_ID = 'owner-emp-1';
  const COUNTER_ID = 'counter-emp-2';

  beforeEach(async () => {
    mockPrisma = {
      order: {
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        return await cb(mockPrisma);
      }),
    };

    mockPaymentService = {
      calculateOrderFinancialState: jest.fn((order) => ({
        totalAmount: order.totalAmount || 0,
        amountPaid: order.amountPaid || 0,
        amountDue: (order.totalAmount || 0) - (order.amountPaid || 0),
        refundAmount: 0,
        storeCreditAmount: 0,
        effectivePaid: order.amountPaid || 0,
        paymentStatus:
          order.amountPaid >= order.totalAmount
            ? PaymentStatus.PAID
            : order.amountPaid > 0
              ? PaymentStatus.PARTIAL
              : PaymentStatus.PENDING,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: CatalogService, useValue: {} },
        { provide: NotificationService, useValue: { createNotificationEvent: jest.fn() } },
        { provide: BusinessSequenceService, useValue: {} },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('find90DayOverdueCleanupOrders', () => {
    it('1. order overdue by 89 days is not included in eligible list', async () => {
      const due89Days = new Date(FIXED_NOW.getTime() - 89 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-89',
          orderNumber: 'GF-089',
          customerId: 'c1',
          effectiveDueDate: due89Days,
          orderDate: new Date('2026-05-01'),
          status: OrderStatus.READY,
          totalAmount: 500,
          amountPaid: 0,
          items: [],
          payments: [],
          photos: [],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(0);
      expect(result.totalEligibleCount).toBe(0);
    });

    it('2. order overdue by exactly 90 days is not eligible (strictly more than 90 days required)', async () => {
      const due90Days = new Date(FIXED_NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-90',
          orderNumber: 'GF-090',
          customerId: 'c1',
          effectiveDueDate: due90Days,
          orderDate: new Date('2026-05-01'),
          status: OrderStatus.READY,
          totalAmount: 500,
          amountPaid: 0,
          items: [],
          payments: [],
          photos: [],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(0);
      expect(result.totalEligibleCount).toBe(0);
    });

    it('3. order overdue by 91 days IS eligible and returned with full details', async () => {
      const due91Days = new Date(FIXED_NOW.getTime() - 91 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-91',
          orderNumber: 'GF-091',
          customerId: 'c1',
          customer: { name: 'Sunil Patil', phone: '9876543210' },
          effectiveDueDate: due91Days,
          orderDate: new Date('2026-05-01'),
          status: OrderStatus.PROCESSING,
          totalAmount: 850,
          amountPaid: 200,
          items: [{ quantity: 3, garmentCatalog: { name: 'Shirt' } }],
          payments: [{ id: 'p1', amount: 200 }],
          photos: [{ id: 'ph1' }],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(1);
      expect(result.totalEligibleCount).toBe(1);
      const order = result.eligibleOrders[0];
      expect(order.orderNumber).toBe('GF-091');
      expect(order.daysOverdue).toBe(91);
      expect(order.hasPayments).toBe(true);
      expect(order.paymentCount).toBe(1);
      expect(order.hasPhotos).toBe(true);
      expect(order.photoCount).toBe(1);
      expect(order.hasDeliveryRecords).toBe(false);
      expect(order.amountDue).toBe(650);
    });

    it('4. order creation date does not determine cleanup eligibility (created 100 days ago, due 10 days ago)', async () => {
      const due10Days = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-created-old',
          orderNumber: 'GF-OLD',
          customerId: 'c1',
          effectiveDueDate: due10Days,
          orderDate: new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000), // Created 100 days ago
          status: OrderStatus.READY,
          totalAmount: 300,
          amountPaid: 0,
          items: [],
          payments: [],
          photos: [],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(0);
    });

    it('5. delivered orders are excluded even if overdue by > 90 days', async () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-deliv',
          orderNumber: 'GF-DELIV',
          customerId: 'c1',
          effectiveDueDate: due100Days,
          orderDate: new Date('2026-05-01'),
          status: OrderStatus.DELIVERED,
          totalAmount: 400,
          amountPaid: 400,
          items: [],
          payments: [],
          photos: [],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(0);
    });

    it('6. orders without due dates are excluded', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-nodue',
          orderNumber: 'GF-NODUE',
          customerId: 'c1',
          effectiveDueDate: null,
          orderDate: new Date('2026-05-01'),
          status: OrderStatus.PROCESSING,
          totalAmount: 400,
          amountPaid: 0,
          items: [],
          payments: [],
          photos: [],
          deliveryRecords: [],
          adjustments: [],
          isArchived: false,
        },
      ]);

      const result = await orderService.find90DayOverdueCleanupOrders(STORE_ID);
      expect(result.eligibleOrders).toHaveLength(0);
    });
  });

  describe('archiveOverdueOrders', () => {
    const due95Days = new Date(FIXED_NOW.getTime() - 95 * 24 * 60 * 60 * 1000);

    it('7. unauthorized employees (non-owner) cannot archive orders', async () => {
      await expect(
        orderService.archiveOverdueOrders({ orderIds: ['ord-1'] }, STORE_ID, COUNTER_ID, 'COUNTER'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('8. an authorized owner can archive eligible orders', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-1',
          orderNumber: 'GF-001',
          storeId: STORE_ID,
          effectiveDueDate: due95Days,
          status: OrderStatus.READY,
          isArchived: false,
        },
      ]);
      mockPrisma.order.updateMany.mockResolvedValueOnce({ count: 1 });

      const response = await orderService.archiveOverdueOrders(
        { orderIds: ['ord-1'], reason: 'Annual uncollected inventory cleanup' },
        STORE_ID,
        OWNER_ID,
        'OWNER',
      );

      expect(response.success).toBe(true);
      expect(response.archivedCount).toBe(1);
      expect(response.orderIds).toEqual(['ord-1']);
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ord-1'] }, storeId: STORE_ID, isArchived: false },
        data: expect.objectContaining({
          isArchived: true,
          archivedById: OWNER_ID,
          archivedReason: 'Annual uncollected inventory cleanup',
        }),
      });
    });

    it('9. an order that becomes ineligible (e.g. DELIVERED) before confirmation cannot be archived', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-delivered',
          orderNumber: 'GF-DELIV-2',
          storeId: STORE_ID,
          effectiveDueDate: due95Days,
          status: OrderStatus.DELIVERED, // customer picked it up right before cleanup!
          isArchived: false,
        },
      ]);

      await expect(
        orderService.archiveOverdueOrders(
          { orderIds: ['ord-delivered'] },
          STORE_ID,
          OWNER_ID,
          'OWNER',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('10. repeated requests do not duplicate cleanup on already archived orders', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-archived',
          orderNumber: 'GF-ARCHIVED',
          storeId: STORE_ID,
          effectiveDueDate: due95Days,
          status: OrderStatus.READY,
          isArchived: true, // already archived!
        },
      ]);

      await expect(
        orderService.archiveOverdueOrders(
          { orderIds: ['ord-archived'] },
          STORE_ID,
          OWNER_ID,
          'OWNER',
        ),
      ).rejects.toThrow(/already archived/i);
    });

    it('11. rejects orders that do not belong to the store', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([]); // order not found for STORE_ID

      await expect(
        orderService.archiveOverdueOrders(
          { orderIds: ['ord-foreign'] },
          STORE_ID,
          OWNER_ID,
          'OWNER',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllOrders with Overdue & Archive filtering', () => {
    it('12. excludes archived orders by default from normal order lists', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([]);
      mockPrisma.order.count.mockResolvedValueOnce(0);

      await orderService.findAllOrders({ page: 1, pageSize: 10 }, STORE_ID);

      const queryArg = mockPrisma.order.findMany.mock.calls[0][0];
      expect(queryArg.where.isArchived).toBe(false);
      expect(queryArg.where.storeId).toBe(STORE_ID);
    });

    it('13. query with isOverdue=true filters orders with effectiveDueDate < now and non-delivered/cancelled status', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([]);
      mockPrisma.order.count.mockResolvedValueOnce(0);

      await orderService.findAllOrders({ isOverdue: true }, STORE_ID);

      const queryArg = mockPrisma.order.findMany.mock.calls[0][0];
      expect(queryArg.where.isArchived).toBe(false);
      expect(queryArg.where.effectiveDueDate.lt).toBeInstanceOf(Date);
      expect(queryArg.where.status.notIn).toEqual([OrderStatus.DELIVERED, OrderStatus.CANCELLED]);
    });

    it('14. query with isOverdue=false excludes overdue orders', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([]);
      mockPrisma.order.count.mockResolvedValueOnce(0);

      await orderService.findAllOrders(
        { isOverdue: false, status: OrderStatus.PROCESSING },
        STORE_ID,
      );

      const queryArg = mockPrisma.order.findMany.mock.calls[0][0];
      expect(queryArg.where.isArchived).toBe(false);
      expect(queryArg.where.status).toBe(OrderStatus.PROCESSING);
      expect(queryArg.where.OR).toBeDefined();
    });
  });
});
