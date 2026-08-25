import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

// GarmentCategory values — matching @prisma/client enum values
const GarmentCategory = {
  MEN: 'MEN' as const,
  WOMEN: 'WOMEN' as const,
  KIDS: 'KIDS' as const,
  HOUSEHOLD: 'HOUSEHOLD' as const,
  SHOES: 'SHOES' as const,
  SPECIAL: 'SPECIAL' as const,
};

// Mock PrismaService
const mockPrismaService = {
  garmentCatalog: {
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

      const result = await service.findAllGarments();

      expect(result).toEqual(mockGarments);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
    });

    it('should return filtered garments when category is provided', async () => {
      const menGarments = mockGarments.filter((g) => g.category === 'MEN');
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue(menGarments);

      const result = await service.findAllGarments(GarmentCategory.MEN);

      expect(result).toEqual(menGarments);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: { category: GarmentCategory.MEN },
        orderBy: { name: 'asc' },
      });
    });

    it('should return empty array when no garments match the category', async () => {
      mockPrismaService.garmentCatalog.findMany.mockResolvedValue([]);

      const result = await service.findAllGarments(GarmentCategory.SPECIAL);

      expect(result).toEqual([]);
      expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
        where: { category: GarmentCategory.SPECIAL },
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by each valid category value', async () => {
      for (const cat of Object.values(GarmentCategory)) {
        mockPrismaService.garmentCatalog.findMany.mockResolvedValue([]);
        await service.findAllGarments(cat);
        expect(mockPrismaService.garmentCatalog.findMany).toHaveBeenCalledWith({
          where: { category: cat },
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

    it('should update and return the garment when it exists', async () => {
      const updateDto = { name: 'Formal Shirt' };
      const updatedGarment = { ...existingGarment, ...updateDto };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', updateDto);

      expect(result.name).toBe('Formal Shirt');
      expect(mockPrismaService.garmentCatalog.findUnique).toHaveBeenCalledWith({
        where: { id: 'g1' },
      });
      expect(mockPrismaService.garmentCatalog.update).toHaveBeenCalledWith({
        where: { id: 'g1' },
        data: updateDto,
      });
    });

    it('should update the category field', async () => {
      const updateDto = { category: GarmentCategory.WOMEN };
      const updatedGarment = { ...existingGarment, category: GarmentCategory.WOMEN };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', updateDto);

      expect(result.category).toBe(GarmentCategory.WOMEN);
    });

    it('should update the isActive field', async () => {
      const updateDto = { isActive: false };
      const updatedGarment = { ...existingGarment, isActive: false };

      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(existingGarment);
      mockPrismaService.garmentCatalog.update.mockResolvedValue(updatedGarment);

      const result = await service.updateGarment('g1', updateDto);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException when garment does not exist', async () => {
      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(null);

      await expect(service.updateGarment('nonexistent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.garmentCatalog.update).not.toHaveBeenCalled();
    });

    it('should include garment ID in NotFoundException message', async () => {
      mockPrismaService.garmentCatalog.findUnique.mockResolvedValue(null);

      try {
        await service.updateGarment('bad-id', { name: 'Test' });
        fail('Expected NotFoundException');
      } catch (err: any) {
        expect(err.message).toContain('bad-id');
      }
    });
  });
});
