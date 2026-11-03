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

/**
 * Canonical helper to determine if an order is overdue.
 *
 * Rules:
 * 1. Must have a valid effective due date.
 * 2. Order status cannot be DELIVERED or CANCELLED.
 * 3. Due date must be strictly before referenceDate (defaults to now).
 */
export function isOrderOverdue(
  order: { effectiveDueDate?: Date | string | null; status?: OrderStatus | string },
  referenceDate: Date = new Date(),
): boolean {
  if (!order || !order.effectiveDueDate) return false;
  const statusStr = String(order.status || '');
  if (statusStr === OrderStatus.DELIVERED || statusStr === OrderStatus.CANCELLED) {
    return false;
  }
  const dueDate = new Date(order.effectiveDueDate);
  if (isNaN(dueDate.getTime())) return false;
  return dueDate.getTime() < referenceDate.getTime();
}

/**
 * Calculates how many whole days an order has been overdue.
 * Returns 0 if not overdue, if due date has not passed, or if due date is invalid.
 */
export function getOverdueDays(
  dueDateInput?: Date | string | null,
  referenceDate: Date = new Date(),
): number {
  if (!dueDateInput) return 0;
  const due = new Date(dueDateInput);
  if (isNaN(due.getTime())) return 0;
  const diffMs = referenceDate.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Checks whether an order is eligible for the 90-day overdue cleanup workflow.
 *
 * Rules:
 * 1. Must not be DELIVERED or CANCELLED.
 * 2. Must have a valid effective due date.
 * 3. Must not already be archived.
 * 4. Days overdue must be strictly MORE than 90 days (> 90).
 *    - 89 days: not eligible.
 *    - 90 days: not eligible (must be strictly > 90).
 *    - 91 days: eligible.
 * 5. Uses due date, not order creation date.
 */
export function isEligibleFor90DayCleanup(
  order: {
    effectiveDueDate?: Date | string | null;
    status?: OrderStatus | string;
    isArchived?: boolean | null;
  },
  referenceDate: Date = new Date(),
): boolean {
  if (!order || !order.effectiveDueDate) return false;
  if (order.isArchived) return false;
  const statusStr = String(order.status || '');
  if (statusStr === OrderStatus.DELIVERED || statusStr === OrderStatus.CANCELLED) {
    return false;
  }
  const days = getOverdueDays(order.effectiveDueDate, referenceDate);
  return days > 90;
}
