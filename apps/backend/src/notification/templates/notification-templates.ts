import { NotificationEventType } from '@growfast/shared-types';

export function formatNotificationMessage(
  eventType: NotificationEventType | string,
  payload: Record<string, any> | null,
  storeName: string = 'GrowFast Laundry',
): string | null {
  if (!payload) return null;

  // Ensure store name is correctly formatted
  const storeHeader = `*${storeName}*`;
  const divider = `────────────────────`;
  const greeting = payload.customerName ? `Hello ${payload.customerName},` : `Hello,`;
  const footer = `Thank you for choosing *${storeName}*.`;

  const buildBase = (body: string, relevantInfo: string = '') => {
    let msg = `${storeHeader}\n${divider}\n\n${greeting}\n\n${body}`;
    if (relevantInfo) {
      msg += `\n\n${relevantInfo}`;
    }
    msg += `\n\n${footer}`;
    return msg;
  };

  const formatSummary = (total: any, paid: any, due: any) => {
    return `*Payment Summary*\nTotal: ₹${total ?? 0}\nPaid: ₹${paid ?? 0}\nBalance: ₹${due ?? 0}`;
  };

  const formatItems = (items: any[]) => {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((i) => `• ${i.quantity ?? 1} × ${i.garmentName || 'Item'}`).join('\n');
  };

  switch (eventType as NotificationEventType) {
    case NotificationEventType.ORDER_CREATED: {
      const body = `Your order *#${payload.orderNumber || 'UNKNOWN'}* has been successfully received.`;
      
      let itemsList = '';
      if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
        itemsList = `*Order Summary*\n${formatItems(payload.items)}\n\n`;
      }
      
      const paymentSummary = formatSummary(payload.totalAmount, payload.amountPaid, payload.amountDue);
      const relevantInfo = `${itemsList}${paymentSummary}\n\nWe will notify you when your items are ready.`;
      
      return buildBase(body, relevantInfo);
    }

    case NotificationEventType.PAYMENT_RECEIVED: {
      const body = `We received your payment for order *#${payload.orderNumber || 'UNKNOWN'}*.`;
      
      const paymentDetails = `*Payment*\nAmount Received: ₹${payload.amountPaid ?? 0}${payload.paymentMethod ? `\nPayment Method: ${payload.paymentMethod}` : ''}`;
      const paymentSummary = formatSummary(payload.totalAmount, payload.totalPaid ?? payload.amountPaid, payload.amountDue);
      const relevantInfo = `${paymentDetails}\n\n${paymentSummary}`;

      return buildBase(body, relevantInfo);
    }

    case NotificationEventType.ORDER_READY: {
      const readyItems = payload.readyItems || [];
      const remainingItems = payload.remainingItems || [];
      
      const paymentSummary = formatSummary(payload.totalAmount, payload.amountPaid, payload.amountDue);
      
      if (remainingItems.length > 0) {
        // Partially ready
        const body = `Some items from your order *#${payload.orderNumber || 'UNKNOWN'}* are ready for pickup.`;
        
        let relevantInfo = '';
        if (readyItems.length > 0) {
          relevantInfo += `*Ready Items*\n${formatItems(readyItems)}\n\n`;
        }
        relevantInfo += `*Remaining Items*\n${formatItems(remainingItems)}\n\n`;
        relevantInfo += `${paymentSummary}\n\nYou may collect the ready items from the store.\nWe will notify you when the remaining items are ready.`;
        
        return buildBase(body, relevantInfo);
      } else {
        // Fully ready
        const body = `Your order *#${payload.orderNumber || 'UNKNOWN'}* is *READY FOR PICKUP*.`;
        
        let relevantInfo = '';
        if (readyItems.length > 0) {
          relevantInfo += `*Ready Items*\n${formatItems(readyItems)}\n\n`;
        }
        relevantInfo += `${paymentSummary}\n\nPlease visit the store to collect your order.`;
        
        return buildBase(body, relevantInfo);
      }
    }

    case NotificationEventType.ORDER_OUT_FOR_DELIVERY: {
      const body = `Your order *#${payload.orderNumber || 'UNKNOWN'}* is out for delivery!`;
      let info = `Our rider${payload.riderName ? ` ${payload.riderName}` : ''} will reach you soon.`;
      if (payload.amountDue > 0) {
        info += `\n\n${formatSummary(payload.totalAmount, payload.amountPaid, payload.amountDue)}`;
      }
      return buildBase(body, info);
    }

    case NotificationEventType.ORDER_DELIVERED: {
      const body = `Your order *#${payload.orderNumber || 'UNKNOWN'}* has been successfully delivered.`;
      return buildBase(body);
    }

    default:
      return null;
  }
}
