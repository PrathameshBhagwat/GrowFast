import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  deriveOrderStatus,
  isOrderOverdue,
  getOverdueDays,
  isEligibleFor90DayCleanup,
} from './order-status';
import { OrderStatus, ItemStatus } from './enums';

describe('OrderStatus & Overdue Business Rules', () => {
  const FIXED_NOW = new Date('2026-11-03T12:00:00.000Z');

  describe('deriveOrderStatus', () => {
    it('returns RECEIVED for empty items', () => {
      assert.strictEqual(deriveOrderStatus({ items: [] }), OrderStatus.RECEIVED);
    });

    it('returns CANCELLED when all items are cancelled', () => {
      assert.strictEqual(
        deriveOrderStatus({
          items: [{ status: ItemStatus.CANCELLED }, { status: ItemStatus.CANCELLED }],
        }),
        OrderStatus.CANCELLED,
      );
    });

    it('returns DELIVERED when all non-cancelled items are DELIVERED', () => {
      assert.strictEqual(
        deriveOrderStatus({
          items: [
            { status: ItemStatus.DELIVERED },
            { status: ItemStatus.DELIVERED },
            { status: ItemStatus.CANCELLED },
          ],
        }),
        OrderStatus.DELIVERED,
      );
    });

    it('returns READY when lowest progress is READY and no transit delivery', () => {
      assert.strictEqual(
        deriveOrderStatus({
          items: [{ status: ItemStatus.READY }, { status: ItemStatus.DELIVERED }],
        }),
        OrderStatus.READY,
      );
    });

    it('returns PROCESSING when lowest progress is PROCESSING', () => {
      assert.strictEqual(
        deriveOrderStatus({
          items: [{ status: ItemStatus.READY }, { status: ItemStatus.PROCESSING }],
        }),
        OrderStatus.PROCESSING,
      );
    });
  });

  describe('isOrderOverdue', () => {
    it('returns true when a processing order is past its due date', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      assert.strictEqual(
        isOrderOverdue(
          { effectiveDueDate: pastDue.toISOString(), status: OrderStatus.PROCESSING },
          FIXED_NOW,
        ),
        true,
      );
    });

    it('returns true when a ready order is past its due date', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      assert.strictEqual(
        isOrderOverdue(
          { effectiveDueDate: pastDue.toISOString(), status: OrderStatus.READY },
          FIXED_NOW,
        ),
        true,
      );
    });

    it('returns false when order is DELIVERED, even if past due date', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isOrderOverdue(
          { effectiveDueDate: pastDue.toISOString(), status: OrderStatus.DELIVERED },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('returns false when order is CANCELLED, even if past due date', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isOrderOverdue(
          { effectiveDueDate: pastDue.toISOString(), status: OrderStatus.CANCELLED },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('returns false when order has no due date', () => {
      assert.strictEqual(
        isOrderOverdue({ effectiveDueDate: null, status: OrderStatus.PROCESSING }, FIXED_NOW),
        false,
      );
      assert.strictEqual(
        isOrderOverdue({ effectiveDueDate: undefined, status: OrderStatus.READY }, FIXED_NOW),
        false,
      );
    });

    it('returns false when order due date is in the future (not yet due)', () => {
      const futureDue = new Date(FIXED_NOW.getTime() + 2 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isOrderOverdue(
          { effectiveDueDate: futureDue.toISOString(), status: OrderStatus.PROCESSING },
          FIXED_NOW,
        ),
        false,
      );
    });
  });

  describe('getOverdueDays', () => {
    it('returns 0 for future or identical due dates', () => {
      const futureDue = new Date(FIXED_NOW.getTime() + 10000);
      assert.strictEqual(getOverdueDays(futureDue, FIXED_NOW), 0);
      assert.strictEqual(getOverdueDays(FIXED_NOW, FIXED_NOW), 0);
    });

    it('calculates whole elapsed days correctly', () => {
      const pastDue5Days = new Date(FIXED_NOW.getTime() - 5 * 24 * 60 * 60 * 1000);
      assert.strictEqual(getOverdueDays(pastDue5Days, FIXED_NOW), 5);

      const pastDue90Days = new Date(FIXED_NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
      assert.strictEqual(getOverdueDays(pastDue90Days, FIXED_NOW), 90);

      const pastDue95Days = new Date(FIXED_NOW.getTime() - 95 * 24 * 60 * 60 * 1000);
      assert.strictEqual(getOverdueDays(pastDue95Days, FIXED_NOW), 95);
    });
  });

  describe('isEligibleFor90DayCleanup', () => {
    it('order overdue by 89 days is NOT eligible', () => {
      const due89Days = new Date(FIXED_NOW.getTime() - 89 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due89Days.toISOString(), status: OrderStatus.READY },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('order overdue by exactly 90 days is NOT eligible (strictly more than 90 days required)', () => {
      const due90Days = new Date(FIXED_NOW.getTime() - 90 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due90Days.toISOString(), status: OrderStatus.READY },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('order overdue by 91 days IS eligible', () => {
      const due91Days = new Date(FIXED_NOW.getTime() - 91 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due91Days.toISOString(), status: OrderStatus.READY },
          FIXED_NOW,
        ),
        true,
      );
    });

    it('order overdue by 120 days IS eligible', () => {
      const due120Days = new Date(FIXED_NOW.getTime() - 120 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due120Days.toISOString(), status: OrderStatus.PROCESSING },
          FIXED_NOW,
        ),
        true,
      );
    });

    it('order creation date does not determine cleanup eligibility (created 100 days ago, due 10 days ago)', () => {
      const due10Days = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due10Days.toISOString(), status: OrderStatus.READY },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('delivered orders are excluded from 90-day cleanup even if overdue by > 90 days', () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due100Days.toISOString(), status: OrderStatus.DELIVERED },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('cancelled orders are excluded from 90-day cleanup', () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          { effectiveDueDate: due100Days.toISOString(), status: OrderStatus.CANCELLED },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('already archived orders are excluded from 90-day cleanup', () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000);
      assert.strictEqual(
        isEligibleFor90DayCleanup(
          {
            effectiveDueDate: due100Days.toISOString(),
            status: OrderStatus.READY,
            isArchived: true,
          },
          FIXED_NOW,
        ),
        false,
      );
    });

    it('orders without due dates are excluded from 90-day cleanup', () => {
      assert.strictEqual(
        isEligibleFor90DayCleanup({ effectiveDueDate: null, status: OrderStatus.READY }, FIXED_NOW),
        false,
      );
    });
  });
});
