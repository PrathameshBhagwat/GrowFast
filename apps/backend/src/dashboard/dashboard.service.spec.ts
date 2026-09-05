import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

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
      _sum: { totalAmount: null, amountPaid: null, amountDue: null },
    });
    mockPrisma.orderItem.count.mockResolvedValue(0);
    mockPrisma.deliveryRecord.groupBy.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);
  }

  function setupPopulatedMocks() {
    // Order groupBy status
    mockPrisma.order.groupBy
      .mockResolvedValueOnce([
        { status: 'RECEIVED', _count: { id: 5 } },
        { status: 'PROCESSING', _count: { id: 3 } },
        { status: 'READY', _count: { id: 2 } },
        { status: 'DELIVERED', _count: { id: 10 } },
        { status: 'CANCELLED', _count: { id: 1 } },
      ])
      // Payment groupBy status
      .mockResolvedValueOnce([
        { paymentStatus: 'PAID', _count: { id: 8 } },
        { paymentStatus: 'PARTIAL', _count: { id: 5 } },
        { paymentStatus: 'PENDING', _count: { id: 8 } },
      ]);

    // Overdue count
    mockPrisma.order.count
      .mockResolvedValueOnce(3) // overdue
      .mockResolvedValueOnce(2); // dueToday

    // Total items
    mockPrisma.orderItem.count.mockResolvedValue(45);

    // Financial aggregate
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 15000, amountPaid: 9500, amountDue: 5500 },
    });

    // Delivery groupBy
    mockPrisma.deliveryRecord.groupBy.mockResolvedValue([
      { status: 'SCHEDULED', _count: { id: 2 } },
      { status: 'IN_TRANSIT', _count: { id: 3 } },
      { status: 'COMPLETED', _count: { id: 7 } },
      { status: 'FAILED', _count: { id: 1 } },
    ]);

    // Customer counts
    mockPrisma.customer.count
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(5); // new in period

    // Ready orders findMany
    mockPrisma.order.findMany
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
      // Recent orders findMany
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
      // Order number map lookup (for activities with orderId)
      .mockResolvedValueOnce([
        {
          id: 'order-ready-1',
          orderNumber: 'ORD-101',
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

  // ─── BASIC FUNCTIONALITY ──────────────────────────────────────

  it('should return a complete dashboard summary with populated data', async () => {
    setupPopulatedMocks();

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.period.startDate).toBe(startDate.toISOString());
    expect(result.period.endDate).toBe(endDate.toISOString());

    // Overview
    expect(result.overview.totalOrders).toBe(21); // 5+3+2+10+1
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

    // Financial
    expect(result.financial.totalOrderValue).toBe(15000);
    expect(result.financial.amountPaid).toBe(9500);
    expect(result.financial.amountDue).toBe(5500);
    expect(result.financial.paidOrders).toBe(8);
    expect(result.financial.partialOrders).toBe(5);
    expect(result.financial.pendingOrders).toBe(8);

    // Delivery
    expect(result.delivery.scheduled).toBe(2);
    expect(result.delivery.inTransit).toBe(3);
    expect(result.delivery.completed).toBe(7);
    expect(result.delivery.failed).toBe(1);
    expect(result.delivery.assigned).toBe(0); // not in mock data

    // Customers
    expect(result.customers.total).toBe(50);
    expect(result.customers.newInPeriod).toBe(5);

    // Ready Orders
    expect(result.readyOrders).toHaveLength(1);
    expect(result.readyOrders[0].orderNumber).toBe('ORD-101');
    expect(result.readyOrders[0].customerName).toBe('Rahul Sharma');
    expect(result.readyOrders[0].customerPhone).toBe('9876543210');
    expect(result.readyOrders[0].readyItems).toEqual([{ garmentName: 'Shirt', quantity: 2 }]);
    expect(result.readyOrders[0].remainingItems).toEqual([{ garmentName: 'Pants', quantity: 1 }]);

    // Recent Orders
    expect(result.recentOrders).toHaveLength(1);
    expect(result.recentOrders[0].orderNumber).toBe('ORD-102');
    expect(result.recentOrders[0].customerName).toBe('Priya Patel');
    expect(result.recentOrders[0].itemCount).toBe(3);
    expect(result.recentOrders[0].totalAmount).toBe(1200);
    expect(result.recentOrders[0].status).toBe('RECEIVED');
    expect(result.recentOrders[0].paymentStatus).toBe('PAID');

    // Recent Activity
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].eventType).toBe('ORDER_READY');
    expect(result.recentActivity[0].orderNumber).toBe('ORD-101');
    expect(result.recentActivity[0].message).toBe('Order is ready');
  });

  // ─── EMPTY STORE ──────────────────────────────────────────────

  it('should return all zeros and empty lists for an empty store', async () => {
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
    expect(result.delivery.completed).toBe(0);
    expect(result.customers.total).toBe(0);
    expect(result.customers.newInPeriod).toBe(0);
    expect(result.readyOrders).toEqual([]);
    expect(result.recentOrders).toEqual([]);
    expect(result.recentActivity).toEqual([]);
  });

  // ─── STORE ISOLATION ──────────────────────────────────────────

  it('should pass storeId to all Prisma queries including readyOrders, recentOrders, and notifications', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    // Verify order queries include storeId
    const orderGroupByCall = mockPrisma.order.groupBy.mock.calls[0][0];
    expect(orderGroupByCall.where.storeId).toBe(STORE_A);

    // Verify financial aggregate includes storeId
    const aggCall = mockPrisma.order.aggregate.mock.calls[0][0];
    expect(aggCall.where.storeId).toBe(STORE_A);

    // Verify overdue count includes storeId
    const overdueCall = mockPrisma.order.count.mock.calls[0][0];
    expect(overdueCall.where.storeId).toBe(STORE_A);

    // Verify delivery query uses order.storeId
    const deliveryCall = mockPrisma.deliveryRecord.groupBy.mock.calls[0][0];
    expect(deliveryCall.where.order.storeId).toBe(STORE_A);

    // Verify customer queries use store-scoped relation
    const customerTotalCall = mockPrisma.customer.count.mock.calls[0][0];
    expect(customerTotalCall.where.orders.some.storeId).toBe(STORE_A);

    // Verify ready orders findMany uses storeId
    const readyOrdersCall = mockPrisma.order.findMany.mock.calls[0][0];
    expect(readyOrdersCall.where.storeId).toBe(STORE_A);

    // Verify recent orders findMany uses storeId
    const recentOrdersCall = mockPrisma.order.findMany.mock.calls[1][0];
    expect(recentOrdersCall.where.storeId).toBe(STORE_A);

    // Verify notifications findMany uses storeId
    const notifCall = mockPrisma.notification.findMany.mock.calls[0][0];
    expect(notifCall.where.storeId).toBe(STORE_A);
  });

  it('should scope queries to different stores independently', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_B, startDate, endDate);

    const orderGroupByCall = mockPrisma.order.groupBy.mock.calls[0][0];
    expect(orderGroupByCall.where.storeId).toBe(STORE_B);

    const readyOrdersCall = mockPrisma.order.findMany.mock.calls[0][0];
    expect(readyOrdersCall.where.storeId).toBe(STORE_B);
  });

  // ─── DATE FILTERING ───────────────────────────────────────────

  it('should pass date range to order queries', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    const orderGroupByCall = mockPrisma.order.groupBy.mock.calls[0][0];
    expect(orderGroupByCall.where.orderDate.gte).toEqual(startDate);
    expect(orderGroupByCall.where.orderDate.lte).toEqual(endDate);
  });

  // ─── READ-ONLY GUARANTEE ──────────────────────────────────────

  it('should not call any mutation methods', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_A, startDate, endDate);

    // Verify only query methods were called
    expect(mockPrisma.order.groupBy).toHaveBeenCalled();
    expect(mockPrisma.order.count).toHaveBeenCalled();
    expect(mockPrisma.order.aggregate).toHaveBeenCalled();
    expect(mockPrisma.order.findMany).toHaveBeenCalled();
    expect(mockPrisma.notification.findMany).toHaveBeenCalled();
  });

  // ─── NULL FINANCIAL SAFETY ────────────────────────────────────

  it('should handle null _sum values from aggregate gracefully', async () => {
    setupEmptyMocks();

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.financial.totalOrderValue).toBe(0);
    expect(result.financial.amountPaid).toBe(0);
    expect(result.financial.amountDue).toBe(0);
  });

  // ─── MISSING STATUS CATEGORIES ────────────────────────────────

  it('should return 0 for statuses not present in groupBy results', async () => {
    mockPrisma.order.groupBy
      .mockResolvedValueOnce([{ status: 'RECEIVED', _count: { id: 3 } }])
      .mockResolvedValueOnce([]);
    mockPrisma.order.count.mockResolvedValue(0);
    mockPrisma.orderItem.count.mockResolvedValue(0);
    mockPrisma.order.aggregate.mockResolvedValue({
      _sum: { totalAmount: 100, amountPaid: 50, amountDue: 50 },
    });
    mockPrisma.deliveryRecord.groupBy.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.order.findMany.mockResolvedValue([]);
    mockPrisma.notification.findMany.mockResolvedValue([]);

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.orders.received).toBe(3);
    expect(result.orders.processing).toBe(0);
    expect(result.orders.ready).toBe(0);
    expect(result.orders.delivered).toBe(0);
    expect(result.orders.cancelled).toBe(0);
    expect(result.orders.sorting).toBe(0);
    expect(result.orders.drying).toBe(0);
    expect(result.orders.ironing).toBe(0);
    expect(result.orders.qualityCheck).toBe(0);
    expect(result.orders.packed).toBe(0);
    expect(result.orders.outForDelivery).toBe(0);
  });

  // ─── RECENT ACTIVITY HANDLING ─────────────────────────────────

  it('should handle activity without orderId and fallback messages gracefully', async () => {
    setupEmptyMocks();

    mockPrisma.notification.findMany.mockResolvedValueOnce([
      {
        id: 'notif-system',
        eventType: 'CUSTOM_NOTIFICATION',
        orderId: null,
        createdAt: new Date('2026-09-01T16:00:00Z'),
      },
    ]);

    const result = await service.getSummary(STORE_A, startDate, endDate);

    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0].orderNumber).toBeNull();
    expect(result.recentActivity[0].message).toBe('CUSTOM_NOTIFICATION');
  });
});
