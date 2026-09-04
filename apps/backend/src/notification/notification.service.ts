import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
  type NotificationDTO,
} from '@growfast/shared-types';
import { NotificationProvider, LogNotificationProvider } from './notification.provider';
import { WhatsAppNotificationProvider } from './whatsapp-notification.provider';
import { BaileysWhatsAppProvider } from './baileys-whatsapp.provider';

/**
 * Notification Service — C8 Foundation
 *
 * Core responsibilities:
 * 1. Record notification events in the database (always succeeds if DB is up)
 * 2. Optionally dispatch via a provider (failure is non-fatal)
 * 3. Enforce store isolation on all queries
 * 4. Never break calling business transactions on notification failure
 *
 * IMPORTANT:
 * - This service is a CONSUMER of business state. It never modifies
 *   Order, Payment, or Delivery records.
 * - Notification failures are logged and recorded, never thrown to callers
 *   of createNotificationEvent().
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly logProvider: NotificationProvider;
  private readonly whatsappProvider: NotificationProvider;

  constructor(private readonly prisma: PrismaService) {
    this.logProvider = new LogNotificationProvider();

    const providerType = process.env.WHATSAPP_PROVIDER || 'log';
    if (providerType === 'baileys') {
      this.whatsappProvider = new BaileysWhatsAppProvider();
    } else if (providerType === 'meta') {
      this.whatsappProvider = new WhatsAppNotificationProvider();
    } else {
      this.whatsappProvider = this.logProvider; // fallback to log
    }
  }

  private getProvider(channel: NotificationChannel): NotificationProvider {
    if (channel === NotificationChannel.WHATSAPP || channel === NotificationChannel.SMS) {
      return this.whatsappProvider;
    }
    return this.logProvider;
  }

  /**
   * Create and record a notification event.
   *
   * This method is designed to be SAFE to call from business transactions:
   * - It catches all errors internally
   * - It never throws to the caller
   * - It returns null on failure instead of crashing the calling transaction
   *
   * @param storeId - Derived from authenticated context, NEVER from client input
   */
  async createNotificationEvent(
    storeId: string,
    eventType: NotificationEventType,
    channel: NotificationChannel,
    recipient: string,
    orderId?: string,
    customerId?: string,
    payload?: Record<string, unknown>,
  ): Promise<NotificationDTO | null> {
    try {
      // 1. Validate referenced records belong to the store
      if (orderId) {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: { storeId: true },
        });
        if (!order || order.storeId !== storeId) {
          this.logger.warn(`Notification rejected: order ${orderId} not found or wrong store`);
          return null;
        }
      }

      // 2. Create the notification record
      const notification = await this.prisma.notification.create({
        data: {
          storeId,
          orderId: orderId || null,
          customerId: customerId || null,
          eventType,
          channel,
          status: 'CREATED',
          recipient,
          payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
          retryCount: 0,
        },
      });

      // 3. Return the created state (background worker will handle dispatch)
      return this.toDTO(notification);
    } catch (err: any) {
      // CRITICAL: Never throw from this method — calling transactions must not break
      this.logger.error(`Failed to create notification event: ${err.message}`);
      return null;
    }
  }

  /**
   * Process a single notification (called by the background worker).
   */
  async processNotification(notificationId: string): Promise<boolean> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) return false;

    try {
      const provider = this.getProvider(notification.channel as NotificationChannel);
      const result = await provider.dispatch({
        id: notification.id,
        channel: notification.channel,
        recipient: notification.recipient,
        eventType: notification.eventType,
        payload: (notification.payload as Record<string, unknown>) || null,
      });

      if (result.success) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        return true;
      } else {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: result.failureReason || 'Provider returned failure',
            retryCount: { increment: 1 },
          },
        });
        return false;
      }
    } catch (dispatchErr: any) {
      this.logger.error(
        `Notification dispatch failed for ${notification.id}: ${dispatchErr.message}`,
      );
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: dispatchErr.message || 'Dispatch exception',
          retryCount: { increment: 1 },
        },
      });
      return false;
    }
  }

  /**
   * Find notifications for a store with optional filters.
   * Enforces store isolation.
   */
  async findNotifications(
    storeId: string,
    filters?: {
      eventType?: NotificationEventType;
      status?: NotificationStatus;
      orderId?: string;
    },
  ): Promise<NotificationDTO[]> {
    const where: any = { storeId };

    if (filters?.eventType) where.eventType = filters.eventType;
    if (filters?.status) where.status = filters.status;
    if (filters?.orderId) where.orderId = filters.orderId;

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return notifications.map((n) => this.toDTO(n));
  }

  /**
   * Find a single notification by ID with store isolation and IDOR protection.
   */
  async findById(id: string, storeId: string): Promise<NotificationDTO> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (notification.storeId !== storeId) {
      throw new ForbiddenException('Access denied: cross-store notification access');
    }

    return this.toDTO(notification);
  }

  /**
   * Map a Prisma Notification record to the shared NotificationDTO.
   */
  private toDTO(n: any): NotificationDTO {
    return {
      id: n.id,
      storeId: n.storeId,
      orderId: n.orderId || null,
      customerId: n.customerId || null,
      eventType: n.eventType as NotificationEventType,
      channel: n.channel as NotificationChannel,
      status: n.status as NotificationStatus,
      recipient: n.recipient,
      payload: (n.payload as Record<string, unknown>) || null,
      sentAt: n.sentAt ? n.sentAt.toISOString() : null,
      failedAt: n.failedAt ? n.failedAt.toISOString() : null,
      failureReason: n.failureReason || null,
      retryCount: n.retryCount,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
