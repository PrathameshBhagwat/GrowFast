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
    tagTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
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

  describe('getTagDesign', () => {
    it('should return existing active tag design if found', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue({
        id: 'tmpl-1',
        storeId: 'store-1',
        name: 'Custom Tag',
        version: 2,
        isActive: true,
        layout: {
          version: 2,
          name: 'Custom Tag',
          fields: [
            { field: 'tagId', enabled: true, fontSize: 16, alignment: 'center' },
            { field: 'customerName', enabled: true, fontSize: 10, alignment: 'left' },
          ],
          containerPaddingMm: { top: 2, right: 2, bottom: 2, left: 2 },
          borderStyle: 'solid',
        },
        createdAt: new Date('2026-10-08T10:00:00.000Z'),
        updatedAt: new Date('2026-10-08T10:00:00.000Z'),
      });

      const result = await service.getTagDesign('store-1');
      expect(result.id).toBe('tmpl-1');
      expect(result.version).toBe(2);
      expect(result.name).toBe('Custom Tag');
      expect(result.layout.borderStyle).toBe('solid');
      expect(result.layout.fields.find((f) => f.field === 'tagId')?.alignment).toBe('center');
    });

    it('should return default template baseline if none exists in database', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getTagDesign('store-1');
      expect(result.id).toBe('default');
      expect(result.storeId).toBe('store-1');
      expect(result.version).toBe(1);
      expect(result.layout.fields.length).toBe(7);
      expect(result.layout.fields.find((f) => f.field === 'orderNumber')?.fontSize).toBe(15);
    });

    it('should throw NotFoundException if store does not exist', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);
      await expect(service.getTagDesign('store-non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTagDesign', () => {
    it('should deactivate old templates and create new version', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue({ version: 1 });
      mockPrisma.tagTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tagTemplate.create.mockResolvedValue({
        id: 'tmpl-new',
        storeId: 'store-1',
        name: 'Brand New Design',
        version: 2,
        isActive: true,
        layout: {},
        createdAt: new Date('2026-10-08T12:00:00.000Z'),
        updatedAt: new Date('2026-10-08T12:00:00.000Z'),
      });

      const result = await service.updateTagDesign('store-1', {
        name: 'Brand New Design',
        layout: {
          version: 1,
          name: 'Brand New Design',
          fields: [
            { field: 'tagId', enabled: true, fontSize: 16, alignment: 'center' },
            { field: 'customerName', enabled: false, fontSize: 9, alignment: 'left' },
          ],
          containerPaddingMm: { top: 3, right: 3, bottom: 3, left: 3 },
          borderStyle: 'solid',
        },
      });

      expect(mockPrisma.tagTemplate.updateMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1', isActive: true },
        data: { isActive: false },
      });
      expect(mockPrisma.tagTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 'store-1',
            version: 2,
            isActive: true,
          }),
        }),
      );
      expect(result.id).toBe('tmpl-new');
      expect(result.version).toBe(2);
    });
  });

  describe('resetTagDesign', () => {
    it('should reset store layout back to default template', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tagTemplate.create.mockResolvedValue({
        id: 'tmpl-reset',
        storeId: 'store-1',
        name: 'Standard 40×40 mm Washable Cloth Tag',
        version: 1,
        isActive: true,
        layout: {},
        createdAt: new Date('2026-10-08T14:00:00.000Z'),
        updatedAt: new Date('2026-10-08T14:00:00.000Z'),
      });

      const result = await service.resetTagDesign('store-1');
      expect(mockPrisma.tagTemplate.updateMany).toHaveBeenCalled();
      expect(mockPrisma.tagTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 'store-1',
            name: expect.stringContaining('40×40 mm'),
            isActive: true,
          }),
        }),
      );
      expect(result.id).toBe('tmpl-reset');
      expect(result.layout.borderStyle).toBe('dashed');
    });
  });
});
