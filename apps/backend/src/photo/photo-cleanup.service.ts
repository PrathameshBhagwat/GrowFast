import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PhotoStorageService } from './photo-storage.service';
import { OrderStatus, ItemStatus } from '@growfast/shared-types';

export interface PhotoCleanupOptions {
  retentionDays?: number;
  batchSize?: number;
  now?: Date;
  storeId?: string;
}

export interface PhotoCleanupResult {
  processedOrders: number;
  photosExamined: number;
  photosDeleted: number;
  storageFilesDeleted: number;
  storageFilesRetainedShared: number;
  failures: number;
  errors: string[];
}

export const DEFAULT_PHOTO_RETENTION_DAYS = 10;
export const DEFAULT_CLEANUP_BATCH_SIZE = 50;
export const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * PhotoCleanupService — automatic scheduled deletion of order photos 10 days post-delivery.
 *
 * Business Rules:
 * - Order must be FULLY delivered (order.status === DELIVERED and order.deliveredAt != null).
 * - Photos must be retained for 10 full days post-delivery:
 *   now >= order.deliveredAt + 10 days (in UTC).
 * - Partial delivery rule: Photos for orders with remaining undelivered garments are NEVER deleted.
 * - Files shared across multiple records are preserved in storage until the last reference expires.
 * - Missing storage files are handled idempotently without throwing.
 * - Transient storage errors prevent DB deletion and are queued for retry.
 */
@Injectable()
export class PhotoCleanupService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PhotoCleanupService.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorageService,
  ) {}

  onModuleInit(): void {
    const disabled =
      process.env.PHOTO_CLEANUP_DISABLED === 'true' || process.env.NODE_ENV === 'test';
    if (disabled) {
      this.logger.log('Photo automatic cleanup timer disabled by configuration/environment');
      return;
    }

    const intervalMs = parseInt(
      process.env.PHOTO_RETENTION_CLEANUP_INTERVAL_MS || `${DEFAULT_CLEANUP_INTERVAL_MS}`,
      10,
    );

    this.logger.log(
      `Initializing photo cleanup schedule with interval ${intervalMs}ms (${intervalMs / 60000} minutes)`,
    );

    // Initial delayed run after startup (30 seconds)
    setTimeout(() => {
      this.cleanupExpiredPhotos().catch((err) => {
        this.logger.error(
          'Error during initial photo cleanup run',
          err instanceof Error ? err.stack : undefined,
        );
      });
    }, 30000);

    // Recurring interval
    this.timer = setInterval(() => {
      this.cleanupExpiredPhotos().catch((err) => {
        this.logger.error(
          'Error during scheduled photo cleanup run',
          err instanceof Error ? err.stack : undefined,
        );
      });
    }, intervalMs);
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Photo cleanup timer cleared on application shutdown');
    }
  }

  /**
   * Determine whether an order's photos have reached expiration eligibility.
   *
   * @param order - Order object with deliveredAt, status, and items
   * @param retentionDays - Days after delivery photos should be retained (default: 10)
   * @param now - Reference timestamp (default: current UTC date)
   */
  isOrderPhotoExpired(
    order: {
      deliveredAt?: Date | string | null;
      status?: string | null;
      items?: Array<{ itemStatus: string }>;
    },
    retentionDays: number = DEFAULT_PHOTO_RETENTION_DAYS,
    now: Date = new Date(),
  ): boolean {
    if (!order || !order.deliveredAt || order.status !== OrderStatus.DELIVERED) {
      return false;
    }

    const deliveredDate = new Date(order.deliveredAt);
    if (isNaN(deliveredDate.getTime())) {
      return false;
    }

    // Partial delivery check: if any non-cancelled item is not DELIVERED, order is partially delivered
    if (order.items && order.items.length > 0) {
      const hasUndelivered = order.items.some(
        (item) =>
          item.itemStatus !== ItemStatus.DELIVERED && item.itemStatus !== ItemStatus.CANCELLED,
      );
      if (hasUndelivered) {
        return false;
      }
    }

    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    return now.getTime() - deliveredDate.getTime() >= retentionMs;
  }

  /**
   * Run the photo cleanup process across eligible expired orders.
   * Safe to call repeatedly and concurrently (guarded by in-memory lock).
   */
  async cleanupExpiredPhotos(options?: PhotoCleanupOptions): Promise<PhotoCleanupResult> {
    const result: PhotoCleanupResult = {
      processedOrders: 0,
      photosExamined: 0,
      photosDeleted: 0,
      storageFilesDeleted: 0,
      storageFilesRetainedShared: 0,
      failures: 0,
      errors: [],
    };

    if (this.isRunning) {
      this.logger.warn('Photo cleanup is already running locally; skipping concurrent execution');
      return result;
    }

    // Distributed multi-instance coordination via PostgreSQL advisory lock
    const ADVISORY_LOCK_ID = 84729103;
    let hasDbAdvisoryLock = false;

    try {
      if (typeof (this.prisma as any).$queryRawUnsafe === 'function') {
        const lockRes = await (this.prisma as any).$queryRawUnsafe(
          `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID}) as locked`,
        );
        if (lockRes && lockRes[0] && lockRes[0].locked === false) {
          this.logger.warn(
            'Another backend replica is currently running photo retention cleanup (pg advisory lock active); skipping',
          );
          return result;
        }
        if (lockRes && lockRes[0] && lockRes[0].locked === true) {
          hasDbAdvisoryLock = true;
        }
      }
    } catch {
      // Non-Postgres fallback or unit-test environments without raw SQL mocks
    }

    this.isRunning = true;
    try {
      const retentionDays = options?.retentionDays ?? DEFAULT_PHOTO_RETENTION_DAYS;
      const batchSize = options?.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE;
      const now = options?.now ?? new Date();

      const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

      this.logger.log(
        `Starting photo cleanup run. Cutoff delivery date: ${cutoffDate.toISOString()} (retention: ${retentionDays} days)`,
      );

      // Find delivered orders past the retention cutoff that have photos
      const eligibleOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          deliveredAt: {
            not: null,
            lte: cutoffDate,
          },
          photos: {
            some: {},
          },
          ...(options?.storeId ? { storeId: options.storeId } : {}),
        },
        include: {
          photos: true,
          items: {
            select: { itemStatus: true },
          },
          deliveryRecords: {
            select: { id: true, proofPhotoUrl: true },
          },
        },
        take: batchSize,
      });

      result.processedOrders = eligibleOrders.length;

      for (const order of eligibleOrders) {
        // Enforce partial-delivery check
        if (!this.isOrderPhotoExpired(order, retentionDays, now)) {
          continue;
        }

        for (const photo of order.photos) {
          result.photosExamined++;

          try {
            // Check if photo.url is shared with another OrderPhoto record
            const otherPhotoCount = await this.prisma.orderPhoto.count({
              where: {
                url: photo.url,
                id: { not: photo.id },
              },
            });

            // Check if referenced by active delivery records of non-expired orders
            const otherDeliveryCount = await this.prisma.deliveryRecord.count({
              where: {
                proofPhotoUrl: photo.url,
                order: {
                  OR: [
                    { status: { not: OrderStatus.DELIVERED } },
                    { deliveredAt: null },
                    { deliveredAt: { gt: cutoffDate } },
                  ],
                },
              },
            });

            const isShared = otherPhotoCount > 0 || otherDeliveryCount > 0;

            if (!isShared) {
              // Safe to delete underlying file from storage
              try {
                await this.storage.delete(photo.url);
                result.storageFilesDeleted++;
              } catch (storageError) {
                // If storage fails with an unexpected error, do NOT delete DB record; retry next time
                this.logger.error(
                  `Storage deletion failed for photo ${photo.id} (${photo.url}); keeping metadata for retry`,
                  storageError instanceof Error ? storageError.stack : undefined,
                );
                result.failures++;
                result.errors.push(`Storage deletion failed for ${photo.id}`);
                continue;
              }
            } else {
              result.storageFilesRetainedShared++;
              this.logger.log(
                `Photo ${photo.id} storage file retained because URL is shared (${photo.url})`,
              );
            }

            // Remove database metadata record
            await this.prisma.orderPhoto.delete({
              where: { id: photo.id },
            });
            result.photosDeleted++;

            // Clean up proofPhotoUrl reference on this order's delivery records if matching
            const matchingDeliveries = order.deliveryRecords.filter(
              (dr) => dr.proofPhotoUrl === photo.url,
            );
            for (const dr of matchingDeliveries) {
              await this.prisma.deliveryRecord.update({
                where: { id: dr.id },
                data: { proofPhotoUrl: null },
              });
            }
          } catch (itemErr: any) {
            result.failures++;
            const msg = `Failed to process photo cleanup for photo ${photo.id}: ${itemErr.message}`;
            result.errors.push(msg);
            this.logger.error(msg, itemErr.stack);
          }
        }
      }

      this.logger.log(
        `Photo cleanup completed: ${result.processedOrders} orders processed, ${result.photosDeleted} photos deleted (${result.storageFilesDeleted} storage files deleted, ${result.storageFilesRetainedShared} shared files kept, ${result.failures} failures)`,
      );

      return result;
    } finally {
      if (hasDbAdvisoryLock) {
        try {
          await (this.prisma as any).$queryRawUnsafe(
            `SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`,
          );
        } catch {
          // Best-effort unlock
        }
      }
      this.isRunning = false;
    }
  }
}
