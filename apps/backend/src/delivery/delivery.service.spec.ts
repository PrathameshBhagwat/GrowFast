import { Test, TestingModule } from '@nestjs/testing';
import { DeliveryService } from './delivery.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DeliveryStatus, ItemStatus, Role } from '@growfast/shared-types';

// Mock deriveOrderStatus
jest.mock('@growfast/shared-types', () => {
  const actual = jest.requireActual('@growfast/shared-types');
  return {
    ...actual,
    deriveOrderStatus: jest.fn().mockReturnValue('DELIVERED'),
  };
});

import { deriveOrderStatus } from '@growfast/shared-types';

describe('DeliveryService', () => {
  let service: DeliveryService;
  let prisma: any;

  const STORE_ID = 'store-1';
  const OTHER_STORE_ID = 'store-2';
  const EMPLOYEE_ID = 'emp-1';
  const DRIVER_ID = 'driver-1';
  const OTHER_DRIVER_ID = 'driver-2';
  const ORDER_ID = 'order-1';
  const DELIVERY_ID = 'delivery-1';

  const mockOrder = {
    id: ORDER_ID,
    storeId: STORE_ID,
    status: 'READY',
    orderNumber: 'ORD-001',
    customer: { id: 'cust-1', name: 'Test Customer' },
    items: [
      { id: 'item-1', itemStatus: 'READY', quantity: 3, deliveredQuantity: 0 },
      { id: 'item-2', itemStatus: 'READY', quantity: 2, deliveredQuantity: 0 },
    ],
  };

  const mockDriver = {
    id: DRIVER_ID,
    name: 'Test Driver',
    storeId: STORE_ID,
    role: Role.DELIVERY,
    isActive: true,
  };

  const mockDelivery = {
    id: DELIVERY_ID,
    orderId: ORDER_ID,
    address: '123 Test St',
    riderId: DRIVER_ID,
    status: DeliveryStatus.ASSIGNED,
    scheduledAt: new Date(),
    completedAt: null,
    proofPhotoUrl: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: mockOrder,
    rider: mockDriver,
  };

  const mockTx = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deliveryRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    orderItem: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      $transaction: jest.fn((fn: any) => fn(mockTx)),
      deliveryRecord: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(mockOrder),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationService,
          useValue: { createNotificationEvent: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get<DeliveryService>(DeliveryService);
  });

  // ─── CREATE DELIVERY ─────────────────────────────────────────────

  describe('createDelivery', () => {
    it('should create a delivery for a valid order in the same store', async () => {
      mockTx.order.findUnique.mockResolvedValue(mockOrder);
      mockTx.deliveryRecord.create.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        riderId: null,
        rider: null,
      });

      const result = await service.createDelivery(ORDER_ID, '123 Test St', undefined, STORE_ID);
      expect(result).toBeDefined();
      expect(result.orderId).toBe(ORDER_ID);
    });

    it('should reject if order not found', async () => {
      mockTx.order.findUnique.mockResolvedValue(null);

      await expect(
        service.createDelivery('bad-id', '123 Test St', undefined, STORE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if order belongs to a different store', async () => {
      mockTx.order.findUnique.mockResolvedValue({ ...mockOrder, storeId: OTHER_STORE_ID });

      await expect(
        service.createDelivery(ORDER_ID, '123 Test St', undefined, STORE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── ASSIGN DRIVER ───────────────────────────────────────────────

  describe('assignDriver', () => {
    it('should assign a driver to a SCHEDULED delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        riderId: null,
      });
      mockTx.employee.findUnique.mockResolvedValue(mockDriver);
      mockTx.deliveryRecord.update.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });

      const result = await service.assignDriver(DELIVERY_ID, DRIVER_ID, undefined, STORE_ID);
      expect(result).toBeDefined();
      expect(mockTx.deliveryRecord.update).toHaveBeenCalled();
    });

    it('should reject assigning driver to non-SCHEDULED delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        order: mockOrder,
      });

      await expect(
        service.assignDriver(DELIVERY_ID, DRIVER_ID, undefined, STORE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject driver from different store', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        order: mockOrder,
      });
      mockTx.employee.findUnique.mockResolvedValue({
        ...mockDriver,
        storeId: OTHER_STORE_ID,
      });

      await expect(
        service.assignDriver(DELIVERY_ID, DRIVER_ID, undefined, STORE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-DELIVERY role employee', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        order: mockOrder,
      });
      mockTx.employee.findUnique.mockResolvedValue({
        ...mockDriver,
        role: Role.COUNTER,
      });

      await expect(
        service.assignDriver(DELIVERY_ID, DRIVER_ID, undefined, STORE_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject cross-store delivery access', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        order: { ...mockOrder, storeId: OTHER_STORE_ID },
      });

      await expect(
        service.assignDriver(DELIVERY_ID, DRIVER_ID, undefined, STORE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── FIND DELIVERY BY ID ─────────────────────────────────────────

  describe('findDeliveryById', () => {
    it('should return delivery for same-store manager', async () => {
      prisma.deliveryRecord.findUnique.mockResolvedValue(mockDelivery);

      const result = await service.findDeliveryById(
        DELIVERY_ID,
        STORE_ID,
        EMPLOYEE_ID,
        Role.MANAGER,
      );
      expect(result).toBeDefined();
      expect(result.id).toBe(DELIVERY_ID);
    });

    it('should allow driver to see own delivery', async () => {
      prisma.deliveryRecord.findUnique.mockResolvedValue(mockDelivery);

      const result = await service.findDeliveryById(
        DELIVERY_ID,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );
      expect(result).toBeDefined();
    });

    it('should reject driver viewing another driver delivery', async () => {
      prisma.deliveryRecord.findUnique.mockResolvedValue(mockDelivery);

      await expect(
        service.findDeliveryById(DELIVERY_ID, STORE_ID, OTHER_DRIVER_ID, Role.DELIVERY),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject cross-store access', async () => {
      prisma.deliveryRecord.findUnique.mockResolvedValue(mockDelivery);

      await expect(
        service.findDeliveryById(DELIVERY_ID, OTHER_STORE_ID, EMPLOYEE_ID, Role.MANAGER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE DELIVERY STATUS ──────────────────────────────────────

  describe('updateDeliveryStatus', () => {
    it('should allow valid transition ASSIGNED → IN_TRANSIT', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });
      mockTx.deliveryRecord.update.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
      });
      mockTx.order.update.mockResolvedValue({});

      const result = await service.updateDeliveryStatus(
        DELIVERY_ID,
        DeliveryStatus.IN_TRANSIT,
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );
      expect(result).toBeDefined();
    });

    it('should emit ORDER_OUT_FOR_DELIVERY notification on transition to IN_TRANSIT', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });
      mockTx.deliveryRecord.update.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        riderId: DRIVER_ID,
      });
      mockTx.order.update.mockResolvedValue({});

      const mockOrderWithCustomer = {
        ...mockOrder,
        customer: { id: 'cust1', phone: '1234567890' },
      };

      prisma.order.findUnique.mockResolvedValue(mockOrderWithCustomer as any);
      prisma.employee = { findUnique: jest.fn().mockResolvedValue(mockDriver as any) };

      await service.updateDeliveryStatus(
        DELIVERY_ID,
        DeliveryStatus.IN_TRANSIT,
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect((service as any).notificationService.createNotificationEvent).toHaveBeenCalledWith(
        STORE_ID,
        'ORDER_OUT_FOR_DELIVERY',
        'SMS',
        '1234567890',
        ORDER_ID,
        'cust1',
        expect.objectContaining({
          orderNumber: mockOrder.orderNumber,
          riderName: mockDriver.name,
        }),
      );
    });

    it('should not rollback if ORDER_OUT_FOR_DELIVERY notification fails', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });
      mockTx.deliveryRecord.update.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        riderId: DRIVER_ID,
      });
      mockTx.order.update.mockResolvedValue({});

      const mockOrderWithCustomer = {
        ...mockOrder,
        customer: { id: 'cust1', phone: '1234567890' },
      };

      prisma.order.findUnique.mockResolvedValue(mockOrderWithCustomer as any);
      prisma.employee = { findUnique: jest.fn().mockResolvedValue(mockDriver as any) };

      (service as any).notificationService.createNotificationEvent.mockRejectedValueOnce(
        new Error('Provider fail'),
      );

      const result = await service.updateDeliveryStatus(
        DELIVERY_ID,
        DeliveryStatus.IN_TRANSIT,
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );
      expect(result).toBeDefined();
    });

    it('should reject invalid transition SCHEDULED → IN_TRANSIT', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.SCHEDULED,
        order: mockOrder,
      });

      await expect(
        service.updateDeliveryStatus(
          DELIVERY_ID,
          DeliveryStatus.IN_TRANSIT,
          undefined,
          STORE_ID,
          EMPLOYEE_ID,
          Role.MANAGER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition from COMPLETED', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.COMPLETED,
        order: mockOrder,
      });

      await expect(
        service.updateDeliveryStatus(
          DELIVERY_ID,
          DeliveryStatus.SCHEDULED,
          undefined,
          STORE_ID,
          EMPLOYEE_ID,
          Role.MANAGER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject driver updating another driver delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
        riderId: OTHER_DRIVER_ID,
        order: mockOrder,
      });

      await expect(
        service.updateDeliveryStatus(
          DELIVERY_ID,
          DeliveryStatus.IN_TRANSIT,
          undefined,
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject COMPLETED via updateStatus (must use completeDelivery)', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        order: mockOrder,
      });

      await expect(
        service.updateDeliveryStatus(
          DELIVERY_ID,
          DeliveryStatus.COMPLETED,
          undefined,
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call deriveOrderStatus when transitioning to IN_TRANSIT', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });
      mockTx.deliveryRecord.update.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
      });
      mockTx.order.update.mockResolvedValue({});

      await service.updateDeliveryStatus(
        DELIVERY_ID,
        DeliveryStatus.IN_TRANSIT,
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect(deriveOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          hasActiveTransitDelivery: true,
        }),
      );
    });
  });

  // ─── COMPLETE DELIVERY ───────────────────────────────────────────

  describe('completeDelivery', () => {
    it('should complete an IN_TRANSIT delivery and update order items (Full Delivery Fallback)', async () => {
      mockTx.deliveryRecord.findUnique
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.IN_TRANSIT,
        })
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.COMPLETED,
        });
      mockTx.deliveryRecord.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.order.findUnique.mockResolvedValue({
        ...mockOrder,
        items: mockOrder.items.map((i) => ({
          ...i,
          itemStatus: ItemStatus.DELIVERED,
          deliveredQuantity: i.quantity,
        })),
      });
      mockTx.deliveryRecord.count.mockResolvedValue(0);
      mockTx.order.update.mockResolvedValue({});

      const result = await service.completeDelivery(
        DELIVERY_ID,
        'proof-url',
        'Delivered OK',
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect(result).toBeDefined();
      expect(mockTx.orderItem.updateMany).toHaveBeenCalledTimes(2);
      expect(deriveOrderStatus).toHaveBeenCalled();
    });

    it('should emit ORDER_DELIVERED notification after successful delivery completion', async () => {
      mockTx.deliveryRecord.findUnique
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.IN_TRANSIT,
        })
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.COMPLETED,
        });
      mockTx.deliveryRecord.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.order.findUnique.mockResolvedValue({
        ...mockOrder,
        items: mockOrder.items.map((i) => ({
          ...i,
          itemStatus: ItemStatus.DELIVERED,
          deliveredQuantity: i.quantity,
        })),
        customer: { id: 'cust1', phone: '1234567890' },
      });
      mockTx.deliveryRecord.count.mockResolvedValue(0);
      mockTx.order.update.mockResolvedValue({});

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        customer: { id: 'cust1', phone: '1234567890' },
      } as any);

      await service.completeDelivery(
        DELIVERY_ID,
        'proof-url',
        'Delivered OK',
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect((service as any).notificationService.createNotificationEvent).toHaveBeenCalledWith(
        STORE_ID,
        'ORDER_DELIVERED',
        'SMS',
        '1234567890',
        ORDER_ID,
        'cust1',
        expect.objectContaining({
          orderNumber: mockOrder.orderNumber,
        }),
      );
    });

    it('should not rollback if ORDER_DELIVERED notification fails', async () => {
      mockTx.deliveryRecord.findUnique
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.IN_TRANSIT,
        })
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.COMPLETED,
        });
      mockTx.deliveryRecord.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.order.findUnique.mockResolvedValue({
        ...mockOrder,
        items: mockOrder.items.map((i) => ({
          ...i,
          itemStatus: ItemStatus.DELIVERED,
          deliveredQuantity: i.quantity,
        })),
        customer: { id: 'cust1', phone: '1234567890' },
      });
      mockTx.deliveryRecord.count.mockResolvedValue(0);
      mockTx.order.update.mockResolvedValue({});

      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        customer: { id: 'cust1', phone: '1234567890' },
      } as any);

      (service as any).notificationService.createNotificationEvent.mockRejectedValueOnce(
        new Error('Provider fail'),
      );

      const result = await service.completeDelivery(
        DELIVERY_ID,
        'proof-url',
        'Delivered OK',
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect(result).toBeDefined();
    });

    it('should process partial delivery quantities correctly', async () => {
      mockTx.deliveryRecord.findUnique
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.IN_TRANSIT,
        })
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.COMPLETED,
        });

      mockTx.deliveryRecord.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.order.findUnique.mockResolvedValue(mockOrder);
      mockTx.deliveryRecord.count.mockResolvedValue(0);
      mockTx.order.update.mockResolvedValue({});

      await service.completeDelivery(
        DELIVERY_ID,
        undefined,
        undefined,
        [{ itemId: 'item-1', quantity: 2 }],
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      expect(mockTx.orderItem.updateMany).toHaveBeenCalledTimes(1);
      expect(mockTx.orderItem.updateMany).toHaveBeenCalledWith({
        where: { id: 'item-1', deliveredQuantity: 0 },
        data: {
          deliveredQuantity: 2,
          itemStatus: 'READY', // unchanged because 2 < 3
        },
      });
    });

    it('should reject over-delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
      });

      await expect(
        service.completeDelivery(
          DELIVERY_ID,
          undefined,
          undefined,
          [{ itemId: 'item-1', quantity: 5 }], // quantity is 3
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(BadRequestException);

      expect((service as any).notificationService.createNotificationEvent).not.toHaveBeenCalled();
    });

    it('should reject completing a non-IN_TRANSIT delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.ASSIGNED,
      });

      await expect(
        service.completeDelivery(
          DELIVERY_ID,
          undefined,
          undefined,
          undefined,
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip cancelled items when completing delivery', async () => {
      const orderWithCancelled = {
        ...mockOrder,
        items: [
          { id: 'item-1', itemStatus: 'READY', quantity: 3, deliveredQuantity: 0 },
          { id: 'item-2', itemStatus: 'CANCELLED', quantity: 2, deliveredQuantity: 0 },
        ],
      };

      mockTx.deliveryRecord.findUnique
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.IN_TRANSIT,
          order: orderWithCancelled,
        })
        .mockResolvedValueOnce({
          ...mockDelivery,
          status: DeliveryStatus.COMPLETED,
          order: orderWithCancelled,
        });
      mockTx.deliveryRecord.updateMany.mockResolvedValue({ count: 1 });
      mockTx.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockTx.order.findUnique.mockResolvedValue({
        ...orderWithCancelled,
        items: [
          { id: 'item-1', itemStatus: ItemStatus.DELIVERED, quantity: 3, deliveredQuantity: 3 },
          { id: 'item-2', itemStatus: ItemStatus.CANCELLED, quantity: 2, deliveredQuantity: 0 },
        ],
      });
      mockTx.deliveryRecord.count.mockResolvedValue(0);
      mockTx.order.update.mockResolvedValue({});

      await service.completeDelivery(
        DELIVERY_ID,
        undefined,
        undefined,
        undefined,
        STORE_ID,
        DRIVER_ID,
        Role.DELIVERY,
      );

      // Only 1 item updated (non-cancelled)
      expect(mockTx.orderItem.updateMany).toHaveBeenCalledTimes(1);
    });

    it('should reject driver completing another driver delivery', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        riderId: OTHER_DRIVER_ID,
      });

      await expect(
        service.completeDelivery(
          DELIVERY_ID,
          undefined,
          undefined,
          undefined,
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject cross-store completion', async () => {
      mockTx.deliveryRecord.findUnique.mockResolvedValue({
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
        order: { ...mockOrder, storeId: OTHER_STORE_ID },
      });

      await expect(
        service.completeDelivery(
          DELIVERY_ID,
          undefined,
          undefined,
          undefined,
          STORE_ID,
          DRIVER_ID,
          Role.DELIVERY,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── FIND DELIVERIES ─────────────────────────────────────────────

  describe('findDeliveries', () => {
    it('should filter by store for manager', async () => {
      prisma.deliveryRecord.findMany.mockResolvedValue([mockDelivery]);

      const result = await service.findDeliveries(STORE_ID, EMPLOYEE_ID, Role.MANAGER);
      expect(result).toHaveLength(1);
    });

    it('should filter by riderId for DELIVERY role', async () => {
      prisma.deliveryRecord.findMany.mockResolvedValue([mockDelivery]);

      await service.findDeliveries(STORE_ID, DRIVER_ID, Role.DELIVERY);

      expect(prisma.deliveryRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            riderId: DRIVER_ID,
          }),
        }),
      );
    });
  });
});
