import { Injectable, OnApplicationBootstrap, OnApplicationShutdown, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationStatus } from '@growfast/shared-types';

@Injectable()
export class NotificationWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  // Configuration with safe defaults
  private readonly enabled: boolean;
  private readonly MAX_RETRIES: number;
  private readonly POLLING_INTERVAL: number;
  private readonly BATCH_SIZE = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    this.enabled = process.env.NOTIFICATION_WORKER_ENABLED !== 'false';
    this.MAX_RETRIES = process.env.MAX_NOTIFICATION_RETRIES
      ? parseInt(process.env.MAX_NOTIFICATION_RETRIES, 10)
      : 3;
    this.POLLING_INTERVAL = process.env.NOTIFICATION_WORKER_INTERVAL_MS
      ? parseInt(process.env.NOTIFICATION_WORKER_INTERVAL_MS, 10)
      : 5000;
  }

  onApplicationBootstrap() {
    if (!this.enabled) {
      this.logger.log(
        'Notification Background Worker is DISABLED via NOTIFICATION_WORKER_ENABLED=false',
      );
      return;
    }
    this.logger.log(
      `Starting Notification Background Worker (interval=${this.POLLING_INTERVAL}ms, maxRetries=${this.MAX_RETRIES})`,
    );
    this.timer = setInterval(() => this.processQueue(), this.POLLING_INTERVAL);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Notification Background Worker stopped');
    }
  }

  /**
   * Periodically scans the database for CREATED or FAILED (retryable) notifications.
   * Guards against overlapping executions via isProcessing flag.
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // 1. Find eligible notifications (CREATED or FAILED with retryCount < MAX_RETRIES)
      const eligibleNotifications = await this.prisma.notification.findMany({
        where: {
          OR: [
            { status: NotificationStatus.CREATED },
            {
              status: NotificationStatus.FAILED,
              retryCount: { lt: this.MAX_RETRIES },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: this.BATCH_SIZE,
      });

      if (eligibleNotifications.length === 0) {
        return;
      }

      this.logger.debug(`Found ${eligibleNotifications.length} notifications to process`);

      // 2. Safely claim and process each notification
      for (const notification of eligibleNotifications) {
        // Optimistic concurrency control: attempt to transition to QUEUED.
        // If another worker already claimed it, the count will be 0.
        const claimResult = await this.prisma.notification.updateMany({
          where: {
            id: notification.id,
            status: notification.status, // Ensure it hasn't changed since we queried
          },
          data: {
            status: NotificationStatus.QUEUED,
          },
        });

        if (claimResult.count === 0) {
          // Another worker claimed this notification or it was deleted/modified
          continue;
        }

        // 3. Dispatch through the NotificationService (isolated try-catch per notification)
        try {
          await this.notificationService.processNotification(notification.id);
        } catch (dispatchErr: any) {
          this.logger.error(
            `Failed to process notification ${notification.id}: ${dispatchErr.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in notification worker loop: ${err.message}`);
      // Worker must not crash the application
    } finally {
      this.isProcessing = false;
    }
  }
}
