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
}

export interface OrderStatusDerivationContext {
  items: OrderItemStatusInput[];
  currentOrderStatus?: OrderStatus;
  hasActiveTransitDelivery?: boolean;
}

// The canonical item progression order (0 = lowest progress)
const ITEM_PROGRESSION = [
  ItemStatus.RECEIVED,
  ItemStatus.PROCESSING,
  ItemStatus.QUALITY_CHECK,
  ItemStatus.READY,
  ItemStatus.DELIVERED,
];

/**
 * Derive the overall order status from individual item statuses.
 *
 * Rules:
 * 1. If ALL non-cancelled items are DELIVERED → DELIVERED
 * 2. If hasActiveTransitDelivery is true AND items are READY → OUT_FOR_DELIVERY
 * 3. Otherwise, use deterministic progress precedence mapping to the lowest progress item.
 * 4. Preserve explicit granular operational states (SORTING, DRYING, IRONING, PACKED)
 *    if the underlying item macro-state still supports it.
 */
export function deriveOrderStatus(ctx: OrderStatusDerivationContext): OrderStatus {
  const { items, currentOrderStatus, hasActiveTransitDelivery } = ctx;

  if (items.length === 0) {
    return OrderStatus.RECEIVED;
  }

  const nonCancelled = items.filter((i) => i.status !== ItemStatus.CANCELLED);

  // All cancelled
  if (nonCancelled.length === 0) {
    return OrderStatus.CANCELLED;
  }

  // Find lowest item progress
  let minIndex = ITEM_PROGRESSION.length;
  for (const item of nonCancelled) {
    const idx = ITEM_PROGRESSION.indexOf(item.status);
    if (idx < minIndex) {
      minIndex = idx;
    }
  }

  const lowestItemStatus = ITEM_PROGRESSION[minIndex] || ItemStatus.RECEIVED;

  // Rule 1: All delivered
  if (lowestItemStatus === ItemStatus.DELIVERED) {
    return OrderStatus.DELIVERED;
  }

  // Rule 2: Active Transit
  // Wait, if it's OUT_FOR_DELIVERY, items must be READY or above.
  // If a delivery is active, it takes precedence.
  if (hasActiveTransitDelivery) {
    return OrderStatus.OUT_FOR_DELIVERY;
  }

  // Map lowest item macro-state to OrderStatus
  if (lowestItemStatus === ItemStatus.READY) {
    if (currentOrderStatus === OrderStatus.PACKED) {
      return OrderStatus.PACKED;
    }
    return OrderStatus.READY;
  }

  if (lowestItemStatus === ItemStatus.PROCESSING) {
    if (
      currentOrderStatus === OrderStatus.SORTING ||
      currentOrderStatus === OrderStatus.DRYING ||
      currentOrderStatus === OrderStatus.IRONING
    ) {
      return currentOrderStatus;
    }
    return OrderStatus.PROCESSING;
  }

  if (lowestItemStatus === ItemStatus.QUALITY_CHECK) {
    return OrderStatus.QUALITY_CHECK;
  }

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
