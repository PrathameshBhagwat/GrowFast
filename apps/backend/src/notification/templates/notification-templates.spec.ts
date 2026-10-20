import {
  formatNotificationMessage,
  formatWhatsAppDate,
  formatCurrencyVal,
} from './notification-templates';
import { NotificationEventType } from '@growfast/shared-types';

describe('Notification Templates', () => {
  const defaultStore = 'GrowFast';

  it('should return null if payload is missing', () => {
    expect(
      formatNotificationMessage(NotificationEventType.ORDER_CREATED, null, defaultStore),
    ).toBeNull();
  });

  describe('formatWhatsAppDate', () => {
    it('should format dates as DD-MMM-YYYY', () => {
      const date = new Date('2026-10-07T12:00:00Z');
      expect(formatWhatsAppDate(date)).toBe('07-Oct-2026');
    });

    it('should handle null or invalid dates gracefully', () => {
      expect(formatWhatsAppDate(null)).toBe('—');
      expect(formatWhatsAppDate(undefined)).toBe('—');
    });
  });

  describe('formatCurrencyVal', () => {
    it('should format whole numbers without decimals', () => {
      expect(formatCurrencyVal(230)).toBe('230');
    });

    it('should format fractional numbers with two decimals', () => {
      expect(formatCurrencyVal(230.5)).toBe('230.50');
    });

    it('should handle zero and nulls', () => {
      expect(formatCurrencyVal(0)).toBe('0');
      expect(formatCurrencyVal(null)).toBe('0');
    });
  });

  describe('ORDER_CREATED', () => {
    it('should format order created message with full payment', () => {
      const payload = {
        orderNumber: 'T12843',
        orderDate: '2026-10-07T10:00:00Z',
        deliveryDate: '2026-10-11T18:00:00Z',
        orderTotal: 230,
        quantity: 2,
        weight: 2,
        amountPaid: 230,
        balanceDue: 0,
        paymentStatus: 'PAID',
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_CREATED,
        payload,
        defaultStore,
      );

      expect(msg).toContain('Hi, Your GrowFast order *#T12843* is registered.');
      expect(msg).toContain('*Order Details:*');
      expect(msg).toContain('Order Date: 07-Oct-2026');
      expect(msg).toContain('Amount: ₹230');
      expect(msg).toContain('Quantity: 2 Pcs');
      expect(msg).toContain('Weight: 2 Kgs');
      expect(msg).toContain('Delivery Date: 11-Oct-2026');
      expect(msg).toContain('Payment Received: ₹230\nPayment Status: Paid');
      expect(msg).toContain(
        'We will inform you in case the order is updated after in-store inspection.',
      );
      expect(msg).toContain('Thank you for choosing GrowFast!');
    });

    it('should format order created message with partial payment', () => {
      const payload = {
        orderNumber: 'T12844',
        orderDate: '2026-10-07T10:00:00Z',
        deliveryDate: '2026-10-11T18:00:00Z',
        orderTotal: 500,
        quantity: 3,
        weight: 0,
        amountPaid: 200,
        balanceDue: 300,
        paymentStatus: 'PARTIAL',
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_CREATED,
        payload,
        defaultStore,
      );

      expect(msg).toContain('Hi, Your GrowFast order *#T12844* is registered.');
      expect(msg).toContain(
        'Payment Received: ₹200\nBalance Due: ₹300\nPayment Status: Partially Paid',
      );
      expect(msg).toContain('Thank you for choosing GrowFast!');
    });

    it('should format order created message with pending payment (no payment)', () => {
      const payload = {
        orderNumber: 'T12845',
        orderDate: '2026-10-07T10:00:00Z',
        deliveryDate: '2026-10-11T18:00:00Z',
        orderTotal: 400,
        quantity: 1,
        weight: 1.5,
        amountPaid: 0,
        balanceDue: 400,
        paymentStatus: 'PENDING',
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_CREATED,
        payload,
        defaultStore,
      );

      expect(msg).toContain('Hi, Your GrowFast order *#T12845* is registered.');
      expect(msg).toContain('Payment Received: ₹0\nBalance Due: ₹400\nPayment Status: Pending');
      expect(msg).toContain('Thank you for choosing GrowFast!');
    });

    it('should handle custom store name', () => {
      const payload = {
        orderNumber: 'ORD-999',
        orderTotal: 100,
        quantity: 1,
        weight: 0,
        amountPaid: 100,
        balanceDue: 0,
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_CREATED,
        payload,
        'Tumbledry',
      );

      expect(msg).toContain('Hi, Your Tumbledry order *#ORD-999* is registered.');
      expect(msg).toContain('Thank you for choosing Tumbledry!');
    });
  });

  describe('ORDER_READY', () => {
    it('should format order ready message with balance due', () => {
      const payload = {
        customerName: 'Prathamesh Bhagwat',
        orderNumber: 'T12843',
        orderDate: '2026-10-07T10:00:00Z',
        orderTotal: 500,
        balanceDue: 200,
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_READY,
        payload,
        defaultStore,
      );

      expect(msg).toBe(
        'Hi Prathamesh Bhagwat, your GrowFast order *#T12843* is ready for pickup.\n\n' +
          'Order Date: 07-Oct-2026\n' +
          'Amount: ₹500\n' +
          'Balance Due: ₹200\n\n' +
          'Thank you for choosing GrowFast!',
      );
    });

    it('should format order ready message with zero balance when fully paid', () => {
      const payload = {
        customerName: 'Rahul Patil',
        orderNumber: 'T12844',
        orderDate: '2026-10-07T10:00:00Z',
        orderTotal: 230,
        balanceDue: 0,
      };

      const msg = formatNotificationMessage(
        NotificationEventType.ORDER_READY,
        payload,
        defaultStore,
      );

      expect(msg).toBe(
        'Hi Rahul Patil, your GrowFast order *#T12844* is ready for pickup.\n\n' +
          'Order Date: 07-Oct-2026\n' +
          'Amount: ₹230\n' +
          'Balance Due: ₹0\n\n' +
          'Thank you for choosing GrowFast!',
      );
    });
  });

  describe('PAYMENT_RECEIVED', () => {
    it('should format full payment completed message', () => {
      const payload = {
        customerName: 'Prathamesh Bhagwat',
        orderNumber: 'T12843',
        orderTotal: 230,
        totalPaid: 230,
      };

      const msg = formatNotificationMessage(
        NotificationEventType.PAYMENT_RECEIVED,
        payload,
        defaultStore,
      );

      expect(msg).toBe(
        'Hi Prathamesh Bhagwat, we have received the full payment for your GrowFast order *#T12843*.\n\n' +
          'Total Amount: ₹230\n' +
          'Payment Received: ₹230\n' +
          'Balance Due: ₹0\n\n' +
          'Thank you for choosing GrowFast!',
      );
    });
  });
});
