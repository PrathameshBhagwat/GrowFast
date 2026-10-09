import { Test, TestingModule } from '@nestjs/testing';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { DEFAULT_TAG_DESIGN, TagDesignConfig } from '@growfast/shared-types';

describe('StoreController (Phase T4: Tag Designer)', () => {
  let controller: StoreController;
  let storeService: {
    getStoreConfig: jest.Mock;
    updateStoreConfig: jest.Mock;
    getTagDesign: jest.Mock;
    updateTagDesign: jest.Mock;
    resetTagDesign: jest.Mock;
  };

  beforeEach(async () => {
    storeService = {
      getStoreConfig: jest.fn(),
      updateStoreConfig: jest.fn(),
      getTagDesign: jest.fn(),
      updateTagDesign: jest.fn(),
      resetTagDesign: jest.fn(),
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

      expect(storeService.updateTagDesign).toHaveBeenCalledWith('store-beta', dto);
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

      expect(storeService.resetTagDesign).toHaveBeenCalledWith('store-gamma');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(DEFAULT_TAG_DESIGN);
    });
  });
});
