/**
 * Shared pricing calculation utility.
 *
 * Centralizes the calculation logic for order financial fields.
 */

import { ItemStatus } from './enums';

export interface PricingItemInput {
  quantity: number;
  unitPrice: number;
}

export interface PricingTotals {
  subtotal: number;
  discountAmount: number;
  expressSurcharge: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateOrderTotals(
  items: PricingItemInput[],
  options?: {
    discountPercent?: number; // Kept at 0 for V1 based on user preference
    isExpress?: boolean;
    expressSurchargePercent?: number;
  },
): PricingTotals {
  let subtotal = 0;

  for (const item of items) {
    // lineTotal = unitPrice * quantity
    subtotal += item.unitPrice * item.quantity;
  }

  // 1. Discount (V1: forced to 0 by default)
  const discountPercent = options?.discountPercent ?? 0;
  let discountAmount = 0;
  if (discountPercent > 0) {
    discountAmount = (subtotal * discountPercent) / 100;
  }

  const discountedSubtotal = subtotal - discountAmount;

  // 2. Express Surcharge (B7 Configurable)
  const isExpress = options?.isExpress ?? false;
  let expressSurcharge = 0;
  if (isExpress) {
    if (options?.expressSurchargePercent == null) {
      throw new Error('Express surcharge percent must be provided for express orders');
    }
    expressSurcharge = (discountedSubtotal * options.expressSurchargePercent) / 100;
  }

  // 3. Tax (V1: 18% GST as per user choice)
  // GST applies on the discounted subtotal + express surcharge (surcharge is a taxable service fee)
  const TAX_RATE = 0.18;
  const taxableAmount = discountedSubtotal + expressSurcharge;
  const taxAmount = taxableAmount * TAX_RATE;

  // 4. Total Amount
  const totalAmount = discountedSubtotal + expressSurcharge + taxAmount;

  return {
    // Math.round to avoid floating point precision issues in UI/DB
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    expressSurcharge: Math.round(expressSurcharge * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
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
