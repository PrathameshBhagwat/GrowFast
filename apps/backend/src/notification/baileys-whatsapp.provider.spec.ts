import { Test, TestingModule } from '@nestjs/testing';
import { BaileysWhatsAppProvider } from './baileys-whatsapp.provider';
import { NotificationEventType } from '@growfast/shared-types';
import * as baileys from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';

// Mock the dependencies
jest.mock('@whiskeysockets/baileys', () => ({
  ...jest.requireActual('@whiskeysockets/baileys'),
  __esModule: true,
  default: jest.fn(),
  fetchLatestBaileysVersion: jest
    .fn()
    .mockResolvedValue({ version: [2, 3000, 1015944512], isLatest: true }),
  useMultiFileAuthState: jest.fn().mockResolvedValue({ state: {}, saveCreds: jest.fn() }),
}));

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  rmSync: jest.fn(),
}));

describe('BaileysWhatsAppProvider', () => {
  let provider: BaileysWhatsAppProvider;
  let mockSocket: any;
  let eventHandler: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock socket
    mockSocket = {
      ev: {
        on: jest.fn((event, handler) => {
          if (event === 'connection.update') {
            eventHandler = handler;
          }
        }),
      },
      onWhatsApp: jest.fn().mockResolvedValue([{ exists: true }]),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: 'mock-id-123' } }),
    };

    (baileys.default as jest.Mock).mockReturnValue(mockSocket);

    // Save original env
    const OLD_ENV = process.env;
    process.env = { ...OLD_ENV, WHATSAPP_DEV_PHONE: '' };

    provider = new BaileysWhatsAppProvider();
  });

  afterEach(() => {
    // Restore env
    jest.resetModules();
  });

  it('should initialize successfully and request QR code', async () => {
    // Wait for the constructor's async init to finish
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(baileys.fetchLatestBaileysVersion).toHaveBeenCalled();
    expect(baileys.useMultiFileAuthState).toHaveBeenCalledWith('./baileys_auth');
    expect(baileys.default).toHaveBeenCalled();

    // Simulate connection update with QR
    eventHandler({ qr: 'mock-qr-code' });
    expect(qrcode.generate).toHaveBeenCalledWith('mock-qr-code', { small: true });
  });

  it('should handle successful connection', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate connection open
    eventHandler({ connection: 'open' });
    expect((provider as any).isConnected).toBe(true);
  });

  it('should handle graceful disconnect and reconnect', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));

    jest.useFakeTimers();
    // Simulate disconnect not caused by logout
    eventHandler({
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: 500 } } },
    });

    expect((provider as any).isConnected).toBe(false);

    // Wait for setTimeout to reconnect
    jest.advanceTimersByTime(5000);
    jest.useRealTimers();

    // Allow microtasks to flush (promises inside connectToWhatsApp)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Expect connectToWhatsApp to be called again (baileys.default called twice)
    expect(baileys.default).toHaveBeenCalledTimes(2);
  });

  it('should handle explicit logout and delete auth folder', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));

    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Simulate logged out
    eventHandler({
      connection: 'close',
      lastDisconnect: { error: { output: { statusCode: baileys.DisconnectReason.loggedOut } } },
    });

    expect(fs.existsSync).toHaveBeenCalledWith('./baileys_auth');
    expect(fs.rmSync).toHaveBeenCalledWith('./baileys_auth', { recursive: true, force: true });
  });

  it('should not dispatch if not connected', async () => {
    const result = await provider.dispatch({
      id: '123',
      channel: 'WHATSAPP',
      eventType: NotificationEventType.ORDER_READY,
      recipient: '+919876543210',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('not connected');
  });

  it('should successfully dispatch a message when connected', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    eventHandler({ connection: 'open' }); // Connect

    const result = await provider.dispatch({
      id: '123',
      channel: 'WHATSAPP',
      eventType: NotificationEventType.ORDER_CREATED,
      recipient: '+919876543210',
      payload: {
        orderNumber: 'GF100',
        totalAmount: 500,
      },
    });

    expect(mockSocket.onWhatsApp).toHaveBeenCalledWith('919876543210@s.whatsapp.net');
    expect(mockSocket.sendMessage).toHaveBeenCalledWith('919876543210@s.whatsapp.net', {
      text: expect.stringContaining('GF100'),
    });
    expect(result.success).toBe(true);
    expect(result.externalId).toBe('mock-id-123');
  });

  it('should override recipient with WHATSAPP_DEV_PHONE if set', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    eventHandler({ connection: 'open' }); // Connect

    process.env.WHATSAPP_DEV_PHONE = '919999999999';

    await provider.dispatch({
      id: '123',
      channel: 'WHATSAPP',
      eventType: NotificationEventType.ORDER_CREATED,
      recipient: '+911111111111', // Real customer
      payload: { orderNumber: 'GF100', totalAmount: 500 },
    });

    expect(mockSocket.onWhatsApp).toHaveBeenCalledWith('919999999999@s.whatsapp.net');
  });

  it('should handle Baileys send failure safely', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    eventHandler({ connection: 'open' }); // Connect

    mockSocket.sendMessage.mockRejectedValue(new Error('Simulated network error'));

    const result = await provider.dispatch({
      id: '123',
      channel: 'WHATSAPP',
      eventType: NotificationEventType.ORDER_CREATED,
      recipient: '+919876543210',
      payload: { orderNumber: 'GF100', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('Simulated network error');
  });

  it('should reject invalid phone number', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    eventHandler({ connection: 'open' });

    const result = await provider.dispatch({
      id: '123',
      channel: 'WHATSAPP',
      eventType: NotificationEventType.ORDER_CREATED,
      recipient: 'abc', // No digits
      payload: { orderNumber: 'GF100', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('Invalid recipient');
  });
});
