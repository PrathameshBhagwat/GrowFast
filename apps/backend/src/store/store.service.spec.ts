import { Test, TestingModule } from '@nestjs/testing';
import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('StoreService', () => {
  let service: StoreService;

  const mockPrisma: any = {
    store: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tagTemplate: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
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
    it('should return store config with default top up services if none configured', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        name: 'Store 1',
        expressSurchargePercent: 25,
        topUpServices: null,
      });

      const result = await service.getStoreConfig('store-1');
      expect(result.expressSurchargePercent).toBe(25);
      expect(result.topUpServices).toBeDefined();
      expect(result.topUpServices.length).toBe(4);
      expect(mockPrisma.store.findUnique).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        select: { id: true, name: true, expressSurchargePercent: true, topUpServices: true },
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
        topUpServices: null,
      });

      const result = await service.updateStoreConfig('store-1', { expressSurchargePercent: 30 });
      expect(result.expressSurchargePercent).toBe(30);
      expect(mockPrisma.store.update).toHaveBeenCalledWith({
        where: { id: 'store-1' },
        data: { expressSurchargePercent: 30 },
        select: { id: true, name: true, expressSurchargePercent: true, topUpServices: true },
      });
    });

    it('should update configurable top up services and validate prices', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      const customTopUps = [
        { id: 'addon-starch', name: 'Custom Starch', price: 45, description: 'Crisp per kg' },
        { id: 'addon-perfume', name: 'Premium Perfume', price: 35, description: 'Fragrance' },
      ];
      mockPrisma.store.update.mockResolvedValue({
        id: 'store-1',
        name: 'Store 1',
        expressSurchargePercent: null,
        topUpServices: customTopUps,
      });

      const result = await service.updateStoreConfig('store-1', {
        topUpServices: customTopUps,
      });
      expect(result.topUpServices).toHaveLength(2);
      expect(result.topUpServices[0].name).toBe('Custom Starch');
      expect(result.topUpServices[0].price).toBe(45);
    });
  });

  describe('getTagDesign', () => {
    it('should return active stored template if exists', async () => {
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
            { field: 'orderNumber', enabled: true, fontSize: 16, alignment: 'center' },
            { field: 'tagId', enabled: true, fontSize: 12, alignment: 'center' },
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

    it('should return reference default template baseline if none exists in database', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getTagDesign('store-1');
      expect(result.id).toBe('default');
      expect(result.storeId).toBe('store-1');
      expect(result.version).toBe(1);
      expect(result.layout.fields.length).toBe(11);
      expect(result.layout.printer).toBe('TSC TE244');
    });

    it('should throw NotFoundException if store does not exist', async () => {
      mockPrisma.store.findUnique.mockResolvedValue(null);
      await expect(service.getTagDesign('store-non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTagDesign', () => {
    it('should deactivate old templates and create new version atomically with audit history', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue({ version: 1, layout: {} });
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

      const result = await service.updateTagDesign(
        'store-1',
        {
          name: 'Brand New Design',
          layout: {
            version: 1,
            name: 'Brand New Design',
            width: '1.5 in',
            height: '1.5 in',
            printer: 'TSC TE244',
            fields: [
              { field: 'bookingNo', enabled: true, fontSize: 19, alignment: 'center' },
              { field: 'customer', enabled: true, fontSize: 11, alignment: 'center' },
            ],
            containerPaddingMm: { top: 3, right: 3, bottom: 3, left: 3 },
            borderStyle: 'solid',
          },
        },
        { id: 'owner-1', name: 'Prathamesh', email: 'owner@growfast.com' },
      );

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
      expect(result.layout.lastUpdatedBy?.name).toBe('Prathamesh');
      expect(result.layout.auditHistory).toHaveLength(1);
    });
  });

  describe('resetTagDesign', () => {
    it('should reset store layout back to canonical reference template', async () => {
      mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1' });
      mockPrisma.tagTemplate.findFirst.mockResolvedValue({ version: 2, layout: {} });
      mockPrisma.tagTemplate.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.tagTemplate.create.mockResolvedValue({
        id: 'tmpl-reset',
        storeId: 'store-1',
        name: 'Standard 1.5×1.5 in Tag (TSC TE244)',
        version: 3,
        isActive: true,
        layout: {},
        createdAt: new Date('2026-10-08T14:00:00.000Z'),
        updatedAt: new Date('2026-10-08T14:00:00.000Z'),
      });

      const result = await service.resetTagDesign('store-1', { id: 'owner-1', name: 'Prathamesh' });
      expect(mockPrisma.tagTemplate.updateMany).toHaveBeenCalled();
      expect(mockPrisma.tagTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storeId: 'store-1',
            isActive: true,
          }),
        }),
      );
      expect(result.id).toBe('tmpl-reset');
      expect(result.layout.printer).toBe('TSC TE244');
    });
  });

  describe('getTagDesignHistory & getFontFile', () => {
    it('should query version history ordered by version desc', async () => {
      mockPrisma.tagTemplate.findMany.mockResolvedValue([
        {
          id: 't-2',
          version: 2,
          name: 'V2',
          isActive: true,
          updatedAt: new Date(),
          layout: {
            width: '1.5 in',
            height: '1.5 in',
            printer: 'TSC TE244',
            fields: [{ enabled: true }],
          },
        },
      ]);

      const history = await service.getTagDesignHistory('store-1');
      expect(mockPrisma.tagTemplate.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1' },
        orderBy: { version: 'desc' },
        take: 20,
      });
      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(2);
    });

    it('getFontFile returns streamable font file', () => {
      const file = service.getFontFile('C39HrP36DmT.ttf');
      expect(file).toBeDefined();
    });
  });
});
