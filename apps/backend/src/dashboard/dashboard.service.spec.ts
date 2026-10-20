import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const STORE_A = 'store-a';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrisma = {
    order: {
      groupBy: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    orderItem: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    financialAdjustment: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    deliveryRecord: {
      groupBy: jest.fn(),
    },
    customer: {
      count: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  const startDate = new Date('2026-09-01T00:00:00Z');
  const endDate = new Date('2026-09-01T23:59:59Z');

  function setupEmptyMocks() {
    mockPrisma.order.groupBy.mockResolvedValue([]);
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: null, amountDue: null },
      _count: { id: 0 },
    });
    mockPrisma.payment.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    });
    mockPrisma.financialAdjustment.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    });
    mockPrisma.orderItem.count.mockResolvedValue(0);
    mockPrisma.orderItem.findMany.mockResolvedValue([]);
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.financialAdjustment.findMany.mockResolvedValue([]);
    mockPrisma.deliveryRecord.groupBy.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
  }

  function setupPopulatedMocks() {
    // 1. Order groupBy status & paymentStatus
    mockPrisma.order.groupBy
      .mockResolvedValueOnce([
        { status: 'RECEIVED', _count: { id: 5 } },
        { status: 'PROCESSING', _count: { id: 3 } },
        { status: 'READY', _count: { id: 2 } },
        { status: 'DELIVERED', _count: { id: 10 } },
        { status: 'CANCELLED', _count: { id: 1 } },
      ])
      .mockResolvedValueOnce([
        { paymentStatus: 'PAID', _count: { id: 8 } },
        { paymentStatus: 'PARTIAL', _count: { id: 5 } },
        { paymentStatus: 'PENDING', _count: { id: 8 } },
      ]);

    // 2. Order counts: overdue, dueToday, dueTomorrow
    // Later Promise.all also counts pendingPaymentCount
    mockPrisma.order.count
      .mockResolvedValueOnce(3) // overdue
      .mockResolvedValueOnce(2) // dueToday
      .mockResolvedValueOnce(1) // dueTomorrow
      .mockResolvedValueOnce(6); // pendingPaymentCount

    // 3. Total items count
    mockPrisma.orderItem.count.mockResolvedValue(45);

    // 4. Financial aggregates
    // Order.aggregate calls: 1) bookedAgg, 2) outstandingAgg, 3) prevBookedAgg
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: 15000 },
        _count: { id: 21 },
      })
      .mockResolvedValueOnce({
        _sum: { amountDue: 5500 },
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: 12000 },
        _count: { id: 16 },
      });

    // Payment.aggregate calls: 1) period collections, 2) prev collections
    mockPrisma.payment.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: 10000 },
        _count: { id: 15 },
      })
      .mockResolvedValueOnce({
        _sum: { amount: 8000 },
        _count: { id: 12 },
      });

    // FinancialAdjustment.aggregate calls: 1) period refunds, 2) prev refunds
    mockPrisma.financialAdjustment.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: 500 },
        _count: { id: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { amount: 200 },
        _count: { id: 1 },
      });

    // 5. Delivery groupBy
    mockPrisma.deliveryRecord.groupBy.mockResolvedValue([
      { status: 'SCHEDULED', _count: { id: 2 } },
      { status: 'IN_TRANSIT', _count: { id: 3 } },
      { status: 'COMPLETED', _count: { id: 7 } },
      { status: 'FAILED', _count: { id: 1 } },
    ]);

    // 6. Customer counts: total, new in period
    mockPrisma.customer.count
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(5); // new in period

    // 7. Trend data:
    mockPrisma.order.findMany
      // 1st findMany: trendOrders
      .mockResolvedValueOnce([{ orderDate: new Date('2026-09-01T10:00:00Z'), totalAmount: 15000 }])
      // 2nd findMany: overdueActionOrdersRaw
      .mockResolvedValueOnce([
        {
          id: 'ord-overdue-1',
          orderNumber: 'ORD-99',
          totalAmount: 1000,
          amountPaid: 0,
          amountDue: 1000,
          status: 'PROCESSING',
          effectiveDueDate: new Date('2026-08-30T10:00:00Z'),
          orderDate: new Date('2026-08-28T10:00:00Z'),
          customer: { name: 'Karan Mehra', phone: '9811122233' },
          _count: { items: 2 },
        },
      ])
      // 3rd findMany: dueTodayActionOrdersRaw
      .mockResolvedValueOnce([
        {
          id: 'ord-today-1',
          orderNumber: 'ORD-100',
          totalAmount: 800,
          amountPaid: 400,
          amountDue: 400,
          status: 'PROCESSING',
          effectiveDueDate: new Date('2026-09-01T12:00:00Z'),
          orderDate: new Date('2026-08-31T10:00:00Z'),
          customer: { name: 'Suman Rao', phone: '9822233344' },
          _count: { items: 1 },
        },
      ])
      // 4th findMany: dueTomorrowActionOrdersRaw
      .mockResolvedValueOnce([])
      // 5th findMany: pendingPaymentOrdersRaw
      .mockResolvedValueOnce([
        {
          id: 'ord-pending-1',
          orderNumber: 'ORD-99',
          totalAmount: 1000,
          amountPaid: 0,
          amountDue: 1000,
          status: 'PROCESSING',
          effectiveDueDate: new Date('2026-08-30T10:00:00Z'),
          orderDate: new Date('2026-08-28T10:00:00Z'),
          customer: { name: 'Karan Mehra', phone: '9811122233' },
          _count: { items: 2 },
        },
      ])
      // 6th findMany: readyOrdersRaw
      .mockResolvedValueOnce([
        {
          id: 'order-ready-1',
          orderNumber: 'ORD-101',
          totalAmount: 500,
          amountPaid: 300,
          amountDue: 200,
          customer: { name: 'Rahul Sharma', phone: '9876543210' },
          items: [
            {
              itemStatus: 'READY',
              quantity: 2,
              garmentCatalog: { name: 'Shirt' },
            },
            {
              itemStatus: 'PROCESSING',
              quantity: 1,
              garmentCatalog: { name: 'Pants' },
            },
            {
              itemStatus: 'CANCELLED',
              quantity: 1,
              garmentCatalog: { name: 'Tie' },
            },
          ],
        },
      ])
      // 7th findMany: recentOrdersRaw
      .mockResolvedValueOnce([
        {
          id: 'order-rec-1',
          orderNumber: 'ORD-102',
          totalAmount: 1200,
          amountPaid: 1200,
          amountDue: 0,
          status: 'RECEIVED',
          paymentStatus: 'PAID',
          orderDate: new Date('2026-09-01T14:30:00Z'),
          customer: { name: 'Priya Patel' },
          _count: { items: 3 },
        },
      ])
      // 8th findMany: orderNumberMap lookup for activity
      .mockResolvedValueOnce([
        {
          id: 'order-ready-1',
          orderNumber: 'ORD-101',
        },
      ]);

    // Trend payments
    mockPrisma.payment.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-09-01T11:00:00Z'), amount: 10000 },
    ]);

    // Trend refunds
    mockPrisma.financialAdjustment.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-09-01T12:00:00Z'), amount: 500 },
    ]);

    // OrderItems for service & category breakdown
    mockPrisma.orderItem.findMany.mockResolvedValueOnce([
      {
        quantity: 3,
        lineTotal: 450,
        serviceType: { name: 'Dry Cleaning', category: 'DRY_CLEAN' },
        garmentCatalog: { category: 'MEN' },
      },
      {
        quantity: 2,
        lineTotal: 200,
        serviceType: { name: 'Steam Press', category: 'STEAM_PRESS' },
        garmentCatalog: { category: 'WOMEN' },
      },
    ]);

    // Notification activity findMany
    mockPrisma.notification.findMany.mockResolvedValueOnce([
      {
        id: 'notif-1',
        eventType: 'ORDER_READY',
        orderId: 'order-ready-1',
        createdAt: new Date('2026-09-01T15:00:00Z'),
      },
    ]);
  }

  // ─── BASIC FUNCTIONALITY & BACKWARD COMPATIBILITY ─────────────

  it('should return a complete dashboard summary with populated data and Step 1 aggregates', async () => {
    setupPopulatedMocks();

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.period.startDate).toBe(startDate.toISOString());
    expect(result.period.endDate).toBe(endDate.toISOString());

    // Overview
    expect(result.overview.totalOrders).toBe(21);
    expect(result.overview.totalItems).toBe(45);
    expect(result.overview.totalCustomers).toBe(50);

    // Orders
    expect(result.orders.received).toBe(5);
    expect(result.orders.processing).toBe(3);
    expect(result.orders.ready).toBe(2);
    expect(result.orders.delivered).toBe(10);
    expect(result.orders.cancelled).toBe(1);
    expect(result.orders.overdue).toBe(3);
    expect(result.orders.dueToday).toBe(2);
    expect(result.orders.dueTomorrow).toBe(1);

    // Financial
    expect(result.financial.totalOrderValue).toBe(15000);
    expect(result.financial.amountPaid).toBe(10000); // Collections from Payment.createdAt
    expect(result.financial.amountDue).toBe(5500); // Store-wide outstanding balance
    expect(result.financial.bookedOrderValue).toBe(15000);
    expect(result.financial.collections).toBe(10000);
    expect(result.financial.refunds).toBe(500);
    expect(result.financial.netCollections).toBe(9500);
    expect(result.financial.outstandingBalance).toBe(5500);
    expect(result.financial.collectionCount).toBe(15);
    expect(result.financial.refundCount).toBe(1);

    // Delivery
    expect(result.delivery.scheduled).toBe(2);
    expect(result.delivery.inTransit).toBe(3);
    expect(result.delivery.completed).toBe(7);
    expect(result.delivery.failed).toBe(1);
    expect(result.delivery.assigned).toBe(0);

    // Customers
    expect(result.customers.total).toBe(50);
    expect(result.customers.newInPeriod).toBe(5);

    // Comparisons
    expect(result.comparison).toBeDefined();
    expect(result.comparison?.bookedOrderValue.current).toBe(15000);
    expect(result.comparison?.bookedOrderValue.previous).toBe(12000);
    expect(result.comparison?.bookedOrderValue.absoluteChange).toBe(3000);
    expect(result.comparison?.bookedOrderValue.percentageChange).toBe(25); // (15000 - 12000)/12000 = +25%

    expect(result.comparison?.collections.current).toBe(10000);
    expect(result.comparison?.collections.previous).toBe(8000);
    expect(result.comparison?.collections.percentageChange).toBe(25);

    expect(result.comparison?.netCollections.current).toBe(9500); // 10000 - 500
    expect(result.comparison?.netCollections.previous).toBe(7800); // 8000 - 200

    // Trends
    expect(result.trends).toBeDefined();
    expect(result.trends?.points.length).toBeGreaterThan(0);
    const dayPoint = result.trends?.points.find((p) => p.bookedOrderValue > 0);
    expect(dayPoint?.bookedOrderValue).toBe(15000);
    expect(dayPoint?.collections).toBe(10000);
    expect(dayPoint?.refunds).toBe(500);
    expect(dayPoint?.netCollections).toBe(9500);

    // Service Breakdown
    expect(result.serviceBreakdown).toHaveLength(2);
    expect(result.serviceBreakdown?.[0].serviceName).toBe('Dry Cleaning');
    expect(result.serviceBreakdown?.[0].totalAmount).toBe(450);

    // Category Breakdown
    expect(result.categoryBreakdown).toHaveLength(2);
    expect(result.categoryBreakdown?.[0].category).toBe('MEN');
    expect(result.categoryBreakdown?.[0].totalAmount).toBe(450);

    // Action Queues
    expect(result.actionQueues?.overdue.count).toBe(3);
    expect(result.actionQueues?.overdue.items).toHaveLength(1);
    expect(result.actionQueues?.overdue.items[0].orderNumber).toBe('ORD-99');
    expect(result.actionQueues?.dueToday.count).toBe(2);
    expect(result.actionQueues?.dueToday.items).toHaveLength(1);
    expect(result.actionQueues?.dueToday.items[0].orderNumber).toBe('ORD-100');
    expect(result.actionQueues?.pendingPayment.count).toBe(6);
    expect(result.actionQueues?.pendingPayment.totalAmountDue).toBe(5500);
    expect(result.actionQueues?.pendingPayment.items[0].orderNumber).toBe('ORD-99');

    // Ready Orders & Recent Orders preserved
    expect(result.readyOrders).toHaveLength(1);
    expect(result.readyOrders[0].orderNumber).toBe('ORD-101');
    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0].orderNumber).toBe('ORD-102');
  });

  // ─── EMPTY STORE ──────────────────────────────────────────────

  it('should return all zeros, empty queues, and safe zero comparison for an empty store', async () => {
    setupEmptyMocks();

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.overview.totalOrders).toBe(0);
    expect(result.overview.totalItems).toBe(0);
    expect(result.overview.totalCustomers).toBe(0);
    expect(result.orders.received).toBe(0);
    expect(result.orders.overdue).toBe(0);
    expect(result.financial.totalOrderValue).toBe(0);
    expect(result.financial.amountPaid).toBe(0);
    expect(result.financial.amountDue).toBe(0);
    expect(result.financial.bookedOrderValue).toBe(0);
    expect(result.financial.collections).toBe(0);
    expect(result.financial.refunds).toBe(0);
    expect(result.financial.netCollections).toBe(0);
    expect(result.financial.outstandingBalance).toBe(0);
    expect(result.readyOrders).toEqual([]);
    expect(result.recentOrders).toEqual([]);
    expect(result.recentActivity).toEqual([]);

    // Comparison with zero previous
    expect(result.comparison?.bookedOrderValue.current).toBe(0);
    expect(result.comparison?.bookedOrderValue.previous).toBe(0);
    expect(result.comparison?.bookedOrderValue.percentageChange).toBe(0);

    // Queues
    expect(result.actionQueues?.overdue.count).toBe(0);
    expect(result.actionQueues?.overdue.items).toEqual([]);
    expect(result.actionQueues?.pendingPayment.count).toBe(0);
    expect(result.actionQueues?.pendingPayment.totalAmountDue).toBe(0);
  });

  // ─── FINANCIAL REPAIRS SPECIFIC TESTS ─────────────────────────

  it('should calculate period collections from Payment.createdAt, not Order.amountPaid', async () => {
    setupEmptyMocks();

    mockPrisma.payment.aggregate.mockResolvedValueOnce({
      _sum: { amount: 3500 },
      _count: { id: 4 },
    });

    const result = await service.getSummary(STORE_A, startDate, endDate);

    // Verify Payment aggregate was called with order.storeId and createdAt dateFilter
    expect(mockPrisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          order: { storeId: STORE_A },
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    );

    expect(result.financial.collections).toBe(3500);
    expect(result.financial.collectionCount).toBe(4);
  });

  it('should aggregate completed refunds and compute netCollections', async () => {
    setupEmptyMocks();

    mockPrisma.payment.aggregate.mockResolvedValueOnce({
      _sum: { amount: 5000 },
      _count: { id: 5 },
    });
    mockPrisma.financialAdjustment.aggregate.mockResolvedValueOnce({
      _sum: { amount: 800 },
      _count: { id: 2 },
    });

    const result = await service.getSummary(STORE_A, startDate, endDate);

    // Verify FinancialAdjustment query filters
    expect(mockPrisma.financialAdjustment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          order: { storeId: STORE_A },
          type: 'REFUND',
          status: 'COMPLETED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
    );

    expect(result.financial.collections).toBe(5000);
    expect(result.financial.refunds).toBe(800);
    expect(result.financial.netCollections).toBe(4200);
    expect(result.financial.refundCount).toBe(2);
  });

  it('should compute live store-wide outstanding balance excluding CANCELLED orders independent of reporting period', async () => {
    setupEmptyMocks();

    mockPrisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 1000 }, _count: { id: 1 } }) // booked
      .mockResolvedValueOnce({ _sum: { amountDue: 4500 } }); // outstanding

    const result = await service.getSummary(STORE_A, startDate, endDate);

    // Outstanding balance query should NOT have orderDate filter
    const outstandingCall = mockPrisma.order.aggregate.mock.calls[1][0];
    expect(outstandingCall.where.storeId).toBe(STORE_A);
    expect(outstandingCall.where.status).toEqual({ not: 'CANCELLED' });
    expect(outstandingCall.where.amountDue).toEqual({ gt: 0 });
    expect(outstandingCall.where.orderDate).toBeUndefined();

    expect(result.financial.outstandingBalance).toBe(4500);
    expect(result.financial.amountDue).toBe(4500);
  });

  // ─── OPERATIONAL & TIMEZONE BOUNDARIES ────────────────────────

  it('should query overdue orders by effectiveDueDate < now without restricting by orderDate', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    const overdueCall = mockPrisma.order.count.mock.calls[0][0];
    expect(overdueCall.where.storeId).toBe(STORE_A);
    expect(overdueCall.where.effectiveDueDate.lt).toBeInstanceOf(Date);
    expect(overdueCall.where.status.notIn).toEqual(['DELIVERED', 'CANCELLED']);
    expect(overdueCall.where.orderDate).toBeUndefined();
  });

  it('should query dueToday and dueTomorrow with Asia/Kolkata day boundaries without restricting by orderDate', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    // dueToday is 2nd count call
    const dueTodayCall = mockPrisma.order.count.mock.calls[1][0];
    expect(dueTodayCall.where.storeId).toBe(STORE_A);
    expect(dueTodayCall.where.effectiveDueDate.gte).toBeInstanceOf(Date);
    expect(dueTodayCall.where.effectiveDueDate.lte).toBeInstanceOf(Date);
    expect(dueTodayCall.where.status.notIn).toEqual(['DELIVERED', 'CANCELLED']);
    expect(dueTodayCall.where.orderDate).toBeUndefined();

    // dueTomorrow is 3rd count call
    const dueTomorrowCall = mockPrisma.order.count.mock.calls[2][0];
    expect(dueTomorrowCall.where.storeId).toBe(STORE_A);
    expect(dueTomorrowCall.where.effectiveDueDate.gte).toBeInstanceOf(Date);
    expect(dueTomorrowCall.where.effectiveDueDate.lte).toBeInstanceOf(Date);
    expect(dueTomorrowCall.where.status.notIn).toEqual(['DELIVERED', 'CANCELLED']);
    expect(dueTomorrowCall.where.orderDate).toBeUndefined();
  });

  // ─── COMPARISONS & BASELINE HANDLING ──────────────────────────

  it('should handle zero baseline in comparisons safely without NaN or Infinity', async () => {
    setupEmptyMocks();

    // Current period has orders, previous period was 0
    mockPrisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 2000 }, _count: { id: 2 } }) // current
      .mockResolvedValueOnce({ _sum: { amountDue: 0 } }) // outstanding
      .mockResolvedValueOnce({ _sum: { totalAmount: null }, _count: { id: 0 } }); // prev

    mockPrisma.payment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1500 }, _count: { id: 2 } }) // current
      .mockResolvedValueOnce({ _sum: { amount: null } }); // prev

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.comparison?.bookedOrderValue.current).toBe(2000);
    expect(result.comparison?.bookedOrderValue.previous).toBe(0);
    expect(result.comparison?.bookedOrderValue.percentageChange).toBeNull(); // Documented null for undefined % change from 0 baseline

    expect(result.comparison?.collections.current).toBe(1500);
    expect(result.comparison?.collections.previous).toBe(0);
    expect(result.comparison?.collections.percentageChange).toBeNull();
  });

  // ─── READ-ONLY GUARANTEE ──────────────────────────────────────

  it('should not call any mutation methods', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    expect(mockPrisma.order.groupBy).toHaveBeenCalled();
    expect(mockPrisma.order.count).toHaveBeenCalled();
    expect(mockPrisma.order.aggregate).toHaveBeenCalled();
    expect(mockPrisma.order.findMany).toHaveBeenCalled();
    expect(mockPrisma.payment.aggregate).toHaveBeenCalled();
    expect(mockPrisma.financialAdjustment.aggregate).toHaveBeenCalled();
    expect(mockPrisma.notification.findMany).toHaveBeenCalled();
  });
});
