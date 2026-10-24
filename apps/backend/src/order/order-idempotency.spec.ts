import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  PickupType,
  ExpressDeliveryOption,
  OrderStatus,
  PaymentStatus,
  ItemStatus,
  GarmentCategory,
  ServiceCategory,
} from '@growfast/shared-types';
import { CreateOrderDto } from './dto/create-order.dto';

const EMPLOYEE_ID = 'emp-001';
const STORE_ID = 'store-main';
const OTHER_STORE_ID = 'store-other';
const CUSTOMER_ID = 'cust-001';

describe('OrderService — Idempotency Readiness', () => {
  let service: OrderService;
  let mockPrisma: any;
  let mockCatalog: any;
  let mockNotification: any;
  let mockPayment: any;

  function makeValidCreateOrderDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
    return {
      clientDraftId: 'draft-uuid-1111',
      customerId: CUSTOMER_ID,
      isExpress: false,
      pickupType: PickupType.STORE_PICKUP,
      items: [
        {
          garmentCatalogId: 'garment-shirt',
          serviceTypeId: 'service-wash-iron',
          quantity: 2,
          colorTags: ['BLUE'],
          defectNotes: 'Loose button',
          pieces: [
            { unitNumber: 1, photoCount: 1, photos: ['https://s3.example.com/p1.jpg'] },
            { unitNumber: 2, photoCount: 1, photos: ['https://s3.example.com/p2.jpg'] },
          ],
        },
      ],
      notes: 'Please pack in box',
      ...overrides,
    };
  }

  function makeOrderMock(overrides: any = {}) {
    return {
      id: 'ord-12345',
      orderNumber: 'ORD-000001',
      customerId: CUSTOMER_ID,
      storeId: STORE_ID,
      createdById: EMPLOYEE_ID,
      clientDraftId: 'draft-uuid-1111',
      draftPayloadHash: null,
      status: OrderStatus.RECEIVED,
      paymentStatus: PaymentStatus.PENDING,
      pickupType: PickupType.STORE_PICKUP,
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      subtotal: 100,
      discountAmount: 0,
      expressSurcharge: 0,
      taxAmount: 0,
      totalAmount: 100,
      amountPaid: 0,
      amountDue: 100,
      orderDate: new Date('2026-10-22T10:00:00Z'),
      systemDueDate: new Date('2026-10-25T10:00:00Z'),
      effectiveDueDate: new Date('2026-10-25T10:00:00Z'),
      dueDateOverrideReason: null,
      dueDateOverriddenBy: null,
      serviceSummary: 'Wash & Iron × 2',
      customer: { id: CUSTOMER_ID, name: 'Alice Customer', phone: '9876543210' },
      createdBy: { id: EMPLOYEE_ID, name: 'Staff User' },
      store: { id: STORE_ID, name: 'Main Store' },
      items: [
        {
          id: 'item-1',
          garmentCatalogId: 'garment-shirt',
          serviceTypeId: 'service-wash-iron',
          quantity: 2,
          unitPrice: 50,
          lineTotal: 100,
          itemStatus: ItemStatus.RECEIVED,
          deliveredQuantity: 0,
          colorTags: ['BLUE'],
          defectNotes: 'Loose button',
          garmentCatalog: { id: 'garment-shirt', name: 'Shirt', category: GarmentCategory.MEN },
          serviceType: {
            id: 'service-wash-iron',
            name: 'Wash & Iron',
            category: ServiceCategory.WASH_IRON,
            estimatedDays: 2,
          },
          photos: [],
          physicalGarments: [
            {
              id: 'pg-1',
              unitNumber: 1,
              tagId: 'GF-AAA111',
              isReady: false,
              isCancelled: false,
              isDelivered: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              photos: [],
            },
            {
              id: 'pg-2',
              unitNumber: 2,
              tagId: 'GF-BBB222',
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
      payments: [],
      adjustments: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    mockNotification = {
      createNotificationEvent: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    mockCatalog = {};
    mockPayment = {
      calculateOrderFinancialState: jest.fn().mockImplementation((order: any) => ({
        refundAmount: 0,
        storeCreditAmount: 0,
        totalAdjustments: 0,
        effectivePaid: order.amountPaid || 0,
        amountDue: (order.totalAmount || 0) - (order.amountPaid || 0),
        paymentStatus: order.paymentStatus || PaymentStatus.PENDING,
      })),
    };

    mockPrisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: CUSTOMER_ID,
          name: 'Alice Customer',
          phone: '9876543210',
        }),
      },
      store: {
        findUnique: jest.fn().mockResolvedValue({
          id: STORE_ID,
          name: 'Main Store',
          expressSurchargePercent: 50,
        }),
      },
      garmentCatalog: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'garment-shirt', name: 'Shirt', category: GarmentCategory.MEN, isActive: true },
          ]),
      },
      serviceType: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'service-wash-iron',
            name: 'Wash & Iron',
            category: ServiceCategory.WASH_IRON,
            isActive: true,
            estimatedDays: 2,
          },
        ]),
      },
      serviceGarmentPrice: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { garmentCatalogId: 'garment-shirt', serviceTypeId: 'service-wash-iron', price: 50 },
          ]),
      },
      order: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      orderPhoto: {
        create: jest.fn().mockResolvedValue({ id: 'photo-1' }),
      },
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CatalogService, useValue: mockCatalog },
        { provide: NotificationService, useValue: mockNotification },
        { provide: PaymentService, useValue: mockPayment },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  describe('1. First Successful Order Submission with clientDraftId', () => {
    it('creates an order with clientDraftId and draftPayloadHash computed and stored', async () => {
      const dto = makeValidCreateOrderDto();
      const expectedHash = service.computeOrderPayloadHash(dto);
      const createdOrder = makeOrderMock({
        clientDraftId: dto.clientDraftId,
        draftPayloadHash: expectedHash,
      });

      // No existing order for this draft
      mockPrisma.order.findUnique.mockResolvedValue(null);
      mockPrisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder(dto, EMPLOYEE_ID, STORE_ID);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientDraftId: 'draft-uuid-1111',
            draftPayloadHash: expectedHash,
            storeId: STORE_ID,
          }),
        }),
      );
      expect(result.id).toBe('ord-12345');
      expect(result.clientDraftId).toBe('draft-uuid-1111');
      expect(mockNotification.createNotificationEvent).toHaveBeenCalled();
    });
  });

  describe('2. Repeated Submission (Same clientDraftId and Same Payload)', () => {
    it('returns the original order without creating duplicate orders or duplicate items or duplicate notifications', async () => {
      const dto = makeValidCreateOrderDto();
      const payloadHash = service.computeOrderPayloadHash(dto);
      const existingOrder = makeOrderMock({
        clientDraftId: dto.clientDraftId,
        draftPayloadHash: payloadHash,
      });

      // Existing order returned on findUnique
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.createOrder(dto, EMPLOYEE_ID, STORE_ID);

      // Verify order.create was never called
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      // Verify no duplicate SMS was triggered
      expect(mockNotification.createNotificationEvent).not.toHaveBeenCalled();
      // Returned data matches existing order
      expect(result.id).toBe('ord-12345');
      expect(result.orderNumber).toBe('ORD-000001');
      expect(result.clientDraftId).toBe('draft-uuid-1111');
    });
  });

  describe('3. Reusing clientDraftId with a Different Payload', () => {
    it('rejects with ConflictException (409) if items differ', async () => {
      const originalDto = makeValidCreateOrderDto();
      const originalHash = service.computeOrderPayloadHash(originalDto);

      const existingOrder = makeOrderMock({
        clientDraftId: originalDto.clientDraftId,
        draftPayloadHash: originalHash,
      });
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      // Conflicting payload with different quantity
      const conflictingDto = makeValidCreateOrderDto({
        items: [
          {
            garmentCatalogId: 'garment-shirt',
            serviceTypeId: 'service-wash-iron',
            quantity: 5, // Modified quantity!
          },
        ],
      });

      await expect(service.createOrder(conflictingDto, EMPLOYEE_ID, STORE_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('rejects with ConflictException (409) if express delivery flag differs', async () => {
      const originalDto = makeValidCreateOrderDto({ isExpress: false });
      const originalHash = service.computeOrderPayloadHash(originalDto);

      const existingOrder = makeOrderMock({
        clientDraftId: originalDto.clientDraftId,
        draftPayloadHash: originalHash,
      });
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      const conflictingDto = makeValidCreateOrderDto({
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });

      await expect(service.createOrder(conflictingDto, EMPLOYEE_ID, STORE_ID)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('4. Concurrent Duplicate Order Requests (Simulated DB Constraint Conflict)', () => {
    it('recovers from P2002 unique constraint conflict and returns original order', async () => {
      const dto = makeValidCreateOrderDto();
      const payloadHash = service.computeOrderPayloadHash(dto);
      const existingOrder = makeOrderMock({
        clientDraftId: dto.clientDraftId,
        draftPayloadHash: payloadHash,
      });

      // Initial check inside transaction didn't see it (race condition)
      mockPrisma.order.findUnique
        .mockResolvedValueOnce(null)
        // Catch block re-queries and finds the winner's order
        .mockResolvedValueOnce(existingOrder);

      const p2002Error: any = new Error('Unique constraint failed on (store_id, client_draft_id)');
      p2002Error.code = 'P2002';
      mockPrisma.order.create.mockRejectedValueOnce(p2002Error);

      const result = await service.createOrder(dto, EMPLOYEE_ID, STORE_ID);

      expect(result.id).toBe('ord-12345');
      expect(result.clientDraftId).toBe(dto.clientDraftId);
      // Ensure no duplicate notification was dispatched on recovered conflict
      expect(mockNotification.createNotificationEvent).not.toHaveBeenCalled();
    });
  });

  describe('5. Ambiguous Timeout Recovery via findOrderByDraftId', () => {
    it('allows client to look up order status by draft ID', async () => {
      const existingOrder = makeOrderMock({ clientDraftId: 'draft-uuid-recover-123' });
      mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.findOrderByDraftId('draft-uuid-recover-123', STORE_ID);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          storeId_clientDraftId: {
            storeId: STORE_ID,
            clientDraftId: 'draft-uuid-recover-123',
          },
        },
        include: expect.any(Object),
      });
      expect(result.id).toBe('ord-12345');
      expect(result.clientDraftId).toBe('draft-uuid-recover-123');
    });

    it('throws NotFoundException if draft ID is not found in store', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOrderByDraftId('non-existent-draft', STORE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('6. Legacy / Web Clients without clientDraftId', () => {
    it('creates orders normally when clientDraftId is not provided', async () => {
      const dto = makeValidCreateOrderDto({ clientDraftId: undefined });
      const createdOrder = makeOrderMock({
        clientDraftId: null,
        draftPayloadHash: null,
      });

      mockPrisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.createOrder(dto, EMPLOYEE_ID, STORE_ID);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientDraftId: null,
            draftPayloadHash: null,
            storeId: STORE_ID,
          }),
        }),
      );
      expect(result.id).toBe('ord-12345');
      expect(result.clientDraftId).toBeNull();
    });
  });

  describe('7. Store Isolation', () => {
    it('scopes draft lookup to authenticated storeId', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOrderByDraftId('draft-uuid-1111', OTHER_STORE_ID)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: {
          storeId_clientDraftId: {
            storeId: OTHER_STORE_ID,
            clientDraftId: 'draft-uuid-1111',
          },
        },
        include: expect.any(Object),
      });
    });
  });
});
