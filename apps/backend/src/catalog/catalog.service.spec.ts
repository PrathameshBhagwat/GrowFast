import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

import { GarmentCategory, ServiceCategory } from '@growfast/shared-types';

// Mock PrismaService
const mockPrismaService = {
  garmentCatalog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  serviceType: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    jest.clearAllMocks();
  });

  describe('findAllGarments', () => {
    const mockGarments = [
      {
        id: 'g1',
        name: 'Shirt',
        category: 'MEN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'g2',
        name: 'Trouser',
        category: 'MEN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'g3',
        name: 'Saree',
        category: 'WOMEN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return all garments when no category filter is provided', async () => {
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue(mockGarments);

      const result = await service.findAllGarments('store-1');

      expect(result).toEqual(mockGarments);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should return filtered garments when category is provided', async () => {
      const menGarments = mockGarments.filter((g) => g.category === 'MEN');
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue(menGarments);

      const result = await service.findAllGarments('store-1', GarmentCategory.MEN);

      expect(result).toEqual(menGarments);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: {
          category: GarmentCategory.MEN,
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no garments match the category', async () => {
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([]);

      const result = await service.findAllGarments('store-1', GarmentCategory.SPECIAL);

      expect(result).toEqual([]);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: {
          category: GarmentCategory.SPECIAL,
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by each valid category value', async () => {
      for (const cat of Object.values(GarmentCategory)) {
        mockPrismaService.garmentCatalog.findMany.mockResolvedValue([]);
        await service.findAllGarments('store-1', cat);
        expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
          where: {
            category: cat,
            OR: [{ storeId: null }, { storeId: 'store-1' }],
          },
          orderBy: { name: 'asc' },
        });
      }
    });
  });

  describe('updateGarment', () => {
    const existingGarment = {
      id: 'g1',
      name: 'Shirt',
      category: 'MEN',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update and return the garment when it exists and store matches', async () => {
      const updateDto = { name: 'Formal Shirt' };
      const updatedGarment = { ...existingGarment, ...updateDto };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', 'store-1', updateDto);

      expect(result.name).toBe('Formal Shirt');
      expect(mockPrismaService.garmentCatalog.findUnique).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
      expect(mockPrismaService.garmentCatalog.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: updateDto,
      });
    });

    it('should throw ForbiddenException when garment belongs to another store', async () => {
      const storeGarment = { ...existingGarment, storeId: 'store-2' };
      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(storeGarment);

      await expect(service.updateGarment('g1', 'store-1', { name: 'Test' })).rejects.toThrow(
        'Cannot modify garment belonging to another store',
      );
    });

    it('should update the category field', async () => {
      const updateDto = { category: GarmentCategory.WOMEN };
      const updatedGarment = { ...existingGarment, category: GarmentCategory.WOMEN };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', 'store-1', updateDto);

      expect(result.category).toBe(GarmentCategory.WOMEN);
    });

    it('should update the isActive field', async () => {
      const updateDto = { isActive: false };
      const updatedGarment = { ...existingGarment, isActive: false };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', 'store-1', updateDto);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when garment does not exist', async () => {
      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(null);

      await expect(service.updateGarment('nonexistent', 'store-1', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.garmentCatalog.update).not.toHaveBeenCalled();
    });

    it('should include garment ID in NotFoundException message', async () => {
      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(null);

      try {
        await service.updateGarment('bad-id', 'store-1', { name: 'Test' });
        fail('Expected NotFoundException');
      } catch (err: any) {
        expect(err.message).toContain('bad-id');
      }
    });
  });

  describe('findAllServices', () => {
    const mockServices = [
      {
        id: 's1',
        name: 'Dry Clean',
        category: 'DRY_CLEAN',
        estimatedDays: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's2',
        name: 'Wash',
        category: 'WASH',
        estimatedDays: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return all services when no category filter is provided', async () => {
      mockPrismaService.serviceType.findMany.mockResolvedValue(mockServices);

      const result = await service.findAllServices('store-1');

      expect(result).toEqual(mockServices);
      expect(mockPrismaService.serviceType.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should return filtered services when category is provided', async () => {
      const washServices = mockServices.filter((s) => s.category === 'WASH');
      mockPrismaService.serviceType.findMany.mockResolvedValue(washServices);

      const result = await service.findAllServices('store-1', ServiceCategory.WASH);

      expect(result).toEqual(washServices);
      expect(mockPrismaService.serviceType.findMany).toHaveBeenCalledWith({
        where: {
          category: ServiceCategory.WASH,
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no services match the category', async () => {
      mockPrismaService.serviceType.findMany.mockResolvedValue([]);

      const result = await service.findAllServices('store-1', ServiceCategory.STAIN_REMOVAL);

      expect(result).toEqual([]);
      expect(mockPrismaService.serviceType.findMany).toHaveBeenCalledWith({
        where: {
          category: ServiceCategory.STAIN_REMOVAL,
          OR: [{ storeId: null }, { storeId: 'store-1' }],
        },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by each valid category value', async () => {
      for (const cat of Object.values(ServiceCategory)) {
        mockPrismaService.serviceType.findMany.mockResolvedValue([]);
        await service.findAllServices('store-1', cat);
        expect(mockPrismaService.serviceType.findMany).toHaveBeenCalledWith({
          where: {
            category: cat,
            OR: [{ storeId: null }, { storeId: 'store-1' }],
          },
          orderBy: { name: 'asc' },
        });
      }
    });
  });

  describe('updateService', () => {
    const existingService = {
      id: 's1',
      name: 'Dry Clean',
      category: 'DRY_CLEAN',
      estimatedDays: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should update and return the service when it exists', async () => {
      const updateDto = { name: 'Premium Dry Clean' };
      const updatedService = { ...existingService, ...updateDto };

      mockPrismaService.serviceType.findUnique.mockResolvedValue(existingService);
      mockPrismaService.serviceType.update.mockResolvedValue(updatedService);

      const result = await service.updateService('s1', 'store-1', updateDto);

      expect(result.name).toBe('Premium Dry Clean');
      expect(mockPrismaService.serviceType.findUnique).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
      expect(mockPrismaService.serviceType.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: updateDto,
      });
    });

    it('should throw ForbiddenException when service belongs to another store', async () => {
      const storeService = { ...existingService, storeId: 'store-2' };
      mockPrismaService.serviceType.findUnique.mockResolvedValue(storeService);

      await expect(service.updateService('s1', 'store-1', { name: 'Test' })).rejects.toThrow(
        'Cannot modify service belonging to another store',
      );
    });

    it('should update the category field', async () => {
      const updateDto = { category: ServiceCategory.WASH };
      const updatedService = { ...existingService, category: ServiceCategory.WASH };

      mockPrismaService.serviceType.findUnique.mockResolvedValue(existingService);
      mockPrismaService.serviceType.update.mockResolvedValue(updatedService);

      const result = await service.updateService('s1', 'store-1', updateDto);

      expect(result.category).toBe(ServiceCategory.WASH);
    });

    it('should update the isActive field', async () => {
      const updateDto = { isActive: false };
      const updatedService = { ...existingService, isActive: false };

      mockPrismaService.serviceType.findUnique.mockResolvedValue(existingService);
      mockPrismaService.serviceType.update.mockResolvedValue(updatedService);

      const result = await service.updateService('s1', 'store-1', updateDto);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when service does not exist', async () => {
      mockPrismaService.serviceType.findUnique.mockResolvedValue(null);

      await expect(service.updateService('nonexistent', 'store-1', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.serviceType.update).not.toHaveBeenCalled();
    });

    it('should include service ID in NotFoundException message', async () => {
      mockPrismaService.serviceType.findUnique.mockResolvedValue(null);

      try {
        await service.updateService('bad-id', 'store-1', { name: 'Test' });
        fail('Expected NotFoundException');
      } catch (err: any) {
        expect(err.message).toContain('bad-id');
      }
    });
  });
});
