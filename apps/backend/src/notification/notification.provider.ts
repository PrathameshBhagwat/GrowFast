/**
 * Notification Provider Interface & Default Implementation
 *
 * This defines the contract that future SMS/WhatsApp/Email providers must implement.
 * The default LogNotificationProvider safely logs notification events without
 * falsely claiming delivery.
 */

import { formatNotificationMessage } from './templates/notification-templates';

/**
 * Result of a notification dispatch attempt.
 */
export interface NotificationDispatchResult {
  success: boolean;
  providerName: string;
  externalId?: string;
  failureReason?: string;
}

/**
 * Payload passed to a notification provider for dispatch.
 */
export interface NotificationDispatchPayload {
  id: string;
  channel: string;
  recipient: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  storeName?: string;
}

/**
 * Provider abstraction for notification dispatch.
 *
 * Future providers (e.g. Twilio SMS, WhatsApp Business API) implement this interface.
 */
export interface NotificationProvider {
  readonly name: string;
  dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult>;
}

/**
 * Default log-only provider for development / when no real provider is configured.
 *
 * IMPORTANT: This provider sets success=false intentionally.
 * It records the event as CREATED, never falsely claims SENT.
 * This ensures production code won't mistakenly believe messages were delivered.
 */
export class LogNotificationProvider implements NotificationProvider {
  readonly name = 'LogNotificationProvider';

  async dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    const formattedMessage = formatNotificationMessage(payload.eventType, payload.payload, payload.storeName);

    if (formattedMessage) {
      console.log(`\n================= CUSTOMER SMS =================`);
      console.log(formattedMessage);
      console.log(`================================================\n`);
    } else {
      console.log(
        `[${this.name}] Notification event recorded (not dispatched):`,
        JSON.stringify({
          id: payload.id,
          channel: payload.channel,
          eventType: payload.eventType,
          recipient: payload.recipient,
        }),
      );
    }

    return {
      success: false,
      providerName: this.name,
      failureReason: 'No real provider configured — event recorded only',
    };
  }
}
