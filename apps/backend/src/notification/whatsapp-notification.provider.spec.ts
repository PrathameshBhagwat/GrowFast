import { WhatsAppNotificationProvider } from './whatsapp-notification.provider';
import { NotificationEventType } from '@growfast/shared-types';

describe('WhatsAppNotificationProvider', () => {
  let provider: WhatsAppNotificationProvider;

  beforeEach(() => {
    // Reset env vars before each test
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    process.env.WHATSAPP_API_VERSION = 'v21.0';

    provider = new WhatsAppNotificationProvider();

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Successful WhatsApp API request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    });

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(true);
    expect(result.externalId).toBe('wamid.123');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('https://graph.facebook.com/v21.0/test-phone-id/messages');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers['Authorization']).toBe('Bearer test-token');

    const body = JSON.parse(callArgs[1].body);
    expect(body.to).toBe('919876543210'); // Formatted correctly (no +)
    expect(body.text.body).toContain('ORD-123');
    expect(body.text.body).toContain('500');
  });

  it('2. Meta API non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid parameter' } }),
    });

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('Invalid parameter');
  });

  it('3. Network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('Network error');
  });

  it('4. Missing access token', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    const noTokenProvider = new WhatsAppNotificationProvider();

    const result = await noTokenProvider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('WhatsApp configuration missing');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('5. Missing phone number ID', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const noPhoneIdProvider = new WhatsAppNotificationProvider();

    const result = await noPhoneIdProvider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('WhatsApp configuration missing');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('6. Missing recipient', async () => {
    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('Recipient phone number is missing');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('7. Invalid recipient', async () => {
    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: 'abcd', // Will strip to empty string
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('Invalid recipient phone number');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('8. Correct API endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: '1' }] }),
    });

    await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toBe('https://graph.facebook.com/v21.0/test-phone-id/messages');
  });

  it('9. Correct authorization header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: '1' }] }),
    });

    await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    expect(callArgs[1].headers['Authorization']).toBe('Bearer test-token');
  });

  it('10. Correct WhatsApp message payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: '1' }] }),
    });

    await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_READY,
      payload: { orderNumber: 'ORD-123', amountPaid: 100, amountDue: 50 },
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('919876543210');
    expect(body.type).toBe('text');
    expect(body.text.body).toContain('ORD-123');
    expect(body.text.body).toContain('100');
    expect(body.text.body).toContain('50');
  });

  it('11. Access token is never logged', async () => {
    // Ensuring the provider does not have a console.log or logger outputting the token
    const loggerSpy = jest.spyOn((provider as any).logger, 'error');
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(loggerSpy).not.toHaveBeenCalledWith(expect.stringContaining('test-token'));
  });

  it('12. Request timeout produces a controlled failure', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toContain('timed out');
  });

  it('13. Meta 5xx server error produces a controlled failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal server error' } }),
    });

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe('Internal server error');
  });

  it('14. Token is sanitized from error messages', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid token: test-token is expired' } }),
    });

    const result = await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_CREATED,
      payload: { orderNumber: 'ORD-123', totalAmount: 500 },
    });

    expect(result.success).toBe(false);
    expect(result.failureReason).not.toContain('test-token');
    expect(result.failureReason).toContain('[REDACTED]');
  });

  it('15. ORDER_READY message includes ready and remaining item details', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: '1' }] }),
    });

    await provider.dispatch({
      id: 'notif-123',
      channel: 'WHATSAPP',
      recipient: '+919876543210',
      eventType: NotificationEventType.ORDER_READY,
      payload: {
        orderNumber: 'ORD-456',
        amountPaid: 200,
        amountDue: 300,
        readyItems: [{ garmentName: 'Shirt', quantity: 2 }],
        remainingItems: [{ garmentName: 'Jeans', quantity: 1 }],
      },
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.text.body).toContain('ORD-456');
    expect(body.text.body).toContain('Shirt');
    expect(body.text.body).toContain('Jeans');
    expect(body.text.body).toContain('200');
    expect(body.text.body).toContain('300');
  });
});
