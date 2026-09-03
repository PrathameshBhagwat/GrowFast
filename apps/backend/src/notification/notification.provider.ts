/**
 * Notification Provider Interface & Default Implementation
 *
 * This defines the contract that future SMS/WhatsApp/Email providers must implement.
 * The default LogNotificationProvider safely logs notification events without
 * falsely claiming delivery.
 */

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
    if (payload.eventType === 'ORDER_READY' && payload.payload) {
      const p = payload.payload as any;
      console.log(`\n================= CUSTOMER SMS =================`);
      console.log(`Your GrowFast order ${p.orderNumber} has items ready for collection.`);

      if (p.readyItems && p.readyItems.length > 0) {
        console.log(`\nReady:`);
        p.readyItems.forEach((i: any) => console.log(`• ${i.garmentName} ×${i.quantity}`));
      }
      if (p.remainingItems && p.remainingItems.length > 0) {
        console.log(`\nStill processing:`);
        p.remainingItems.forEach((i: any) => console.log(`• ${i.garmentName} ×${i.quantity}`));
      }

      console.log(`\nOrder total: ₹${p.totalAmount}`);
      console.log(`Paid: ₹${p.amountPaid}`);
      console.log(`Balance due: ₹${p.amountDue}`);
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
