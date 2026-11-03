import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEventType, NotificationChannel } from '@growfast/shared-types';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * C8 Notification Service Tests
 *
 * Covers:
 * 1. Event creation
 * 2. Store isolation
 * 3. Cross-store rejection
 * 4. Valid/invalid event types
 * 5. Provider failure handling
 * 6. Notification failure doesn't corrupt payment/delivery
 * 7. IDOR protection
 * 8. Duplicate event handling
 * 9. Query filtering
 */

// Mock Prisma service
const mockPrismaService = () => ({
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  order: {
    findUnique: jest.fn(),
  },
  store: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ name: 'GrowFast', address: 'Main St', phone: '+919999999999' }),
  },
});

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: ReturnType<typeof mockPrismaService>;

  const STORE_A = 'store-a';
  const STORE_B = 'store-b';
  const ORDER_ID = 'order-001';
  const CUSTOMER_ID = 'cust-001';
  const RECIPIENT = '+919876543210';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService, { provide: PrismaService, useFactory: mockPrismaService }],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Event Creation ─────────────────────────────────────────────

  describe('createNotificationEvent', () => {
    it('should create a notification event successfully', async () => {
      const mockNotification = {
        id: 'notif-001',
        storeId: STORE_A,
        orderId: null,
        customerId: CUSTOMER_ID,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      // LogProvider returns success=false, so update sets FAILED
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'No real provider configured — event recorded only',
      });
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'No real provider configured — event recorded only',
      });

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        undefined,
        CUSTOMER_ID,
      );

      expect(result).toBeDefined();
      expect(result!.storeId).toBe(STORE_A);
      expect(result!.eventType).toBe(NotificationEventType.ORDER_CREATED);
      expect(result!.channel).toBe(NotificationChannel.SMS);
      expect(result!.recipient).toBe(RECIPIENT);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('should validate orderId belongs to the correct store', async () => {
      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });

      const mockNotification = {
        id: 'notif-002',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      expect(result).toBeDefined();
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: ORDER_ID },
        select: { storeId: true },
      });
    });

    // ─── Cross-Store Rejection ───────────────────────────────────

    it('should reject notification when order belongs to different store', async () => {
      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_B });

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('should reject notification when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        'non-existent-order',
      );

      expect(result).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    // ─── Provider Failure Handling ────────────────────────────────

    it('should create event as CREATED (dispatch deferred to background)', async () => {
      const mockNotification = {
        id: 'notif-003',
        storeId: STORE_A,
        orderId: null,
        customerId: null,
        eventType: NotificationEventType.PAYMENT_RECEIVED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.PAYMENT_RECEIVED,
        NotificationChannel.SMS,
        RECIPIENT,
      );

      // Event is created successfully and deferred
      expect(result).toBeDefined();
      expect(result!.status).toBe('CREATED');
    });

    it('should handle provider dispatch failure gracefully in processNotification', async () => {
      const mockNotification = {
        id: 'notif-004',
        storeId: STORE_A,
        orderId: null,
        customerId: null,
        eventType: NotificationEventType.PAYMENT_RECEIVED,
        channel: NotificationChannel.SMS,
        status: 'QUEUED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'No real provider configured — event recorded only',
        retryCount: 1,
      });

      const success = await service.processNotification('notif-004');

      expect(success).toBe(false);
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED', retryCount: { increment: 1 } }),
        }),
      );
    });

    it('should skip dispatch if notification status is already SENT', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-already-sent',
        storeId: STORE_A,
        status: 'SENT',
      });

      const result = await service.processNotification('notif-already-sent');
      expect(result).toBe(true);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should abort dispatch if atomic status claim returns count 0 (claimed by worker)', async () => {
      prisma.notification.findUnique
        .mockResolvedValueOnce({
          id: 'notif-racing',
          storeId: STORE_A,
          status: 'CREATED',
        })
        .mockResolvedValueOnce({
          id: 'notif-racing',
          storeId: STORE_A,
          status: 'QUEUED', // Claimed by worker
        });
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.processNotification('notif-racing');
      expect(result).toBe(false);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('should block concurrent in-flight executions for the same notificationId', async () => {
      const mockNotification = {
        id: 'notif-inflight-lock',
        storeId: STORE_A,
        status: 'QUEUED',
        channel: NotificationChannel.IN_APP,
        recipient: RECIPIENT,
      };

      prisma.notification.findUnique.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 25));
        return mockNotification;
      });
      prisma.notification.update.mockResolvedValue({});

      const [p1, p2] = await Promise.all([
        service.processNotification('notif-inflight-lock'),
        service.processNotification('notif-inflight-lock'),
      ]);

      // At least one should be rejected/skipped by lock
      expect([p1, p2]).toContain(false);
    });

    // ─── Notification Failure Must Not Corrupt Business Transactions ──

    it('should return null on database error without throwing', async () => {
      prisma.notification.create.mockRejectedValue(new Error('Database connection lost'));

      // This simulates calling createNotificationEvent from inside a
      // payment or delivery transaction — it must NOT throw
      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.PAYMENT_RECEIVED,
        NotificationChannel.SMS,
        RECIPIENT,
      );

      expect(result).toBeNull();
      // No exception thrown — calling transaction is safe
    });

    // ─── Deduplication & Idempotency ──────────────────────────────

    it('should deduplicate repeated calls for the same order, event, and recipient', async () => {
      const baseNotification = {
        id: 'notif-idemp-1',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });
      // First call finds no existing record, calls create
      prisma.notification.findFirst.mockResolvedValueOnce(null);
      prisma.notification.create.mockResolvedValueOnce(baseNotification);

      const result1 = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      // Second call finds the existing notification
      prisma.notification.findFirst.mockResolvedValueOnce(baseNotification);

      const result2 = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1!.id).toBe(result2!.id);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent in-flight calls to createNotificationEvent', async () => {
      const baseNotification = {
        id: 'notif-concurrent-1',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return baseNotification;
      });

      const [r1, r2] = await Promise.all([
        service.createNotificationEvent(
          STORE_A,
          NotificationEventType.ORDER_CREATED,
          NotificationChannel.SMS,
          RECIPIENT,
          ORDER_ID,
        ),
        service.createNotificationEvent(
          STORE_A,
          NotificationEventType.ORDER_CREATED,
          NotificationChannel.SMS,
          RECIPIENT,
          ORDER_ID,
        ),
      ]);

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(r1!.id).toBe(r2!.id);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    it('should allow legitimate different event types for the same order', async () => {
      const notifCreated = {
        id: 'notif-created-1',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      const notifReady = {
        id: 'notif-ready-1',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_READY,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create
        .mockResolvedValueOnce(notifCreated)
        .mockResolvedValueOnce(notifReady);

      const resCreated = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      const resReady = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_READY,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      expect(resCreated!.id).toBe('notif-created-1');
      expect(resReady!.id).toBe('notif-ready-1');
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should allow retry if previous notification status was FAILED', async () => {
      const retryNotification = {
        id: 'notif-retried-1',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });
      // When findFirst queries for CREATED, QUEUED, SENT, none match because existing is FAILED
      prisma.notification.findFirst.mockResolvedValueOnce(null);
      prisma.notification.create.mockResolvedValueOnce(retryNotification);

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe('notif-retried-1');
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });

    // ─── All Event Types ─────────────────────────────────────────

    it.each([
      NotificationEventType.ORDER_CREATED,
      NotificationEventType.ORDER_READY,
      NotificationEventType.ORDER_OUT_FOR_DELIVERY,
      NotificationEventType.ORDER_DELIVERED,
      NotificationEventType.PAYMENT_RECEIVED,
    ])('should accept event type %s', async (eventType) => {
      const mockNotification = {
        id: `notif-${eventType}`,
        storeId: STORE_A,
        orderId: null,
        customerId: null,
        eventType,
        channel: NotificationChannel.IN_APP,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });

      const result = await service.createNotificationEvent(
        STORE_A,
        eventType,
        NotificationChannel.IN_APP,
        RECIPIENT,
      );

      expect(result).toBeDefined();
      expect(result!.eventType).toBe(eventType);
    });

    // ─── All Channels ────────────────────────────────────────────

    it.each([
      NotificationChannel.SMS,
      NotificationChannel.WHATSAPP,
      NotificationChannel.EMAIL,
      NotificationChannel.IN_APP,
    ])('should accept channel %s', async (channel) => {
      const mockNotification = {
        id: `notif-${channel}`,
        storeId: STORE_A,
        orderId: null,
        customerId: null,
        eventType: NotificationEventType.ORDER_CREATED,
        channel,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.ORDER_CREATED,
        channel,
        RECIPIENT,
      );

      expect(result).toBeDefined();
      expect(result!.channel).toBe(channel);
    });

    // ─── Payload Handling ────────────────────────────────────────

    it('should pass payload metadata correctly', async () => {
      const testPayload = { orderNumber: 'ORD-0001', amount: 500 };
      const mockNotification = {
        id: 'notif-payload',
        storeId: STORE_A,
        orderId: ORDER_ID,
        customerId: null,
        eventType: NotificationEventType.PAYMENT_RECEIVED,
        channel: NotificationChannel.SMS,
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: testPayload,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.order.findUnique.mockResolvedValue({ storeId: STORE_A });
      prisma.notification.create.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });
      prisma.notification.findUnique.mockResolvedValue({
        ...mockNotification,
        status: 'FAILED',
      });

      const result = await service.createNotificationEvent(
        STORE_A,
        NotificationEventType.PAYMENT_RECEIVED,
        NotificationChannel.SMS,
        RECIPIENT,
        ORDER_ID,
        undefined,
        testPayload,
      );

      expect(result).toBeDefined();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: testPayload,
          }),
        }),
      );
    });
  });

  // ─── findNotifications ──────────────────────────────────────────

  describe('findNotifications', () => {
    it('should return notifications filtered by storeId', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          storeId: STORE_A,
          orderId: null,
          customerId: null,
          eventType: 'ORDER_CREATED',
          channel: 'SMS',
          status: 'CREATED',
          recipient: RECIPIENT,
          payload: null,
          sentAt: null,
          failedAt: null,
          failureReason: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await service.findNotifications(STORE_A);

      expect(result).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: STORE_A },
        }),
      );
    });

    it('should apply optional filters', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findNotifications(STORE_A, {
        eventType: NotificationEventType.ORDER_READY,
        status: 'CREATED' as any,
        orderId: ORDER_ID,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            storeId: STORE_A,
            eventType: NotificationEventType.ORDER_READY,
            status: 'CREATED',
            orderId: ORDER_ID,
          },
        }),
      );
    });
  });

  // ─── findById — IDOR Protection ─────────────────────────────────

  describe('findById', () => {
    it('should return notification when found and store matches', async () => {
      const mockNotification = {
        id: 'notif-find-1',
        storeId: STORE_A,
        orderId: null,
        customerId: null,
        eventType: 'ORDER_CREATED',
        channel: 'SMS',
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      };

      prisma.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await service.findById('notif-find-1', STORE_A);
      expect(result.id).toBe('notif-find-1');
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent', STORE_A)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for cross-store access (IDOR)', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-idor',
        storeId: STORE_B,
        orderId: null,
        customerId: null,
        eventType: 'ORDER_CREATED',
        channel: 'SMS',
        status: 'CREATED',
        recipient: RECIPIENT,
        payload: null,
        sentAt: null,
        failedAt: null,
        failureReason: null,
        retryCount: 0,
        createdAt: new Date(),
      });

      await expect(service.findById('notif-idor', STORE_A)).rejects.toThrow(ForbiddenException);
    });
  });
});
