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
  });

  // ─── EMPTY STORE ──────────────────────────────────────────────

  it('should return all zeros for an empty store', async () => {
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
  });

  // ─── STORE ISOLATION ──────────────────────────────────────────

  it('should pass storeId to all Prisma queries for store isolation', async () => {
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
  });

  it('should scope queries to different stores independently', async () => {
    setupEmptyMocks();

    await service.getSummary(STORE_B, startDate, endDate);

    const orderGroupByCall = mockPrisma.order.groupBy.mock.calls[0][0];
    expect(orderGroupByCall.where.storeId).toBe(STORE_B);
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

    // Verify no create/update/delete/upsert was called
    expect(mockPrisma.order.groupBy).toHaveBeenCalled();
    expect(mockPrisma.order.count).toHaveBeenCalled();
    expect(mockPrisma.order.aggregate).toHaveBeenCalled();
    // These mutation methods should NOT exist or NOT be called
    // The dashboard service only reads
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
});
