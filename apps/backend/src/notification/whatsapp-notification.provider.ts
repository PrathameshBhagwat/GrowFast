import { Logger } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationDispatchPayload,
  NotificationDispatchResult,
} from './notification.provider';
import { NotificationEventType } from '@growfast/shared-types';

export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly name = 'WhatsAppNotificationProvider';
  private readonly logger = new Logger(WhatsAppNotificationProvider.name);

  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly requestTimeoutMs: number;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.requestTimeoutMs = process.env.WHATSAPP_REQUEST_TIMEOUT_MS
      ? parseInt(process.env.WHATSAPP_REQUEST_TIMEOUT_MS, 10)
      : 30000;
  }

  async dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    if (!this.accessToken || !this.phoneNumberId) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'WhatsApp configuration missing',
      };
    }

    if (!payload.recipient) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Recipient phone number is missing',
      };
    }

    // Format phone number: strip non-numeric characters (WhatsApp requires international format without +)
    const formattedPhone = payload.recipient.replace(/\D/g, '');
    if (!formattedPhone) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Invalid recipient phone number',
      };
    }

    const messageBody = this.generateMessageBody(payload.eventType, payload.payload);
    if (!messageBody) {
      return {
        success: false,
        providerName: this.name,
        failureReason: `Unsupported event type or invalid payload for ${payload.eventType}`,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: {
              body: messageBody,
            },
          }),
          signal: controller.signal,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        // Sanitize: Meta error messages should not contain our token
        const reason = data.error?.message || `WhatsApp API error: ${response.status}`;
        return {
          success: false,
          providerName: this.name,
          failureReason: this.sanitizeErrorMessage(reason),
        };
      }

      return {
        success: true,
        providerName: this.name,
        externalId: data.messages?.[0]?.id,
      };
    } catch (error: any) {
      const reason =
        error.name === 'AbortError'
          ? `WhatsApp API request timed out after ${this.requestTimeoutMs}ms`
          : error.message || 'Network failure communicating with WhatsApp API';
      return {
        success: false,
        providerName: this.name,
        failureReason: this.sanitizeErrorMessage(reason),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private generateMessageBody(
    eventType: string,
    payload: Record<string, any> | null,
  ): string | null {
    if (!payload) return null;

    switch (eventType as NotificationEventType) {
      case NotificationEventType.ORDER_CREATED:
        return `Hello! Your GrowFast order ${payload.orderNumber} has been received.\nTotal Amount: ₹${payload.totalAmount}\nWe'll notify you once it's ready.`;

      case NotificationEventType.ORDER_READY: {
        let msg = `Good news! Your GrowFast order ${payload.orderNumber} is ready for collection.`;
        if (
          payload.readyItems &&
          Array.isArray(payload.readyItems) &&
          payload.readyItems.length > 0
        ) {
          msg += `\n\nReady items:`;
          payload.readyItems.forEach((item: any) => {
            msg += `\n• ${item.garmentName} ×${item.quantity}`;
          });
        }
        if (
          payload.remainingItems &&
          Array.isArray(payload.remainingItems) &&
          payload.remainingItems.length > 0
        ) {
          msg += `\n\nStill processing:`;
          payload.remainingItems.forEach((item: any) => {
            msg += `\n• ${item.garmentName} ×${item.quantity}`;
          });
        }
        msg += `\n\nAmount Paid: ₹${payload.amountPaid}\nBalance Due: ₹${payload.amountDue}\nSee you soon!`;
        return msg;
      }

      case NotificationEventType.PAYMENT_RECEIVED:
        return `We have received your payment of ₹${payload.amountPaid}.\nThank you for choosing GrowFast!`;

      case NotificationEventType.ORDER_OUT_FOR_DELIVERY:
        return `Your GrowFast order is out for delivery! Our rider will reach you soon.`;

      case NotificationEventType.ORDER_DELIVERED:
        return `Your GrowFast order has been delivered. Thank you!`;

      default:
        return null;
    }
  }

  /**
   * Ensure error messages never contain the access token.
   */
  private sanitizeErrorMessage(message: string): string {
    if (this.accessToken && message.includes(this.accessToken)) {
      return message.replaceAll(this.accessToken, '[REDACTED]');
    }
    return message;
  }
}
