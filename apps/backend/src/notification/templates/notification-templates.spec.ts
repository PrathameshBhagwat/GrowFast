import { formatNotificationMessage } from './notification-templates';
import { NotificationEventType } from '@growfast/shared-types';

describe('Notification Templates', () => {
  const defaultStore = 'FreshCare Laundry';

  it('should return null if payload is missing', () => {
    expect(formatNotificationMessage(NotificationEventType.ORDER_CREATED, null, defaultStore)).toBeNull();
  });

  describe('ORDER_CREATED', () => {
    it('should format message with all details', () => {
      const payload = {
        customerName: 'Rahul',
        orderNumber: 'GF-1001',
        totalAmount: 1500,
        amountPaid: 500,
        amountDue: 1000,
        items: [
          { garmentName: 'Shirt', quantity: 2 },
          { garmentName: 'Pant', quantity: 1 }
        ]
      };
      
      const msg = formatNotificationMessage(NotificationEventType.ORDER_CREATED, payload, defaultStore);
      
      expect(msg).toContain('*FreshCare Laundry*');
      expect(msg).toContain('Hello Rahul,');
      expect(msg).toContain('Your order *#GF-1001* has been successfully received.');
      expect(msg).toContain('*Order Summary*');
      expect(msg).toContain('• 2 × Shirt');
      expect(msg).toContain('• 1 × Pant');
      expect(msg).toContain('*Payment Summary*');
      expect(msg).toContain('Total: ₹1500');
      expect(msg).toContain('Paid: ₹500');
      expect(msg).toContain('Balance: ₹1000');
      expect(msg).toContain('Thank you for choosing *FreshCare Laundry*.');
    });

    it('should handle missing optional values safely', () => {
      const payload = { orderNumber: 'GF-1002' }; // missing total, paid, due, items, customerName
      const msg = formatNotificationMessage(NotificationEventType.ORDER_CREATED, payload, defaultStore);
      
      expect(msg).toContain('Hello,'); // Fallback greeting
      expect(msg).toContain('Your order *#GF-1002* has been successfully received.');
      expect(msg).not.toContain('*Order Summary*');
      expect(msg).toContain('Total: ₹0');
      expect(msg).toContain('Paid: ₹0');
      expect(msg).toContain('Balance: ₹0');
    });
  });

  describe('PAYMENT_RECEIVED', () => {
    it('should format full payment message', () => {
      const payload = {
        customerName: 'Neha',
        orderNumber: 'GF-2001',
        amountPaid: 1500,
        totalPaid: 1500,
        totalAmount: 1500,
        amountDue: 0,
        paymentMethod: 'UPI'
      };

      const msg = formatNotificationMessage(NotificationEventType.PAYMENT_RECEIVED, payload, defaultStore);
      
      expect(msg).toContain('We received your payment for order *#GF-2001*.');
      expect(msg).toContain('Amount Received: ₹1500');
      expect(msg).toContain('Payment Method: UPI');
      expect(msg).toContain('Total: ₹1500');
      expect(msg).toContain('Paid: ₹1500');
      expect(msg).toContain('Balance: ₹0');
    });

    it('should format partial payment message without method', () => {
      const payload = {
        orderNumber: 'GF-2002',
        amountPaid: 500,
        totalPaid: 500,
        totalAmount: 2000,
        amountDue: 1500
      };

      const msg = formatNotificationMessage(NotificationEventType.PAYMENT_RECEIVED, payload, defaultStore);
      
      expect(msg).toContain('Amount Received: ₹500');
      expect(msg).not.toContain('Payment Method:');
      expect(msg).toContain('Paid: ₹500');
      expect(msg).toContain('Balance: ₹1500');
    });
  });

  describe('ORDER_READY', () => {
    it('should format FULLY READY message', () => {
      const payload = {
        customerName: 'Aman',
        orderNumber: 'GF-3001',
        readyItems: [
          { garmentName: 'Suit', quantity: 1 }
        ],
        remainingItems: [],
        totalAmount: 800,
        amountPaid: 800,
        amountDue: 0
      };

      const msg = formatNotificationMessage(NotificationEventType.ORDER_READY, payload, defaultStore);
      
      expect(msg).toContain('Your order *#GF-3001* is *READY FOR PICKUP*.');
      expect(msg).toContain('*Ready Items*');
      expect(msg).toContain('• 1 × Suit');
      expect(msg).not.toContain('*Remaining Items*');
      expect(msg).toContain('Please visit the store to collect your order.');
      expect(msg).toContain('Balance: ₹0');
    });

    it('should format PARTIALLY READY message', () => {
      const payload = {
        customerName: 'Aman',
        orderNumber: 'GF-3002',
        readyItems: [
          { garmentName: 'Shirt', quantity: 2 }
        ],
        remainingItems: [
          { garmentName: 'Blazer', quantity: 1 }
        ],
        totalAmount: 1200,
        amountPaid: 400,
        amountDue: 800
      };

      const msg = formatNotificationMessage(NotificationEventType.ORDER_READY, payload, defaultStore);
      
      expect(msg).toContain('Some items from your order *#GF-3002* are ready for pickup.');
      expect(msg).toContain('*Ready Items*');
      expect(msg).toContain('• 2 × Shirt');
      expect(msg).toContain('*Remaining Items*');
      expect(msg).toContain('• 1 × Blazer');
      expect(msg).toContain('You may collect the ready items from the store.');
      expect(msg).toContain('We will notify you when the remaining items are ready.');
      expect(msg).toContain('Balance: ₹800');
    });
  });

  describe('ORDER_OUT_FOR_DELIVERY', () => {
    it('should format delivery message with rider and balance', () => {
      const payload = {
        orderNumber: 'GF-4001',
        riderName: 'Raju',
        totalAmount: 500,
        amountPaid: 0,
        amountDue: 500
      };

      const msg = formatNotificationMessage(NotificationEventType.ORDER_OUT_FOR_DELIVERY, payload, defaultStore);
      
      expect(msg).toContain('Your order *#GF-4001* is out for delivery!');
      expect(msg).toContain('Our rider Raju will reach you soon.');
      expect(msg).toContain('Balance: ₹500'); // Included because due > 0
    });

    it('should omit payment summary if balance is 0', () => {
      const payload = {
        orderNumber: 'GF-4002',
        totalAmount: 500,
        amountPaid: 500,
        amountDue: 0
      };

      const msg = formatNotificationMessage(NotificationEventType.ORDER_OUT_FOR_DELIVERY, payload, defaultStore);
      
      expect(msg).toContain('Our rider will reach you soon.');
      expect(msg).not.toContain('*Payment Summary*');
      expect(msg).not.toContain('Balance: ₹0');
    });
  });

  describe('ORDER_DELIVERED', () => {
    it('should format simple delivered message', () => {
      const payload = { orderNumber: 'GF-5001' };
      const msg = formatNotificationMessage(NotificationEventType.ORDER_DELIVERED, payload, defaultStore);
      expect(msg).toContain('Your order *#GF-5001* has been successfully delivered.');
    });
  });
});
