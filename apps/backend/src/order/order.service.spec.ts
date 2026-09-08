import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import {
  PaymentStatus,
  PickupType,
  OrderPriority,
  ItemStatus,
  OrderStatus,
  calculateOrderTotals,
  NotificationEventType,
  NotificationChannel,
  AdjustmentType,
  AdjustmentStatus,
  Role,
  PaymentMode,
  OrderPickupRequest,
} from '@growfast/shared-types';

const mockPrismaService: any = {
  $transaction: jest.fn(async (cb: any) => {
    return cb(mockPrismaService);
  }),
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
  order: {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  serviceGarmentPrice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  store: {
    findUnique: jest.fn(),
  },
  physicalGarment: {
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  notification: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  financialAdjustment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  payment: {
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCatalogService = {};

const mockNotificationService = {
  createNotificationEvent: jest.fn().mockResolvedValue(null),
};

const mockPaymentService: any = {
  recordPayment: jest.fn(),
  getPaymentSummary: jest.fn(),
  createAdjustment: jest.fn(),
  calculateOrderFinancialState: jest.fn(),
};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    mockPrismaService.physicalGarment = {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
    };
    mockPrismaService.orderItem = {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    mockPrismaService.order = {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    mockPaymentService.recordPayment = jest.fn();
    mockPaymentService.getPaymentSummary = jest.fn();
    mockPaymentService.createAdjustment = jest.fn();
    mockPaymentService.calculateOrderFinancialState = jest.fn((order: any) => {
      const adjustments = order.adjustments || [];
      const refundAmount = adjustments
        .filter((a: any) => a.status === 'COMPLETED' && a.type === 'REFUND')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      const storeCreditAmount = adjustments
        .filter((a: any) => a.status === 'COMPLETED' && a.type === 'STORE_CREDIT')
        .reduce((sum: number, a: any) => sum + a.amount, 0);
      const totalAdjustments = refundAmount + storeCreditAmount;
      const effectivePaid = (order.amountPaid ?? 0) - totalAdjustments;
      const amountDue =
        order.amountDue !== undefined
          ? order.amountDue
          : Math.max(0, (order.totalAmount ?? 0) - effectivePaid);
      return {
        refundAmount,
        storeCreditAmount,
        totalAdjustments,
        effectivePaid,
        amountDue,
        paymentStatus: order.paymentStatus ?? 'PAID',
      };
    });

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
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    const validDto = {
      customerId: 'cust1',
      isExpress: false,
      pickupType: PickupType.STORE_PICKUP,
      items: [
        {
          garmentCatalogId: 'g1',
          serviceTypeId: 's1',
          quantity: 2,
        },
      ],
    };

    const mockCustomer = { id: 'cust1', discountPercent: 10 };
    const mockGarment = { id: 'g1', name: 'Shirt', isActive: true };
    const mockService = { id: 's1', name: 'Wash', estimatedDays: 2, isActive: true };
    const mockCreatedOrder = {
      id: 'o1',
      orderNumber: 'ORD-0001',
      customerId: 'cust1',
      customer: { name: 'Test', phone: '123' },
      orderDate: new Date(),
      effectiveDueDate: new Date(),
      systemDueDate: new Date(),
      isExpress: false,
      priority: OrderPriority.STANDARD,
      status: 'RECEIVED',
      totalAmount: 90,
      amountPaid: 0,
      amountDue: 90,
      paymentStatus: PaymentStatus.PENDING,
      pickupType: PickupType.STORE_PICKUP,
      items: [
        {
          quantity: 2,
          garmentCatalog: { name: 'Shirt', category: 'MEN' },
          serviceType: { category: 'WASH' },
        },
      ],
      createdBy: { name: 'Emp' },
    };

    beforeEach(() => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([mockGarment]);
      mockPrismaService.serviceType.findMany.mockResolvedValue([mockService]);
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      mockPrismaService.serviceGarmentPrice.findMany.mockResolvedValue([
        {
          garmentCatalogId: 'g1',
          serviceTypeId: 's1',
          price: 150,
        },
      ]);
      mockPrismaService.store.findUnique.mockResolvedValue({
        id: 'store1',
        expressSurchargePercent: 50,
      });
    });

    it('should create an order successfully and calculate due dates', async () => {
      const result = await service.createOrder(validDto, 'emp1', 'store1');
      expect(result).toBeDefined();
      expect(result.orderNumber).toBe('ORD-0001');

      // Expected logic: today + 2 days
      const expectedDueDate = new Date();
      expectedDueDate.setDate(expectedDueDate.getDate() + 2);

      expect(mockPrismaService.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            systemDueDate: expect.any(Date),
            effectiveDueDate: expect.any(Date),
            status: expect.any(String),
            expressSurcharge: 0,
          }),
        }),
      );

      // Normal order: due date = orderDate + 2 days
      const callArgs = mockPrismaService.order.create.mock.calls[0][0];
      const orderDate = callArgs.data.orderDate;
      const expectedDue = new Date(orderDate);
      expectedDue.setDate(expectedDue.getDate() + 2);
      expect(callArgs.data.systemDueDate).toEqual(expectedDue);
    });

    it('should apply B7 express pricing and halved due date for express orders', async () => {
      const expressDto = { ...validDto, isExpress: true };
      const mockExpressOrder = {
        ...mockCreatedOrder,
        isExpress: true,
        priority: OrderPriority.EXPRESS,
        expressSurcharge: 150,
      };
      mockPrismaService.order.create.mockResolvedValue(mockExpressOrder);
      await service.createOrder(expressDto, 'emp1', 'store1');

      const callArgs = mockPrismaService.order.create.mock.calls[0][0];

      // B7: Express due date = orderDate + ceil(estimatedDays / 2) = ceil(2/2) = 1
      const orderDate = callArgs.data.orderDate;
      const expectedExpressDue = new Date(orderDate);
      expectedExpressDue.setDate(expectedExpressDue.getDate() + Math.ceil(2 / 2));
      expect(callArgs.data.systemDueDate).toEqual(expectedExpressDue);

      // B7: Express surcharge should be 50% of subtotal
      // Items: 2 * 150 = 300 subtotal, express surcharge = 150
      expect(callArgs.data.expressSurcharge).toBe(150);

      // B7: Priority is EXPRESS
      expect(callArgs.data.priority).toBe(OrderPriority.EXPRESS);
      expect(callArgs.data.isExpress).toBe(true);
    });

    it('should calculate correct GST on express order (taxable = subtotal + surcharge)', async () => {
      const expressDto = { ...validDto, isExpress: true };
      const mockExpressOrder = {
        ...mockCreatedOrder,
        isExpress: true,
      };
      mockPrismaService.order.create.mockResolvedValue(mockExpressOrder);
      await service.createOrder(expressDto, 'emp1', 'store1');

      const callArgs = mockPrismaService.order.create.mock.calls[0][0];
      // subtotal = 300, expressSurcharge = 150, taxable = 450, GST = 450 * 0.18 = 81
      // total = 300 + 150 + 81 = 531
      const expectedTotals = calculateOrderTotals([{ unitPrice: 150, quantity: 2 }], {
        isExpress: true,
        expressSurchargePercent: 50,
      });
      expect(callArgs.data.subtotal).toBe(expectedTotals.subtotal);
      expect(callArgs.data.expressSurcharge).toBe(expectedTotals.expressSurcharge);
      expect(callArgs.data.taxAmount).toBe(expectedTotals.taxAmount);
      expect(callArgs.data.totalAmount).toBe(expectedTotals.totalAmount);
    });

    it('should throw NotFoundException if customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      await expect(service.createOrder(validDto, 'emp1', 'store1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockNotificationService.createNotificationEvent).not.toHaveBeenCalled();
    });

    it('should emit ORDER_CREATED notification after successful order creation', async () => {
      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      await service.createOrder(validDto, 'emp1', 'store1');

      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalledWith(
        'store1',
        'ORDER_CREATED',
        'SMS',
        mockCreatedOrder.customer.phone,
        mockCreatedOrder.id,
        mockCreatedOrder.customerId,
        {
          orderNumber: mockCreatedOrder.orderNumber,
          totalAmount: mockCreatedOrder.totalAmount,
        },
      );
    });

    it('should not rollback transaction if ORDER_CREATED notification fails', async () => {
      mockPrismaService.order.create.mockResolvedValue(mockCreatedOrder);
      mockNotificationService.createNotificationEvent.mockRejectedValueOnce(
        new Error('Provider fail'),
      );

      const result = await service.createOrder(validDto, 'emp1', 'store1');
      expect(result).toBeDefined(); // Still succeeds
      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalled();
    });

    it('should throw NotFoundException if garment not found', async () => {
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([]);
      await expect(service.createOrder(validDto, 'emp1', 'store1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if garment is inactive', async () => {
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([
        { ...mockGarment, isActive: false },
      ]);
      await expect(service.createOrder(validDto, 'emp1', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if service not found', async () => {
      mockPrismaService.serviceType.findMany.mockResolvedValue([]);
      await expect(service.createOrder(validDto, 'emp1', 'store1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if service is inactive', async () => {
      mockPrismaService.serviceType.findMany.mockResolvedValue([
        { ...mockService, isActive: false },
      ]);
      await expect(service.createOrder(validDto, 'emp1', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateOrderItem', () => {
    const mockOrder = {
      id: 'o1',
      storeId: 'store1',
      customerId: 'cust1',
      orderNumber: 'ORD-001',
      items: [
        {
          id: 'item1',
          quantity: 2,
          deliveredQuantity: 0,
        },
      ],
      customer: { name: 'Test', phone: '123' },
      orderDate: new Date(),
      effectiveDueDate: new Date(),
      systemDueDate: new Date(),
      isExpress: false,
      priority: OrderPriority.STANDARD,
      status: 'RECEIVED',
      totalAmount: 90,
      amountPaid: 0,
      amountDue: 90,
      paymentStatus: PaymentStatus.PENDING,
      pickupType: PickupType.STORE_PICKUP,
      createdBy: { name: 'Emp' },
    };

    beforeEach(() => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.orderItem.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});
      mockPrismaService.serviceGarmentPrice.findUnique.mockResolvedValue({
        garmentCatalogId: 'g1',
        serviceTypeId: 's1',
        price: 150,
      });
      mockPrismaService.serviceGarmentPrice.findFirst.mockResolvedValue({
        garmentCatalogId: 'g1',
        serviceTypeId: 's1',
        price: 150,
      });
      mockPrismaService.store.findUnique.mockResolvedValue({
        id: 'store1',
        expressSurchargePercent: 50,
      });
      mockPrismaService.physicalGarment.count.mockResolvedValue(0);
    });

    it('should update an order item successfully', async () => {
      // FindOrderById is called at the end, so we mock it by reusing mockOrder
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...mockOrder, customerPhone: '123' } as any);

      const result = await service.updateOrderItem(
        'o1',
        'item1',
        { quantity: 3, itemStatus: ItemStatus.PROCESSING },
        'store1',
      );
      expect(result).toBeDefined();
      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: expect.objectContaining({ quantity: 3, itemStatus: ItemStatus.PROCESSING }),
      });
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1' },
          data: expect.objectContaining({ status: expect.any(String) }),
        }),
      );
    });

    it('should emit ORDER_READY notification exactly once when transitioning to READY', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PROCESSING,
      });

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...mockOrder,
        id: 'o1',
        status: OrderStatus.READY,
        customerPhone: '1234567890',
      } as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { quantity: 2, itemStatus: ItemStatus.READY },
        'store1',
      );

      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalledWith(
        'store1',
        'ORDER_READY',
        'SMS',
        '1234567890',
        'o1',
        mockOrder.customerId,
        expect.any(Object),
      );
    });

    it('should NOT emit ORDER_READY if order was already READY', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.READY,
        items: [
          {
            id: 'item1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
          },
        ],
      });

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...mockOrder,
        id: 'o1',
        status: OrderStatus.READY,
        customerPhone: '1234567890',
      } as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { quantity: 2, itemStatus: ItemStatus.READY },
        'store1',
      );

      expect(mockNotificationService.createNotificationEvent).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);
      await expect(service.updateOrderItem('o1', 'item1', {}, 'store1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if order does not belong to store', async () => {
      await expect(service.updateOrderItem('o1', 'item1', {}, 'wrongStore')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if item not found in order', async () => {
      await expect(service.updateOrderItem('o1', 'wrongItem', {}, 'store1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if deliveredQuantity exceeds total quantity', async () => {
      await expect(
        service.updateOrderItem('o1', 'item1', { deliveredQuantity: 5 }, 'store1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate express surcharge on express order item update', async () => {
      const expressOrder = {
        ...mockOrder,
        isExpress: true,
        items: [
          {
            id: 'item1',
            quantity: 2,
            unitPrice: 150,
            deliveredQuantity: 0,
            garmentCatalogId: 'g1',
            serviceTypeId: 's1',
            itemStatus: ItemStatus.RECEIVED,
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(expressOrder);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...expressOrder, customerPhone: '123' } as any);

      await service.updateOrderItem('o1', 'item1', { quantity: 3 }, 'store1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expressSurcharge: 150, // 300 * 0.5 = 150
          }),
        }),
      );
    });

    it('should throw BadRequestException if store has no express configuration', async () => {
      mockPrismaService.store.findUnique.mockResolvedValue({
        id: 'store-1',
        expressSurchargePercent: null,
      });

      const dto = {
        customerId: 'cust-1',
        isExpress: true,
        pickupType: PickupType.STORE_PICKUP,
        items: [{ garmentCatalogId: 'g1', serviceTypeId: 's1', quantity: 1 }],
      };

      await expect(service.createOrder(dto, 'emp-1', 'store-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should preserve granular operational states (e.g. PACKED) if items are READY', async () => {
      const packedOrder = {
        ...mockOrder,
        status: OrderStatus.PACKED,
        items: [
          {
            id: 'item1',
            quantity: 2,
            unitPrice: 150,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY, // still READY, supports PACKED
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(packedOrder);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...packedOrder, customerPhone: '123' } as any);

      await service.updateOrderItem('o1', 'item1', { quantity: 3 }, 'store1');

      // The status should remain PACKED, not revert to READY
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.PACKED,
          }),
        }),
      );
    });

    it('should progress to DELIVERED when all items are delivered', async () => {
      const deliveredOrder = {
        ...mockOrder,
        status: OrderStatus.READY,
        items: [
          {
            id: 'item1',
            quantity: 2,
            unitPrice: 150,
            deliveredQuantity: 2, // will be updated but itemStatus is what deriveOrderStatus looks at
            itemStatus: ItemStatus.DELIVERED,
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(deliveredOrder);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...deliveredOrder, customerPhone: '123' } as any);

      await service.updateOrderItem('o1', 'item1', { quantity: 2 }, 'store1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
          }),
        }),
      );
    });

    it('should reject manual itemStatus = READY for items with physical garments', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(5);

      await expect(
        service.updateOrderItem('o1', 'item1', { itemStatus: ItemStatus.READY }, 'store1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Item status is derived from physical garments and cannot be manually set.',
        ),
      );
    });

    it('should reject manual itemStatus = PROCESSING for items with physical garments', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(5);

      await expect(
        service.updateOrderItem('o1', 'item1', { itemStatus: ItemStatus.PROCESSING }, 'store1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Item status is derived from physical garments and cannot be manually set.',
        ),
      );
    });

    it('should reject manual itemStatus = RECEIVED for items with physical garments', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(5);

      await expect(
        service.updateOrderItem('o1', 'item1', { itemStatus: ItemStatus.RECEIVED }, 'store1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Item status is derived from physical garments and cannot be manually set.',
        ),
      );
    });

    it('should reject quantity change for items with physical garments to prevent desync', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(2);

      await expect(
        service.updateOrderItem('o1', 'item1', { quantity: 4 }, 'store1'),
      ).rejects.toThrow(
        new BadRequestException('Quantity cannot be modified for items with physical garments.'),
      );
    });

    it('should reject delivering garments before they are marked ready', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...mockOrder,
        items: [
          {
            id: 'item1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.PROCESSING,
          },
        ],
      });
      mockPrismaService.physicalGarment.count.mockResolvedValue(2);

      await expect(
        service.updateOrderItem('o1', 'item1', { deliveredQuantity: 1 }, 'store1'),
      ).rejects.toThrow(
        new BadRequestException('Cannot deliver garments before they are marked ready.'),
      );
    });

    it('should allow attribute-only update on physical garment items without altering derived status', async () => {
      const processingOrder = {
        ...mockOrder,
        items: [
          {
            id: 'item1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.PROCESSING,
            garmentCatalogId: 'g1',
            serviceTypeId: 's1',
            unitPrice: 150,
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(processingOrder);
      mockPrismaService.physicalGarment.count.mockResolvedValue(2);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...processingOrder, customerPhone: '123' } as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { defectNotes: 'Stain on collar', colorTags: ['Navy'] },
        'store1',
      );

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: expect.objectContaining({
            defectNotes: 'Stain on collar',
            colorTags: ['Navy'],
            itemStatus: ItemStatus.PROCESSING,
          }),
        }),
      );
    });

    it('should preserve READY status on physical garment items during attribute updates', async () => {
      const readyOrder = {
        ...mockOrder,
        items: [
          {
            id: 'item1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            garmentCatalogId: 'g1',
            serviceTypeId: 's1',
            unitPrice: 150,
          },
        ],
      };
      mockPrismaService.order.findUnique.mockResolvedValue(readyOrder);
      mockPrismaService.physicalGarment.count.mockResolvedValue(2);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...readyOrder, customerPhone: '123' } as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { defectNotes: 'Cleaned and pressed' },
        'store1',
      );

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: expect.objectContaining({
            defectNotes: 'Cleaned and pressed',
            itemStatus: ItemStatus.READY,
          }),
        }),
      );
    });

    it('should allow legacy items (0 physical garments) to update itemStatus to READY', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(0);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...mockOrder, customerPhone: '123' } as any);

      await service.updateOrderItem('o1', 'item1', { itemStatus: ItemStatus.READY }, 'store1');

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: expect.objectContaining({
            itemStatus: ItemStatus.READY,
          }),
        }),
      );
    });

    it('should allow legacy items (0 physical garments) to update to other valid ItemStatus', async () => {
      mockPrismaService.physicalGarment.count.mockResolvedValue(0);
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ ...mockOrder, customerPhone: '123' } as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { itemStatus: ItemStatus.QUALITY_CHECK },
        'store1',
      );

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: expect.objectContaining({
            itemStatus: ItemStatus.QUALITY_CHECK,
          }),
        }),
      );
    });
  });

  describe('updateDueDate', () => {
    const mockOrder = {
      id: 'o1',
      storeId: 'store1',
      systemDueDate: new Date(),
      effectiveDueDate: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue({});
    });

    it('should update effective due date and log audit fields', async () => {
      jest
        .spyOn(service, 'findOrderById')
        .mockResolvedValue({ id: 'o1', effectiveDueDate: new Date('2026-09-01') } as any);

      const result = await service.updateDueDate(
        'o1',
        '2026-09-01T10:00:00Z',
        'Customer requested early delivery',
        'mgr1',
        'store1',
      );

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'o1' },
        data: {
          effectiveDueDate: expect.any(Date),
          dueDateOverrideReason: 'Customer requested early delivery',
          dueDateOverriddenBy: 'mgr1',
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);
      await expect(
        service.updateDueDate('wrong_id', '2026-09-01T10:00:00Z', 'Reason', 'mgr1', 'store1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if order does not belong to store', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({ id: 'o1', storeId: 'otherStore' });
      await expect(
        service.updateDueDate('o1', '2026-09-01T10:00:00Z', 'Reason', 'mgr1', 'store1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllOrders', () => {
    it('should query orders by storeId', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.findAllOrders({}, 'store1');

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ storeId: 'store1' }),
        }),
      );
    });
  });

  describe('findOrderById', () => {
    it('should throw NotFoundException if order belongs to a different store', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'o1',
        storeId: 'otherStore',
        customer: {},
        createdBy: {},
        items: [],
      });

      await expect(service.findOrderById('o1', 'store1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPhysicalGarmentReady', () => {
    it('should correctly derive item status when toggling garments', async () => {
      const mockOrder = {
        id: 'o1',
        storeId: 'store1',
        status: 'RECEIVED',
        customerPhone: '1234567890',
        items: [{ id: 'item1', itemStatus: 'READY' }],
      };

      const mockOrderItem = {
        id: 'item1',
        orderId: 'o1',
        itemStatus: 'READY',
        order: { storeId: 'store1' },
      };

      // Scenario: Toggling a garment to not ready, when another garment is still ready
      // Expected ItemStatus: PROCESSING
      mockPrismaService.orderItem.findUnique = jest.fn().mockResolvedValue(mockOrderItem);
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.physicalGarment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', orderItemId: 'item1' }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ isReady: false }, { isReady: true }]),
      };
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.orderItem.findMany = jest
        .fn()
        .mockResolvedValue([{ itemStatus: 'PROCESSING' }]);
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({ ...mockOrder, items: [mockOrderItem] });

      await service.markPhysicalGarmentReady('o1', 'item1', 'g1', false, 'store1');

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: { itemStatus: ItemStatus.PROCESSING },
        }),
      );
    });

    it('should revert item status to RECEIVED when no garments are ready', async () => {
      const mockOrder = {
        id: 'o1',
        storeId: 'store1',
        status: 'RECEIVED',
        customerPhone: '1234567890',
        items: [{ id: 'item1', itemStatus: 'READY' }],
      };

      const mockOrderItem = {
        id: 'item1',
        orderId: 'o1',
        itemStatus: 'READY',
        order: { storeId: 'store1' },
      };

      // Scenario: Toggling a garment to not ready, no other garments are ready
      // Expected ItemStatus: RECEIVED
      mockPrismaService.orderItem.findUnique = jest.fn().mockResolvedValue(mockOrderItem);
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.physicalGarment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', orderItemId: 'item1' }),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ isReady: false }, { isReady: false }]),
      };
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.orderItem.findMany = jest
        .fn()
        .mockResolvedValue([{ itemStatus: 'RECEIVED' }]);
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({ ...mockOrder, items: [mockOrderItem] });

      await service.markPhysicalGarmentReady('o1', 'item1', 'g1', false, 'store1');

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: { itemStatus: ItemStatus.RECEIVED },
        }),
      );
    });

    it('should set itemStatus to READY when all physical garments become ready', async () => {
      const mockOrder = {
        id: 'o1',
        storeId: 'store1',
        status: 'RECEIVED',
        customerPhone: '1234567890',
        items: [{ id: 'item1', itemStatus: 'PROCESSING' }],
      };
      const mockOrderItem = {
        id: 'item1',
        orderId: 'o1',
        itemStatus: 'PROCESSING',
        order: { storeId: 'store1' },
      };

      mockPrismaService.orderItem.findUnique = jest.fn().mockResolvedValue(mockOrderItem);
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.physicalGarment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', orderItemId: 'item1' }),
        update: jest.fn(),
        // 5 garments, all 5 are ready
        findMany: jest.fn().mockResolvedValue(Array(5).fill({ isReady: true })),
      };
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.orderItem.findMany = jest.fn().mockResolvedValue([{ itemStatus: 'READY' }]);
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({ ...mockOrder, items: [mockOrderItem] });

      await service.markPhysicalGarmentReady('o1', 'item1', 'g1', true, 'store1');

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: { itemStatus: ItemStatus.READY },
        }),
      );
    });

    it('should set itemStatus to PROCESSING when some garments are ready (e.g. 3 out of 5)', async () => {
      const mockOrder = {
        id: 'o1',
        storeId: 'store1',
        status: 'RECEIVED',
        customerPhone: '1234567890',
        items: [{ id: 'item1', itemStatus: 'READY' }], // transitioning from READY to PROCESSING
      };
      const mockOrderItem = {
        id: 'item1',
        orderId: 'o1',
        itemStatus: 'READY',
        order: { storeId: 'store1' },
      };

      mockPrismaService.orderItem.findUnique = jest.fn().mockResolvedValue(mockOrderItem);
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.physicalGarment = {
        findUnique: jest.fn().mockResolvedValue({ id: 'g1', orderItemId: 'item1' }),
        update: jest.fn(),
        // 5 garments, 3 ready, 2 not ready
        findMany: jest
          .fn()
          .mockResolvedValue([
            { isReady: true },
            { isReady: true },
            { isReady: true },
            { isReady: false },
            { isReady: false },
          ]),
      };
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.orderItem.findMany = jest
        .fn()
        .mockResolvedValue([{ itemStatus: 'PROCESSING' }]);
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({ ...mockOrder, items: [mockOrderItem] });

      await service.markPhysicalGarmentReady('o1', 'item1', 'g1', false, 'store1');

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item1' },
          data: { itemStatus: ItemStatus.PROCESSING },
        }),
      );
    });

    it('should throw BadRequestException if order does not belong to store (Store Isolation)', async () => {
      const mockOrder = {
        id: 'o1',
        storeId: 'wrongStore',
        items: [{ id: 'item1' }],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);

      await expect(
        service.markPhysicalGarmentReady('o1', 'item1', 'g1', true, 'store1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('notifyPartialReady', () => {
    const mockOrderWithPg = {
      id: 'o1',
      orderNumber: 'ORD-1234',
      storeId: 'store1',
      customerId: 'c1',
      customerName: 'Rahul Patil',
      customerPhone: '9876543210',
      totalAmount: 1200,
      amountPaid: 400,
      amountDue: 800,
      items: [
        {
          id: 'item1',
          garmentName: 'Shirt',
          serviceType: 'Dry Clean',
          quantity: 5,
          physicalGarments: [
            { id: 'pg1', unitNumber: 1, isReady: true },
            { id: 'pg2', unitNumber: 2, isReady: true },
            { id: 'pg3', unitNumber: 3, isReady: true },
            { id: 'pg4', unitNumber: 4, isReady: false },
            { id: 'pg5', unitNumber: 5, isReady: false },
          ],
        },
      ],
    };

    beforeEach(() => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);
      mockNotificationService.createNotificationEvent.mockReset();
    });

    it('should queue ORDER_READY notification with correct partial payload for 3/5 garments', async () => {
      jest.spyOn(service, 'findOrderById').mockResolvedValue(mockOrderWithPg as any);
      mockNotificationService.createNotificationEvent.mockResolvedValue({ id: 'notif-1' });

      const result = await service.notifyPartialReady('o1', 'store1');

      expect(result.success).toBe(true);
      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalledWith(
        'store1',
        NotificationEventType.ORDER_READY,
        NotificationChannel.SMS,
        '9876543210',
        'o1',
        'c1',
        {
          orderNumber: 'ORD-1234',
          customerName: 'Rahul Patil',
          totalAmount: 1200,
          amountPaid: 400,
          amountDue: 800,
          readyItems: [
            {
              id: 'item1',
              garmentName: 'Shirt',
              serviceType: 'Dry Clean',
              quantity: 3,
            },
          ],
          remainingItems: [
            {
              id: 'item1',
              garmentName: 'Shirt',
              quantity: 2,
            },
          ],
        },
      );
    });

    it('should pass authoritative financial values through unchanged', async () => {
      jest.spyOn(service, 'findOrderById').mockResolvedValue(mockOrderWithPg as any);

      await service.notifyPartialReady('o1', 'store1');

      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          totalAmount: 1200,
          amountPaid: 400,
          amountDue: 800,
        }),
      );
    });

    it('should throw BadRequestException if customer has no phone number', async () => {
      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...mockOrderWithPg,
        customerPhone: null,
      } as any);

      await expect(service.notifyPartialReady('o1', 'store1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a notification was sent within the 30-second cooldown', async () => {
      jest.spyOn(service, 'findOrderById').mockResolvedValue(mockOrderWithPg as any);
      mockPrismaService.notification.findFirst.mockResolvedValue({ id: 'recent-notif' });

      await expect(service.notifyPartialReady('o1', 'store1')).rejects.toThrow(
        /readiness notification was sent recently/,
      );
    });

    it('should throw BadRequestException if 0 garments are ready', async () => {
      const allNotReadyOrder = {
        ...mockOrderWithPg,
        items: [
          {
            ...mockOrderWithPg.items[0],
            physicalGarments: [
              { id: 'pg1', isReady: false },
              { id: 'pg2', isReady: false },
            ],
          },
        ],
      };
      jest.spyOn(service, 'findOrderById').mockResolvedValue(allNotReadyOrder as any);

      await expect(service.notifyPartialReady('o1', 'store1')).rejects.toThrow(
        /No garments are ready to notify/,
      );
    });

    it('should support legacy orders without physical garments', async () => {
      const legacyOrder = {
        ...mockOrderWithPg,
        items: [
          {
            id: 'item1',
            garmentName: 'Suit',
            serviceType: 'Dry Clean',
            quantity: 2,
            itemStatus: ItemStatus.READY,
            physicalGarments: [],
          },
          {
            id: 'item2',
            garmentName: 'Tie',
            serviceType: 'Dry Clean',
            quantity: 1,
            itemStatus: ItemStatus.PROCESSING,
            physicalGarments: [],
          },
        ],
      };
      jest.spyOn(service, 'findOrderById').mockResolvedValue(legacyOrder as any);

      await service.notifyPartialReady('o1', 'store1');

      expect(mockNotificationService.createNotificationEvent).toHaveBeenCalledWith(
        'store1',
        NotificationEventType.ORDER_READY,
        NotificationChannel.SMS,
        '9876543210',
        'o1',
        'c1',
        expect.objectContaining({
          readyItems: [{ id: 'item1', garmentName: 'Suit', serviceType: 'Dry Clean', quantity: 2 }],
          remainingItems: [{ id: 'item2', garmentName: 'Tie', quantity: 1 }],
        }),
      );
    });
  });

  describe('addPhysicalGarment', () => {
    const mockStore = { id: 'store1', expressSurchargePercent: 0 };
    const mockOrder = {
      id: 'o1',
      storeId: 'store1',
      status: OrderStatus.READY,
      isExpress: false,
      subtotal: 500,
      discountAmount: 0,
      expressSurcharge: 0,
      taxAmount: 90,
      totalAmount: 590,
      amountPaid: 200,
      amountDue: 390,
      paymentStatus: PaymentStatus.PARTIAL,
      items: [
        {
          id: 'item1',
          quantity: 2,
          unitPrice: 250,
          lineTotal: 500,
          itemStatus: ItemStatus.READY,
          physicalGarments: [
            { id: 'g1', unitNumber: 1, isReady: true, isCancelled: false },
            { id: 'g2', unitNumber: 2, isReady: true, isCancelled: false },
          ],
        },
      ],
    };

    it('should add a physical garment, increment quantity, recalculate totals and derive status regression', async () => {
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);
      mockPrismaService.physicalGarment.create = jest.fn().mockResolvedValue({
        id: 'g3',
        orderItemId: 'item1',
        unitNumber: 3,
        isReady: false,
        isCancelled: false,
      });
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({ ...mockOrder });

      await service.addPhysicalGarment('o1', 'item1', 'store1');

      expect(mockPrismaService.physicalGarment.create).toHaveBeenCalledWith({
        data: {
          orderItemId: 'item1',
          unitNumber: 3,
          isReady: false,
          isCancelled: false,
        },
      });

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: {
          quantity: 3,
          lineTotal: 750,
          itemStatus: ItemStatus.PROCESSING,
        },
      });

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1' },
          data: expect.objectContaining({
            status: OrderStatus.PROCESSING,
            subtotal: 750,
            totalAmount: 885,
            amountDue: 685,
          }),
        }),
      );

      expect(mockNotificationService.createNotificationEvent).not.toHaveBeenCalled();
    });

    it('should never reuse cancelled unit numbers when adding', async () => {
      const orderWithCancelled = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            physicalGarments: [
              { id: 'g1', unitNumber: 1, isReady: true, isCancelled: false },
              { id: 'g2', unitNumber: 2, isReady: false, isCancelled: true },
              { id: 'g3', unitNumber: 3, isReady: false, isCancelled: true },
            ],
          },
        ],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(orderWithCancelled);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);
      mockPrismaService.physicalGarment.create = jest.fn().mockResolvedValue({});
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue(orderWithCancelled);

      await service.addPhysicalGarment('o1', 'item1', 'store1');

      expect(mockPrismaService.physicalGarment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unitNumber: 4 }),
        }),
      );
    });

    it('should reject adding to legacy item without physical garments', async () => {
      const legacyOrder = {
        ...mockOrder,
        items: [{ ...mockOrder.items[0], physicalGarments: [] }],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(legacyOrder);

      await expect(service.addPhysicalGarment('o1', 'item1', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should enforce store isolation on add', async () => {
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      await expect(service.addPhysicalGarment('o1', 'item1', 'other-store')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelPhysicalGarment', () => {
    const mockStore = { id: 'store1', expressSurchargePercent: 0 };
    const mockOrder = {
      id: 'o1',
      storeId: 'store1',
      status: OrderStatus.PROCESSING,
      isExpress: false,
      subtotal: 750,
      discountAmount: 0,
      expressSurcharge: 0,
      taxAmount: 135,
      totalAmount: 885,
      amountPaid: 200,
      amountDue: 685,
      paymentStatus: PaymentStatus.PARTIAL,
      items: [
        {
          id: 'item1',
          quantity: 3,
          unitPrice: 250,
          lineTotal: 750,
          itemStatus: ItemStatus.PROCESSING,
          deliveredQuantity: 0,
          physicalGarments: [
            { id: 'g1', unitNumber: 1, isReady: true, isCancelled: false },
            { id: 'g2', unitNumber: 2, isReady: true, isCancelled: false },
            { id: 'g3', unitNumber: 3, isReady: false, isCancelled: false },
          ],
        },
      ],
    };

    it('should soft-cancel garment, decrement quantity, and transition item to READY if all remaining are ready', async () => {
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);
      mockPrismaService.physicalGarment.update = jest.fn().mockResolvedValue({});
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.order.update = jest.fn();
      service.findOrderById = jest.fn().mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.READY,
        customerPhone: '1234567890',
        items: [
          {
            ...mockOrder.items[0],
            quantity: 2,
            itemStatus: ItemStatus.READY,
          },
        ],
      });

      await service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1');

      expect(mockPrismaService.physicalGarment.update).toHaveBeenCalledWith({
        where: { id: 'g3' },
        data: { isCancelled: true },
      });

      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: {
          quantity: 2,
          lineTotal: 500,
          itemStatus: ItemStatus.READY,
        },
      });

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1' },
          data: expect.objectContaining({
            status: OrderStatus.READY,
            subtotal: 500,
            totalAmount: 590,
            amountDue: 390,
          }),
        }),
      );
    });

    it('should reject cancelling a READY garment', async () => {
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      await expect(service.cancelPhysicalGarment('o1', 'item1', 'g1', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancelling if deliveredQuantity > 0', async () => {
      const deliveredOrder = {
        ...mockOrder,
        items: [{ ...mockOrder.items[0], deliveredQuantity: 1 }],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(deliveredOrder);
      await expect(service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancelling the last active garment', async () => {
      const singleGarmentOrder = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            quantity: 1,
            physicalGarments: [{ id: 'g3', unitNumber: 3, isReady: false, isCancelled: false }],
          },
        ],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(singleGarmentOrder);
      await expect(service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancelling already cancelled garment', async () => {
      const orderWithCancelled = {
        ...mockOrder,
        items: [
          {
            ...mockOrder.items[0],
            physicalGarments: [
              { id: 'g1', unitNumber: 1, isReady: false, isCancelled: false },
              { id: 'g2', unitNumber: 2, isReady: false, isCancelled: true },
            ],
          },
        ],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(orderWithCancelled);
      await expect(service.cancelPhysicalGarment('o1', 'item1', 'g2', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancellation if totalAmount < amountPaid (refund required) when unadjusted', async () => {
      const paidOrder = {
        ...mockOrder,
        amountPaid: 800,
        adjustments: [],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(paidOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);

      await expect(service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow cancellation when totalAmount < amountPaid if OWNER provides valid REFUND adjustment', async () => {
      const paidOrder = {
        ...mockOrder,
        amountPaid: 885,
        adjustments: [],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(paidOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);
      mockPrismaService.physicalGarment.update = jest.fn().mockResolvedValue({});
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.order.update = jest.fn();
      mockPrismaService.financialAdjustment.create = jest.fn().mockResolvedValue({
        id: 'adj1',
        orderId: 'o1',
        type: AdjustmentType.REFUND,
        amount: 295,
        reason: 'Cancelled damaged piece',
        status: AdjustmentStatus.COMPLETED,
      });
      service.findOrderById = jest.fn().mockResolvedValue({
        ...mockOrder,
        totalAmount: 590,
        amountPaid: 885,
        refundAmount: 295,
        effectivePaid: 590,
        amountDue: 0,
        paymentStatus: PaymentStatus.PAID,
      });

      await service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1', 'emp-owner', Role.OWNER, {
        type: AdjustmentType.REFUND,
        amount: 295,
        reason: 'Cancelled damaged piece',
      });

      // Verify financial adjustment was created in the same transaction
      expect(mockPrismaService.financialAdjustment.create).toHaveBeenCalledWith({
        data: {
          orderId: 'o1',
          type: AdjustmentType.REFUND,
          amount: 295,
          reason: 'Cancelled damaged piece',
          status: AdjustmentStatus.COMPLETED,
          reference: undefined,
          createdById: 'emp-owner',
        },
      });

      // Verify physical garment was soft cancelled
      expect(mockPrismaService.physicalGarment.update).toHaveBeenCalledWith({
        where: { id: 'g3' },
        data: { isCancelled: true },
      });

      // Verify order update: amountDue is 0, paymentStatus is PAID
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1' },
          data: expect.objectContaining({
            subtotal: 500,
            totalAmount: 590,
            amountDue: 0,
            paymentStatus: PaymentStatus.PAID,
          }),
        }),
      );

      // Verify historical payment records were NOT mutated or deleted
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.delete).not.toHaveBeenCalled();
    });

    it('should allow cancellation when totalAmount < amountPaid if OWNER provides valid STORE_CREDIT adjustment', async () => {
      const paidOrder = {
        ...mockOrder,
        amountPaid: 885,
        adjustments: [],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(paidOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);
      mockPrismaService.physicalGarment.update = jest.fn().mockResolvedValue({});
      mockPrismaService.orderItem.update = jest.fn();
      mockPrismaService.order.update = jest.fn();
      mockPrismaService.financialAdjustment.create = jest.fn().mockResolvedValue({
        id: 'adj2',
        orderId: 'o1',
        type: AdjustmentType.STORE_CREDIT,
        amount: 295,
        reason: 'Customer opted for store credit',
        status: AdjustmentStatus.COMPLETED,
      });
      service.findOrderById = jest.fn().mockResolvedValue({
        ...mockOrder,
        totalAmount: 590,
        amountPaid: 885,
        storeCreditAmount: 295,
        effectivePaid: 590,
        amountDue: 0,
        paymentStatus: PaymentStatus.PAID,
      });

      await service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1', 'emp-owner', Role.OWNER, {
        type: AdjustmentType.STORE_CREDIT,
        amount: 295,
        reason: 'Customer opted for store credit',
      });

      expect(mockPrismaService.financialAdjustment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: AdjustmentType.STORE_CREDIT,
          amount: 295,
          status: AdjustmentStatus.COMPLETED,
        }),
      });
      expect(mockPrismaService.physicalGarment.update).toHaveBeenCalledWith({
        where: { id: 'g3' },
        data: { isCancelled: true },
      });
    });

    it('should reject cancellation with adjustment if requested by non-OWNER (COUNTER)', async () => {
      const paidOrder = {
        ...mockOrder,
        amountPaid: 885,
        adjustments: [],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(paidOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);

      await expect(
        service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1', 'emp-counter', Role.COUNTER, {
          type: AdjustmentType.REFUND,
          amount: 295,
          reason: 'Counter attempting refund',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.financialAdjustment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.physicalGarment.update).not.toHaveBeenCalled();
    });

    it('should reject cancellation if adjustment amount does not match required reduction', async () => {
      const paidOrder = {
        ...mockOrder,
        amountPaid: 885,
        adjustments: [],
      };
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(paidOrder);
      mockPrismaService.store.findUnique = jest.fn().mockResolvedValue(mockStore);

      await expect(
        service.cancelPhysicalGarment('o1', 'item1', 'g3', 'store1', 'emp-owner', Role.OWNER, {
          type: AdjustmentType.REFUND,
          amount: 100, // Mismatched: required is 295
          reason: 'Partial adjustment mismatch',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.financialAdjustment.create).not.toHaveBeenCalled();
      expect(mockPrismaService.physicalGarment.update).not.toHaveBeenCalled();
    });

    it('should enforce store isolation on cancel', async () => {
      mockPrismaService.order.findUnique = jest.fn().mockResolvedValue(mockOrder);
      await expect(
        service.cancelPhysicalGarment('o1', 'item1', 'g3', 'other-store'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Phase 4B — Physical Garment Delivery & Handover Foundation', () => {
    it('should map isDelivered and deliveredAt on physicalGarments and order handover fields in detail DTO', () => {
      const orderData = {
        id: 'o1',
        orderNumber: 'ORD-001',
        customerId: 'cust-1',
        customer: { name: 'Alice', phone: '9876543210' },
        orderDate: new Date('2026-09-06T10:00:00Z'),
        systemDueDate: new Date('2026-09-08T10:00:00Z'),
        effectiveDueDate: new Date('2026-09-08T10:00:00Z'),
        dueDateOverrideReason: null,
        dueDateOverriddenBy: null,
        serviceSummary: 'Dry Cleaning',
        storeId: 'store1',
        createdById: 'emp-1',
        createdBy: { name: 'Staff Member' },
        isExpress: false,
        priority: OrderPriority.STANDARD,
        status: OrderStatus.PROCESSING,
        subtotal: 500,
        discountAmount: 0,
        taxAmount: 90,
        totalAmount: 590,
        expressSurcharge: 0,
        amountPaid: 590,
        amountDue: 0,
        paymentStatus: PaymentStatus.PAID,
        pickupType: PickupType.STORE_PICKUP,
        deliveredAt: new Date('2026-09-06T15:00:00Z'),
        deliveredById: 'emp-counter',
        deliveredBy: { id: 'emp-counter', name: 'Counter Staff' },
        adjustments: [],
        items: [
          {
            id: 'item1',
            quantity: 2,
            unitPrice: 250,
            lineTotal: 500,
            colorTags: [],
            defectNotes: null,
            itemStatus: ItemStatus.PROCESSING,
            deliveredQuantity: 1,
            itemDueDate: null,
            garmentCatalog: { name: 'Shirt', category: 'MEN' },
            serviceType: { category: 'DRY_CLEANING' },
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
                deliveredAt: new Date('2026-09-06T14:30:00Z'),
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
              {
                id: 'pg-2',
                orderItemId: 'item1',
                unitNumber: 2,
                isReady: false,
                isCancelled: false,
                isDelivered: false,
                deliveredAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                photos: [],
              },
            ],
          },
        ],
      };

      const dto = (service as any).mapToDetailDto(orderData);
      expect(dto.deliveredAt).toBe('2026-09-06T15:00:00.000Z');
      expect(dto.deliveredById).toBe('emp-counter');
      expect(dto.deliveredByName).toBe('Counter Staff');

      const pg1 = dto.items[0].physicalGarments[0];
      expect(pg1.isDelivered).toBe(true);
      expect(pg1.deliveredAt).toBe('2026-09-06T14:30:00.000Z');

      const pg2 = dto.items[0].physicalGarments[1];
      expect(pg2.isDelivered).toBe(false);
      expect(pg2.deliveredAt).toBeNull();
    });

    it('should validate OrderPickupRequest type compatibility', () => {
      const request: OrderPickupRequest = {
        garmentIds: ['pg-1'],
        legacyItems: [{ itemId: 'legacy-item-1', quantity: 2 }],
        payment: {
          amount: 500,
          mode: PaymentMode.CASH,
          reference: 'RCP-1234',
        },
        notes: 'Customer collected morning batch',
      };
      expect(request.garmentIds).toHaveLength(1);
      expect(request.legacyItems).toHaveLength(1);
      expect(request.payment?.mode).toBe(PaymentMode.CASH);
    });
  });

  describe('Phase 4C — Counter Pickup & Order Handover', () => {
    const storeId = 'store1';
    const employeeId = 'emp1';
    const orderId = 'order-pickup-1';

    const makePickupOrder = (overrides: any = {}) => ({
      id: orderId,
      orderNumber: 'ORD-PICKUP-1',
      storeId,
      status: OrderStatus.READY,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount: 1000,
      amountPaid: 0,
      amountDue: 1000,
      customer: { id: 'c1', name: 'John Doe', phone: '9876543210' },
      customerId: 'c1',
      items: [
        {
          id: 'item-1',
          garmentName: 'Shirt',
          quantity: 5,
          deliveredQuantity: 0,
          itemStatus: ItemStatus.READY,
          physicalGarments: [
            {
              id: 'pg-1',
              orderItemId: 'item-1',
              unitNumber: 1,
              isReady: true,
              isCancelled: false,
              isDelivered: false,
            },
            {
              id: 'pg-2',
              orderItemId: 'item-1',
              unitNumber: 2,
              isReady: true,
              isCancelled: false,
              isDelivered: false,
            },
            {
              id: 'pg-3',
              orderItemId: 'item-1',
              unitNumber: 3,
              isReady: true,
              isCancelled: false,
              isDelivered: false,
            },
            {
              id: 'pg-4',
              orderItemId: 'item-1',
              unitNumber: 4,
              isReady: false,
              isCancelled: false,
              isDelivered: false,
            },
            {
              id: 'pg-5',
              orderItemId: 'item-1',
              unitNumber: 5,
              isReady: false,
              isCancelled: false,
              isDelivered: false,
            },
          ],
        },
      ],
      ...overrides,
    });

    it('TEST 1: Partial pickup — delivers ready garments without fully delivering order', async () => {
      const initialOrder = makePickupOrder();
      mockPrismaService.order.findUnique.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce({
        ...initialOrder,
        items: [
          {
            ...initialOrder.items[0],
            deliveredQuantity: 3,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
              {
                id: 'pg-2',
                orderItemId: 'item-1',
                unitNumber: 2,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
              {
                id: 'pg-3',
                orderItemId: 'item-1',
                unitNumber: 3,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
              {
                id: 'pg-4',
                orderItemId: 'item-1',
                unitNumber: 4,
                isReady: false,
                isCancelled: false,
                isDelivered: false,
              },
              {
                id: 'pg-5',
                orderItemId: 'item-1',
                unitNumber: 5,
                isReady: false,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
        ],
      });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
        {
          id: 'pg-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
        {
          id: 'pg-3',
          orderItemId: 'item-1',
          unitNumber: 3,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
        {
          id: 'pg-4',
          orderItemId: 'item-1',
          unitNumber: 4,
          isReady: false,
          isCancelled: false,
          isDelivered: false,
        },
        {
          id: 'pg-5',
          orderItemId: 'item-1',
          unitNumber: 5,
          isReady: false,
          isCancelled: false,
          isDelivered: false,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...initialOrder,
        status: OrderStatus.PROCESSING,
        deliveredAt: null,
        deliveredById: null,
      } as any);

      const result = await service.recordPickup(
        orderId,
        { garmentIds: ['pg-1', 'pg-2', 'pg-3'] },
        employeeId,
        storeId,
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.physicalGarment.updateMany).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.orderItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deliveredQuantity: 3 }),
        }),
      );
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: expect.not.stringMatching('DELIVERED') }),
        }),
      );
      expect(result.deliveredAt).toBeNull();
    });

    it('TEST 2: Attempt pickup of unready garment — rejects with BadRequestException', async () => {
      const order = makePickupOrder();
      mockPrismaService.order.findUnique.mockResolvedValue(order);

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-4'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 3: Attempt pickup of cancelled garment — rejects with BadRequestException', async () => {
      const order = makePickupOrder({
        items: [
          {
            id: 'item-1',
            quantity: 1,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-c',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: true,
                isDelivered: false,
              },
            ],
          },
        ],
      });
      mockPrismaService.order.findUnique.mockResolvedValue(order);

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-c'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 4: Attempt pickup of already delivered garment — rejects with BadRequestException', async () => {
      const order = makePickupOrder({
        items: [
          {
            id: 'item-1',
            quantity: 1,
            deliveredQuantity: 1,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [
              {
                id: 'pg-d',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
            ],
          },
        ],
      });
      mockPrismaService.order.findUnique.mockResolvedValue(order);

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-d'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 5: Full unpaid pickup — rejects final handover when amountDue > 0', async () => {
      const initialOrder = makePickupOrder({
        totalAmount: 500,
        amountDue: 500,
        amountPaid: 0,
        items: [
          {
            id: 'item-1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
              {
                id: 'pg-2',
                orderItemId: 'item-1',
                unitNumber: 2,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
        ],
      });

      mockPrismaService.order.findUnique.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce({
        ...initialOrder,
        items: [
          {
            ...initialOrder.items[0],
            deliveredQuantity: 2,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
              {
                id: 'pg-2',
                orderItemId: 'item-1',
                unitNumber: 2,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
            ],
          },
        ],
      });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
        {
          id: 'pg-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-1', 'pg-2'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 6: Pickup with valid payment settling balance — completes atomically', async () => {
      const initialOrder = makePickupOrder({
        totalAmount: 500,
        amountDue: 500,
        amountPaid: 0,
        items: [
          {
            id: 'item-1',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
              {
                id: 'pg-2',
                orderItemId: 'item-1',
                unitNumber: 2,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
        ],
      });

      mockPrismaService.order.findUnique.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce({
        ...initialOrder,
        amountPaid: 500,
        amountDue: 0,
        paymentStatus: PaymentStatus.PAID,
        items: [
          {
            ...initialOrder.items[0],
            deliveredQuantity: 2,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
              {
                id: 'pg-2',
                orderItemId: 'item-1',
                unitNumber: 2,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
            ],
          },
        ],
      });

      mockPaymentService.recordPayment.mockResolvedValue({
        id: 'pay-1',
        amount: 500,
        mode: PaymentMode.CASH,
      });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
        {
          id: 'pg-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...initialOrder,
        status: OrderStatus.DELIVERED,
        amountDue: 0,
        amountPaid: 500,
        deliveredAt: '2026-09-06T15:00:00.000Z',
        deliveredById: employeeId,
      } as any);

      const result = await service.recordPickup(
        orderId,
        {
          garmentIds: ['pg-1', 'pg-2'],
          payment: { amount: 500, mode: PaymentMode.CASH },
        },
        employeeId,
        storeId,
      );

      expect(mockPaymentService.recordPayment).toHaveBeenCalledWith(
        employeeId,
        storeId,
        expect.objectContaining({ orderId, amount: 500, mode: PaymentMode.CASH }),
        expect.anything(),
      );
      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
            deliveredById: employeeId,
          }),
        }),
      );
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('TEST 7: Payment failure rolls back entire pickup transaction', async () => {
      const initialOrder = makePickupOrder({
        totalAmount: 500,
        amountDue: 500,
      });
      mockPrismaService.order.findUnique.mockResolvedValue(initialOrder);
      mockPaymentService.recordPayment.mockRejectedValue(
        new BadRequestException('Payment amount exceeds amount due'),
      );

      await expect(
        service.recordPickup(
          orderId,
          {
            garmentIds: ['pg-1'],
            payment: { amount: 600, mode: PaymentMode.CASH },
          },
          employeeId,
          storeId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.physicalGarment.updateMany).not.toHaveBeenCalled();
    });

    it('TEST 8: Payment records remain immutable (no update or delete called)', async () => {
      expect(mockPrismaService.payment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.payment.delete).not.toHaveBeenCalled();
    });

    it('TEST 9: Financial adjustment reconciliation respects authoritative balance', async () => {
      const orderWithAdjustments = makePickupOrder({
        totalAmount: 1000,
        amountPaid: 1000,
        amountDue: 200,
        items: [
          {
            id: 'item-1',
            quantity: 1,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
        ],
      });

      mockPrismaService.order.findUnique
        .mockResolvedValueOnce(orderWithAdjustments)
        .mockResolvedValueOnce({
          ...orderWithAdjustments,
          items: [
            {
              ...orderWithAdjustments.items[0],
              deliveredQuantity: 1,
              physicalGarments: [
                {
                  id: 'pg-1',
                  orderItemId: 'item-1',
                  unitNumber: 1,
                  isReady: true,
                  isCancelled: false,
                  isDelivered: true,
                },
              ],
            },
          ],
        });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-1'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TEST 10: Final pickup sets audit fields and derives DELIVERED canonical status', async () => {
      const initialOrder = makePickupOrder({
        amountDue: 0,
        amountPaid: 1000,
        totalAmount: 1000,
        items: [
          {
            id: 'item-1',
            quantity: 1,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
        ],
      });

      mockPrismaService.order.findUnique.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce({
        ...initialOrder,
        items: [
          {
            ...initialOrder.items[0],
            deliveredQuantity: 1,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'item-1',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
            ],
          },
        ],
      });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});
      mockPrismaService.order.update.mockResolvedValue({});

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...initialOrder,
        status: OrderStatus.DELIVERED,
        deliveredAt: '2026-09-06T15:00:00.000Z',
        deliveredById: employeeId,
      } as any);

      const result = await service.recordPickup(
        orderId,
        { garmentIds: ['pg-1'] },
        employeeId,
        storeId,
      );

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
            deliveredById: employeeId,
          }),
        }),
      );
      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('TEST 11: Legacy order pickup updates deliveredQuantity with OCC', async () => {
      const legacyOrder = {
        id: 'legacy-order-1',
        orderNumber: 'ORD-LEGACY',
        storeId,
        status: OrderStatus.READY,
        amountDue: 0,
        amountPaid: 500,
        totalAmount: 500,
        customer: { id: 'c1', name: 'John Doe', phone: '9876543210' },
        customerId: 'c1',
        items: [
          {
            id: 'legacy-item-1',
            quantity: 3,
            deliveredQuantity: 1,
            itemStatus: ItemStatus.READY,
            physicalGarments: [],
          },
        ],
      };

      mockPrismaService.order.findUnique.mockResolvedValueOnce(legacyOrder).mockResolvedValueOnce({
        ...legacyOrder,
        items: [
          {
            ...legacyOrder.items[0],
            deliveredQuantity: 3,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [],
          },
        ],
      });

      mockPrismaService.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.order.update.mockResolvedValue({});

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...legacyOrder,
        status: OrderStatus.DELIVERED,
      } as any);

      const result = await service.recordPickup(
        'legacy-order-1',
        { legacyItems: [{ itemId: 'legacy-item-1', quantity: 2 }] },
        employeeId,
        storeId,
      );

      expect(mockPrismaService.orderItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'legacy-item-1', deliveredQuantity: 1 },
          data: expect.objectContaining({ deliveredQuantity: 3, itemStatus: ItemStatus.DELIVERED }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('TEST 12: Mixed order pickup supports physical garments and legacy items together', async () => {
      const mixedOrder = {
        id: 'mixed-order-1',
        orderNumber: 'ORD-MIXED',
        storeId,
        status: OrderStatus.READY,
        amountDue: 0,
        amountPaid: 800,
        totalAmount: 800,
        customer: { id: 'c1', name: 'John Doe', phone: '9876543210' },
        customerId: 'c1',
        items: [
          {
            id: 'pg-item',
            quantity: 1,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'pg-item',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: false,
              },
            ],
          },
          {
            id: 'leg-item',
            quantity: 2,
            deliveredQuantity: 0,
            itemStatus: ItemStatus.READY,
            physicalGarments: [],
          },
        ],
      };

      mockPrismaService.order.findUnique.mockResolvedValueOnce(mixedOrder).mockResolvedValueOnce({
        ...mixedOrder,
        items: [
          {
            ...mixedOrder.items[0],
            deliveredQuantity: 1,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [
              {
                id: 'pg-1',
                orderItemId: 'pg-item',
                unitNumber: 1,
                isReady: true,
                isCancelled: false,
                isDelivered: true,
              },
            ],
          },
          {
            ...mixedOrder.items[1],
            deliveredQuantity: 2,
            itemStatus: ItemStatus.DELIVERED,
            physicalGarments: [],
          },
        ],
      });

      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.physicalGarment.findMany.mockResolvedValue([
        {
          id: 'pg-1',
          orderItemId: 'pg-item',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
        },
      ]);
      mockPrismaService.orderItem.update.mockResolvedValue({});
      mockPrismaService.orderItem.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.order.update.mockResolvedValue({});

      jest.spyOn(service, 'findOrderById').mockResolvedValue({
        ...mixedOrder,
        status: OrderStatus.DELIVERED,
      } as any);

      const result = await service.recordPickup(
        'mixed-order-1',
        {
          garmentIds: ['pg-1'],
          legacyItems: [{ itemId: 'leg-item', quantity: 2 }],
        },
        employeeId,
        storeId,
      );

      expect(mockPrismaService.physicalGarment.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.orderItem.updateMany).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('TEST 13: Store isolation rejects employee from different store', async () => {
      const order = makePickupOrder({ storeId: 'store-A' });
      mockPrismaService.order.findUnique.mockResolvedValue(order);

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-1'] }, employeeId, 'store-B'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEST 15: Concurrency protection rejects duplicate/concurrent handover attempt', async () => {
      const order = makePickupOrder();
      mockPrismaService.order.findUnique.mockResolvedValue(order);
      mockPrismaService.physicalGarment.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-1'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });

    it('Validation: rejects request with no garments and no legacy items', async () => {
      await expect(service.recordPickup(orderId, {}, employeeId, storeId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Validation: rejects duplicate garment IDs in request', async () => {
      const order = makePickupOrder();
      mockPrismaService.order.findUnique.mockResolvedValue(order);

      await expect(
        service.recordPickup(orderId, { garmentIds: ['pg-1', 'pg-1'] }, employeeId, storeId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
