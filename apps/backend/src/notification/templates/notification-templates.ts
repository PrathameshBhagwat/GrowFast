import { NotificationEventType } from '@growfast/shared-types';

/**
 * Format a Date object or ISO string as DD-MMM-YYYY (e.g. 07-Oct-2026).
 */
export function formatWhatsAppDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Cleanly format currency values without superfluous decimals if whole.
 */
export function formatCurrencyVal(val: any): string {
  if (val == null || isNaN(Number(val))) return '0';
  const num = Number(val);
  return Number.isInteger(num) ? num.toString() : num.toFixed(2);
}

/**
 * Canonical notification message formatter for GrowFast.
 * Adheres strictly to the three required events and formats:
 * 1. Order Created
 * 2. Order Ready
 * 3. Full Payment Completed
 */
export function formatNotificationMessage(
  eventType: NotificationEventType | string,
  payload: Record<string, any> | null,
  storeName: string = 'GrowFast',
): string | null {
  if (!payload) return null;

  // Clean brand name
  let brand = (storeName || 'GrowFast').trim();
  if (brand.toLowerCase().endsWith(' laundry')) {
    // Keep 'GrowFast' clean for conversational templates if store name has 'Laundry'
    // But preserve whatever custom store name was provided
    brand = brand.replace(/ Laundry$/i, '');
  }
  if (!brand) brand = 'GrowFast';

  const customerName = payload.customerName ? payload.customerName.trim() : 'Customer';
  const orderNumber = payload.orderNumber || 'UNKNOWN';

  switch (eventType as NotificationEventType) {
    case NotificationEventType.ORDER_CREATED: {
      const orderDate = formatWhatsAppDate(payload.orderDate || new Date());
      const deliveryDate = formatWhatsAppDate(
        payload.deliveryDate || payload.effectiveDueDate || payload.systemDueDate,
      );
      const orderTotal = formatCurrencyVal(payload.orderTotal ?? payload.totalAmount);
      const quantity =
        payload.quantity ??
        (Array.isArray(payload.items)
          ? payload.items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0)
          : 0);
      const weight = formatCurrencyVal(payload.weight ?? 0);

      const amountPaidNum = Number(payload.amountPaid || 0);
      const totalAmountNum = Number(payload.orderTotal ?? payload.totalAmount ?? 0);
      const balanceDueNum =
        payload.balanceDue != null
          ? Number(payload.balanceDue)
          : payload.amountDue != null
            ? Number(payload.amountDue)
            : Math.max(0, totalAmountNum - amountPaidNum);
      const paymentStatus = payload.paymentStatus;

      let paymentSummary = '';
      if (
        paymentStatus === 'PAID' ||
        (amountPaidNum >= totalAmountNum && totalAmountNum > 0 && balanceDueNum === 0)
      ) {
        paymentSummary = `Payment Received: ₹${formatCurrencyVal(amountPaidNum)}\nPayment Status: Paid`;
      } else if (
        paymentStatus === 'PARTIAL' ||
        (amountPaidNum > 0 && balanceDueNum > 0)
      ) {
        paymentSummary = `Payment Received: ₹${formatCurrencyVal(amountPaidNum)}\nBalance Due: ₹${formatCurrencyVal(balanceDueNum)}\nPayment Status: Partially Paid`;
      } else {
        paymentSummary = `Payment Received: ₹0\nBalance Due: ₹${formatCurrencyVal(balanceDueNum)}\nPayment Status: Pending`;
      }

      return (
        `Hi, Your ${brand} order *#${orderNumber}* is registered.\n\n` +
        `*Order Details:*\n` +
        `Order Date: ${orderDate}\n` +
        `Amount: ₹${orderTotal}\n` +
        `Quantity: ${quantity} Pcs\n` +
        `Weight: ${weight} Kgs\n` +
        `Delivery Date: ${deliveryDate}\n\n` +
        `${paymentSummary}\n\n` +
        `We will inform you in case the order is updated after in-store inspection.\n\n` +
        `Thank you for choosing ${brand}!`
      );
    }

    case NotificationEventType.ORDER_READY: {
      const orderDate = formatWhatsAppDate(payload.orderDate || new Date());
      const orderTotal = formatCurrencyVal(
        payload.orderTotal ?? payload.totalAmount ?? payload.amountPaid ?? 0,
      );
      const balanceDueNum =
        payload.balanceDue != null
          ? Number(payload.balanceDue)
          : payload.amountDue != null
            ? Number(payload.amountDue)
            : 0;
      const balanceDue = formatCurrencyVal(Math.max(0, balanceDueNum));

      const readyItems = payload.readyItems || [];
      const remainingItems = payload.remainingItems || [];
      let itemDetails = '';
      if (Array.isArray(readyItems) && readyItems.length > 0) {
        itemDetails +=
          `\n\n*Ready Items:*\n` +
          readyItems
            .map((i: any) => `• ${i.quantity ?? 1} × ${i.garmentName || 'Item'}`)
            .join('\n');
      }
      if (Array.isArray(remainingItems) && remainingItems.length > 0) {
        itemDetails +=
          `\n\n*Remaining Items:*\n` +
          remainingItems
            .map((i: any) => `• ${i.quantity ?? 1} × ${i.garmentName || 'Item'}`)
            .join('\n');
      }

      return (
        `Hi ${customerName}, your ${brand} order *#${orderNumber}* is ready for pickup.\n\n` +
        `Order Date: ${orderDate}\n` +
        `Amount: ₹${orderTotal}\n` +
        `Balance Due: ₹${balanceDue}` +
        itemDetails +
        `\n\nThank you for choosing ${brand}!`
      );
    }

    case NotificationEventType.PAYMENT_RECEIVED: {
      const orderTotal = formatCurrencyVal(payload.orderTotal ?? payload.totalAmount);
      const totalPaid = formatCurrencyVal(
        payload.totalPaid ?? payload.amountPaid ?? payload.orderTotal ?? payload.totalAmount,
      );

      return (
        `Hi ${customerName}, we have received the full payment for your ${brand} order *#${orderNumber}*.\n\n` +
        `Total Amount: ₹${orderTotal}\n` +
        `Payment Received: ₹${totalPaid}\n` +
        `Balance Due: ₹0\n\n` +
        `Thank you for choosing ${brand}!`
      );
    }

    case NotificationEventType.ORDER_OUT_FOR_DELIVERY: {
      return `Hi ${customerName}, your ${brand} order *#${orderNumber}* is out for delivery!`;
    }

    case NotificationEventType.ORDER_DELIVERED: {
      return `Hi ${customerName}, your ${brand} order *#${orderNumber}* has been successfully delivered.\n\nThank you for choosing ${brand}!`;
    }

    default:
      return null;
  }
}
