import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipTier } from '@growfast/shared-types';

describe('CustomerService', () => {
  let service: CustomerService;

  const mockPrismaService = {
    customer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockCustomers = [
    {
      id: 'cust-001',
      name: 'Rahul Sharma',
      phone: '9876543210',
      email: 'rahul@example.com',
      address: '123 Main St, Pune',
      pincode: '411001',
      membership: 'GOLD',
      discountPercent: 10,
      preferences: { fragrance: 'lavender' },
      registrationSource: 'WALK_IN',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'cust-002',
      name: 'Priya Patel',
      phone: '9876500000',
      email: 'priya@example.com',
      address: '456 MG Road, Pune',
      pincode: '411002',
      membership: 'SILVER',
      discountPercent: 5,
      preferences: null,
      registrationSource: 'PHONE',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('searchCustomers', () => {
    it('1. should search by exact phone number', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([mockCustomers[0]]);
      mockPrismaService.customer.count.mockResolvedValue(1);

      const result = await service.searchCustomers('9876543210', 1, 10);

      expect(result.success).toBe(true);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].phone).toBe('9876543210');
      expect(result.data[0].name).toBe('Rahul Sharma');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { phone: { contains: '9876543210', mode: 'insensitive' } },
              { name: { contains: '9876543210', mode: 'insensitive' } },
              { id: { equals: '9876543210' } },
            ],
          },
        }),
      );
    });

    it('2. should search by partial phone number', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.customer.count.mockResolvedValue(2);

      const result = await service.searchCustomers('98765', 1, 10);

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('3. should search by case-insensitive partial name', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([mockCustomers[0]]);
      mockPrismaService.customer.count.mockResolvedValue(1);

      const result = await service.searchCustomers('rahul', 1, 10);

      expect(result.success).toBe(true);
      expect(result.data[0].name).toBe('Rahul Sharma');
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { phone: { contains: 'rahul', mode: 'insensitive' } },
              { name: { contains: 'rahul', mode: 'insensitive' } },
              { id: { equals: 'rahul' } },
            ],
          },
        }),
      );
    });

    it('4. should search by customer ID', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([mockCustomers[1]]);
      mockPrismaService.customer.count.mockResolvedValue(1);

      const result = await service.searchCustomers('cust-002', 1, 10);

      expect(result.success).toBe(true);
      expect(result.data[0].id).toBe('cust-002');
    });

    it('5. should handle pagination skip/take correctly', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([mockCustomers[1]]);
      mockPrismaService.customer.count.mockResolvedValue(2);

      const result = await service.searchCustomers('', 2, 1);

      expect(result.success).toBe(true);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(1);
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
        }),
      );
    });

    it('6. should return empty list when no customers match', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue([]);
      mockPrismaService.customer.count.mockResolvedValue(0);

      const result = await service.searchCustomers('nonexistent', 1, 10);

      expect(result.success).toBe(true);
      expect(result.total).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('7. should return correct total count', async () => {
      mockPrismaService.customer.findMany.mockResolvedValue(mockCustomers);
      mockPrismaService.customer.count.mockResolvedValue(100);

      const result = await service.searchCustomers('', 1, 2);

      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it('8. should throw BadRequestException for invalid pagination parameters', async () => {
      await expect(service.searchCustomers('', 0, 10)).rejects.toThrow(BadRequestException);
      await expect(service.searchCustomers('', -1, 10)).rejects.toThrow(BadRequestException);
      await expect(service.searchCustomers('', 1, 0)).rejects.toThrow(BadRequestException);
      await expect(service.searchCustomers('', 'abc', 10)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCustomerById', () => {
    it('should return mapped CustomerDTO for valid ID', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);

      const result = await service.getCustomerById('cust-001');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('cust-001');
      expect(result?.membership).toBe(MembershipTier.GOLD);
    });

    it('should return null for non-existent ID', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      const result = await service.getCustomerById('cust-999');

      expect(result).toBeNull();
    });
  });
});
