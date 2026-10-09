import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import {
  PickupType,
  ItemStatus,
  OrderStatus,
  GarmentCategory,
  ServiceCategory,
  PhotoType,
  PaymentStatus,
  OrderPriority,
} from '@growfast/shared-types';

describe('Phase T1: Tag System Foundation Tests (TESTS A through J)', () => {
  let service: OrderService;

  const mockPrismaService: any = {
    $transaction: jest.fn(async (cb: any) => cb(mockPrismaService)),
    customer: {
      findUnique: jest.fn(),
    },
    garmentCatalog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    serviceType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    serviceGarmentPrice: {
      findMany: jest.fn(),
    },
    store: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    physicalGarment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn(),
    },
    orderPhoto: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    financialAdjustment: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockCatalogService = {};
  const mockNotificationService = {
    createNotificationEvent: jest.fn().mockResolvedValue(null),
  };
  const mockPaymentService: any = {
    calculateOrderFinancialState: jest.fn().mockReturnValue({
      subtotal: 250,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 250,
      amountPaid: 0,
      effectivePaid: 0,
      amountDue: 250,
      paymentStatus: PaymentStatus.PENDING,
      refundAmount: 0,
      storeCreditAmount: 0,
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPrismaService.financialAdjustment = {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST A — CREATE ORDER
  // Create an order with Shirt × 5.
  // Verify 5 PhysicalGarments and 5 unique tag identities.
  // ─────────────────────────────────────────────────────────────
  it('TEST A — CREATE ORDER: creates 5 PhysicalGarments with 5 unique tag identities for Shirt x 5', async () => {
    mockPrismaService.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      name: 'Rohan Sharma',
      phone: '9876543210',
    });

    mockPrismaService.garmentCatalog.findMany.mockResolvedValue([
      { id: 'garment-shirt', name: 'Shirt', category: GarmentCategory.MEN, isActive: true },
    ]);

    mockPrismaService.serviceType.findMany.mockResolvedValue([
      {
        id: 'service-dryclean',
        name: 'Dry Clean',
        category: ServiceCategory.DRY_CLEAN,
        estimatedDays: 2,
        isActive: true,
      },
    ]);

    mockPrismaService.serviceGarmentPrice.findMany.mockResolvedValue([
      { garmentCatalogId: 'garment-shirt', serviceTypeId: 'service-dryclean', price: 50 },
    ]);

    mockPrismaService.store.findUnique.mockResolvedValue({
      id: 'store-1',
      name: 'Main Store',
      expressSurchargePercent: 50,
    });

    let capturedCreateData: any = null;
    mockPrismaService.order.create.mockImplementation(({ data }: any) => {
      capturedCreateData = data;
      return {
        id: 'ord-1001',
        orderNumber: 'ORD-1001',
        customerId: 'cust-1',
        storeId: 'store-1',
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        status: OrderStatus.RECEIVED,
        subtotal: 250,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 250,
        amountPaid: 0,
        amountDue: 250,
        paymentStatus: PaymentStatus.PENDING,
        pickupType: PickupType.STORE_PICKUP,
        priority: OrderPriority.STANDARD,
        createdById: 'emp-1',
        items: [
          {
            id: 'item-101',
            garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
            serviceType: { category: ServiceCategory.DRY_CLEAN },
            quantity: 5,
            unitPrice: 50,
            lineTotal: 250,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: data.items.create[0].physicalGarments.create.map(
              (pg: any, idx: number) => ({
                id: `pg-${idx + 1}`,
                orderItemId: 'item-101',
                unitNumber: pg.unitNumber,
                tagId: pg.tagId,
                isReady: false,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              }),
            ),
          },
        ],
        customer: { name: 'Rohan Sharma', phone: '9876543210' },
        createdBy: { name: 'Staff' },
      };
    });

    const result = await service.createOrder(
      {
        customerId: 'cust-1',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'garment-shirt',
            serviceTypeId: 'service-dryclean',
            quantity: 5,
            pieces: [1, 2, 3, 4, 5].map((u) => ({ unitNumber: u, photoCount: 1 })),
          },
        ],
      },
      'emp-1',
      'store-1',
    );

    const createdGarments = capturedCreateData.items.create[0].physicalGarments.create;
    expect(createdGarments).toHaveLength(5);

    const tagIds = createdGarments.map((g: any) => g.tagId);
    tagIds.forEach((tagId: string) => {
      expect(tagId).toBeDefined();
      expect(tagId).toMatch(/^GF-[2-9A-Z]{6}$/);
    });

    const uniqueTags = new Set(tagIds);
    expect(uniqueTags.size).toBe(5);

    expect(result.items[0].physicalGarments).toHaveLength(5);
    result.items[0].physicalGarments!.forEach((pg: any, i: number) => {
      expect(pg.unitNumber).toBe(i + 1);
      expect(pg.tagId).toBe(tagIds[i]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST B — STABILITY
  // Fetch the same order multiple times. Verify all tag identities remain unchanged.
  // ─────────────────────────────────────────────────────────────
  it('TEST B — STABILITY: tag identities remain unchanged across multiple fetches and reloads', async () => {
    const fixedTags = ['GF-A1B2C3', 'GF-D4E5F6', 'GF-G7H8J9', 'GF-K1M2N3', 'GF-P4Q5R6'];
    const mockOrderRecord = {
      id: 'ord-stable',
      orderNumber: 'ORD-STABLE',
      storeId: 'store-1',
      orderDate: new Date('2026-10-08T10:00:00Z'),
      systemDueDate: new Date('2026-10-10T10:00:00Z'),
      effectiveDueDate: new Date('2026-10-10T10:00:00Z'),
      isExpress: false,
      status: OrderStatus.RECEIVED,
      subtotal: 250,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 250,
      amountPaid: 0,
      amountDue: 250,
      paymentStatus: PaymentStatus.PENDING,
      pickupType: PickupType.STORE_PICKUP,
      priority: OrderPriority.STANDARD,
      createdById: 'emp-1',
      customer: { name: 'Rohan Sharma', phone: '9876543210' },
      createdBy: { name: 'Staff' },
      items: [
        {
          id: 'item-1',
          garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          quantity: 5,
          unitPrice: 50,
          lineTotal: 250,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          photos: [],
          physicalGarments: fixedTags.map((tag, idx) => ({
            id: `pg-${idx + 1}`,
            orderItemId: 'item-1',
            unitNumber: idx + 1,
            tagId: tag,
            isReady: false,
            isCancelled: false,
            isDelivered: false,
            createdAt: new Date('2026-10-08T10:00:00Z'),
            updatedAt: new Date('2026-10-08T10:00:00Z'),
            photos: [],
          })),
        },
      ],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(mockOrderRecord);

    const fetch1 = await service.findOrderById('ord-stable', 'store-1');
    const fetch2 = await service.findOrderById('ord-stable', 'store-1');
    const fetch3 = await service.findOrderById('ord-stable', 'store-1');

    const tags1 = fetch1.items[0].physicalGarments!.map((g: any) => g.tagId);
    const tags2 = fetch2.items[0].physicalGarments!.map((g: any) => g.tagId);
    const tags3 = fetch3.items[0].physicalGarments!.map((g: any) => g.tagId);

    expect(tags1).toEqual(fixedTags);
    expect(tags2).toEqual(fixedTags);
    expect(tags3).toEqual(fixedTags);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST C — PIECE POSITION
  // Verify 1/5, 2/5, 3/5, 4/5, 5/5 map to correct PhysicalGarments.
  // ─────────────────────────────────────────────────────────────
  it('TEST C — PIECE POSITION: unitNumber represents 1..5 matching total quantity', async () => {
    const mockOrderRecord = {
      id: 'ord-pos',
      orderNumber: 'ORD-POS',
      storeId: 'store-1',
      orderDate: new Date(),
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
      isExpress: false,
      status: OrderStatus.RECEIVED,
      subtotal: 250,
      totalAmount: 250,
      amountPaid: 0,
      customer: { name: 'Rohan Sharma', phone: '9876543210' },
      items: [
        {
          id: 'item-1',
          garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          quantity: 5,
          unitPrice: 50,
          lineTotal: 250,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          photos: [],
          physicalGarments: [1, 2, 3, 4, 5].map((u) => ({
            id: `pg-${u}`,
            orderItemId: 'item-1',
            unitNumber: u,
            tagId: `GF-TAG00${u}`,
            isReady: false,
            isCancelled: false,
            isDelivered: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            photos: [],
          })),
        },
      ],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(mockOrderRecord);

    const order = await service.findOrderById('ord-pos', 'store-1');
    const garments = order.items[0].physicalGarments!;

    expect(garments).toHaveLength(5);
    garments.forEach((g: any, idx: number) => {
      expect(g.unitNumber).toBe(idx + 1);
      expect(g.tagId).toBe(`GF-TAG00${idx + 1}`);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST D — ADD PIECE
  // Start with 5 pieces. Add one piece.
  // Verify 6 PhysicalGarments with 6 unique tag identities, previous unchanged.
  // ─────────────────────────────────────────────────────────────
  it('TEST D — ADD PIECE: generates a new unique tag identity for the new garment and leaves previous untouched', async () => {
    const initialTags = ['GF-A11111', 'GF-B22222', 'GF-C33333', 'GF-D44444', 'GF-E55555'];
    const existingOrder = {
      id: 'ord-add',
      orderNumber: 'ORD-ADD',
      storeId: 'store-1',
      orderDate: new Date(),
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
      status: OrderStatus.PROCESSING,
      isExpress: false,
      amountPaid: 0,
      totalAmount: 300,
      paymentStatus: PaymentStatus.PENDING,
      customer: { name: 'Rohan Sharma', phone: '9876543210' },
      createdBy: { name: 'Staff' },
      items: [
        {
          id: 'item-1',
          quantity: 5,
          unitPrice: 50,
          lineTotal: 250,
          itemStatus: ItemStatus.PROCESSING,
          deliveredQuantity: 0,
          garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          physicalGarments: initialTags.map((tag, i) => ({
            id: `pg-${i + 1}`,
            orderItemId: 'item-1',
            unitNumber: i + 1,
            tagId: tag,
            isReady: false,
            isCancelled: false,
            isDelivered: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            photos: [],
          })),
        },
      ],
      adjustments: [],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);
    mockPrismaService.store.findUnique.mockResolvedValue({ id: 'store-1' });

    let addedGarmentData: any = null;
    mockPrismaService.physicalGarment.create.mockImplementation(({ data }: any) => {
      addedGarmentData = data;
      return { id: 'pg-6', ...data, createdAt: new Date(), updatedAt: new Date() };
    });

    await service.addPhysicalGarment('ord-add', 'item-1', 'store-1');

    expect(addedGarmentData).toBeDefined();
    expect(addedGarmentData.unitNumber).toBe(6);
    expect(addedGarmentData.tagId).toBeDefined();
    expect(addedGarmentData.tagId).toMatch(/^GF-[2-9A-Z]{6}$/);
    expect(initialTags).not.toContain(addedGarmentData.tagId);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST E — CANCEL PIECE
  // Cancel one piece.
  // Verify PhysicalGarment remains historically identifiable, tag identity remains associated.
  // ─────────────────────────────────────────────────────────────
  it('TEST E — CANCEL PIECE: soft-cancels the garment, preserving its tag identity and photo links', async () => {
    const existingOrder = {
      id: 'ord-cancel',
      orderNumber: 'ORD-CANCEL',
      storeId: 'store-1',
      orderDate: new Date(),
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
      status: OrderStatus.PROCESSING,
      isExpress: false,
      amountPaid: 0,
      totalAmount: 150,
      paymentStatus: PaymentStatus.PENDING,
      customer: { name: 'Rohan Sharma', phone: '9876543210' },
      createdBy: { name: 'Staff' },
      items: [
        {
          id: 'item-1',
          quantity: 3,
          unitPrice: 50,
          lineTotal: 150,
          itemStatus: ItemStatus.PROCESSING,
          deliveredQuantity: 0,
          garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          physicalGarments: [
            {
              id: 'pg-1',
              unitNumber: 1,
              tagId: 'GF-PIECE1',
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              photos: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pg-2',
              unitNumber: 2,
              tagId: 'GF-PIECE2',
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              photos: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'pg-3',
              unitNumber: 3,
              tagId: 'GF-PIECE3',
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              photos: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ],
      adjustments: [],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);
    mockPrismaService.store.findUnique.mockResolvedValue({ id: 'store-1' });

    let updatedGarmentData: any = null;
    mockPrismaService.physicalGarment.update.mockImplementation(({ where, data }: any) => {
      if (where.id === 'pg-2') {
        updatedGarmentData = data;
      }
      return { id: where.id, ...data };
    });

    await service.cancelPhysicalGarment('ord-cancel', 'item-1', 'pg-2', 'store-1');

    expect(updatedGarmentData).toEqual({ isCancelled: true });

    const piece2 = existingOrder.items[0].physicalGarments.find((g) => g.id === 'pg-2');
    expect(piece2?.tagId).toBe('GF-PIECE2');
  });

  // ─────────────────────────────────────────────────────────────
  // TEST F — PHOTOS
  // Attach multiple photos to one PhysicalGarment.
  // Verify all photos remain associated with that exact PhysicalGarment.
  // ─────────────────────────────────────────────────────────────
  it('TEST F — PHOTOS: multiple photos remain associated with the specific PhysicalGarment', async () => {
    const mockOrderWithPhotos = {
      id: 'ord-photos',
      orderNumber: 'ORD-PHOTOS',
      storeId: 'store-1',
      orderDate: new Date(),
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
      isExpress: false,
      status: OrderStatus.RECEIVED,
      subtotal: 50,
      totalAmount: 50,
      amountPaid: 0,
      customer: { name: 'Rohan Sharma', phone: '9876543210' },
      items: [
        {
          id: 'item-1',
          garmentCatalog: { name: 'Suit Jacket', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          quantity: 1,
          unitPrice: 50,
          lineTotal: 50,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          photos: [],
          physicalGarments: [
            {
              id: 'pg-101',
              orderItemId: 'item-1',
              unitNumber: 1,
              tagId: 'GF-SUIT01',
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              photos: [
                {
                  id: 'ph-1',
                  orderItemId: 'item-1',
                  physicalGarmentId: 'pg-101',
                  type: PhotoType.FRONT,
                  url: 'https://r2.storage.com/front.jpg',
                  uploadedAt: new Date('2026-10-08T10:00:00Z'),
                },
                {
                  id: 'ph-2',
                  orderItemId: 'item-1',
                  physicalGarmentId: 'pg-101',
                  type: PhotoType.BACK,
                  url: 'https://r2.storage.com/back.jpg',
                  uploadedAt: new Date('2026-10-08T10:01:00Z'),
                },
                {
                  id: 'ph-3',
                  orderItemId: 'item-1',
                  physicalGarmentId: 'pg-101',
                  type: PhotoType.DAMAGE,
                  url: 'https://r2.storage.com/damage.jpg',
                  uploadedAt: new Date('2026-10-08T10:02:00Z'),
                },
              ],
            },
          ],
        },
      ],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(mockOrderWithPhotos);

    const order = await service.findOrderById('ord-photos', 'store-1');
    const garment = order.items[0].physicalGarments![0];

    expect(garment.tagId).toBe('GF-SUIT01');
    expect(garment.photos).toHaveLength(3);
    garment.photos!.forEach((photo: any) => {
      expect(photo.physicalGarmentId).toBe('pg-101');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TEST G — STORE ISOLATION
  // Store A cannot access Store B's PhysicalGarment / Tag.
  // ─────────────────────────────────────────────────────────────
  it('TEST G — STORE ISOLATION: Store A cannot access Store B orders or garments', async () => {
    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'ord-store-b',
      storeId: 'store-B',
    });

    await expect(service.findOrderById('ord-store-b', 'store-A')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.addPhysicalGarment('ord-store-b', 'item-1', 'store-A')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.cancelPhysicalGarment('ord-store-b', 'item-1', 'pg-1', 'store-A'),
    ).rejects.toThrow(NotFoundException);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST H — AUTHORIZATION / VALIDATION
  // Operations on delivered or cancelled orders are rejected.
  // ─────────────────────────────────────────────────────────────
  it('TEST H — AUTHORIZATION: operations on delivered or cancelled orders are rejected', async () => {
    mockPrismaService.order.findUnique.mockResolvedValue({
      id: 'ord-delivered',
      storeId: 'store-1',
      status: OrderStatus.DELIVERED,
      items: [{ id: 'item-1', physicalGarments: [] }],
      adjustments: [],
    });

    await expect(service.addPhysicalGarment('ord-delivered', 'item-1', 'store-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.cancelPhysicalGarment('ord-delivered', 'item-1', 'pg-1', 'store-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST I — LEGACY ORDERS
  // Existing legacy orders without tagId continue working seamlessly.
  // ─────────────────────────────────────────────────────────────
  it('TEST I — LEGACY: orders created before the tag system (tagId null) continue working without error', async () => {
    const legacyOrder = {
      id: 'ord-legacy',
      orderNumber: 'ORD-LEGACY-001',
      storeId: 'store-1',
      orderDate: new Date(),
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
      isExpress: false,
      status: OrderStatus.RECEIVED,
      subtotal: 50,
      totalAmount: 50,
      amountPaid: 0,
      customer: { name: 'Old Customer', phone: '9876543210' },
      items: [
        {
          id: 'item-1',
          garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: { category: ServiceCategory.DRY_CLEAN },
          quantity: 1,
          unitPrice: 50,
          lineTotal: 50,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          photos: [],
          physicalGarments: [
            {
              id: 'pg-legacy-1',
              orderItemId: 'item-1',
              unitNumber: 1,
              tagId: null,
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              photos: [],
            },
          ],
        },
      ],
    };

    mockPrismaService.order.findUnique.mockResolvedValue(legacyOrder);

    const result = await service.findOrderById('ord-legacy', 'store-1');
    expect(result.items[0].physicalGarments![0].tagId).toBeNull();
    expect(result.items[0].physicalGarments![0].unitNumber).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST J — WEIGHT-BASED LAUNDRY
  // Weight-based Laundry creates no fake PhysicalGarments.
  // ─────────────────────────────────────────────────────────────
  it('TEST J — WEIGHT-BASED LAUNDRY: weight-based laundry creates 0 fake PhysicalGarments', async () => {
    mockPrismaService.customer.findUnique.mockResolvedValue({
      id: 'cust-1',
      name: 'Rohan Sharma',
      phone: '9876543210',
    });

    mockPrismaService.garmentCatalog.findMany.mockResolvedValue([
      {
        id: 'garment-kg',
        name: 'Wash & Fold Bulk',
        category: GarmentCategory.WEIGHT_BASED,
        isActive: true,
      },
    ]);

    mockPrismaService.serviceType.findMany.mockResolvedValue([
      {
        id: 'service-wb',
        name: 'Weight Based Laundry',
        category: ServiceCategory.WEIGHT_BASED,
        estimatedDays: 1,
        isActive: true,
      },
    ]);

    mockPrismaService.serviceGarmentPrice.findMany.mockResolvedValue([
      { garmentCatalogId: 'garment-kg', serviceTypeId: 'service-wb', price: 80 },
    ]);

    mockPrismaService.store.findUnique.mockResolvedValue({
      id: 'store-1',
      name: 'Main Store',
    });

    let capturedCreateData: any = null;
    mockPrismaService.order.create.mockImplementation(({ data }: any) => {
      capturedCreateData = data;
      return {
        id: 'ord-wb-1',
        orderNumber: 'ORD-WB-1',
        customerId: 'cust-1',
        storeId: 'store-1',
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        status: OrderStatus.RECEIVED,
        subtotal: 440,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 440,
        amountPaid: 0,
        amountDue: 440,
        paymentStatus: PaymentStatus.PENDING,
        pickupType: PickupType.STORE_PICKUP,
        priority: OrderPriority.STANDARD,
        createdById: 'emp-1',
        items: [
          {
            id: 'item-wb-1',
            garmentCatalog: { name: 'Wash & Fold Bulk', category: GarmentCategory.WEIGHT_BASED },
            serviceType: { category: ServiceCategory.WEIGHT_BASED },
            quantity: 1,
            weight: 5.5,
            unitPrice: 80,
            lineTotal: 440,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [],
          },
        ],
        customer: { name: 'Rohan Sharma', phone: '9876543210' },
        createdBy: { name: 'Staff' },
      };
    });

    const result = await service.createOrder(
      {
        customerId: 'cust-1',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'garment-kg',
            serviceTypeId: 'service-wb',
            quantity: 1,
            weight: 5.5,
            pieces: [{ unitNumber: 1, photoCount: 1 }],
          },
        ],
      },
      'emp-1',
      'store-1',
    );

    const itemData = capturedCreateData.items.create[0];
    expect(itemData.physicalGarments).toBeUndefined();
    expect(result.items[0].physicalGarments).toHaveLength(0);
    expect(result.items[0].weight).toBe(5.5);
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE T2: PRINT PAYLOAD, STABILITY & ISOLATION TESTS
  // ─────────────────────────────────────────────────────────────
  describe('Phase T2: Tag UI & Print Foundation Backend Tests', () => {
    it('TEST K — PRINT PAYLOAD & DETERMINISTIC ORDER: retrieves garments with stable tagId, sorted by unitNumber asc, with store metadata', async () => {
      const mockOrderRecord = {
        id: 'ord-t2-payload',
        orderNumber: 'ORD-T2-001',
        storeId: 'store-1',
        store: { id: 'store-1', name: 'GrowFast Koramangala', address: 'Koramangala, Bangalore' },
        orderDate: new Date('2026-09-02T10:00:00.000Z'),
        systemDueDate: new Date('2026-09-05T18:00:00.000Z'),
        effectiveDueDate: new Date('2026-09-05T18:00:00.000Z'),
        isExpress: false,
        status: OrderStatus.RECEIVED,
        subtotal: 500,
        totalAmount: 500,
        amountPaid: 0,
        customer: { name: 'Aishwarya Gangam', phone: '9876543210' },
        createdBy: { name: 'Counter Staff' },
        items: [
          {
            id: 'item-shirt-5',
            garmentCatalog: { name: 'Shirt', category: GarmentCategory.MEN },
            serviceType: { category: ServiceCategory.DRY_CLEAN },
            quantity: 5,
            unitPrice: 100,
            lineTotal: 500,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-shirt-5',
                unitNumber: 1,
                tagId: 'GF-TAG001',
                isReady: true,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
              {
                id: 'pg-2',
                orderItemId: 'item-shirt-5',
                unitNumber: 2,
                tagId: 'GF-TAG002',
                isReady: true,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
              {
                id: 'pg-3',
                orderItemId: 'item-shirt-5',
                unitNumber: 3,
                tagId: 'GF-TAG003',
                isReady: false,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
              {
                id: 'pg-4',
                orderItemId: 'item-shirt-5',
                unitNumber: 4,
                tagId: 'GF-TAG004',
                isReady: false,
                isCancelled: true,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
              {
                id: 'pg-5',
                orderItemId: 'item-shirt-5',
                unitNumber: 5,
                tagId: 'GF-TAG005',
                isReady: false,
                isDelivered: false,
                isCancelled: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
            ],
          },
        ],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrderRecord);

      const result = await service.findOrderById('ord-t2-payload', 'store-1');
      expect(result.customerName).toBe('Aishwarya Gangam');
      expect(result.storeName).toBe('GrowFast Koramangala');

      const garments = result.items[0].physicalGarments!;
      expect(garments).toHaveLength(5);

      // Verify unit numbers are 1..5 in order
      expect(garments.map((g: any) => g.unitNumber)).toEqual([1, 2, 3, 4, 5]);

      // Active garments eligible for Print All exclude cancelled garment #4
      const activeGarments = garments.filter((g: any) => !g.isCancelled);
      expect(activeGarments).toHaveLength(4);
      expect(activeGarments.map((g: any) => g.tagId)).toEqual([
        'GF-TAG001',
        'GF-TAG002',
        'GF-TAG003',
        'GF-TAG005',
      ]);

      // Cancelled garment #4 preserves its tagId
      const cancelledGarment = garments.find((g: any) => g.unitNumber === 4);
      expect(cancelledGarment?.tagId).toBe('GF-TAG004');
      expect(cancelledGarment?.isCancelled).toBe(true);
    });

    it('TEST L — REPRINT STABILITY: repeated fetches return the identical stable tagId and do not create new tag identities', async () => {
      const mockRecord = {
        id: 'ord-reprint',
        orderNumber: 'ORD-REP-01',
        storeId: 'store-1',
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        status: OrderStatus.RECEIVED,
        subtotal: 100,
        totalAmount: 100,
        amountPaid: 0,
        customer: { name: 'Vijay Kumar', phone: '9876543210' },
        items: [
          {
            id: 'item-1',
            garmentCatalog: { name: 'Blazer', category: GarmentCategory.MEN },
            serviceType: { category: ServiceCategory.DRY_CLEAN },
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [
              {
                id: 'pg-rep-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                tagId: 'GF-STABLE99',
                isReady: false,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
            ],
          },
        ],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockRecord);

      const firstFetch = await service.findOrderById('ord-reprint', 'store-1');
      const secondFetch = await service.findOrderById('ord-reprint', 'store-1');

      expect(firstFetch.items[0].physicalGarments![0].tagId).toBe('GF-STABLE99');
      expect(secondFetch.items[0].physicalGarments![0].tagId).toBe('GF-STABLE99');
      expect(mockPrismaService.physicalGarment.create).not.toHaveBeenCalled();
    });

    it('TEST M — STORE ISOLATION: prevents fetching tag information from a different store', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'ord-store-a',
        storeId: 'store-A',
        items: [],
      });

      // Attempting to access Store A order with Store B credentials throws NotFoundException
      await expect(service.findOrderById('ord-store-a', 'store-B')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('TEST N — NON-DESTRUCTIVE: tag data retrieval does not touch order status or financial balances', async () => {
      const mockRecord = {
        id: 'ord-financial-safety',
        orderNumber: 'ORD-SAFE-01',
        storeId: 'store-1',
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        status: OrderStatus.PROCESSING,
        subtotal: 300,
        totalAmount: 300,
        amountPaid: 150,
        amountDue: 150,
        customer: { name: 'Sneha Patel', phone: '9876543210' },
        items: [
          {
            id: 'item-1',
            garmentCatalog: { name: 'Saree', category: GarmentCategory.WOMEN },
            serviceType: { category: ServiceCategory.DRY_CLEAN },
            quantity: 1,
            unitPrice: 300,
            lineTotal: 300,
            itemStatus: ItemStatus.PROCESSING,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                tagId: 'GF-SAFE-01',
                isReady: false,
                isCancelled: false,
                isDelivered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
            ],
          },
        ],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockRecord);

      const result = await service.findOrderById('ord-financial-safety', 'store-1');

      expect(result.status).toBe(OrderStatus.PROCESSING);
      expect(result.totalAmount).toBe(300);
      expect(result.amountPaid).toBe(150);
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      expect(mockPaymentService.calculateOrderFinancialState).toHaveBeenCalled();
    });
  });
});
