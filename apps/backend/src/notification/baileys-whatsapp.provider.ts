import { Logger } from '@nestjs/common';
import {
  NotificationProvider,
  NotificationDispatchPayload,
  NotificationDispatchResult,
} from './notification.provider';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';

import { formatNotificationMessage } from './templates/notification-templates';

export class BaileysWhatsAppProvider implements NotificationProvider {
  readonly name = 'BaileysWhatsAppProvider';
  private readonly logger = new Logger(BaileysWhatsAppProvider.name);

  private sock: any = null;
  private isConnected = false;
  private readonly authFolder = './baileys_auth';
  private readonly sentCache = new Map<string, { timestamp: number; externalId?: string }>();

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
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.log(
          'connection closed due to ',
          lastDisconnect?.error,
          ', reconnecting ',
          shouldReconnect,
        );
        this.isConnected = false;

        if (shouldReconnect) {
          this.connectToWhatsApp();
        } else {
          this.logger.log('Logged out from WhatsApp. Delete baileys_auth folder to scan again.');
          if (fs.existsSync(this.authFolder)) {
            fs.rmSync(this.authFolder, { recursive: true, force: true });
          }
        }
      } else if (connection === 'open') {
        this.logger.log('Baileys opened connection successfully!');
        this.isConnected = true;
      }
    });
  }

  async dispatch(payload: NotificationDispatchPayload): Promise<NotificationDispatchResult> {
    if (!this.isConnected || !this.sock) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Baileys provider not connected to WhatsApp',
      };
    }

    if (payload.id) {
      const cached = this.sentCache.get(payload.id);
      const fifteenMinutes = 15 * 60 * 1000;
      if (cached && Date.now() - cached.timestamp < fifteenMinutes) {
        this.logger.warn(
          `[BaileysWhatsAppProvider] Duplicate dispatch suppressed for notification ${payload.id}. Already sent with externalId: ${cached.externalId}`,
        );
        return {
          success: true,
          providerName: this.name,
          externalId: cached.externalId,
        };
      }
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

    // Format phone number: strip non-numeric characters and ensure country code
    const formattedPhone = targetRecipient.replace(/\D/g, '');
    if (!formattedPhone) {
      return {
        success: false,
        providerName: this.name,
        failureReason: 'Invalid recipient phone number',
      };
    }

    const jid = `${formattedPhone}@s.whatsapp.net`;
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

      let msg: any;
      if (payload.document) {
        msg = await this.sock.sendMessage(jid, {
          document: payload.document.buffer,
          mimetype: payload.document.mimetype || 'application/pdf',
          fileName:
            payload.document.fileName || `Invoice_${payload.payload?.orderNumber || 'order'}.pdf`,
          caption: messageBody,
        });
      } else {
        msg = await this.sock.sendMessage(jid, { text: messageBody });
      }

      const externalId = msg?.key?.id;
      if (payload.id) {
        this.sentCache.set(payload.id, { timestamp: Date.now(), externalId });
        if (this.sentCache.size > 2000) {
          const cutoff = Date.now() - 15 * 60 * 1000;
          for (const [k, v] of this.sentCache.entries()) {
            if (v.timestamp < cutoff) this.sentCache.delete(k);
          }
        }
      }

      return {
        success: true,
        providerName: this.name,
        externalId,
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

  // generateMessageBody has been moved to notification-templates.ts
}
