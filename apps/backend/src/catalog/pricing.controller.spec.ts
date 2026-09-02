import { Test, TestingModule } from '@nestjs/testing';
import { PricingController } from './pricing.controller';
import { CatalogService } from './catalog.service';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// Mock CatalogService
const mockCatalogService = {
  findAllPrices: jest.fn(),
  setPrice: jest.fn(),
};

describe('PricingController', () => {
  let controller: PricingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [{ provide: CatalogService, useValue: mockCatalogService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<PricingController>(PricingController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockPrices = [
      {
        id: 'p1',
        garmentCatalogId: 'g1',
        serviceTypeId: 's1',
        price: 105,
        storeId: 'store-1',
      },
    ];

    it('should return all pricing records for the store', async () => {
      mockCatalogService.findAllPrices.mockResolvedValue(mockPrices);

      const result = await controller.findAll({ user: { storeId: 'store-1' } });

      expect(result).toEqual({ success: true, data: mockPrices });
      expect(mockCatalogService.findAllPrices).toHaveBeenCalledWith('store-1');
    });

    it('should NOT have roles metadata on findAll (accessible to all authenticated)', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, PricingController.prototype.findAll);
      expect(roles).toBeUndefined();
    });
  });

  describe('setPrice', () => {
    const mockPriceRecord = {
      id: 'p1',
      garmentCatalogId: 'g1',
      serviceTypeId: 's1',
      price: 120,
      storeId: 'store-1',
    };

    it('should set price and return the record', async () => {
      mockCatalogService.setPrice.mockResolvedValue(mockPriceRecord);

      const result = await controller.setPrice(
        { user: { storeId: 'store-1' } },
        'g1',
        's1',
        { price: 120 },
      );

      expect(result).toEqual({ success: true, data: mockPriceRecord });
      expect(mockCatalogService.setPrice).toHaveBeenCalledWith('g1', 's1', 'store-1', { price: 120 });
    });

    it('should have OWNER and MANAGER role metadata on setPrice', () => {
      const reflector = new Reflector();
      const roles = reflector.get<string[]>(ROLES_KEY, PricingController.prototype.setPrice);
      expect(roles).toEqual(['OWNER', 'MANAGER']);
    });
  });
});
