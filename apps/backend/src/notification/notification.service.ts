import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
  type NotificationDTO,
} from '@growfast/shared-types';
import {
  NotificationProvider,
  LogNotificationProvider,
  NotificationDocument,
} from './notification.provider';
import { WhatsAppNotificationProvider } from './whatsapp-notification.provider';
import { BaileysWhatsAppProvider } from './baileys-whatsapp.provider';
import { BillPdfService } from './bill-pdf.service';

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

  // In-memory locks to eliminate duplicate event creation and concurrent dispatches
  private readonly activeEventCreationLocks = new Map<string, Promise<NotificationDTO | null>>();
  private readonly activeDispatchLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private billPdfService?: BillPdfService,
  ) {
    if (!this.billPdfService) {
      this.billPdfService = new BillPdfService(this.prisma);
    }
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

  /**
   * Mask recipient phone number for PII protection in structured logs.
   */
  private maskPhone(phone?: string | null): string {
    if (!phone) return 'N/A';
    const clean = phone.replace(/\D/g, '');
    if (clean.length <= 4) return '***';
    return `${clean.slice(0, 2)}****${clean.slice(-4)}`;
  }

  private getProvider(channel: NotificationChannel): NotificationProvider {
    if (channel === NotificationChannel.WHATSAPP || channel === NotificationChannel.SMS) {
      return this.whatsappProvider;
    }
    return this.logProvider;
  }

  /**
   * Create and record a notification event with end-to-end idempotency protection.
   *
   * This method is designed to be SAFE to call from business transactions:
   * - It catches all errors internally
   * - It never throws to the caller
   * - It returns null on failure instead of crashing the calling transaction
   * - It deduplicates duplicate requests for the same (storeId, orderId, eventType, recipient)
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
    const lockKey = `${storeId}:${orderId || 'no-order'}:${eventType}:${channel}:${recipient}`;
    const inFlight = this.activeEventCreationLocks.get(lockKey);
    if (inFlight) {
      this.logger.debug(
        `[NotificationService] In-flight event creation detected for ${lockKey}. Awaiting existing promise.`,
      );
      return await inFlight;
    }

    const creationPromise = this.executeCreateNotificationEvent(
      storeId,
      eventType,
      channel,
      recipient,
      orderId,
      customerId,
      payload,
    );

    this.activeEventCreationLocks.set(lockKey, creationPromise);
    try {
      return await creationPromise;
    } finally {
      this.activeEventCreationLocks.delete(lockKey);
    }
  }

  private async executeCreateNotificationEvent(
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

        // 1.5 Idempotency check:
        // A single order must have at most one active or successfully sent notification
        // for a given eventType and recipient (e.g. ORDER_CREATED sent only once).
        if (this.prisma.notification?.findFirst) {
          const existing = await this.prisma.notification.findFirst({
            where: {
              storeId,
              orderId,
              eventType,
              channel,
              recipient,
              status: {
                in: [
                  NotificationStatus.CREATED,
                  NotificationStatus.QUEUED,
                  NotificationStatus.SENT,
                ],
              },
            },
          });

          if (existing) {
            this.logger.log(
              `[NotificationService] Idempotent deduplication: notification already exists (${existing.status}) for order ${orderId}, event ${eventType}, id: ${existing.id}`,
            );
            return this.toDTO(existing);
          }
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
          status: NotificationStatus.CREATED,
          recipient,
          payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
          retryCount: 0,
        },
      });

      this.logger.log(
        `[NotificationService] Created notification event: id=${notification.id}, order=${orderId || 'none'}, event=${eventType}, recipient=${this.maskPhone(recipient)}`,
      );

      // 3. Asynchronously trigger dispatch without blocking the caller (deferred in test environment)
      if (process.env.NODE_ENV !== 'test') {
        if (typeof setImmediate !== 'undefined') {
          setImmediate(() => {
            this.processNotification(notification.id).catch((err) => {
              this.logger.error(`Async dispatch error for ${notification.id}: ${err.message}`);
            });
          });
        } else {
          Promise.resolve().then(() => {
            this.processNotification(notification.id).catch((err) => {
              this.logger.error(`Async dispatch error for ${notification.id}: ${err.message}`);
            });
          });
        }
      }

      // Return the created state
      return this.toDTO(notification);
    } catch (err: any) {
      // CRITICAL: Never throw from this method — calling transactions must not break
      this.logger.error(`Failed to create notification event: ${err.message}`);
      return null;
    }
  }

  /**
   * Process a single notification (called by the background worker or immediate dispatch).
   */
  async processNotification(notificationId: string): Promise<boolean> {
    if (this.activeDispatchLocks.has(notificationId)) {
      this.logger.debug(
        `[NotificationService] Notification ${notificationId} is already in-flight. Skipping duplicate concurrent execution.`,
      );
      return false;
    }
    this.activeDispatchLocks.add(notificationId);

    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) return false;

      // Idempotency: If already successfully sent, do not duplicate
      if (notification.status === NotificationStatus.SENT) {
        return true;
      }

      // Concurrency claim: Transition CREATED to QUEUED atomically
      if (
        notification.status === NotificationStatus.CREATED &&
        this.prisma.notification?.updateMany
      ) {
        const claimResult = await this.prisma.notification.updateMany({
          where: { id: notificationId, status: NotificationStatus.CREATED },
          data: { status: NotificationStatus.QUEUED },
        });

        if (claimResult.count === 0) {
          const fresh = await this.prisma.notification.findUnique({
            where: { id: notificationId },
          });
          if (fresh?.status === NotificationStatus.SENT) return true;
          return false;
        }
      }

      const store = this.prisma.store
        ? await this.prisma.store.findUnique({
            where: { id: notification.storeId },
            select: { name: true, address: true, phone: true },
          })
        : null;

      let payload = (notification.payload as Record<string, unknown>) || {};

      // Enrich payload from Order record when orderId is present
      if (notification.orderId) {
        try {
          const order = await this.prisma.order.findUnique({
            where: { id: notification.orderId },
            include: { customer: true, items: true },
          });
          if (order) {
            const totalPieces = (order.items || []).reduce(
              (sum: number, it: any) => sum + (it.quantity || 1),
              0,
            );
            const totalWeight = (order.items || []).reduce(
              (sum: number, it: any) => sum + (it.weight ? Number(it.weight) : 0),
              0,
            );
            payload = {
              orderNumber: order.orderNumber,
              customerName: order.customer?.name || 'Customer',
              orderDate: order.orderDate,
              deliveryDate: order.effectiveDueDate || order.systemDueDate,
              orderTotal: order.totalAmount,
              quantity: totalPieces,
              weight: totalWeight,
              amountPaid: order.amountPaid,
              balanceDue: order.amountDue,
              paymentStatus: order.paymentStatus,
              ...payload,
            };
          }
        } catch {
          // Non-fatal, keep existing payload
        }
      }

      let document: NotificationDocument | undefined;

      // Event 1: If ORDER_CREATED, generate or retrieve the Bill PDF
      if (
        notification.eventType === NotificationEventType.ORDER_CREATED &&
        notification.orderId &&
        this.billPdfService
      ) {
        try {
          const pdfBuffer = await this.billPdfService.generateBillPdf(
            notification.orderId,
            notification.storeId,
          );
          if (pdfBuffer && pdfBuffer.length > 0) {
            const orderNumber = (payload.orderNumber as string) || notification.orderId;
            document = {
              buffer: pdfBuffer,
              fileName: `Invoice_${orderNumber}.pdf`,
              mimetype: 'application/pdf',
            };
          }
        } catch (pdfErr: any) {
          this.logger.error(
            `Failed to generate bill PDF for notification ${notification.id}: ${pdfErr.message}`,
          );
          // PDF generation failure is logged safely; notification dispatch still continues
        }
      }

      this.logger.log(
        `[NotificationService] Dispatching notification: id=${notification.id}, order=${notification.orderId || 'none'}, event=${notification.eventType}, recipient=${this.maskPhone(notification.recipient)}, attempt=${notification.retryCount + 1}`,
      );

      const provider = this.getProvider(notification.channel as NotificationChannel);
      const result = await provider.dispatch({
        id: notification.id,
        channel: notification.channel,
        recipient: notification.recipient,
        eventType: notification.eventType,
        payload,
        storeName: store?.name || 'GrowFast',
        document,
      });

      if (result.success) {
        const enrichedPayload = {
          ...payload,
          ...(result.externalId ? { externalId: result.externalId } : {}),
          providerName: result.providerName,
          dispatchedAt: new Date().toISOString(),
        };

        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            payload: enrichedPayload,
          },
        });

        this.logger.log(
          `[NotificationService] Notification dispatched successfully: id=${notification.id}, externalId=${result.externalId || 'N/A'}, recipient=${this.maskPhone(notification.recipient)}`,
        );
        return true;
      } else {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            failureReason: result.failureReason || 'Provider returned failure',
            retryCount: { increment: 1 },
          },
        });

        this.logger.warn(
          `[NotificationService] Notification dispatch failed: id=${notification.id}, reason=${result.failureReason}`,
        );
        return false;
      }
    } catch (dispatchErr: any) {
      this.logger.error(
        `Notification dispatch failed for ${notificationId}: ${dispatchErr.message}`,
      );
      try {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.FAILED,
            failedAt: new Date(),
            failureReason: dispatchErr.message || 'Dispatch exception',
            retryCount: { increment: 1 },
          },
        });
      } catch {
        // Ignore secondary update error
      }
      return false;
    } finally {
      this.activeDispatchLocks.delete(notificationId);
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
    const where: any = storeId && storeId !== 'all' ? { storeId } : {};

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

    if (storeId && storeId !== 'all' && notification.storeId !== storeId) {
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
