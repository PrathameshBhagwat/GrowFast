import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { PhotoStorageService } from './photo-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoType } from '@growfast/shared-types';

// ── Mock PrismaService ──────────────────────────────────────────────

const mockPrismaService = {
  order: {
    findUnique: jest.fn(),
  },
  orderItem: {
    findUnique: jest.fn(),
  },
  orderPhoto: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  physicalGarment: {
    findUnique: jest.fn(),
  },
};

// ── Mock PhotoStorageService ────────────────────────────────────────

const mockStorageService = {
  store: jest.fn(),
  getAccessUrl: jest.fn(),
  delete: jest.fn(),
};

// ── Test helpers ────────────────────────────────────────────────────

function createMockFile(overrides?: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test-photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024 * 100, // 100KB
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    ...overrides,
  };
}

const MOCK_STORE_ID = 'store-001';
const MOCK_ORDER = { id: 'order-001', storeId: MOCK_STORE_ID };
const MOCK_ORDER_ITEM = { id: 'item-001', orderId: 'order-001' };
const MOCK_ORDER_ITEM_WRONG_ORDER = { id: 'item-002', orderId: 'order-999' };

const MOCK_STORED_URL = 'uploads/photos/order-00/front_mock-uuid.jpg';

const MOCK_PHOTO_RECORD = {
  id: 'photo-001',
  orderId: 'order-001',
  orderItemId: null,
  type: 'FRONT',
  url: MOCK_STORED_URL,
  uploadedAt: new Date('2026-08-25T10:00:00Z'),
};

// ────────────────────────────────────────────────────────────────────

describe('PhotoService', () => {
  let service: PhotoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PhotoStorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<PhotoService>(PhotoService);
    jest.clearAllMocks();
  });

  // ── VALIDATION TESTS ──────────────────────────────────────────────

  describe('Validation', () => {
    it('should accept a valid photo upload', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      const result = await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('photo-001');
      expect(result.type).toBe('FRONT');
      expect(mockStorageService.store).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.orderPhoto.create).toHaveBeenCalledTimes(1);
    });

    it('should reject unsupported MIME type', async () => {
      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile({ mimetype: 'application/pdf' }),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
      expect(mockPrismaService.orderPhoto.create).not.toHaveBeenCalled();
    });

    it('should reject oversized photo', async () => {
      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile({ size: 50 * 1024 * 1024 }), // 50MB
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
    });

    it('should reject when no file is provided', async () => {
      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          null as any,
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unsupported file extension', async () => {
      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile({ originalname: 'test.gif', mimetype: 'image/jpeg' }),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── ASSOCIATION TESTS ─────────────────────────────────────────────

  describe('Association', () => {
    it('should accept valid orderId', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      const result = await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-001' },
        select: { id: true, storeId: true },
      });
    });

    it('should reject missing order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadPhoto(
          { orderId: 'order-nonexistent', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
    });

    it('should accept valid orderItemId belonging to the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderItem.findUnique.mockResolvedValue(MOCK_ORDER_ITEM);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue({
        ...MOCK_PHOTO_RECORD,
        orderItemId: 'item-001',
      });

      const result = await service.uploadPhoto(
        { orderId: 'order-001', orderItemId: 'item-001', type: PhotoType.DAMAGE },
        createMockFile(),
        MOCK_STORE_ID,
      );

      expect(result).toBeDefined();
    });

    it('should reject missing order item', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderItem.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', orderItemId: 'item-nonexistent', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
    });

    it('should reject order item belonging to a different order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderItem.findUnique.mockResolvedValue(MOCK_ORDER_ITEM_WRONG_ORDER);

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', orderItemId: 'item-002', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
    });

    it('should accept valid physicalGarmentId belonging to the order and store', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.physicalGarment.findUnique.mockResolvedValue({
        id: 'garment-001',
        orderItemId: 'item-001',
        orderItem: { orderId: 'order-001', order: { storeId: MOCK_STORE_ID } },
      });
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      const result = await service.uploadPhoto(
        { orderId: 'order-001', physicalGarmentId: 'garment-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );
      expect(result).toBeDefined();
    });

    it('should reject physicalGarmentId belonging to a different store', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.physicalGarment.findUnique.mockResolvedValue({
        id: 'garment-002',
        orderItemId: 'item-001',
        orderItem: { orderId: 'order-001', order: { storeId: 'store-wrong' } },
      });

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', physicalGarmentId: 'garment-002', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject physicalGarmentId belonging to a different order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.physicalGarment.findUnique.mockResolvedValue({
        id: 'garment-003',
        orderItemId: 'item-002',
        orderItem: { orderId: 'order-999', order: { storeId: MOCK_STORE_ID } },
      });

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', physicalGarmentId: 'garment-003', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── PERSISTENCE / FAILURE CONSISTENCY TESTS ───────────────────────

  describe('Failure Consistency', () => {
    it('should create OrderPhoto metadata on successful storage', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      expect(mockPrismaService.orderPhoto.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-001',
          orderItemId: null,
          type: PhotoType.FRONT,
          url: MOCK_STORED_URL,
        }),
      });
    });

    it('should NOT create metadata when storage fails', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockRejectedValue(new Error('Storage write failed'));

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.orderPhoto.create).not.toHaveBeenCalled();
    });

    it('should attempt storage cleanup when DB persistence fails', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockRejectedValue(new Error('DB write failed'));
      mockStorageService.delete.mockResolvedValue(undefined);

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      // Should have attempted cleanup
      expect(mockStorageService.delete).toHaveBeenCalledWith(MOCK_STORED_URL);
    });

    it('should still throw when both DB and cleanup fail', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockRejectedValue(new Error('DB write failed'));
      mockStorageService.delete.mockRejectedValue(new Error('Cleanup failed'));

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      // Cleanup was attempted even though it failed
      expect(mockStorageService.delete).toHaveBeenCalledWith(MOCK_STORED_URL);
    });
  });

  // ── RETRIEVAL TESTS ───────────────────────────────────────────────

  describe('Retrieval', () => {
    it('should return photos for the requested order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderPhoto.findMany.mockResolvedValue([
        MOCK_PHOTO_RECORD,
        { ...MOCK_PHOTO_RECORD, id: 'photo-002', type: 'BACK' },
      ]);
      mockStorageService.getAccessUrl.mockImplementation(async (url: string) => url);

      const result = await service.getOrderPhotos('order-001', MOCK_STORE_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('photo-001');
      expect(result[1].id).toBe('photo-002');
      expect(mockPrismaService.orderPhoto.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-001' },
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('should return empty array when order has no photos', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderPhoto.findMany.mockResolvedValue([]);
      mockStorageService.getAccessUrl.mockImplementation(async (url: string) => url);

      const result = await service.getOrderPhotos('order-001', MOCK_STORE_ID);

      expect(result).toHaveLength(0);
    });

    it('should reject retrieval for non-existent order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderPhotos('order-nonexistent', MOCK_STORE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should only return photos belonging to the requested order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderPhoto.findMany.mockResolvedValue([MOCK_PHOTO_RECORD]);
      mockStorageService.getAccessUrl.mockImplementation(async (url: string) => url);

      await service.getOrderPhotos('order-001', MOCK_STORE_ID);

      // Verify the query filters by orderId
      expect(mockPrismaService.orderPhoto.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-001' },
        orderBy: { uploadedAt: 'desc' },
      });
    });
  });

  // ── STORE SCOPING TESTS ───────────────────────────────────────────

  describe('Store Scoping', () => {
    it('should allow upload when storeId matches the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      const result = await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('photo-001');
    });

    it('should reject upload when storeId does not match the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...MOCK_ORDER,
        storeId: 'store-other',
      });

      await expect(
        service.uploadPhoto(
          { orderId: 'order-001', type: PhotoType.FRONT },
          createMockFile(),
          MOCK_STORE_ID,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockStorageService.store).not.toHaveBeenCalled();
    });

    it('should allow retrieval when storeId matches the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockPrismaService.orderPhoto.findMany.mockResolvedValue([MOCK_PHOTO_RECORD]);
      mockStorageService.getAccessUrl.mockImplementation(async (url: string) => url);

      const result = await service.getOrderPhotos('order-001', MOCK_STORE_ID);

      expect(result).toHaveLength(1);
    });

    it('should reject retrieval when storeId does not match the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        ...MOCK_ORDER,
        storeId: 'store-other',
      });

      await expect(service.getOrderPhotos('order-001', MOCK_STORE_ID)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.orderPhoto.findMany).not.toHaveBeenCalled();
    });
  });

  // ── SECURITY TESTS ────────────────────────────────────────────────

  describe('Security', () => {
    it('should generate unpredictable object keys', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      // Verify the key passed to storage is not simply "orderId/type.ext"
      const storeCall = mockStorageService.store.mock.calls[0];
      const key = storeCall[0] as string;

      // Key should NOT be just "order-001/front.jpg" — it must contain a UUID
      expect(key).not.toBe('order-001/front.jpg');
      expect(key).toMatch(/^.+\/.+_.+\.\w+$/); // pattern: prefix/type_uuid.ext
    });

    it('should not expose storage credentials in the response', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(MOCK_ORDER);
      mockStorageService.store.mockResolvedValue(MOCK_STORED_URL);
      mockPrismaService.orderPhoto.create.mockResolvedValue(MOCK_PHOTO_RECORD);

      const result = await service.uploadPhoto(
        { orderId: 'order-001', type: PhotoType.FRONT },
        createMockFile(),
        MOCK_STORE_ID,
      );

      // Response should contain the DTO fields, no credentials
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('uploadedAt');
      expect(result).not.toHaveProperty('accessKey');
      expect(result).not.toHaveProperty('secret');
      expect(result).not.toHaveProperty('bucket');
    });
  });
});
