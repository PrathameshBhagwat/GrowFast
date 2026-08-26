import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';
import { CatalogService } from './catalog.service';
import { ServiceCategory } from '@growfast/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// Mock CatalogService
const mockCatalogService = {
  findAllServices: jest.fn(),
  updateService: jest.fn(),
};

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: CatalogService, useValue: mockCatalogService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ServicesController>(ServicesController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockServices = [
      {
        id: 's1',
        name: 'Dry Clean',
        category: 'DRY_CLEAN',
        estimatedDays: 2,
        isActive: true,
      },
    ];

    it('should return all services without a category filter', async () => {
      mockCatalogService.findAllServices.mockResolvedValue(mockServices);

      const result = await controller.findAll({});

      expect(result).toEqual({ success: true, data: mockServices });
      expect(mockCatalogService.findAllServices).toHaveBeenCalledWith(undefined);
    });

    it('should return services filtered by category', async () => {
      mockCatalogService.findAllServices.mockResolvedValue(mockServices);

      const result = await controller.findAll({ category: ServiceCategory.DRY_CLEAN });

      expect(result).toEqual({ success: true, data: mockServices });
      expect(mockCatalogService.findAllServices).toHaveBeenCalledWith(ServiceCategory.DRY_CLEAN);
    });

    it('should NOT have roles metadata on findAll (accessible to all authenticated)', () => {
      const rolesMetadata = Reflect.getMetadata('roles', controller.findAll);
      expect(rolesMetadata).toBeUndefined();
    });
  });

  describe('update', () => {
    const existingService = {
      id: 's1',
      name: 'Dry Clean',
      category: 'DRY_CLEAN',
      estimatedDays: 2,
      isActive: true,
    };

    it('should update and return the service', async () => {
      const updateDto = { name: 'Premium Dry Clean' };
      const updatedService = { ...existingService, ...updateDto };

      mockCatalogService.updateService.mockResolvedValue(updatedService);

      const result = await controller.update('s1', updateDto);

      expect(result).toEqual({ success: true, data: updatedService });
      expect(mockCatalogService.updateService).toHaveBeenCalledWith('s1', updateDto);
    });

    it('should pass the update DTO to the service', async () => {
      const updateDto = { isActive: false };
      mockCatalogService.updateService.mockResolvedValue({ ...existingService, ...updateDto });

      await controller.update('s1', updateDto);

      expect(mockCatalogService.updateService).toHaveBeenCalledWith('s1', updateDto);
    });

    it('should have OWNER role metadata on the update method', () => {
      const rolesMetadata = Reflect.getMetadata('roles', controller.update);
      expect(rolesMetadata).toEqual(['OWNER']);
    });
  });
});
