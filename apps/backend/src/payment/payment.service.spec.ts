import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { RecordPaymentRequest } from '@growfast/shared-types';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockEmployeeId = 'emp-123';
  const mockStoreId = 'store-1';
  const mockOrder = {
    id: 'order-1',
    storeId: mockStoreId,
    totalAmount: 1000,
    amountPaid: 0,
    amountDue: 1000,
    paymentStatus: PaymentStatus.PENDING,
  };

  const mockPrisma = {
    $transaction: jest.fn(),
    order: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordPayment', () => {
    const validDto: RecordPaymentRequest = {
      orderId: 'order-1',
      amount: 400,
      mode: 'CASH' as any,
    };

    it('should successfully record a partial payment', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue({}),
          },
          payment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-1',
              orderId: mockOrder.id,
              amount: validDto.amount,
              mode: validDto.mode,
              reference: null,
              receivedById: mockEmployeeId,
              receivedBy: { name: 'Test Employee' },
              createdAt: new Date(),
            }),
          },
        };
        return cb(tx);
      });

      const result = await service.recordPayment(mockEmployeeId, mockStoreId, validDto);

      expect(result).toBeDefined();
      expect(result.amount).toBe(400);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if amount is zero or negative', async () => {
      await expect(
        service.recordPayment(mockEmployeeId, mockStoreId, { ...validDto, amount: 0 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.recordPayment(mockEmployeeId, mockStoreId, { ...validDto, amount: -100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return cb(tx);
      });

      await expect(service.recordPayment(mockEmployeeId, mockStoreId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if order belongs to a different store', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue({ ...mockOrder, storeId: 'other-store' }),
          },
        };
        return cb(tx);
      });

      await expect(service.recordPayment(mockEmployeeId, mockStoreId, validDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException on overpayment', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(mockOrder),
          },
        };
        return cb(tx);
      });

      await expect(
        service.recordPayment(mockEmployeeId, mockStoreId, { ...validDto, amount: 1001 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update paymentStatus to PAID when fully paid', async () => {
      let updatedOrderData: any;

      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue({
              ...mockOrder,
              amountPaid: 400,
              amountDue: 600,
              paymentStatus: PaymentStatus.PARTIAL,
            }),
            update: jest.fn().mockImplementation(({ data }) => {
              updatedOrderData = data;
              return {};
            }),
          },
          payment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-2',
              orderId: mockOrder.id,
              amount: 600,
              mode: validDto.mode,
              reference: null,
              receivedById: mockEmployeeId,
              receivedBy: { name: 'Test Employee' },
              createdAt: new Date(),
            }),
          },
        };
        return cb(tx);
      });

      await service.recordPayment(mockEmployeeId, mockStoreId, { ...validDto, amount: 600 });

      expect(updatedOrderData.amountDue).toBe(0);
      expect(updatedOrderData.amountPaid).toBe(1000);
      expect(updatedOrderData.paymentStatus).toBe(PaymentStatus.PAID);
    });
  });

  describe('getOrderPayments', () => {
    it('should return payments for the order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        storeId: mockStoreId,
        payments: [
          {
            id: 'pay-1',
            orderId: mockOrder.id,
            amount: 400,
            mode: 'CASH',
            reference: null,
            receivedById: mockEmployeeId,
            receivedBy: { name: 'Test Employee' },
            createdAt: new Date(),
          },
        ],
      });

      const result = await service.getOrderPayments(mockOrder.id, mockStoreId);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(400);
    });

    it('should enforce store isolation', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: mockOrder.id,
        storeId: 'other-store',
        payments: [],
      });

      await expect(service.getOrderPayments(mockOrder.id, mockStoreId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
