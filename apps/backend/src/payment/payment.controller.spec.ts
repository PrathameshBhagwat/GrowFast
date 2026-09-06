import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentController,
  OrderPaymentController,
  OrderAdjustmentController,
} from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';
import { PaymentMode, AdjustmentType, Role } from '@growfast/shared-types';

const mockPaymentService = {
  recordPayment: jest.fn(),
  getOrderPayments: jest.fn(),
  getPaymentSummary: jest.fn(),
  createAdjustment: jest.fn(),
  getOrderAdjustments: jest.fn(),
};

describe('Payment Controllers', () => {
  let paymentController: PaymentController;
  let orderPaymentController: OrderPaymentController;
  let orderAdjustmentController: OrderAdjustmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController, OrderPaymentController, OrderAdjustmentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    paymentController = module.get<PaymentController>(PaymentController);
    orderPaymentController = module.get<OrderPaymentController>(OrderPaymentController);
    orderAdjustmentController = module.get<OrderAdjustmentController>(OrderAdjustmentController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PaymentController', () => {
    it('should record payment and return success', async () => {
      const mockResult = { id: 'p1', amount: 500 };
      mockPaymentService.recordPayment.mockResolvedValue(mockResult);

      const req = { user: { id: 'emp1', storeId: 'store1' } };
      const body = { orderId: 'o1', amount: 500, mode: PaymentMode.CASH };

      const res = await paymentController.recordPayment(req, body);
      expect(mockPaymentService.recordPayment).toHaveBeenCalledWith('emp1', 'store1', body);
      expect(res).toEqual({ success: true, data: mockResult });
    });
  });

  describe('OrderPaymentController', () => {
    it('should return order payments', async () => {
      const mockList = [{ id: 'p1' }];
      mockPaymentService.getOrderPayments.mockResolvedValue(mockList);

      const req = { user: { storeId: 'store1' } };
      const res = await orderPaymentController.getOrderPayments(req, 'o1');

      expect(mockPaymentService.getOrderPayments).toHaveBeenCalledWith('o1', 'store1');
      expect(res).toEqual({ success: true, data: mockList });
    });

    it('should return payment summary', async () => {
      const mockSummary = { totalAmount: 1000, effectivePaid: 500, amountDue: 500 };
      mockPaymentService.getPaymentSummary.mockResolvedValue(mockSummary);

      const req = { user: { storeId: 'store1' } };
      const res = await orderPaymentController.getPaymentSummary(req, 'o1');

      expect(mockPaymentService.getPaymentSummary).toHaveBeenCalledWith('o1', 'store1');
      expect(res).toEqual({ success: true, data: mockSummary });
    });
  });

  describe('OrderAdjustmentController', () => {
    it('createAdjustment should enforce OWNER role only', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        OrderAdjustmentController.prototype.createAdjustment,
      );
      expect(roles).toEqual(['OWNER']);
    });

    it('createAdjustment should call service with user details and return success', async () => {
      const mockAdjustment = {
        id: 'adj1',
        orderId: 'o1',
        type: AdjustmentType.REFUND,
        amount: 200,
      };
      mockPaymentService.createAdjustment.mockResolvedValue(mockAdjustment);

      const req = { user: { id: 'emp-owner', storeId: 'store1', role: Role.OWNER } };
      const body = {
        type: AdjustmentType.REFUND,
        amount: 200,
        reason: 'Piece cancellation',
      };

      const res = await orderAdjustmentController.createAdjustment(req, 'o1', body);

      expect(mockPaymentService.createAdjustment).toHaveBeenCalledWith(
        'emp-owner',
        'store1',
        Role.OWNER,
        { ...body, orderId: 'o1' },
      );
      expect(res).toEqual({ success: true, data: mockAdjustment });
    });

    it('getOrderAdjustments should allow OWNER and COUNTER roles', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        OrderAdjustmentController.prototype.getOrderAdjustments,
      );
      expect(roles).toEqual(['OWNER', 'COUNTER']);
    });

    it('getOrderAdjustments should call service and return adjustments', async () => {
      const mockAdjustments = [{ id: 'adj1' }, { id: 'adj2' }];
      mockPaymentService.getOrderAdjustments.mockResolvedValue(mockAdjustments);

      const req = { user: { storeId: 'store1' } };
      const res = await orderAdjustmentController.getOrderAdjustments(req, 'o1');

      expect(mockPaymentService.getOrderAdjustments).toHaveBeenCalledWith('o1', 'store1');
      expect(res).toEqual({ success: true, data: mockAdjustments });
    });
  });
});
