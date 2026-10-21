import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportService } from './report.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import { OrderStatus, PaymentStatus } from '@growfast/shared-types';

describe('ReportService — Daily Orders Report', () => {
  let service: ReportService;
  let prisma: any;
  let paymentService: any;

  const mockStoreId = 'store-kp-001';

  const mockOrderData = [
    {
      id: 'order-1',
      orderNumber: 'T12980',
      customerId: 'cust-1',
      orderDate: new Date('2026-10-19T09:41:00.000+05:30'),
      effectiveDueDate: new Date('2026-10-25T18:00:00.000+05:30'),
      status: OrderStatus.RECEIVED,
      paymentStatus: PaymentStatus.PENDING,
      subtotal: 150,
      discountAmount: 0,
      totalAmount: 150,
      amountPaid: 0,
      amountDue: 150,
      createdById: 'emp-1',
      storeId: mockStoreId,
      customer: {
        id: 'cust-1',
        customerCode: 'Cust1856515',
        name: 'sagar patil',
        phone: '9881636771',
        address: 'charoli',
      },
      createdBy: {
        id: 'emp-1',
        name: 'Staff One',
        role: 'COUNTER',
      },
      items: [
        {
          id: 'item-1',
          quantity: 3,
          weight: null,
          serviceType: { id: 'svc-dc', name: 'Dry Clean' },
          garmentCatalog: { id: 'gc-1', name: 'Shirt', category: 'MEN' },
        },
      ],
      adjustments: [],
    },
    {
      id: 'order-2',
      orderNumber: 'T12981',
      customerId: 'cust-2',
      orderDate: new Date('2026-10-19T09:49:00.000+05:30'),
      effectiveDueDate: new Date('2026-10-25T18:00:00.000+05:30'),
      status: OrderStatus.RECEIVED,
      paymentStatus: PaymentStatus.PARTIAL,
      subtotal: 1092,
      discountAmount: 0,
      totalAmount: 1092,
      amountPaid: 500,
      amountDue: 592,
      createdById: 'emp-2',
      storeId: mockStoreId,
      customer: {
        id: 'cust-2',
        customerCode: 'Cust464567',
        name: 'Pankaj',
        phone: '9356905139',
        address: 'bhosari tapkir nagar',
      },
      createdBy: {
        id: 'emp-2',
        name: 'Staff Two',
        role: 'COUNTER',
      },
      items: [
        {
          id: 'item-2',
          quantity: 31,
          weight: 8.4,
          serviceType: { id: 'svc-wash', name: 'Standard Wash' },
          garmentCatalog: { id: 'gc-2', name: 'Mix Laundry', category: 'WEIGHT_BASED' },
        },
      ],
      adjustments: [],
    },
    {
      id: 'order-3',
      orderNumber: 'T12986',
      customerId: 'cust-3',
      orderDate: new Date('2026-10-19T10:45:00.000+05:30'),
      effectiveDueDate: new Date('2026-10-26T18:00:00.000+05:30'),
      status: OrderStatus.READY,
      paymentStatus: PaymentStatus.PAID,
      subtotal: 1120,
      discountAmount: 56,
      totalAmount: 1064,
      amountPaid: 1064,
      amountDue: 0,
      createdById: 'emp-1',
      storeId: mockStoreId,
      customer: {
        id: 'cust-3',
        customerCode: 'Cust2223648',
        name: 'Anup Nair',
        phone: '7028922646',
        address: 'C1203 Tanish O2',
      },
      createdBy: {
        id: 'emp-1',
        name: 'Staff One',
        role: 'COUNTER',
      },
      items: [
        {
          id: 'item-3',
          quantity: 10,
          weight: null,
          serviceType: { id: 'svc-dc', name: 'Dry Clean' },
          garmentCatalog: { id: 'gc-3', name: 'Kurta', category: 'MEN' },
        },
      ],
      adjustments: [],
    },
  ];

  beforeEach(async () => {
    prisma = {
      order: {
        findMany: jest.fn().mockImplementation((args) => {
          // If select only (summary query), map to selected fields
          if (args.select) {
            return Promise.resolve(
              mockOrderData.map((o) => ({
                subtotal: o.subtotal,
                discountAmount: o.discountAmount,
                totalAmount: o.totalAmount,
                amountPaid: o.amountPaid,
                amountDue: o.amountDue,
                paymentStatus: o.paymentStatus,
                items: o.items.map((it) => ({ quantity: it.quantity, weight: it.weight })),
                adjustments: o.adjustments,
              })),
            );
          }
          return Promise.resolve(mockOrderData);
        }),
        count: jest.fn().mockResolvedValue(mockOrderData.length),
      },
    };

    paymentService = {
      calculateOrderFinancialState: jest.fn().mockImplementation((order: any) => ({
        refundAmount: 0,
        storeCreditAmount: 0,
        totalAdjustments: 0,
        effectivePaid: order.amountPaid || 0,
        amountDue:
          order.amountDue != null
            ? order.amountDue
            : Math.max(0, order.totalAmount - (order.amountPaid || 0)),
        paymentStatus:
          (order.amountPaid || 0) >= order.totalAmount
            ? PaymentStatus.PAID
            : (order.amountPaid || 0) > 0
              ? PaymentStatus.PARTIAL
              : PaymentStatus.PENDING,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('1. enforces store isolation strictly on queries', async () => {
    const res = await service.getDailyOrdersReport(mockStoreId, {
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    });

    expect(prisma.order.findMany).toHaveBeenCalled();
    const callArgs = prisma.order.findMany.mock.calls[0][0];
    expect(callArgs.where.storeId).toBe(mockStoreId);
    expect(res.success).toBe(true);
    expect(res.data.length).toBe(3);
  });

  it('2. calculates gross amount, discount, net amount, advance, and balance accurately', async () => {
    const res = await service.getDailyOrdersReport(mockStoreId, {
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    });

    const rowWithDiscount = res.data.find((r) => r.orderNumber === 'T12986');
    expect(rowWithDiscount).toBeDefined();
    expect(rowWithDiscount?.grossAmount).toBe(1120);
    expect(rowWithDiscount?.discount).toBe(56);
    expect(rowWithDiscount?.netAmount).toBe(1064);
    expect(rowWithDiscount?.advance).toBe(1064);
    expect(rowWithDiscount?.balance).toBe(0);
    expect(rowWithDiscount?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(rowWithDiscount?.pieces).toBe(10);
  });

  it('3. calculates weight correctly for weight-based orders and handles null for non-weight orders', async () => {
    const res = await service.getDailyOrdersReport(mockStoreId, {
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    });

    const weightRow = res.data.find((r) => r.orderNumber === 'T12981');
    expect(weightRow?.weight).toBe(8.4);
    expect(weightRow?.pieces).toBe(31);

    const nonWeightRow = res.data.find((r) => r.orderNumber === 'T12980');
    expect(nonWeightRow?.weight).toBeNull();
    expect(nonWeightRow?.pieces).toBe(3);
  });

  it('4. aggregates total summary metrics across all matching orders', async () => {
    const res = await service.getDailyOrdersReport(mockStoreId, {
      startDate: '2026-10-19',
      endDate: '2026-10-19',
    });

    expect(res.summary.totalOrders).toBe(3);
    expect(res.summary.totalPieces).toBe(3 + 31 + 10); // 44
    expect(res.summary.totalWeight).toBe(8.4);
    expect(res.summary.totalGrossAmount).toBe(150 + 1092 + 1120); // 2362
    expect(res.summary.totalDiscount).toBe(56);
    expect(res.summary.totalNetAmount).toBe(150 + 1092 + 1064); // 2306
    expect(res.summary.totalAdvance).toBe(0 + 500 + 1064); // 1564
    expect(res.summary.totalBalance).toBe(150 + 592 + 0); // 742
  });

  it('5. rejects invalid or inverted date ranges with BadRequestException', async () => {
    await expect(
      service.getDailyOrdersReport(mockStoreId, {
        startDate: '2026-10-25',
        endDate: '2026-10-19',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.getDailyOrdersReport(mockStoreId, {
        startDate: 'not-a-date',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. applies filters (discount, orderNumber, user, status) to where clause', async () => {
    await service.getDailyOrdersReport(mockStoreId, {
      startDate: '2026-10-19',
      endDate: '2026-10-19',
      orderNumber: 'T12980',
      hasDiscount: 'with',
      userId: 'emp-1',
      filterBy: 'PAID',
    });

    const callArgs =
      prisma.order.findMany.mock.calls[prisma.order.findMany.mock.calls.length - 2][0];
    expect(callArgs.where.orderNumber.contains).toBe('T12980');
    expect(callArgs.where.discountAmount).toEqual({ gt: 0 });
    expect(callArgs.where.createdById).toBe('emp-1');
    expect(callArgs.where.paymentStatus).toBe(PaymentStatus.PAID);
  });
});
