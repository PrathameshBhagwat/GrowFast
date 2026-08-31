import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('StoreService', () => {
  let service: StoreService;

  const mockPrisma = {
    store: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStoreConfig', () => {
    it('should return store config', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        name: 'Store 1',
        expressSurchargePercent: 25,
      });

      const result = await service.getStoreConfig('store-1');
      expect(result.expressSurchargePercent).toBe(25);
      expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        select: { id: true, name: true, expressSurchargePercent: true },
      });
    });

    it('should throw NotFoundException if store not found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);
      await expect(service.getStoreConfig('store-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStoreConfig', () => {
    it('should update and return store config', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.store.update.mockResolvedValue({
        id: 'store-1',
        name: 'Store 1',
        expressSurchargePercent: 30,
      });

      const result = await service.updateStoreConfig('store-1', { expressSurchargePercent: 30 });
      expect(result.expressSurchargePercent).toBe(30);
      expect(mockPrisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { expressSurchargePercent: 30 },
        select: { id: true, name: true, expressSurchargePercent: true },
      });
    });
  });
});
