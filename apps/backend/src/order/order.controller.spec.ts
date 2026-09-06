import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';

const mockOrderService = {
  createOrder: jest.fn(),
  findAllOrders: jest.fn(),
  findOrderById: jest.fn(),
  updateOrderItem: jest.fn(),
  updateDueDate: jest.fn(),
  notifyPartialReady: jest.fn(),
  addPhysicalGarment: jest.fn(),
  cancelPhysicalGarment: jest.fn(),
  recordPickup: jest.fn(),
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

    it('should enforce OWNER and COUNTER roles and reject MANAGER', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, OrderController.prototype.updateOrderItem);
      expect(roles).toEqual(['OWNER', 'COUNTER']);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('COUNTER');
      expect(roles).not.toContain('MANAGER');
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

  describe('notifyPartialReady', () => {
    it('should call OrderService.notifyPartialReady with storeId and return result', async () => {
      const mockResult = { success: true, message: 'Readiness notification queued successfully' };
      mockOrderService.notifyPartialReady = jest.fn().mockResolvedValue(mockResult);
      const req = { user: { storeId: 'store1' } };

      const response = await controller.notifyPartialReady('order1', req);

      expect(mockOrderService.notifyPartialReady).toHaveBeenCalledWith('order1', 'store1');
      expect(response).toEqual(mockResult);
    });
  });

  describe('addPhysicalGarment', () => {
    it('should call OrderService.addPhysicalGarment and return success', async () => {
      const mockResult = { id: 'order1' };
      mockOrderService.addPhysicalGarment = jest.fn().mockResolvedValue(mockResult);
      const req = { user: { storeId: 'store1' } };

      const response = await controller.addPhysicalGarment('order1', 'item1', req);

      expect(mockOrderService.addPhysicalGarment).toHaveBeenCalledWith('order1', 'item1', 'store1');
      expect(response).toEqual({ success: true, data: mockResult });
    });

    it('should enforce OWNER and COUNTER roles and reject MANAGER', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        OrderController.prototype.addPhysicalGarment,
      );
      expect(roles).toEqual(['OWNER', 'COUNTER']);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('COUNTER');
      expect(roles).not.toContain('MANAGER');
    });
  });

  describe('cancelPhysicalGarment', () => {
    it('should call OrderService.cancelPhysicalGarment with user context and adjustment and return success', async () => {
      const mockResult = { id: 'order1' };
      mockOrderService.cancelPhysicalGarment = jest.fn().mockResolvedValue(mockResult);
      const req = { user: { id: 'emp1', storeId: 'store1', role: 'OWNER' } };
      const body = {
        adjustment: {
          type: 'REFUND',
          amount: 295,
          reason: 'Customer cancelled piece',
        },
      };

      const response = await controller.cancelPhysicalGarment('order1', 'item1', 'g1', req, body);

      expect(mockOrderService.cancelPhysicalGarment).toHaveBeenCalledWith(
        'order1',
        'item1',
        'g1',
        'store1',
        'emp1',
        'OWNER',
        body.adjustment,
      );
      expect(response).toEqual({ success: true, data: mockResult });
    });

    it('should enforce OWNER and COUNTER roles and reject MANAGER', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        OrderController.prototype.cancelPhysicalGarment,
      );
      expect(roles).toEqual(['OWNER', 'COUNTER']);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('COUNTER');
      expect(roles).not.toContain('MANAGER');
    });
  });

  describe('recordPickup', () => {
    it('should call OrderService.recordPickup and return success', async () => {
      const mockResult = { id: 'order1', status: 'DELIVERED' };
      mockOrderService.recordPickup = jest.fn().mockResolvedValue(mockResult);
      const req = { user: { id: 'emp1', storeId: 'store1' } };
      const dto = { garmentIds: ['g1', 'g2'] };

      const response = await controller.recordPickup('order1', dto as any, req);

      expect(mockOrderService.recordPickup).toHaveBeenCalledWith('order1', dto, 'emp1', 'store1');
      expect(response).toEqual({ success: true, data: mockResult });
    });

    it('should enforce OWNER and COUNTER roles and reject other roles', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, OrderController.prototype.recordPickup);
      expect(roles).toEqual(['OWNER', 'COUNTER']);
      expect(roles).toContain('OWNER');
      expect(roles).toContain('COUNTER');
      expect(roles).not.toContain('MANAGER');
      expect(roles).not.toContain('DELIVERY');
    });
  });
});
