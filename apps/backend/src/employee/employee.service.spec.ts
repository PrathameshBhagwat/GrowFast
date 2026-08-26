import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@growfast/shared-types';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prisma: any;

  const mockStore1 = {
    id: 'store-001',
    name: 'Koregaon Park Branch',
  };

  const mockStore2 = {
    id: 'store-002',
    name: 'Viman Nagar Branch',
  };

  const mockOwner = {
    id: 'emp-001',
    name: 'Prathamesh Bhagwat',
    phone: '+919876543210',
    email: 'owner@example.com',
    pinHash: '$2a$10$hashedpin1',
    role: Role.OWNER,
    storeId: 'store-001',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    store: mockStore1,
  };

  const mockManagerStore1 = {
    id: 'emp-002',
    name: 'Rajesh Nair',
    phone: '+919876543211',
    email: 'manager@example.com',
    pinHash: '$2a$10$hashedpin2',
    role: Role.MANAGER,
    storeId: 'store-001',
    isActive: true,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    store: mockStore1,
  };

  const mockStaffStore2 = {
    id: 'emp-003',
    name: 'Viman Nagar Counter',
    phone: '+919876543299',
    email: 'viman@example.com',
    pinHash: '$2a$10$hashedpin3',
    role: Role.COUNTER,
    storeId: 'store-002',
    isActive: true,
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-03'),
    store: mockStore2,
  };

  const mockUserContextOwner = {
    id: 'emp-001',
    role: Role.OWNER,
    storeId: 'store-001',
  };

  const mockUserContextManager1 = {
    id: 'emp-002',
    role: Role.MANAGER,
    storeId: 'store-001',
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      store: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  describe('findAll', () => {
    it('should return sanitized employee list without exposing pinHash', async () => {
      prisma.employee.findMany.mockResolvedValue([mockOwner, mockManagerStore1]);

      const result = await service.findAll(undefined, undefined, mockUserContextOwner);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'emp-001',
        name: 'Prathamesh Bhagwat',
        phone: '+919876543210',
        email: 'owner@example.com',
        role: Role.OWNER,
        storeId: 'store-001',
        storeName: 'Koregaon Park Branch',
        isActive: true,
        createdAt: mockOwner.createdAt.toISOString(),
        updatedAt: mockOwner.updatedAt.toISOString(),
      });
      expect((result[0] as any).pinHash).toBeUndefined();
    });

    it('should enforce Store Isolation for Manager (forces currentUser.storeId)', async () => {
      prisma.employee.findMany.mockResolvedValue([mockManagerStore1]);

      await service.findAll('store-002', true, mockUserContextManager1);

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-001', isActive: true },
        include: { store: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should allow Owner to query specific storeId or all stores', async () => {
      prisma.employee.findMany.mockResolvedValue([mockStaffStore2]);

      await service.findAll('store-002', true, mockUserContextOwner);

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-002', isActive: true },
        include: { store: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return single sanitized employee for authorized store', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      const result = await service.findOne('emp-001', mockUserContextOwner);

      expect(result.id).toBe('emp-001');
      expect((result as any).pinHash).toBeUndefined();
    });

    it('should enforce Store Isolation on findOne for Manager', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockStaffStore2);

      await expect(
        service.findOne('emp-003', mockUserContextManager1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if employee is not found', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id', mockUserContextOwner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create employee with hashed PIN and return sanitized DTO', async () => {
      prisma.employee.findUnique.mockResolvedValue(null); // email check
      prisma.store.findUnique.mockResolvedValue(mockStore1); // store check
      prisma.employee.create.mockResolvedValue({
        ...mockManagerStore1,
        id: 'emp-004',
        name: 'New Counter Staff',
      });

      const dto = {
        name: 'New Counter Staff',
        pin: '123456',
        role: Role.COUNTER,
      };

      const result = await service.create(dto, mockUserContextOwner);

      expect(result.name).toBe('New Counter Staff');
      expect((result as any).pinHash).toBeUndefined();
      expect(prisma.employee.create).toHaveBeenCalled();
    });

    it('should forbid Manager from creating an employee for another store', async () => {
      const dto = {
        name: 'Attempted Cross Store Staff',
        pin: '123456',
        role: Role.COUNTER,
        storeId: 'store-002',
      };

      await expect(service.create(dto, mockUserContextManager1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should forbid Managers from creating Owner accounts', async () => {
      const dto = {
        name: 'New Owner Attempt',
        pin: '123456',
        role: Role.OWNER,
      };

      await expect(service.create(dto, mockUserContextManager1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException on duplicate email', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner); // email exists

      const dto = {
        name: 'Duplicate Email Staff',
        email: 'owner@example.com',
        pin: '123456',
        role: Role.COUNTER,
      };

      await expect(service.create(dto, mockUserContextOwner)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should allow Owner to update employee role and state', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockManagerStore1);
      prisma.employee.update.mockResolvedValue({
        ...mockManagerStore1,
        role: Role.COUNTER,
      });

      const result = await service.update('emp-002', { role: Role.COUNTER }, mockUserContextOwner);

      expect(result.role).toBe(Role.COUNTER);
      expect((result as any).pinHash).toBeUndefined();
    });

    it('should enforce Store Isolation on update for Manager (editing another store employee)', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockStaffStore2);

      await expect(
        service.update('emp-003', { name: 'Unauthorized Edit' }, mockUserContextManager1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should enforce Store Isolation on update for Manager (moving employee to another store)', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockManagerStore1);

      await expect(
        service.update('emp-002', { storeId: 'store-002' }, mockUserContextManager1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should forbid Manager from editing an Owner account', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.update('emp-001', { name: 'New Name' }, mockUserContextManager1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent employee from deactivating their own account', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.update('emp-001', { isActive: false }, mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent employee from changing their own role', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.update('emp-001', { role: Role.MANAGER }, mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent deactivating the last active Owner', async () => {
      const otherOwner = { ...mockOwner, id: 'emp-other-owner' };
      prisma.employee.findUnique.mockResolvedValue(otherOwner);
      prisma.employee.count.mockResolvedValue(1); // Only 1 active owner exists

      await expect(
        service.update('emp-other-owner', { isActive: false }, mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
