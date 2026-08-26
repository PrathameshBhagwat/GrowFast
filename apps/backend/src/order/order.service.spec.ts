import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { PaymentStatus, PickupType, OrderPriority, ItemStatus } from '@growfast/shared-types';

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
          }),
        }),
      );
    });

    it('should calculate the exact same due date even if isExpress is true (B6 Regression)', async () => {
      const expressDto = { ...validDto, isExpress: true };
      await service.createOrder(expressDto, 'emp1', 'store1');

      expect(mockPrismaService.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            systemDueDate: expect.any(Date),
            effectiveDueDate: expect.any(Date),
            priority: OrderPriority.EXPRESS,
            isExpress: true,
          }),
        }),
      );

      // We'll capture the call and check that systemDueDate has the normal +2 days logic
      const callArgs = mockPrismaService.order.create.mock.calls[0][0];

      const orderDate = callArgs.data.orderDate;
      const expectedSystemDueDate = new Date(orderDate);
      // It should be strictly +2 days as mocked in mockService.estimatedDays = 2
      expectedSystemDueDate.setDate(expectedSystemDueDate.getDate() + 2);

      expect(callArgs.data.systemDueDate).toEqual(expectedSystemDueDate);
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
  });

  describe('updateDueDate', () => {
    const mockOrder = {
      id: 'o1',
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
        service.updateDueDate('wrong_id', '2026-09-01T10:00:00Z', 'Reason', 'mgr1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
