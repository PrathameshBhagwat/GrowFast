import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipTier, RegistrationSource } from '@growfast/shared-types';

describe('CustomerService', () => {
  let service: CustomerService;

  const mockPrismaService = {
    customer: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
      providers: [CustomerService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCustomer', () => {
    it('1. should create a customer with valid required fields', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue({
        id: 'cust-100',
        name: 'Aarav Kumar',
        phone: '9876512345',
        email: null,
        address: null,
        pincode: null,
        membership: 'NONE',
        discountPercent: 0,
        preferences: null,
        registrationSource: 'WALK_IN',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createCustomer({
        name: '  Aarav Kumar  ',
        phone: '  9876512345  ',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Aarav Kumar');
      expect(result.phone).toBe('9876512345');
      expect(result.membership).toBe(MembershipTier.NONE);
      expect(mockPrismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Aarav Kumar',
            phone: '9876512345',
            registrationSource: 'WALK_IN',
          }),
        }),
      );
    });

    it('2. should throw BadRequestException if name is missing or empty', async () => {
      await expect(service.createCustomer({ name: '   ', phone: '9876512345' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('3. should throw BadRequestException if phone is missing or empty', async () => {
      await expect(service.createCustomer({ name: 'Aarav Kumar', phone: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('4. should throw BadRequestException if phone format is invalid', async () => {
      await expect(service.createCustomer({ name: 'Aarav Kumar', phone: '123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('5. should throw BadRequestException if email format is invalid', async () => {
      await expect(
        service.createCustomer({
          name: 'Aarav Kumar',
          phone: '9876512345',
          email: 'not-an-email',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('6. should throw ConflictException if phone number already exists', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);

      await expect(
        service.createCustomer({
          name: 'New Person',
          phone: '9876543210',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('7. should create customer with all optional fields', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue({
        id: 'cust-101',
        name: 'Neha Gupta',
        phone: '9876543211',
        email: 'neha@example.com',
        address: '101 Lotus Colony',
        pincode: '411038',
        membership: 'GOLD',
        discountPercent: 10,
        preferences: { fragrance: 'jasmine', starch: 'medium' },
        registrationSource: 'REFERRAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createCustomer({
        name: 'Neha Gupta',
        phone: '9876543211',
        email: 'neha@example.com',
        address: '101 Lotus Colony',
        pincode: '411038',
        membership: MembershipTier.GOLD,
        discountPercent: 10,
        preferences: { fragrance: 'jasmine', starch: 'medium' },
        registrationSource: RegistrationSource.REFERRAL,
      });

      expect(result.id).toBe('cust-101');
      expect(result.membership).toBe(MembershipTier.GOLD);
      expect(result.preferences).toEqual({ fragrance: 'jasmine', starch: 'medium' });
      expect(result.registrationSource).toBe('REFERRAL');
    });

    it('8. should throw BadRequestException for invalid membership tier', async () => {
      await expect(
        service.createCustomer({
          name: 'Test',
          phone: '9876512345',
          membership: 'INVALID_TIER' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('9. should handle Prisma unique constraint P2002 error gracefully', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);
      const prismaError: any = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      mockPrismaService.customer.create.mockRejectedValue(prismaError);

      await expect(
        service.createCustomer({
          name: 'Duplicate Test',
          phone: '9876512345',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('10. should throw BadRequestException for invalid discount percent', async () => {
      await expect(
        service.createCustomer({
          name: 'Discount Test',
          phone: '9876512345',
          discountPercent: 150,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createCustomer({
          name: 'Discount Test',
          phone: '9876512345',
          discountPercent: -5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('11. should throw BadRequestException for invalid preferences payload', async () => {
      await expect(
        service.createCustomer({
          name: 'Preferences Test',
          phone: '9876512345',
          preferences: 'not-an-object' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
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

  describe('updateCustomer', () => {
    it('1. should perform valid partial update and return mapped CustomerDTO', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);
      mockPrismaService.customer.update.mockResolvedValue({
        ...mockCustomers[0],
        name: 'Rahul Updated',
        discountPercent: 15,
      });

      const result = await service.updateCustomer('cust-001', {
        name: 'Rahul Updated',
        discountPercent: 15,
      });

      expect(result.name).toBe('Rahul Updated');
      expect(result.discountPercent).toBe(15);
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-001' },
        data: expect.objectContaining({
          name: 'Rahul Updated',
          discountPercent: 15,
        }),
      });
    });

    it('2. should throw NotFoundException when updating non-existent customer', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.updateCustomer('cust-999', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('3. should allow retaining current customer phone number without conflict', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);
      mockPrismaService.customer.update.mockResolvedValue(mockCustomers[0]);

      const result = await service.updateCustomer('cust-001', {
        phone: '9876543210',
      });

      expect(result.phone).toBe('9876543210');
      expect(mockPrismaService.customer.findUnique).toHaveBeenCalledTimes(1);
    });

    it('4. should throw ConflictException when updating to phone belonging to another customer', async () => {
      mockPrismaService.customer.findUnique
        .mockResolvedValueOnce(mockCustomers[0]) // existing customer to update
        .mockResolvedValueOnce(mockCustomers[1]); // existing conflict customer

      await expect(service.updateCustomer('cust-001', { phone: '9876500000' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('5. should throw BadRequestException for invalid phone format', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);

      await expect(service.updateCustomer('cust-001', { phone: '123' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('6. should throw BadRequestException for invalid email format', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);

      await expect(service.updateCustomer('cust-001', { email: 'bad-email' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('7. should throw BadRequestException for invalid discount percentage', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(mockCustomers[0]);

      await expect(service.updateCustomer('cust-001', { discountPercent: 200 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
