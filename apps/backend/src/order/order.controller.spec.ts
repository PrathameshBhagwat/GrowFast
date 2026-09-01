import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

const mockOrderService = {
  createOrder: jest.fn(),
  findAllOrders: jest.fn(),
  findOrderById: jest.fn(),
  updateOrderItem: jest.fn(),
  updateDueDate: jest.fn(),
};

describe('OrderController', () => {
  let controller: OrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<OrderController>(OrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call OrderService.findAllOrders with storeId and return success', async () => {
      mockOrderService.findAllOrders.mockResolvedValue({ data: [], total: 0 });
      const req = { user: { storeId: 'store1' } };
      const query = {};
      const response = await controller.findAll(query, req);
      expect(mockOrderService.findAllOrders).toHaveBeenCalledWith(query, 'store1');
      expect(response).toEqual({ success: true, data: [], total: 0 });
    });
  });

  describe('findOne', () => {
    it('should call OrderService.findOrderById with storeId and return success', async () => {
      mockOrderService.findOrderById.mockResolvedValue({ id: 'order1' });
      const req = { user: { storeId: 'store1' } };
      const response = await controller.findOne('order1', req);
      expect(mockOrderService.findOrderById).toHaveBeenCalledWith('order1', 'store1');
      expect(response).toEqual({ success: true, data: { id: 'order1' } });
    });
  });

  describe('updateOrderItem', () => {
    it('should call OrderService.updateOrderItem and return success', async () => {
      const mockResult = { id: 'order1' };
      mockOrderService.updateOrderItem.mockResolvedValue(mockResult);

      const req = { user: { storeId: 'store1' } };
      const dto = { quantity: 2 };

      const response = await controller.updateOrderItem('order1', 'item1', dto as any, req);

      expect(mockOrderService.updateOrderItem).toHaveBeenCalledWith(
        'order1',
        'item1',
        dto,
        'store1',
      );
      expect(response).toEqual({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('updateDueDate', () => {
    it('should call OrderService.updateDueDate with storeId and return success', async () => {
      mockOrderService.updateDueDate = jest.fn().mockResolvedValue({ id: 'order1' });
      const req = { user: { id: 'emp1', storeId: 'store1' } };
      const dto = { effectiveDueDate: '2026-09-01T10:00:00Z', reason: 'Test' };
      const response = await controller.updateDueDate('order1', dto, req);
      expect(mockOrderService.updateDueDate).toHaveBeenCalledWith(
        'order1',
        '2026-09-01T10:00:00Z',
        'Test',
        'emp1',
        'store1',
      );
      expect(response).toEqual({ success: true, data: { id: 'order1' } });
    });
  });
});
