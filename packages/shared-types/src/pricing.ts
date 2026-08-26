/**
 * Shared pricing calculation utility.
 *
 * Centralizes the calculation logic for order financial fields.
 */

export interface PricingItemInput {
  quantity: number;
  unitPrice: number;
}

export interface PricingTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateOrderTotals(
  items: PricingItemInput[],
  options?: {
    discountPercent?: number; // Kept at 0 for V1 based on user preference
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

  // 2. Tax (V1: 18% GST as per user choice)
  // GST applies on the discounted subtotal
  const TAX_RATE = 0.18;
  const taxAmount = discountedSubtotal * TAX_RATE;

  // 3. Total Amount
  const totalAmount = discountedSubtotal + taxAmount;

  return {
    // Math.round to avoid floating point precision issues in UI/DB
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}
