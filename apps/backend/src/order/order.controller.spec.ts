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

  describe('updateOrderItem', () => {
    it('should call OrderService.updateOrderItem and return success', async () => {
      const mockResult = { id: 'order1' };
      mockOrderService.updateOrderItem.mockResolvedValue(mockResult);

      const req = { user: { storeId: 'store1' } };
      const dto = { quantity: 2 };

      const response = await controller.updateOrderItem('order1', 'item1', dto, req);

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
});
