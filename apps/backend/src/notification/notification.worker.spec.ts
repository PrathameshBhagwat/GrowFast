import { Test, TestingModule } from '@nestjs/testing';
import { NotificationWorkerService } from './notification.worker';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus } from '@growfast/shared-types';

const mockPrismaService = () => ({
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
});

const mockNotificationService = () => ({
  processNotification: jest.fn(),
});

describe('NotificationWorkerService', () => {
  let worker: NotificationWorkerService;
  let prisma: ReturnType<typeof mockPrismaService>;
  let notificationService: ReturnType<typeof mockNotificationService>;

  beforeEach(async () => {
    process.env.MAX_NOTIFICATION_RETRIES = '3';
    process.env.NOTIFICATION_WORKER_INTERVAL_MS = '5000';
    process.env.NOTIFICATION_WORKER_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorkerService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    }).compile();

    worker = module.get<NotificationWorkerService>(NotificationWorkerService);
    prisma = module.get(PrismaService);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    worker.onApplicationShutdown();
  });

  // ─── Core Processing ───────────────────────────────────────────

  it('1. Should process CREATED notifications', async () => {
    const mockNotif = { id: 'notif-1', status: NotificationStatus.CREATED };
    prisma.notification.findMany.mockResolvedValue([mockNotif]);
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await worker.processQueue();

    expect(prisma.notification.findMany).toHaveBeenCalled();
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-1', status: NotificationStatus.CREATED },
      data: { status: NotificationStatus.QUEUED },
    });
    expect(notificationService.processNotification).toHaveBeenCalledWith('notif-1');
  });

  it('2. Should retry FAILED notifications if under MAX_RETRIES', async () => {
    const mockNotif = { id: 'notif-retry', status: NotificationStatus.FAILED, retryCount: 1 };
    prisma.notification.findMany.mockResolvedValue([mockNotif]);
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await worker.processQueue();

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notif-retry', status: NotificationStatus.FAILED },
      data: { status: NotificationStatus.QUEUED },
    });
    expect(notificationService.processNotification).toHaveBeenCalledWith('notif-retry');
  });

  it('3. Should NOT process FAILED notifications at MAX_RETRIES', async () => {
    prisma.notification.findMany.mockResolvedValue([]);
    await worker.processQueue();
    expect(notificationService.processNotification).not.toHaveBeenCalled();
    const findArgs = prisma.notification.findMany.mock.calls[0][0];
    expect(findArgs.where.OR[1].retryCount.lt).toBe(3);
  });

  // ─── Error Isolation ───────────────────────────────────────────

  it('4. One failed notification does not stop other notifications', async () => {
    const mockNotifs = [
      { id: 'notif-1', status: NotificationStatus.CREATED },
      { id: 'notif-2', status: NotificationStatus.CREATED },
    ];
    prisma.notification.findMany.mockResolvedValue(mockNotifs);
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    notificationService.processNotification
      .mockRejectedValueOnce(new Error('Random crash'))
      .mockResolvedValueOnce(true);

    await worker.processQueue();

    expect(notificationService.processNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.processNotification).toHaveBeenNthCalledWith(2, 'notif-2');
  });

  // ─── Concurrency Safety ────────────────────────────────────────

  it('5. Concurrent workers cannot claim the same notification simultaneously', async () => {
    const mockNotif = { id: 'notif-1', status: NotificationStatus.CREATED };
    prisma.notification.findMany.mockResolvedValue([mockNotif]);
    prisma.notification.updateMany.mockResolvedValue({ count: 0 }); // another worker claimed

    await worker.processQueue();

    expect(notificationService.processNotification).not.toHaveBeenCalled();
  });

  // ─── Overlapping Polling Prevention ────────────────────────────

  it('6. Overlapping polling is prevented by isProcessing flag', async () => {
    // Make the first processQueue hang (never resolve until we say so)
    let resolveFirst: () => void;
    const hangingPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });
    prisma.notification.findMany.mockImplementationOnce(() => hangingPromise.then(() => []));

    const firstCall = worker.processQueue();
    // Second call should bail immediately since isProcessing is true
    await worker.processQueue();
    expect(prisma.notification.findMany).toHaveBeenCalledTimes(1);

    resolveFirst!();
    await firstCall;
  });

  // ─── Worker Error Isolation ────────────────────────────────────

  it('7. Database error in findMany does not crash the worker', async () => {
    prisma.notification.findMany.mockRejectedValue(new Error('DB connection lost'));

    // Should not throw
    await expect(worker.processQueue()).resolves.not.toThrow();
    expect(notificationService.processNotification).not.toHaveBeenCalled();
  });

  // ─── Graceful Shutdown ─────────────────────────────────────────

  it('8. Graceful shutdown clears the polling timer', () => {
    worker.onApplicationBootstrap();
    expect((worker as any).timer).not.toBeNull();

    worker.onApplicationShutdown();
    expect((worker as any).timer).toBeNull();
  });

  // ─── Worker Disabled Mode ──────────────────────────────────────

  it('9. Worker does not start when NOTIFICATION_WORKER_ENABLED=false', async () => {
    process.env.NOTIFICATION_WORKER_ENABLED = 'false';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorkerService,
        { provide: PrismaService, useFactory: mockPrismaService },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    }).compile();

    const disabledWorker = module.get<NotificationWorkerService>(NotificationWorkerService);
    disabledWorker.onApplicationBootstrap();

    expect((disabledWorker as any).timer).toBeNull();
    disabledWorker.onApplicationShutdown();
  });

  // ─── No Empty Batches Side Effects ─────────────────────────────

  it('10. Empty queue does not call processNotification', async () => {
    prisma.notification.findMany.mockResolvedValue([]);

    await worker.processQueue();

    expect(notificationService.processNotification).not.toHaveBeenCalled();
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });
});
