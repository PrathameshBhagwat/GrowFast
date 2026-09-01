import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PaymentStatus, PickupType, OrderPriority, ItemStatus, OrderStatus, calculateOrderTotals } from '@growfast/shared-types';

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
  },
  serviceGarmentPrice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  store: {
    findUnique: jest.fn(),
  },
};

const mockCatalogService = {};

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CatalogService, useValue: mockCatalogService },
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
      const expectedTotals = calculateOrderTotals(
        [{ unitPrice: 150, quantity: 2 }],
        { isExpress: true, expressSurchargePercent: 50 },
      );
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
      mockPrismaService.store.findUnique.mockResolvedValue({
        id: 'store1',
        expressSurchargePercent: 50,
      });
    });

    it('should update an order item successfully', async () => {
      // FindOrderById is called at the end, so we mock it by reusing mockOrder
      jest.spyOn(service, 'findOrderById').mockResolvedValue(mockOrder as any);

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
      jest.spyOn(service, 'findOrderById').mockResolvedValue(expressOrder as any);

      await service.updateOrderItem(
        'o1',
        'item1',
        { quantity: 3 },
        'store1',
      );

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
      jest.spyOn(service, 'findOrderById').mockResolvedValue(packedOrder as any);

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
      jest.spyOn(service, 'findOrderById').mockResolvedValue(deliveredOrder as any);

      await service.updateOrderItem('o1', 'item1', { quantity: 2 }, 'store1');

      expect(mockPrismaService.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: OrderStatus.DELIVERED,
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
});
