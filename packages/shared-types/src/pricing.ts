/**
 * Shared pricing calculation utility.
 *
 * Centralizes the calculation logic for order financial fields.
 */

import { ItemStatus, ExpressDeliveryOption } from './enums';

export interface PricingItemInput {
  quantity: number;
  unitPrice: number;
  weight?: number | null;
}

export interface PricingTotals {
  subtotal: number;
  discountAmount: number;
  expressSurcharge: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Returns the express charge multiplier based on customer's requested delivery:
 * - Same-day delivery: 2× the configured express charge
 * - Tomorrow / next-day evening delivery: 1.5× the configured express charge
 * - Regular delivery: No express charge (0×)
 */
export function getExpressMultiplier(option?: ExpressDeliveryOption | string | null): number {
  if (!option) return 0;
  const upper = String(option).toUpperCase().trim();
  if (
    upper === ExpressDeliveryOption.SAME_DAY ||
    upper === 'SAME_DAY' ||
    upper === 'SAME-DAY' ||
    upper === 'SAME_DAY_DELIVERY'
  ) {
    return 2.0;
  }
  if (
    upper === ExpressDeliveryOption.NEXT_DAY_EVENING ||
    upper === 'NEXT_DAY_EVENING' ||
    upper === 'TOMORROW_EVENING' ||
    upper === 'NEXT_DAY' ||
    upper === 'TOMORROW'
  ) {
    return 1.5;
  }
  return 0; // Regular delivery - no express charge
}

/**
 * Canonical currency rounding helper.
 * Rounds half-up to 2 decimal places, correcting IEEE 754 binary floating-point artifacts.
 */
export function roundCurrency(val: number): number {
  return Math.round((val + 1e-9) * 100) / 100;
}

export function calculateOrderTotals(
  items: PricingItemInput[],
  options?: {
    discountPercent?: number; // Kept at 0 for V1 based on user preference
    isExpress?: boolean;
    expressSurchargePercent?: number;
    expressDeliveryOption?: ExpressDeliveryOption | string | null;
  },
): PricingTotals {
  let subtotal = 0;

  for (const item of items) {
    // For weight-based items, multiplier is weight; otherwise quantity
    const multiplier = item.weight != null && item.weight > 0 ? item.weight : item.quantity;
    subtotal += roundCurrency(item.unitPrice * multiplier);
  }
  subtotal = roundCurrency(subtotal);

  // 1. Discount (V1: forced to 0 by default)
  const discountPercent = options?.discountPercent ?? 0;
  let discountAmount = 0;
  if (discountPercent > 0) {
    discountAmount = roundCurrency((subtotal * discountPercent) / 100);
  }

  const discountedSubtotal = roundCurrency(subtotal - discountAmount);

  // 2. Express Surcharge (Canonical Multipliers: Same-day 2.0x, Tomorrow evening 1.5x, Regular 0)
  const option = options?.expressDeliveryOption;
  const isRegular =
    option === ExpressDeliveryOption.REGULAR || option === 'REGULAR' || option === 'STANDARD';

  const multiplier = getExpressMultiplier(option);
  const isExpress = !isRegular && (multiplier > 0 || Boolean(options?.isExpress));

  let expressSurcharge = 0;
  if (isExpress) {
    if (multiplier > 0) {
      // The delivery multiplier applies to the eligible base amount (discountedSubtotal) exactly once:
      // - Regular: 1.0× (no surcharge, final = 1.0× base)
      // - Tomorrow / Next-day evening: 1.5× (surcharge = 0.5× base, final = 1.5× base)
      // - Same Day: 2.0× (surcharge = 1.0× base, final = 2.0× base)
      expressSurcharge = roundCurrency(discountedSubtotal * (multiplier - 1.0));
    } else if (options?.expressSurchargePercent != null) {
      // Fallback for generic express flag when no tiered delivery option is selected
      expressSurcharge = roundCurrency(
        (discountedSubtotal * options.expressSurchargePercent) / 100,
      );
    } else {
      throw new Error('Express surcharge percent must be provided for express orders');
    }
  }

  // 3. Tax (V1: GST removed per business decision — all pricing is tax-inclusive)
  const TAX_RATE = 0;
  const taxableAmount = roundCurrency(discountedSubtotal + expressSurcharge);
  const taxAmount = roundCurrency(taxableAmount * TAX_RATE);

  // 4. Total Amount
  const totalAmount = roundCurrency(discountedSubtotal + expressSurcharge + taxAmount);

  return {
    subtotal,
    discountAmount,
    expressSurcharge,
    taxAmount,
    totalAmount,
  };
}

export interface FulfillmentBreakdown {
  readyAmount: number;
  remainingAmount: number;
  collectedAmount: number;
  cancelledAmount: number;
  payableAmount: number;
}

export function calculateFulfillmentBreakdown(
  totalAmount: number,
  amountPaid: number,
  items: { lineTotal: number; itemStatus: ItemStatus }[],
): FulfillmentBreakdown {
  const totalLine = items.reduce((sum, item) => sum + item.lineTotal, 0);

  if (totalLine === 0) {
    return {
      readyAmount: 0,
      remainingAmount: 0,
      collectedAmount: 0,
      cancelledAmount: 0,
      payableAmount: 0,
    };
  }

  let readyLine = 0;
  let remainingLine = 0;
  let collectedLine = 0;
  let cancelledLine = 0;

  for (const item of items) {
    if (item.itemStatus === ItemStatus.READY) readyLine += item.lineTotal;
    else if (item.itemStatus === ItemStatus.DELIVERED) collectedLine += item.lineTotal;
    else if (item.itemStatus === ItemStatus.CANCELLED) cancelledLine += item.lineTotal;
    else remainingLine += item.lineTotal;
  }

  const readyAmount = Math.round((readyLine / totalLine) * totalAmount * 100) / 100;
  const collectedAmount = Math.round((collectedLine / totalLine) * totalAmount * 100) / 100;
  const cancelledAmount = Math.round((cancelledLine / totalLine) * totalAmount * 100) / 100;
  const remainingAmount = Math.round((remainingLine / totalLine) * totalAmount * 100) / 100;

  // Payable right now = what they are picking up + what they already picked up - what they paid
  let payableAmount = readyAmount + collectedAmount - amountPaid;
  if (payableAmount < 0) {
    payableAmount = 0;
  }

  // Clean up floating point just in case
  payableAmount = Math.round(payableAmount * 100) / 100;

  return { readyAmount, remainingAmount, collectedAmount, cancelledAmount, payableAmount };
}
