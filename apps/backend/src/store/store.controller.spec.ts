import { Test, TestingModule } from '@nestjs/testing';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { DEFAULT_TAG_DESIGN, TagDesignConfig, Role } from '@growfast/shared-types';
import { StreamableFile } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('StoreController (Phase T4: Tag Designer & Owner Settings)', () => {
  let controller: StoreController;
  let storeService: {
    getStoreConfig: jest.Mock;
    updateStoreConfig: jest.Mock;
    getTagDesign: jest.Mock;
    updateTagDesign: jest.Mock;
    resetTagDesign: jest.Mock;
    getTagDesignHistory: jest.Mock;
    getFontFile: jest.Mock;
  };

  beforeEach(async () => {
    storeService = {
      getStoreConfig: jest.fn(),
      updateStoreConfig: jest.fn(),
      getTagDesign: jest.fn(),
      updateTagDesign: jest.fn(),
      resetTagDesign: jest.fn(),
      getTagDesignHistory: jest.fn(),
      getFontFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreController],
      providers: [
        {
          provide: StoreService,
          useValue: storeService,
        },
      ],
    }).compile();

    controller = module.get<StoreController>(StoreController);
  });

  describe('Store Isolation & Tag Design Endpoints', () => {
    it('getTagDesign passes authenticated user storeId from JWT', async () => {
      const mockReq = { user: { id: 'emp-1', storeId: 'store-alpha', role: 'OWNER' } };
      storeService.getTagDesign.mockResolvedValue({
        id: 'tmpl-1',
        storeId: 'store-alpha',
        name: DEFAULT_TAG_DESIGN.name,
        version: 1,
        isActive: true,
        layout: DEFAULT_TAG_DESIGN,
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-08T00:00:00.000Z',
      });

      const res = await controller.getTagDesign(mockReq);

      expect(storeService.getTagDesign).toHaveBeenCalledWith('store-alpha');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(DEFAULT_TAG_DESIGN);
    });

    it('updateTagDesign enforces store isolation by using req.user.storeId', async () => {
      const mockReq = { user: { id: 'emp-1', storeId: 'store-beta', role: 'OWNER' } };
      const customLayout: TagDesignConfig = {
        ...DEFAULT_TAG_DESIGN,
        name: 'Custom Beta Design',
      };
      const dto = { name: 'Custom Beta Design', layout: customLayout };

      storeService.updateTagDesign.mockResolvedValue({
        id: 'tmpl-2',
        storeId: 'store-beta',
        name: 'Custom Beta Design',
        version: 2,
        isActive: true,
        layout: customLayout,
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-08T00:00:00.000Z',
      });

      const res = await controller.updateTagDesign(mockReq, dto);

      expect(storeService.updateTagDesign).toHaveBeenCalledWith('store-beta', dto, mockReq.user);
      expect(res.success).toBe(true);
      expect(res.data.name).toBe('Custom Beta Design');
    });

    it('resetTagDesign resets design strictly for authenticated user storeId', async () => {
      const mockReq = { user: { id: 'emp-2', storeId: 'store-gamma', role: 'OWNER' } };
      storeService.resetTagDesign.mockResolvedValue({
        id: 'tmpl-3',
        storeId: 'store-gamma',
        name: DEFAULT_TAG_DESIGN.name,
        version: 1,
        isActive: true,
        layout: DEFAULT_TAG_DESIGN,
        createdAt: '2026-10-08T00:00:00.000Z',
        updatedAt: '2026-10-08T00:00:00.000Z',
      });

      const res = await controller.resetTagDesign(mockReq);

      expect(storeService.resetTagDesign).toHaveBeenCalledWith('store-gamma', mockReq.user);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(DEFAULT_TAG_DESIGN);
    });

    it('getTagDesignHistory returns version audit entries for storeId', async () => {
      const mockReq = { user: { id: 'emp-1', storeId: 'store-alpha', role: 'OWNER' } };
      storeService.getTagDesignHistory.mockResolvedValue([
        { version: 2, name: 'Version 2', updatedAt: '2026-10-18T10:00:00.000Z' },
        { version: 1, name: 'Version 1', updatedAt: '2026-10-17T10:00:00.000Z' },
      ]);

      const res = await controller.getTagDesignHistory(mockReq);

      expect(storeService.getTagDesignHistory).toHaveBeenCalledWith('store-alpha');
      expect(res.success).toBe(true);
      expect(res.data).toHaveLength(2);
    });

    it('downloadFont returns streamable font file with attachment headers', () => {
      const mockRes = { set: jest.fn() };
      const streamable = new StreamableFile(Buffer.from('test font'));
      storeService.getFontFile.mockReturnValue(streamable);

      const result = controller.downloadFont(mockRes);

      expect(storeService.getFontFile).toHaveBeenCalledWith('C39HrP36DmT.ttf');
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'font/ttf',
        'Content-Disposition': 'attachment; filename="C39HrP36DmT.ttf"',
      });
      expect(result).toBe(streamable);
    });

    it('getTopUpServices returns topUpServices from store config', async () => {
      const mockReq = { user: { id: 'emp-1', storeId: 'store-alpha', role: 'OWNER' } };
      storeService.getStoreConfig.mockResolvedValue({
        id: 'store-alpha',
        name: 'Alpha Store',
        expressSurchargePercent: 20,
        topUpServices: [{ id: 'addon-1', name: 'Starching', price: 35 }],
      });

      const res = await controller.getTopUpServices(mockReq);

      expect(storeService.getStoreConfig).toHaveBeenCalledWith('store-alpha');
      expect(res.success).toBe(true);
      expect(res.data).toEqual([{ id: 'addon-1', name: 'Starching', price: 35 }]);
    });

    it('updateStoreConfig delegates to storeService with req.user.storeId', async () => {
      const mockReq = { user: { id: 'emp-1', storeId: 'store-alpha', role: 'OWNER' } };
      const dto = { topUpServices: [{ id: 'addon-1', name: 'Starching', price: 40 }] };
      storeService.updateStoreConfig.mockResolvedValue({
        id: 'store-alpha',
        name: 'Alpha Store',
        topUpServices: dto.topUpServices,
      });

      const res = await controller.updateStoreConfig(mockReq, dto as any);

      expect(storeService.updateStoreConfig).toHaveBeenCalledWith('store-alpha', dto);
      expect(res.topUpServices).toEqual(dto.topUpServices);
    });

    it('updateStoreConfig is restricted to OWNER role only and excludes COUNTER', () => {
      const reflector = new Reflector();
      const roles = reflector.get<Role[]>(ROLES_KEY, StoreController.prototype.updateStoreConfig);

      expect(roles).toEqual([Role.OWNER]);
      expect(roles).not.toContain(Role.COUNTER);
    });
  });
});
