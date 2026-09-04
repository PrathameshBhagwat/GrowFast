import { Logger } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationDispatchPayload,
  NotificationDispatchResult,
} from './notification.provider';
import { NotificationEventType } from '@growfast/shared-types';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';

export class BaileysWhatsAppProvider implements NotificationProvider {
  readonly name = 'BaileysWhatsAppProvider';
  private readonly logger = new Logger(BaileysWhatsAppProvider.name);

  private sock: any = null;
  private isConnected = false;
  private readonly authFolder = './baileys_auth';

  constructor() {
    this.logger.log('Initializing Baileys WhatsApp Provider (DEVELOPMENT MODE)');
    this.connectToWhatsApp().catch((err) => {
      this.logger.error('Failed to initialize Baileys connection', err);
    });
  }

  private async connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    this.logger.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const pinoLogger = pino({ level: 'silent' }); // Suppress baileys logs

    this.sock = makeWASocket({
      version,
      logger: pinoLogger as any,
      printQRInTerminal: false, // We will print it manually
      auth: state,
      generateHighQualityLinkPreview: true,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.log('\n--- SCAN THIS QR CODE WITH WHATSAPP TO AUTHENTICATE ---');
        qrcode.generate(qr, { small: true });
        this.logger.log('-------------------------------------------------------');
      }

      if (connection === 'close') {
        this.isConnected = false;
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        this.logger.warn(
          `Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`,
        );

        if (shouldReconnect) {
          setTimeout(() => this.connectToWhatsApp(), 5000);
        } else {
          this.logger.error(
            'Logged out from WhatsApp. Please delete baileys_auth folder and restart to scan new QR.',
          );
          if (fs.existsSync(this.authFolder)) {
            fs.rmSync(this.authFolder, { recursive: true, force: true });
          }
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.logger.log('WhatsApp connection successfully opened!');
      }
    });
  }

  async dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    if (!this.isConnected || !this.sock) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Baileys WhatsApp socket is not connected',
      };
    }

    if (!payload.recipient) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Recipient phone number is missing',
      };
    }

    // Determine target recipient (override with WHATSAPP_DEV_PHONE if set)
    const targetRecipient = process.env.WHATSAPP_DEV_PHONE || payload.recipient;

    // Format phone number
    const formattedPhone = targetRecipient.replace(/\D/g, '');
    if (!formattedPhone) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Invalid recipient phone number',
      };
    }

    const jid = `${formattedPhone}@s.whatsapp.net`;
    const messageBody = this.generateMessageBody(payload.eventType, payload.payload);

    if (!messageBody) {
      return {
        success: false,
        providerName: this.name,
        failureReason: `Unsupported event type or invalid payload for ${payload.eventType}`,
      };
    }

    try {
      // Check if the number is on WhatsApp
      const [result] = await this.sock.onWhatsApp(jid);
      if (!result?.exists) {
        return {
          success: false,
          providerName: this.name,
          failureReason: 'Phone number is not registered on WhatsApp',
        };
      }

      const msg = await this.sock.sendMessage(jid, { text: messageBody });

      return {
        success: true,
        providerName: this.name,
        externalId: msg?.key?.id,
      };
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp message to ${jid}`, error.stack);
      return {
        success: false,
        providerName: this.name,
        failureReason: error.message || 'Unknown Baileys send error',
      };
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
}
