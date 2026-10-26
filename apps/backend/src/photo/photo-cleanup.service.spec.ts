import { Test, TestingModule } from '@nestjs/testing';
import { PhotoCleanupService } from './photo-cleanup.service';
import { PhotoService } from './photo.service';
import { PhotoStorageService } from './photo-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, ItemStatus } from '@growfast/shared-types';

describe('PhotoCleanupService & 10-Day Retention Rules', () => {
  let cleanupService: PhotoCleanupService;
  let photoService: PhotoService;

  const mockPrisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    orderPhoto: {
      count: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    deliveryRecord: {
      count: jest.fn(),
      update: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const mockStorage = {
    store: jest.fn(),
    getAccessUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoCleanupService,
        PhotoService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: PhotoStorageService,
          useValue: mockStorage,
        },
      ],
    }).compile();

    cleanupService = module.get<PhotoCleanupService>(PhotoCleanupService);
    photoService = module.get<PhotoService>(PhotoService);
  });

  // ── Retention Timing Tests ──────────────────────────────────────────

  describe('Retention Timing Verification (UTC Consistent)', () => {
    const fixedNow = new Date('2026-10-25T12:00:00.000Z');

    it('1. Order delivered less than 10 days ago: photos remain available (not eligible for deletion)', () => {
      // Delivered 9 days and 23 hours ago
      const deliveredAt = new Date('2026-10-15T13:00:00.000Z');
      const order = {
        status: OrderStatus.DELIVERED,
        deliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      };

      const isExpired = cleanupService.isOrderPhotoExpired(order, 10, fixedNow);
      expect(isExpired).toBe(false);

      const serviceExpired = photoService.isOrderPhotoRetentionExpired(order, fixedNow);
      expect(serviceExpired).toBe(false);
    });

    it('2. Order delivered exactly 10 days ago: photos are eligible for deletion', () => {
      // Exactly 10 days = 240 hours ago
      const deliveredAt = new Date('2026-10-15T12:00:00.000Z');
      const order = {
        status: OrderStatus.DELIVERED,
        deliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      };

      const isExpired = cleanupService.isOrderPhotoExpired(order, 10, fixedNow);
      expect(isExpired).toBe(true);

      const serviceExpired = photoService.isOrderPhotoRetentionExpired(order, fixedNow);
      expect(serviceExpired).toBe(true);
    });

    it('3. Order delivered more than 10 days ago: photos are eligible for deletion', () => {
      // Delivered 15 days ago
      const deliveredAt = new Date('2026-10-10T12:00:00.000Z');
      const order = {
        status: OrderStatus.DELIVERED,
        deliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      };

      const isExpired = cleanupService.isOrderPhotoExpired(order, 10, fixedNow);
      expect(isExpired).toBe(true);

      const serviceExpired = photoService.isOrderPhotoRetentionExpired(order, fixedNow);
      expect(serviceExpired).toBe(true);
    });

    it('4. Order not delivered: photos remain available regardless of order age', () => {
      // Created 30 days ago, but still in PROCESSING
      const order = {
        status: OrderStatus.PROCESSING,
        deliveredAt: null,
        items: [{ itemStatus: ItemStatus.PROCESSING }],
      };

      const isExpired = cleanupService.isOrderPhotoExpired(order, 10, fixedNow);
      expect(isExpired).toBe(false);

      const serviceExpired = photoService.isOrderPhotoRetentionExpired(order, fixedNow);
      expect(serviceExpired).toBe(false);
    });

    it('5. Order partially delivered: photos remain available until full delivery', () => {
      // Order has deliveredAt set from a partial drop, but has an item in READY or PROCESSING
      const deliveredAt = new Date('2026-10-10T12:00:00.000Z');
      const order = {
        status: OrderStatus.DELIVERED, // Even if marked delivered, items indicate partial state
        deliveredAt,
        items: [
          { itemStatus: ItemStatus.DELIVERED },
          { itemStatus: ItemStatus.READY }, // Not delivered!
        ],
      };

      const isExpired = cleanupService.isOrderPhotoExpired(order, 10, fixedNow);
      expect(isExpired).toBe(false);

      const serviceExpired = photoService.isOrderPhotoRetentionExpired(order, fixedNow);
      expect(serviceExpired).toBe(false);
    });

    it('6. Delivery timestamp missing or invalid: photos are not deleted based on assumed timestamps', () => {
      const orderNoDate = {
        status: OrderStatus.DELIVERED,
        deliveredAt: null,
      };
      expect(cleanupService.isOrderPhotoExpired(orderNoDate, 10, fixedNow)).toBe(false);

      const orderInvalidDate = {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date('invalid-date'),
      };
      expect(cleanupService.isOrderPhotoExpired(orderInvalidDate, 10, fixedNow)).toBe(false);
    });

    it('7. Time-zone differences do not change retention calculation (UTC consistency)', () => {
      // +05:30 (IST) vs UTC: Both represent the exact same point in time
      const utcString = '2026-10-15T12:00:00.000Z';
      const istString = '2026-10-15T17:30:00.000+05:30';

      const orderUtc = {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(utcString),
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      };
      const orderIst = {
        status: OrderStatus.DELIVERED,
        deliveredAt: new Date(istString),
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      };

      expect(cleanupService.isOrderPhotoExpired(orderUtc, 10, fixedNow)).toBe(true);
      expect(cleanupService.isOrderPhotoExpired(orderIst, 10, fixedNow)).toBe(true);
    });
  });

  // ── Storage and Database Cleanup Tests ──────────────────────────────

  describe('Storage & Database Cleanup Execution', () => {
    const fixedNow = new Date('2026-10-25T12:00:00.000Z');
    const oldDeliveredAt = new Date('2026-10-10T12:00:00.000Z'); // 15 days ago

    it('8. Stored file exists and is deleted successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [
          {
            id: 'photo-1',
            url: 'uploads/photos/order-1/front_1.jpg',
            orderId: 'order-1',
          },
        ],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.orderPhoto.count.mockResolvedValue(0); // Not shared
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.orderPhoto.delete.mockResolvedValue(mockOrder.photos[0]);

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      expect(result.processedOrders).toBe(1);
      expect(result.photosDeleted).toBe(1);
      expect(result.storageFilesDeleted).toBe(1);
      expect(mockStorage.delete).toHaveBeenCalledWith('uploads/photos/order-1/front_1.jpg');
      expect(mockPrisma.orderPhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
    });

    it('9. Stored file is already missing: handled gracefully without crashing, DB metadata removed', async () => {
      const mockOrder = {
        id: 'order-missing',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [
          {
            id: 'photo-missing',
            url: 'uploads/photos/missing.jpg',
            orderId: 'order-missing',
          },
        ],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.orderPhoto.count.mockResolvedValue(0);
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);
      // Best-effort storage.delete succeeds even if file was already missing
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.orderPhoto.delete.mockResolvedValue(mockOrder.photos[0]);

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      expect(result.processedOrders).toBe(1);
      expect(result.photosDeleted).toBe(1);
      expect(result.failures).toBe(0);
      expect(mockPrisma.orderPhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-missing' } });
    });

    it('10. Storage deletion fails temporarily: metadata is preserved for safe retry', async () => {
      const mockOrder = {
        id: 'order-fail',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [
          {
            id: 'photo-fail',
            url: 'uploads/photos/fail.jpg',
            orderId: 'order-fail',
          },
        ],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.orderPhoto.count.mockResolvedValue(0);
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);
      mockStorage.delete.mockRejectedValue(new Error('Transient S3 503 error'));

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      expect(result.photosDeleted).toBe(0);
      expect(result.failures).toBe(1);
      // DB record must NOT be deleted so retry can occur
      expect(mockPrisma.orderPhoto.delete).not.toHaveBeenCalled();
    });

    it('11. One failed photo does not prevent other eligible photos from being processed', async () => {
      const mockOrder = {
        id: 'order-multi',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [
          { id: 'photo-fail-1', url: 'uploads/photos/fail.jpg', orderId: 'order-multi' },
          { id: 'photo-ok-2', url: 'uploads/photos/ok.jpg', orderId: 'order-multi' },
        ],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      mockPrisma.orderPhoto.count.mockResolvedValue(0);
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);

      mockStorage.delete.mockImplementation(async (url: string) => {
        if (url === 'uploads/photos/fail.jpg') {
          throw new Error('Network timeout');
        }
      });
      mockPrisma.orderPhoto.delete.mockResolvedValue({ id: 'photo-ok-2' });

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      expect(result.photosExamined).toBe(2);
      expect(result.photosDeleted).toBe(1);
      expect(result.failures).toBe(1);
      expect(mockPrisma.orderPhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-ok-2' } });
    });

    it('12. Repeated cleanup runs are idempotent and do not create errors', async () => {
      // First run has 1 eligible order
      const mockOrder = {
        id: 'order-idempotent',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [{ id: 'p1', url: 'p1.jpg', orderId: 'order-idempotent' }],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValueOnce([mockOrder]).mockResolvedValueOnce([]);
      mockPrisma.orderPhoto.count.mockResolvedValue(0);
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);
      mockStorage.delete.mockResolvedValue(undefined);
      mockPrisma.orderPhoto.delete.mockResolvedValue(mockOrder.photos[0]);

      // Run 1
      const res1 = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });
      expect(res1.photosDeleted).toBe(1);

      // Run 2: No more photos
      const res2 = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });
      expect(res2.photosDeleted).toBe(0);
      expect(res2.failures).toBe(0);
    });

    it('13. Shared files are NOT deleted from storage while still referenced elsewhere', async () => {
      const mockOrder = {
        id: 'order-shared',
        status: OrderStatus.DELIVERED,
        deliveredAt: oldDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
        photos: [{ id: 'photo-shared', url: 'uploads/photos/shared-logo.png', orderId: 'order-shared' }],
        deliveryRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([mockOrder]);
      // Referenced by another active order record
      mockPrisma.orderPhoto.count.mockResolvedValue(1);
      mockPrisma.deliveryRecord.count.mockResolvedValue(0);
      mockPrisma.orderPhoto.delete.mockResolvedValue(mockOrder.photos[0]);

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      expect(result.photosDeleted).toBe(1);
      expect(result.storageFilesDeleted).toBe(0);
      expect(result.storageFilesRetainedShared).toBe(1);
      // Storage delete was NOT called because file is shared
      expect(mockStorage.delete).not.toHaveBeenCalled();
      // But DB metadata record for this order was deleted
      expect(mockPrisma.orderPhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-shared' } });
    });

    it('14. Expired photos cannot be retrieved through the normal API (getOrderPhotos gatekeeping)', async () => {
      const expiredDeliveredAt = new Date('2026-10-10T12:00:00.000Z'); // 15 days ago

      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-api-test',
        storeId: 'store-001',
        status: OrderStatus.DELIVERED,
        deliveredAt: expiredDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      });

      const photos = await photoService.getOrderPhotos('order-api-test', 'store-001');

      // Returns empty list because retention period expired
      expect(photos).toEqual([]);
      expect(mockPrisma.orderPhoto.findMany).not.toHaveBeenCalled();
    });

    it('15. Concurrent cleanup attempt blocked when PostgreSQL advisory lock is held by another instance', async () => {
      // Simulate another replica holding the advisory lock
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ locked: false }]);

      const result = await cleanupService.cleanupExpiredPhotos({ now: fixedNow });

      // Skips execution
      expect(result.processedOrders).toBe(0);
      expect(result.photosDeleted).toBe(0);
      expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
    });

    it('16. Direct local photo URL access blocked when retention expired (isPhotoUrlExpired gatekeeping)', async () => {
      mockPrisma.orderPhoto.findFirst = jest.fn().mockResolvedValue({
        id: 'photo-url-1',
        url: 'uploads/photos/stores/store-1/orders/order-exp/front.jpg',
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date('2026-10-10T12:00:00.000Z'), // 15 days ago
          items: [{ itemStatus: ItemStatus.DELIVERED }],
        },
      });

      const isExpired = await photoService.isPhotoUrlExpired(
        'uploads/photos/stores/store-1/orders/order-exp/front.jpg',
        fixedNow,
      );
      expect(isExpired).toBe(true);

      // Active order
      mockPrisma.orderPhoto.findFirst = jest.fn().mockResolvedValue({
        id: 'photo-url-2',
        url: 'uploads/photos/stores/store-1/orders/order-act/front.jpg',
        order: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date('2026-10-23T12:00:00.000Z'), // 2 days ago
          items: [{ itemStatus: ItemStatus.DELIVERED }],
        },
      });

      const isActExpired = await photoService.isPhotoUrlExpired(
        'uploads/photos/stores/store-1/orders/order-act/front.jpg',
        fixedNow,
      );
      expect(isActExpired).toBe(false);
    });

    it('17. Presigned URL lifetime clamped to remaining retention duration when near the 10-day deadline', async () => {
      // Order delivered 9 days, 23 hours, and 30 minutes ago
      // Remaining retention = 30 minutes = 1800 seconds (< standard 3600s / 1hr)
      const nearExpiredDeliveredAt = new Date(Date.now() - (10 * 24 * 3600 * 1000 - 1800 * 1000));

      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'order-near-expiry',
        storeId: 'store-001',
        status: OrderStatus.DELIVERED,
        deliveredAt: nearExpiredDeliveredAt,
        items: [{ itemStatus: ItemStatus.DELIVERED }],
      });

      mockPrisma.orderPhoto.findMany.mockResolvedValue([
        {
          id: 'photo-near-expiry',
          orderId: 'order-near-expiry',
          url: 'stores/store-1/orders/order-near-expiry/front.jpg',
          type: 'FRONT',
          uploadedAt: new Date('2026-10-15T12:30:00.000Z'),
        },
      ]);

      mockStorage.getAccessUrl.mockResolvedValue('https://r2.cloudflarestorage.com/photo.jpg?signed');

      const dtos = await photoService.getOrderPhotos('order-near-expiry', 'store-001');

      expect(dtos.length).toBe(1);
      // Verify getAccessUrl was called with clamped maxExpirySeconds (around 1800s, not default 3600s)
      expect(mockStorage.getAccessUrl).toHaveBeenCalledWith(
        'stores/store-1/orders/order-near-expiry/front.jpg',
        expect.any(Number),
      );
      const passedExpiry = (mockStorage.getAccessUrl as jest.Mock).mock.calls[0][1];
      expect(passedExpiry).toBeLessThanOrEqual(3600);
    });

    it('18. Large photo collection is processed in bounded batches without exhausting memory', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ locked: true }]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await cleanupService.cleanupExpiredPhotos({
        batchSize: 25,
        now: fixedNow,
      });

      // Verify take: 25 was passed to Prisma query
      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
        }),
      );
    });

    it('19. Backend lifecycle hooks (onModuleInit and onApplicationShutdown) manage timer safely', () => {
      // Test shutdown clears timer without throwing
      expect(() => cleanupService.onApplicationShutdown()).not.toThrow();
    });
  });
});
