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
      const physicalGarments = (data.items.create[0].physicalGarments?.create || []).map(
        (pg: any) => ({
          id: `pg-${pg.unitNumber}`,
          unitNumber: pg.unitNumber,
          tagId: pg.tagId,
          isReady: false,
          isCancelled: false,
          isDelivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          photos: [],
        }),
      );
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
            physicalGarments,
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
    expect(itemData.physicalGarments.create).toHaveLength(1);
    expect(itemData.physicalGarments.create[0].tagId).toMatch(/^GF-/);
    expect(result.items[0].physicalGarments).toHaveLength(1);
    expect(result.items[0].physicalGarments[0].tagId).toMatch(/^GF-/);
    expect(result.items[0].weight).toBe(5.5);
    expect(result.items[0].lineTotal).toBe(440);
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

  // ─────────────────────────────────────────────────────────────
  // PHASE T3: WEIGHT-BASED LAUNDRY & PHOTO THRESHOLD CANONICAL RULES
  // ─────────────────────────────────────────────────────────────
  describe('Phase T3: Weight-Based Laundry & Photo Threshold Canonical Rules', () => {
    const storeId = 'store-canonical-1';
    const empId = 'emp-canonical-1';
    const custId = 'cust-canonical-1';

    const makeMockPg = (unitNumber: number, tagId: string, photos: any[] = []) => ({
      id: `pg-${unitNumber}`,
      unitNumber,
      tagId,
      isReady: false,
      isCancelled: false,
      isDelivered: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      photos,
    });

    beforeEach(() => {
      mockPrismaService.store.findUnique.mockResolvedValue({ id: storeId, name: 'Main Store' });
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: custId,
        name: 'Customer Test',
      });
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([
        {
          id: 'g-laundry-kg',
          name: 'Laundry Weight Item',
          category: GarmentCategory.WEIGHT_BASED,
          isActive: true,
        },
        { id: 'g-shirt-piece', name: 'Shirt', category: GarmentCategory.MEN, isActive: true },
      ]);
      mockPrismaService.serviceType.findMany.mockResolvedValue([
        {
          id: 's-laundry-kg',
          name: 'Wash & Steam Iron',
          category: ServiceCategory.WEIGHT_BASED,
          isActive: true,
        },
        {
          id: 's-dry-clean',
          name: 'Dry Clean',
          category: ServiceCategory.DRY_CLEAN,
          isActive: true,
        },
      ]);
      mockPrismaService.serviceGarmentPrice.findMany.mockResolvedValue([
        { garmentCatalogId: 'g-laundry-kg', serviceTypeId: 's-laundry-kg', price: 80 },
        { garmentCatalogId: 'g-shirt-piece', serviceTypeId: 's-dry-clean', price: 150 },
      ]);

      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        return {
          id: `ord-${Date.now()}`,
          orderNumber: 'GF-TEST-01',
          storeId,
          customerId: custId,
          orderDate: new Date(),
          systemDueDate: new Date(),
          effectiveDueDate: new Date(),
          isExpress: false,
          status: OrderStatus.RECEIVED,
          subtotal: data.subtotal || 200,
          totalAmount: data.totalAmount || 200,
          amountPaid: 0,
          amountDue: data.totalAmount || 200,
          paymentStatus: PaymentStatus.PENDING,
          pickupType: PickupType.STORE_PICKUP,
          priority: OrderPriority.STANDARD,
          createdById: empId,
          items: data.items.create.map((it: any, i: number) => ({
            id: `item-${i + 1}`,
            quantity: it.quantity,
            weight: it.weight,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: (it.physicalGarments?.create || []).map((pg: any) =>
              makeMockPg(pg.unitNumber, pg.tagId),
            ),
            garmentCatalog: {
              name: 'Garment',
              category: it.weight ? GarmentCategory.WEIGHT_BASED : GarmentCategory.MEN,
            },
            serviceType: {
              category: it.weight ? ServiceCategory.WEIGHT_BASED : ServiceCategory.DRY_CLEAN,
            },
          })),
          customer: { name: 'Customer Test', phone: '9876543210' },
          createdBy: { name: 'Staff' },
        };
      });
    });

    // 1. One garment creates one physical garment and one permanent tag
    it('1. One garment creates one physical garment and one permanent tag', async () => {
      let capturedData: any = null;
      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return originalImpl({ data });
      });

      const res = await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 1,
              weight: 3.5,
              pieces: [{ unitNumber: 1, photoCount: 1 }],
            },
          ],
        },
        empId,
        storeId,
      );

      expect(capturedData.items.create[0].physicalGarments.create).toHaveLength(1);
      expect(capturedData.items.create[0].physicalGarments.create[0].tagId).toMatch(/^GF-/);
      expect(res.items[0].physicalGarments).toHaveLength(1);
    });

    // 2. Ten garments create ten physical garments and ten permanent tags
    it('2. Ten garments create ten physical garments and ten permanent tags', async () => {
      let capturedData: any = null;
      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return originalImpl({ data });
      });

      const pieces = Array.from({ length: 10 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 }));
      const res = await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 10,
              weight: 5.0,
              pieces,
            },
          ],
        },
        empId,
        storeId,
      );

      const createdPgs = capturedData.items.create[0].physicalGarments.create;
      expect(createdPgs).toHaveLength(10);
      const tagSet = new Set(createdPgs.map((p: any) => p.tagId));
      expect(tagSet.size).toBe(10);
      expect(res.items[0].physicalGarments).toHaveLength(10);
    });

    // 3. Exactly 50 garments require a photo for every garment
    it('3. Exactly 50 garments require a photo for every garment', async () => {
      // 50 garments with only 49 covered => must be rejected
      const incompletePieces = Array.from({ length: 49 }, (_, i) => ({
        unitNumber: i + 1,
        photoCount: 1,
      }));
      await expect(
        service.createOrder(
          {
            customerId: custId,
            isExpress: false,
            pickupType: PickupType.STORE_PICKUP,
            items: [
              {
                garmentCatalogId: 'g-laundry-kg',
                serviceTypeId: 's-laundry-kg',
                quantity: 50,
                weight: 25.0,
                pieces: incompletePieces,
              },
            ],
          },
          empId,
          storeId,
        ),
      ).rejects.toThrow(BadRequestException);

      // 50 garments with all 50 covered => succeeds
      const all50Pieces = Array.from({ length: 50 }, (_, i) => ({
        unitNumber: i + 1,
        photoCount: 1,
      }));
      const result = await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 50,
              weight: 25.0,
              pieces: all50Pieces,
            },
          ],
        },
        empId,
        storeId,
      );
      expect(result).toBeDefined();
    });

    // 4. Fifty-one garments do not require photos
    it('4. Fifty-one garments do not require photos', async () => {
      const result = await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 51,
              weight: 26.0,
              pieces: [], // zero photos provided
            },
          ],
        },
        empId,
        storeId,
      );
      expect(result).toBeDefined();
    });

    // 5. Tags are generated for all garments when the count is greater than 50
    it('5. Tags are generated for all garments when the count is greater than 50', async () => {
      let capturedData: any = null;
      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return originalImpl({ data });
      });

      await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 60,
              weight: 30.0,
              pieces: [],
            },
          ],
        },
        empId,
        storeId,
      );

      const createdPgs = capturedData.items.create[0].physicalGarments.create;
      expect(createdPgs).toHaveLength(60);
      expect(createdPgs[0].tagId).toMatch(/^GF-/);
      expect(createdPgs[59].tagId).toMatch(/^GF-/);
      const tagSet = new Set(createdPgs.map((p: any) => p.tagId));
      expect(tagSet.size).toBe(60);
    });

    // 6. Missing photos block the appropriate workflow step when the count is 50 or fewer
    it('6. Missing photos block order creation when count is 50 or fewer', async () => {
      await expect(
        service.createOrder(
          {
            customerId: custId,
            isExpress: false,
            pickupType: PickupType.STORE_PICKUP,
            items: [
              {
                garmentCatalogId: 'g-laundry-kg',
                serviceTypeId: 's-laundry-kg',
                quantity: 8,
                weight: 4.5,
                pieces: [{ unitNumber: 1, photoCount: 1 }], // only 1 of 8 covered
              },
            ],
          },
          empId,
          storeId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // 7. Failed or pending uploads do not satisfy mandatory photo validation
    it('7. Failed or pending uploads (photoCount 0) do not satisfy mandatory photo validation', async () => {
      await expect(
        service.createOrder(
          {
            customerId: custId,
            isExpress: false,
            pickupType: PickupType.STORE_PICKUP,
            items: [
              {
                garmentCatalogId: 'g-laundry-kg',
                serviceTypeId: 's-laundry-kg',
                quantity: 2,
                weight: 3.0,
                pieces: [
                  { unitNumber: 1, photoCount: 1 },
                  { unitNumber: 2, photoCount: 0 }, // failed or 0 photoCount
                ],
              },
            ],
          },
          empId,
          storeId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // 8. Successful persisted photos satisfy the per-garment requirement
    it('8. Successful persisted photos satisfy the per-garment requirement', async () => {
      const res = await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 3,
              weight: 3.5,
              pieces: [
                { unitNumber: 1, photoCount: 1 },
                { unitNumber: 2, photoCount: 2 },
                { unitNumber: 3, photoCount: 1 },
              ],
            },
          ],
        },
        empId,
        storeId,
      );
      expect(res).toBeDefined();
    });

    // 9. Each photo is associated with the correct physical garment
    it('9. Each photo is associated with the correct physical garment', async () => {
      const mockOrderWithPgPhotos = {
        id: 'ord-photos-pg',
        orderNumber: 'GF-PHOTO-1',
        storeId,
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        priority: OrderPriority.STANDARD,
        status: OrderStatus.RECEIVED,
        totalAmount: 240,
        amountPaid: 0,
        amountDue: 240,
        customer: { name: 'Test', phone: '123' },
        createdBy: { name: 'Staff' },
        items: [
          {
            id: 'item-pg',
            garmentCatalog: { name: 'Laundry', category: GarmentCategory.WEIGHT_BASED },
            serviceType: { category: ServiceCategory.WEIGHT_BASED },
            quantity: 2,
            weight: 3.0,
            unitPrice: 80,
            lineTotal: 240,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [
              makeMockPg(1, 'GF-PG-1', [
                {
                  id: 'photo-1',
                  url: 'https://cdn.example.com/p1.jpg',
                  photoType: 'FRONT',
                  uploadedAt: new Date(),
                },
              ]),
              makeMockPg(2, 'GF-PG-2', [
                {
                  id: 'photo-2',
                  url: 'https://cdn.example.com/p2.jpg',
                  photoType: 'FRONT',
                  uploadedAt: new Date(),
                },
              ]),
            ],
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrderWithPgPhotos);

      const order = await service.findOrderById('ord-photos-pg', storeId);
      const pg1 = order.items[0].physicalGarments!.find((g: any) => g.unitNumber === 1);
      const pg2 = order.items[0].physicalGarments!.find((g: any) => g.unitNumber === 2);
      expect(pg1!.photos[0].id).toBe('photo-1');
      expect(pg2!.photos[0].id).toBe('photo-2');
    });

    // 10. Editing an order preserves existing tag identities
    it('10. Editing an order preserves existing tag identities', async () => {
      const existingTags = ['GF-PERM-01', 'GF-PERM-02'];
      const orderRecord = {
        id: 'ord-edit-tags',
        orderNumber: 'GF-EDIT-1',
        storeId,
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        priority: OrderPriority.STANDARD,
        status: OrderStatus.RECEIVED,
        totalAmount: 320,
        amountPaid: 0,
        amountDue: 320,
        customer: { name: 'Test', phone: '123' },
        createdBy: { name: 'Staff' },
        items: [
          {
            id: 'item-edit',
            garmentCatalog: { name: 'Laundry', category: GarmentCategory.WEIGHT_BASED },
            serviceType: { category: ServiceCategory.WEIGHT_BASED },
            quantity: 2,
            weight: 4.0,
            unitPrice: 80,
            lineTotal: 320,
            itemStatus: ItemStatus.RECEIVED,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [makeMockPg(1, existingTags[0]), makeMockPg(2, existingTags[1])],
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(orderRecord);

      const before = await service.findOrderById('ord-edit-tags', storeId);
      const after = await service.findOrderById('ord-edit-tags', storeId);

      expect(before.items[0].physicalGarments![0].tagId).toBe(existingTags[0]);
      expect(after.items[0].physicalGarments![0].tagId).toBe(existingTags[0]);
      expect(before.items[0].physicalGarments![1].tagId).toBe(existingTags[1]);
      expect(after.items[0].physicalGarments![1].tagId).toBe(existingTags[1]);
    });

    // 11. Increasing garment count creates only the additional records and tags
    it('11. Increasing garment count creates only the additional records and tags', async () => {
      const initialTags = ['GF-EXIST-01', 'GF-EXIST-02'];
      const existingOrder = {
        id: 'ord-inc-count',
        orderNumber: 'GF-INC-1',
        storeId,
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        status: OrderStatus.PROCESSING,
        isExpress: false,
        amountPaid: 0,
        totalAmount: 320,
        paymentStatus: PaymentStatus.PENDING,
        customer: { name: 'Rohan Sharma', phone: '9876543210' },
        createdBy: { name: 'Staff' },
        items: [
          {
            id: 'item-inc',
            quantity: 2,
            unitPrice: 80,
            lineTotal: 320,
            itemStatus: ItemStatus.PROCESSING,
            deliveredQuantity: 0,
            garmentCatalog: { name: 'Laundry', category: GarmentCategory.WEIGHT_BASED },
            serviceType: { category: ServiceCategory.WEIGHT_BASED },
            physicalGarments: initialTags.map((tag, i) => makeMockPg(i + 1, tag)),
          },
        ],
        adjustments: [],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);

      let addedGarmentData: any = null;
      mockPrismaService.physicalGarment.create.mockImplementation(({ data }: any) => {
        addedGarmentData = data;
        return { id: 'pg-3', ...data, createdAt: new Date(), updatedAt: new Date() };
      });

      await service.addPhysicalGarment('ord-inc-count', 'item-inc', storeId);

      expect(addedGarmentData).toBeDefined();
      expect(addedGarmentData.unitNumber).toBe(3);
      expect(addedGarmentData.tagId).toMatch(/^GF-[2-9A-Z]{6}$/);
      expect(initialTags).not.toContain(addedGarmentData.tagId);
    });

    // 12. Retrying order creation does not create duplicate garments or tags
    it('12. Retrying order creation does not create duplicate garments or tags', async () => {
      const dto = {
        customerId: custId,
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'g-laundry-kg',
            serviceTypeId: 's-laundry-kg',
            quantity: 4,
            weight: 4.0,
            pieces: Array.from({ length: 4 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 })),
          },
        ],
      };

      const attempt1 = await service.createOrder(dto, empId, storeId);
      expect(attempt1.items[0].physicalGarments).toHaveLength(4);

      // Unique tags per garment, no duplicates
      const tags = attempt1.items[0].physicalGarments.map((g: any) => g.tagId);
      expect(new Set(tags).size).toBe(4);
    });

    // 13. Weight-based Laundry pricing remains weight × configured price per kg
    it('13. Weight-based Laundry pricing remains weight × configured price per kg', async () => {
      let capturedData: any = null;
      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return originalImpl({ data });
      });

      await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 8, // 8 garments
              weight: 5.5, // 5.5 kg @ 80/kg
              pieces: Array.from({ length: 8 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 })),
            },
          ],
        },
        empId,
        storeId,
      );

      // lineTotal is exactly 5.5 * 80 = 440 (NOT 8 * 440)
      expect(capturedData.items.create[0].lineTotal).toBe(440);
      expect(capturedData.items.create[0].unitPrice).toBe(80);
      expect(capturedData.items.create[0].weight).toBe(5.5);
    });

    // 14. Changing garment count does not change the base weight-based Laundry price
    it('14. Changing garment count does not change the base weight-based Laundry price', async () => {
      let capturedOrder1: any = null;
      let capturedOrder2: any = null;

      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create
        .mockImplementationOnce(({ data }: any) => {
          capturedOrder1 = data;
          return originalImpl({ data });
        })
        .mockImplementationOnce(({ data }: any) => {
          capturedOrder2 = data;
          return originalImpl({ data });
        });

      // 5.0 kg with 4 garments
      await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 4,
              weight: 5.0,
              pieces: Array.from({ length: 4 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 })),
            },
          ],
        },
        empId,
        storeId,
      );

      // 5.0 kg with 12 garments
      await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-laundry-kg',
              serviceTypeId: 's-laundry-kg',
              quantity: 12,
              weight: 5.0,
              pieces: Array.from({ length: 12 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 })),
            },
          ],
        },
        empId,
        storeId,
      );

      // Base price in both cases is exactly 5.0 * 80 = 400
      expect(capturedOrder1.items.create[0].lineTotal).toBe(400);
      expect(capturedOrder2.items.create[0].lineTotal).toBe(400);
    });

    // 15. Ordinary Per Pieces orders continue to work correctly
    it('15. Ordinary Per Pieces orders continue to work correctly', async () => {
      let capturedData: any = null;
      const originalImpl = mockPrismaService.order.create.getMockImplementation();
      mockPrismaService.order.create.mockImplementation(({ data }: any) => {
        capturedData = data;
        return originalImpl({ data });
      });

      await service.createOrder(
        {
          customerId: custId,
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [
            {
              garmentCatalogId: 'g-shirt-piece',
              serviceTypeId: 's-dry-clean',
              quantity: 3, // 3 shirts @ 150 each
              pieces: Array.from({ length: 3 }, (_, i) => ({ unitNumber: i + 1, photoCount: 1 })),
            },
          ],
        },
        empId,
        storeId,
      );

      // Per piece line total: quantity * unitPrice = 3 * 150 = 450
      expect(capturedData.items.create[0].lineTotal).toBe(450);
      expect(capturedData.items.create[0].weight).toBeNull();
      expect(capturedData.items.create[0].physicalGarments.create).toHaveLength(3);
    });

    // 16. Existing processing, readiness, pickup, and handover flows continue to recognize the permanent tags
    it('16. Existing processing, readiness, pickup, and handover flows continue to recognize the permanent tags', async () => {
      const orderWithTags = {
        id: 'ord-flows',
        orderNumber: 'GF-FLOW-1',
        storeId,
        orderDate: new Date(),
        systemDueDate: new Date(),
        effectiveDueDate: new Date(),
        isExpress: false,
        priority: OrderPriority.STANDARD,
        status: OrderStatus.PROCESSING,
        totalAmount: 400,
        amountPaid: 400,
        amountDue: 0,
        customer: { name: 'Flow Customer', phone: '9999999999' },
        createdBy: { name: 'Staff' },
        items: [
          {
            id: 'item-flow',
            garmentCatalog: { name: 'Laundry', category: GarmentCategory.WEIGHT_BASED },
            serviceType: { category: ServiceCategory.WEIGHT_BASED },
            quantity: 2,
            weight: 5.0,
            unitPrice: 80,
            lineTotal: 400,
            itemStatus: ItemStatus.PROCESSING,
            deliveredQuantity: 0,
            photos: [],
            physicalGarments: [makeMockPg(1, 'GF-TAG-01'), makeMockPg(2, 'GF-TAG-02')],
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(orderWithTags);

      const retrievedOrder = await service.findOrderById('ord-flows', storeId);
      expect(retrievedOrder.items[0].physicalGarments).toHaveLength(2);
      expect(retrievedOrder.items[0].physicalGarments![0].tagId).toBe('GF-TAG-01');
      expect(retrievedOrder.items[0].physicalGarments![1].tagId).toBe('GF-TAG-02');
    });
  });
});
