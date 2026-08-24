/**
 * Order status derivation — single source of truth.
 *
 * This function determines the canonical order status based on
 * the statuses of all items within the order.
 *
 * IMPORTANT:
 * - Order status must NOT be manually set by delivery or other modules.
 * - All modules (delivery, payment, processing) must call this function
 *   to derive the order status from item-level statuses.
 * - There must be ONE source of truth for order status derivation.
 */

import { OrderStatus, ItemStatus } from './enums';

export interface OrderItemStatusInput {
  status: ItemStatus;
  deliveredQuantity: number;
  totalQuantity: number;
}

/**
 * Derive the overall order status from individual item statuses.
 *
 * Rules:
 * 1. If ALL items are DELIVERED → DELIVERED
 * 2. If ANY item is OUT_FOR_DELIVERY → OUT_FOR_DELIVERY
 * 3. If ALL items are READY or DELIVERED → READY
 * 4. If ALL items have passed QC (READY+) → PACKED
 * 5. If ANY item is in QUALITY_CHECK → QUALITY_CHECK
 * 6. If ANY item is PROCESSING → PROCESSING
 * 7. If ALL items are RECEIVED → RECEIVED
 * 8. If ALL items are CANCELLED → CANCELLED
 * 9. Otherwise → the lowest-progress status among non-cancelled items
 */
export function deriveOrderStatus(items: OrderItemStatusInput[]): OrderStatus {
  if (items.length === 0) {
    return OrderStatus.RECEIVED;
  }

  const nonCancelled = items.filter((i) => i.status !== ItemStatus.CANCELLED);

  // All cancelled
  if (nonCancelled.length === 0) {
    return OrderStatus.CANCELLED;
  }

  // All delivered
  if (nonCancelled.every((i) => i.status === ItemStatus.DELIVERED)) {
    return OrderStatus.DELIVERED;
  }

  // All ready or delivered
  if (
    nonCancelled.every((i) => i.status === ItemStatus.READY || i.status === ItemStatus.DELIVERED)
  ) {
    return OrderStatus.READY;
  }

  // Any in quality check
  if (nonCancelled.some((i) => i.status === ItemStatus.QUALITY_CHECK)) {
    return OrderStatus.QUALITY_CHECK;
  }

  // Any processing
  if (nonCancelled.some((i) => i.status === ItemStatus.PROCESSING)) {
    return OrderStatus.PROCESSING;
  }

  // Default: received
  return OrderStatus.RECEIVED;
}

/**
 * STATUS COLOR MAPPING — for consistent UI rendering.
 * The StatusChip component in packages/ui must use these colors.
 */
export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  [OrderStatus.RECEIVED]: { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  [OrderStatus.SORTING]: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  [OrderStatus.PROCESSING]: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  [OrderStatus.DRYING]: { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },
  [OrderStatus.IRONING]: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  [OrderStatus.QUALITY_CHECK]: { bg: '#F5F3FF', text: '#5B21B6', border: '#DDD6FE' },
  [OrderStatus.PACKED]: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  [OrderStatus.READY]: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  [OrderStatus.OUT_FOR_DELIVERY]: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  [OrderStatus.DELIVERED]: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  [OrderStatus.CANCELLED]: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};
