import { Logger } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationDispatchPayload,
  NotificationDispatchResult,
} from './notification.provider';
import { NotificationEventType } from '@growfast/shared-types';
import { formatNotificationMessage } from './templates/notification-templates';

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

    const messageBody = formatNotificationMessage(
      payload.eventType,
      payload.payload,
      payload.storeName,
    );
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

  // generateMessageBody has been moved to notification-templates.ts

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
