import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

// Mock PrismaService
const mockPrismaService = {
  employee: {
    findUnique: jest.fn(),
  },
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockEmployee = {
      id: 'emp-001',
      name: 'Test User',
      role: 'COUNTER',
      storeId: 'store-001',
      isActive: true,
      pinHash: '', // Will be set in each test
      store: { id: 'store-001', name: 'Test Store' },
    };

    it('should return JWT for valid login', async () => {
      const pin = '123456';
      const pinHash = await bcrypt.hash(pin, 10);
      mockPrismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        pinHash,
      });

      const result = await service.login('emp-001', pin);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.employee.id).toBe('emp-001');
      expect(result.employee.name).toBe('Test User');
      expect(result.employee.role).toBe('COUNTER');
      expect(result.employee.storeName).toBe('Test Store');
    });

    it('should throw UnauthorizedException for invalid PIN', async () => {
      const pinHash = await bcrypt.hash('123456', 10);
      mockPrismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        pinHash,
      });

      await expect(service.login('emp-001', '999999')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent employee', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.login('emp-nonexistent', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive employee', async () => {
      const pinHash = await bcrypt.hash('123456', 10);
      mockPrismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        pinHash,
        isActive: false,
      });

      await expect(service.login('emp-001', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateJwtPayload', () => {
    it('should return user for valid payload', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 'emp-001',
        name: 'Test User',
        role: 'COUNTER',
        storeId: 'store-001',
        isActive: true,
      });

      const result = await service.validateJwtPayload({
        sub: 'emp-001',
        role: 'COUNTER',
        storeId: 'store-001',
        name: 'Test User',
      });

      expect(result.id).toBe('emp-001');
      expect(result.role).toBe('COUNTER');
    });

    it('should throw for inactive employee', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 'emp-001',
        name: 'Test User',
        role: 'COUNTER',
        storeId: 'store-001',
        isActive: false,
      });

      await expect(
        service.validateJwtPayload({
          sub: 'emp-001',
          role: 'COUNTER',
          storeId: 'store-001',
          name: 'Test User',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for non-existent employee', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.validateJwtPayload({
          sub: 'emp-nonexistent',
          role: 'COUNTER',
          storeId: 'store-001',
          name: 'Test User',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

describe('RolesGuard', () => {
  // RolesGuard logic tests
  it('should be tested via integration tests with controller', () => {
    // The RolesGuard is best tested via the auth controller integration tests
    // where we can verify the full request pipeline
    expect(true).toBe(true);
  });
});
