import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EmployeeService, STAFF_DOCUMENT_MAX_SIZE } from './employee.service';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoStorageService } from '../photo/photo-storage.service';
import { Role } from '@growfast/shared-types';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let prisma: any;
  let photoStorage: any;

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
    isDeleted: false,
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
    isDeleted: false,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    store: mockStore1,
  };

  const mockCounterStaff = {
    id: 'emp-004',
    name: 'Pooja Kulkarni',
    phone: '+919876543212',
    email: 'pooja@example.com',
    pinHash: '$2a$10$hashedpin4',
    role: Role.COUNTER,
    storeId: 'store-001',
    isActive: true,
    isDeleted: false,
    photoUrl: 'uploads/photos/staff-docs/store-001/photo1.jpg',
    passportPhotoUrl: 'uploads/photos/staff-docs/store-001/passport1.jpg',
    aadhaarFrontUrl: 'uploads/photos/staff-docs/store-001/aadhaar-front.jpg',
    aadhaarBackUrl: 'uploads/photos/staff-docs/store-001/aadhaar-back.jpg',
    currentAddress: '123 MG Road, Pune',
    permanentAddress: '123 MG Road, Pune',
    sameAsCurrentAddress: true,
    createdAt: new Date('2026-01-04'),
    updatedAt: new Date('2026-01-04'),
    store: mockStore1,
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
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(2),
      },
      store: {
        findUnique: jest.fn().mockResolvedValue(mockStore1),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: {
        count: jest.fn().mockResolvedValue(0),
      },
      financialAdjustment: {
        count: jest.fn().mockResolvedValue(0),
      },
      deliveryRecord: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    photoStorage = {
      store: jest.fn().mockResolvedValue('uploads/photos/staff-docs/store-001/test.jpg'),
      getAccessUrl: jest
        .fn()
        .mockImplementation((url) => Promise.resolve(`/api/photos/local/${url}`)),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: PrismaService, useValue: prisma },
        { provide: PhotoStorageService, useValue: photoStorage },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── FIND ALL & DATA MINIMIZATION ─────────────────────────────────

  describe('findAll', () => {
    it('should filter out deleted staff and protect sensitive Aadhaar document URLs in list', async () => {
      prisma.employee.findMany.mockResolvedValue([mockOwner, mockCounterStaff]);

      const result = await service.findAll('store-001', true, mockUserContextOwner);

      expect(result).toHaveLength(2);
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isDeleted: false }),
        }),
      );

      // Sensitive document URLs must be protected in general list responses
      const counterDto = result.find((e) => e.id === 'emp-004');
      expect(counterDto?.aadhaarFrontUrl).toBe('[PROTECTED]');
      expect(counterDto?.aadhaarBackUrl).toBe('[PROTECTED]');
      // Non-sensitive photos are accessible
      expect(counterDto?.photoUrl).toBe(mockCounterStaff.photoUrl);
    });

    it('should enforce Store Isolation for Manager', async () => {
      prisma.employee.findMany.mockResolvedValue([mockManagerStore1]);

      await service.findAll('store-002', true, mockUserContextManager1);

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ storeId: 'store-001', isDeleted: false }),
        }),
      );
    });
  });

  // ─── FIND ONE ─────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return full profile including sensitive document URLs for authorized detail view', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockCounterStaff);

      const result = await service.findOne('emp-004', mockUserContextOwner);

      expect(result.id).toBe('emp-004');
      expect(result.aadhaarFrontUrl).toBe(mockCounterStaff.aadhaarFrontUrl);
      expect(result.aadhaarBackUrl).toBe(mockCounterStaff.aadhaarBackUrl);
      expect(result.currentAddress).toBe('123 MG Road, Pune');
    });

    it('should throw NotFoundException if employee is deleted', async () => {
      prisma.employee.findUnique.mockResolvedValue({ ...mockCounterStaff, isDeleted: true });

      await expect(service.findOne('emp-004', mockUserContextOwner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── CREATE & OPTIONAL PROFILE ────────────────────────────────────

  describe('create', () => {
    it('should create employee without any optional profile fields', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockImplementation((args: any) => ({
        id: 'new-emp-1',
        ...args.data,
        store: mockStore1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dto = {
        name: 'Basic Staff',
        pin: '123456',
        role: Role.COUNTER,
      };

      const result = await service.create(dto, mockUserContextOwner);

      expect(result.name).toBe('Basic Staff');
      expect(result.photoUrl).toBeNull();
      expect(result.aadhaarFrontUrl).toBeNull();
      expect(result.currentAddress).toBeNull();
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDeleted: false }),
        }),
      );
    });

    it('should create employee with full optional profile and mirrored address', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockImplementation((args: any) => ({
        id: 'new-emp-2',
        ...args.data,
        store: mockStore1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const dto = {
        name: 'Full Profile Staff',
        pin: '654321',
        role: Role.COUNTER,
        photoUrl: 'uploads/photos/staff-docs/store-001/p1.jpg',
        passportPhotoUrl: 'uploads/photos/staff-docs/store-001/pass1.jpg',
        aadhaarFrontUrl: 'uploads/photos/staff-docs/store-001/af.jpg',
        aadhaarBackUrl: 'uploads/photos/staff-docs/store-001/ab.jpg',
        currentAddress: 'Flat 402, Sunshine Towers, Pune 411001',
        sameAsCurrentAddress: true,
      };

      const result = await service.create(dto, mockUserContextOwner);

      expect(result.photoUrl).toBe('uploads/photos/staff-docs/store-001/p1.jpg');
      expect(result.aadhaarFrontUrl).toBe('uploads/photos/staff-docs/store-001/af.jpg');
      expect(result.currentAddress).toBe('Flat 402, Sunshine Towers, Pune 411001');
      expect(result.permanentAddress).toBe('Flat 402, Sunshine Towers, Pune 411001');
      expect(result.sameAsCurrentAddress).toBe(true);
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
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      const dto = {
        name: 'Duplicate Email Staff',
        email: 'owner@example.com',
        pin: '123456',
        role: Role.COUNTER,
      };

      await expect(service.create(dto, mockUserContextOwner)).rejects.toThrow(ConflictException);
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe('update', () => {
    it('should preserve existing optional profile data when updating unrelated fields', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockCounterStaff);
      prisma.employee.update.mockImplementation((args: any) => ({
        ...mockCounterStaff,
        ...args.data,
        store: mockStore1,
      }));

      const result = await service.update('emp-004', { name: 'Pooja Patil' }, mockUserContextOwner);

      expect(result.name).toBe('Pooja Patil');
      expect(result.photoUrl).toBe(mockCounterStaff.photoUrl);
      expect(result.currentAddress).toBe(mockCounterStaff.currentAddress);
      expect(result.aadhaarFrontUrl).toBe(mockCounterStaff.aadhaarFrontUrl);
    });

    it('should delete old photo from storage when replacing staff photo', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockCounterStaff);
      prisma.employee.update.mockResolvedValue({
        ...mockCounterStaff,
        photoUrl: 'uploads/photos/staff-docs/store-001/new-photo.jpg',
      });

      await service.update(
        'emp-004',
        { photoUrl: 'uploads/photos/staff-docs/store-001/new-photo.jpg' },
        mockUserContextOwner,
      );

      expect(photoStorage.delete).toHaveBeenCalledWith(mockCounterStaff.photoUrl);
    });

    it('should prevent employee from deactivating their own account', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(
        service.update('emp-001', { isActive: false }, mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── PERMANENT DELETION ───────────────────────────────────────────

  describe('remove', () => {
    it('should permanently hard-delete staff with zero historical orders or payments', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockCounterStaff);
      prisma.order.count.mockResolvedValue(0);
      prisma.payment.count.mockResolvedValue(0);
      prisma.financialAdjustment.count.mockResolvedValue(0);
      prisma.employee.delete.mockResolvedValue(mockCounterStaff);

      const result = await service.remove('emp-004', mockUserContextOwner);

      expect(result.success).toBe(true);
      expect(result.permanentDeleteType).toBe('HARD');
      expect(prisma.employee.delete).toHaveBeenCalledWith({ where: { id: 'emp-004' } });
      // Uploaded files must be cleaned up
      expect(photoStorage.delete).toHaveBeenCalledWith(mockCounterStaff.photoUrl);
      expect(photoStorage.delete).toHaveBeenCalledWith(mockCounterStaff.passportPhotoUrl);
      expect(photoStorage.delete).toHaveBeenCalledWith(mockCounterStaff.aadhaarFrontUrl);
      expect(photoStorage.delete).toHaveBeenCalledWith(mockCounterStaff.aadhaarBackUrl);
    });

    it('should purge credentials and redact PII when historical orders exist (preserving audit integrity)', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockCounterStaff);
      prisma.order.count.mockResolvedValue(42); // 42 historical orders
      prisma.payment.count.mockResolvedValue(15);
      prisma.financialAdjustment.count.mockResolvedValue(0);
      prisma.employee.update.mockResolvedValue({
        ...mockCounterStaff,
        isDeleted: true,
      });

      const result = await service.remove('emp-004', mockUserContextOwner);

      expect(result.success).toBe(true);
      expect(result.permanentDeleteType).toBe('REDACTED_WITH_HISTORICAL_PRESERVED');
      // Must NOT hard-delete orders/employee
      expect(prisma.employee.delete).not.toHaveBeenCalled();
      // Must purge credentials, addresses, and redact PII
      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-004' },
          data: expect.objectContaining({
            isDeleted: true,
            isActive: false,
            pinHash: '',
            phone: null,
            email: null,
            photoUrl: null,
            aadhaarFrontUrl: null,
            aadhaarBackUrl: null,
            currentAddress: null,
            permanentAddress: null,
          }),
        }),
      );
      // Private files removed from disk/storage
      expect(photoStorage.delete).toHaveBeenCalled();
    });

    it('should prevent employee from deleting their own account', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(service.remove('emp-001', mockUserContextOwner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should prevent deleting the last active Owner', async () => {
      const otherOwner = { ...mockOwner, id: 'emp-owner-002' };
      prisma.employee.findUnique.mockResolvedValue(otherOwner);
      prisma.employee.count.mockResolvedValue(1); // Only 1 active owner

      await expect(service.remove('emp-owner-002', mockUserContextOwner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should forbid Manager from deleting Owner', async () => {
      prisma.employee.findUnique.mockResolvedValue(mockOwner);

      await expect(service.remove('emp-001', mockUserContextManager1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject concurrent duplicate deletion attempts for same employee', async () => {
      prisma.employee.findUnique.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return mockCounterStaff;
      });
      prisma.order.count.mockResolvedValue(0);
      prisma.payment.count.mockResolvedValue(0);
      prisma.financialAdjustment.count.mockResolvedValue(0);
      prisma.employee.delete.mockResolvedValue(mockCounterStaff);

      const [p1, p2] = await Promise.allSettled([
        service.remove('emp-004', mockUserContextOwner),
        service.remove('emp-004', mockUserContextOwner),
      ]);

      expect([p1.status, p2.status]).toContain('rejected');
    });
  });

  // ─── DOCUMENT UPLOAD VALIDATION ───────────────────────────────────

  describe('uploadDocument', () => {
    it('should reject files exceeding 5MB size limit', async () => {
      const oversizedFile: any = {
        size: STAFF_DOCUMENT_MAX_SIZE + 1,
        mimetype: 'image/jpeg',
        originalname: 'large.jpg',
        buffer: Buffer.from('large'),
      };

      await expect(
        service.uploadDocument(oversizedFile, 'store-001', mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported file types', async () => {
      const executableFile: any = {
        size: 1024,
        mimetype: 'application/x-msdownload',
        originalname: 'malware.exe',
        buffer: Buffer.from('exe'),
      };

      await expect(
        service.uploadDocument(executableFile, 'store-001', mockUserContextOwner),
      ).rejects.toThrow(BadRequestException);
    });

    it('should store valid image and return storedUrl and accessUrl', async () => {
      const validFile: any = {
        size: 50000,
        mimetype: 'image/jpeg',
        originalname: 'staff.jpg',
        buffer: Buffer.from('jpeg-bytes'),
      };

      const result = await service.uploadDocument(validFile, 'store-001', mockUserContextOwner);

      expect(result.storedUrl).toBeDefined();
      expect(result.accessUrl).toBeDefined();
      expect(photoStorage.store).toHaveBeenCalled();
    });
  });
});
