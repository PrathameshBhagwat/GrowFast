import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';

import { GarmentCategory } from '@growfast/shared-types';

// Mock CatalogService
const mockCatalogService = {
  findAllGarments: jest.fn(),
  updateGarment: jest.fn(),
};

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: mockCatalogService }],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    jest.clearAllMocks();
  });

  describe('GET /api/garments', () => {
    const mockGarments = [
      { id: 'g1', name: 'Shirt', category: 'MEN', isActive: true },
      { id: 'g2', name: 'Saree', category: 'WOMEN', isActive: true },
    ];

    it('should return all garments without a category filter', async () => {
      mockCatalogService.findAllGarments.mockResolvedValue(mockGarments);

      const result = await controller.findAll({ user: { storeId: 'store-1' } }, {});

      expect(result).toEqual({
        success: true,
        data: mockGarments,
      });
      expect(mockCatalogService.findAllGarments).toHaveBeenCalledWith('store-1', undefined);
    });

    it('should return garments filtered by category', async () => {
      const menGarments = [mockGarments[0]];
      mockCatalogService.findAllGarments.mockResolvedValue(menGarments);

      const result = await controller.findAll(
        { user: { storeId: 'store-1' } },
        { category: GarmentCategory.MEN },
      );

      expect(result).toEqual({
        success: true,
        data: menGarments,
      });
      expect(mockCatalogService.findAllGarments).toHaveBeenCalledWith(
        'store-1',
        GarmentCategory.MEN,
      );
    });

    it('should return empty array when no garments match', async () => {
      mockCatalogService.findAllGarments.mockResolvedValue([]);

      const result = await controller.findAll(
        { user: { storeId: 'store-1' } },
        { category: GarmentCategory.SPECIAL },
      );

      expect(result).toEqual({
        success: true,
        data: [],
      });
    });
  });

  describe('PATCH /api/garments/:id', () => {
    const updatedGarment = {
      id: 'g1',
      name: 'Formal Shirt',
      category: 'MEN',
      isActive: true,
    };

    it('should update and return the garment', async () => {
      mockCatalogService.updateGarment.mockResolvedValue(updatedGarment);

      const result = await controller.update(
        { user: { storeId: 'store-1' } },
        'g1',
        { name: 'Formal Shirt' },
      );

      expect(result).toEqual({
        success: true,
        data: updatedGarment,
      });
      expect(mockCatalogService.updateGarment).toHaveBeenCalledWith('g1', 'store-1', {
        name: 'Formal Shirt',
      });
    });

    it('should pass the update DTO to the service', async () => {
      const dto = { name: 'Kids Dress', category: GarmentCategory.KIDS, isActive: false };
      mockCatalogService.updateGarment.mockResolvedValue({ id: 'g2', ...dto });

      await controller.update({ user: { storeId: 'store-1' } }, 'g2', dto);

      expect(mockCatalogService.updateGarment).toHaveBeenCalledWith('g2', 'store-1', dto);
    });
  });

  describe('Authorization metadata', () => {
    it('should have OWNER and MANAGER role metadata on the create method', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, CatalogController.prototype.create);

      expect(roles).toEqual(['OWNER', 'MANAGER']);
    });

    it('should have OWNER and MANAGER role metadata on the update method', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, CatalogController.prototype.update);

      expect(roles).toEqual(['OWNER', 'MANAGER']);
    });

    it('should NOT have roles metadata on the findAll method (accessible to all authenticated)', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, CatalogController.prototype.findAll);

      // No @Roles decorator on findAll means roles should be undefined
      expect(roles).toBeUndefined();
    });

    it('should restrict PATCH to OWNER and MANAGER — not COUNTER or DELIVERY', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, CatalogController.prototype.update);

      expect(roles).toContain('OWNER');
      expect(roles).toContain('MANAGER');
      expect(roles).not.toContain('COUNTER');
      expect(roles).not.toContain('DELIVERY');
    });
  });
});
