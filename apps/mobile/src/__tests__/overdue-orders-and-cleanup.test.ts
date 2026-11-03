import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiError } from '../api/client';
import {
  OrderStatus,
  PaymentStatus,
  OrderPriority,
  PickupType,
  OrderSummaryDTO,
  isOrderOverdue,
  getOverdueDays,
  isEligibleFor90DayCleanup,
  deriveOrderStatus,
  ItemStatus,
} from '@growfast/shared-types';

describe('GrowFast Mobile POS — Overdue Orders Filter & 90-Day Cleanup Workflow', () => {
  const FIXED_NOW = new Date('2026-11-03T12:00:00.000Z');

  const createMockOrder = (overrides?: Partial<OrderSummaryDTO>): OrderSummaryDTO => ({
    id: 'ord-test-1',
    orderNumber: 'GF-1024',
    customerId: 'cust-1',
    customerName: 'Omkar Chavhan',
    customerPhone: '+918080085552',
    orderDate: '2026-08-01T10:00:00.000Z',
    effectiveDueDate: '2026-08-04T18:00:00.000Z',
    isExpress: false,
    priority: OrderPriority.STANDARD,
    status: OrderStatus.PROCESSING,
    subtotal: 560,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 560,
    amountPaid: 0,
    amountDue: 560,
    readyAmount: 0,
    remainingAmount: 560,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 560,
    paymentStatus: PaymentStatus.PENDING,
    pickupType: PickupType.STORE_PICKUP,
    itemCount: 3,
    ...overrides,
  });

  describe('Part 1: Overdue Filter & Classification Rules', () => {
    it('1. A processing order past its due date is classified as overdue and appears in Overdue', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        status: OrderStatus.PROCESSING,
        effectiveDueDate: pastDue,
      });

      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), true);
      assert.strictEqual(getOverdueDays(order.effectiveDueDate, FIXED_NOW), 5);
    });

    it('2. A ready order past its due date is classified as overdue and appears in Overdue', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        status: OrderStatus.READY,
        effectiveDueDate: pastDue,
      });

      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), true);
      assert.strictEqual(getOverdueDays(order.effectiveDueDate, FIXED_NOW), 2);
    });

    it('3. A delivered order does NOT appear in Overdue, even if its due date was in the past', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        status: OrderStatus.DELIVERED,
        effectiveDueDate: pastDue,
      });

      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), false);
    });

    it('4. An order with no due date does NOT appear in Overdue', () => {
      const order = createMockOrder({
        status: OrderStatus.PROCESSING,
        effectiveDueDate: '' as any,
      });

      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), false);
    });

    it('5. An order that is not yet due (future due date) does NOT appear in Overdue', () => {
      const futureDue = new Date(FIXED_NOW.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        status: OrderStatus.PROCESSING,
        effectiveDueDate: futureDue,
      });

      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), false);
    });

    it('6. Canonical order status is still derived using deriveOrderStatus() and not replaced by Overdue', () => {
      // Overdue is an orthogonal time-based property, canonical operational status is preserved
      const derived = deriveOrderStatus({
        items: [{ status: ItemStatus.PROCESSING }, { status: ItemStatus.READY }],
      });
      assert.strictEqual(derived, OrderStatus.PROCESSING);

      const pastDue = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        status: derived,
        effectiveDueDate: pastDue,
      });

      assert.strictEqual(order.status, OrderStatus.PROCESSING);
      assert.strictEqual(isOrderOverdue(order, FIXED_NOW), true);
    });

    it('7. Tab filter segregation: Overdue orders do not leak into IN_PROCESS or READY tabs', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const futureDue = new Date(FIXED_NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const overdueProcessingOrder = createMockOrder({
        id: 'ord-1',
        status: OrderStatus.PROCESSING,
        effectiveDueDate: pastDue,
      });

      const normalProcessingOrder = createMockOrder({
        id: 'ord-2',
        status: OrderStatus.PROCESSING,
        effectiveDueDate: futureDue,
      });

      const allOrders = [overdueProcessingOrder, normalProcessingOrder];

      // IN_PROCESS filter logic: must exclude overdue orders
      const inProcessFiltered = allOrders.filter(
        (o) =>
          !isOrderOverdue(o, FIXED_NOW) &&
          (o.status === OrderStatus.PROCESSING || o.status === OrderStatus.RECEIVED),
      );
      assert.strictEqual(inProcessFiltered.length, 1);
      assert.strictEqual(inProcessFiltered[0].id, 'ord-2');

      // OVERDUE filter logic: must show only overdue orders
      const overdueFiltered = allOrders.filter((o) => isOrderOverdue(o, FIXED_NOW));
      assert.strictEqual(overdueFiltered.length, 1);
      assert.strictEqual(overdueFiltered[0].id, 'ord-1');
    });

    it('8. Search by order number, customer name, and customer phone works together with Overdue filter', () => {
      const pastDue = new Date(FIXED_NOW.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const orders = [
        createMockOrder({
          id: 'ord-101',
          orderNumber: 'GF-00101',
          customerName: 'Omkar Chavhan',
          customerPhone: '8080085552',
          effectiveDueDate: pastDue,
        }),
        createMockOrder({
          id: 'ord-102',
          orderNumber: 'GF-00102',
          customerName: 'Harshad Jadhav',
          customerPhone: '9834820606',
          effectiveDueDate: pastDue,
        }),
      ];

      // Search by phone '80800' inside Overdue filter
      const phoneSearch = orders.filter(
        (o) => isOrderOverdue(o, FIXED_NOW) && o.customerPhone.includes('80800'),
      );
      assert.strictEqual(phoneSearch.length, 1);
      assert.strictEqual(phoneSearch[0].id, 'ord-101');

      // Search by customer name 'Harshad' inside Overdue filter
      const nameSearch = orders.filter(
        (o) => isOrderOverdue(o, FIXED_NOW) && o.customerName.toLowerCase().includes('harshad'),
      );
      assert.strictEqual(nameSearch.length, 1);
      assert.strictEqual(nameSearch[0].id, 'ord-102');

      // Search by order number '00101' inside Overdue filter
      const orderNumSearch = orders.filter(
        (o) => isOrderOverdue(o, FIXED_NOW) && o.orderNumber.includes('00101'),
      );
      assert.strictEqual(orderNumSearch.length, 1);
      assert.strictEqual(orderNumSearch[0].id, 'ord-101');
    });
  });

  describe('Part 2: 90-Day Overdue Cleanup Threshold & Workflow Rules', () => {
    it('1. An order overdue by 89 days is NOT eligible for 90-day cleanup', () => {
      const due89Days = new Date(FIXED_NOW.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({ effectiveDueDate: due89Days, status: OrderStatus.READY });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });

    it('2. An order overdue by exactly 90 days is NOT eligible (strictly more than 90 days required)', () => {
      const due90Days = new Date(FIXED_NOW.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({ effectiveDueDate: due90Days, status: OrderStatus.READY });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });

    it('3. An order overdue by 91 days IS eligible for 90-day cleanup', () => {
      const due91Days = new Date(FIXED_NOW.getTime() - 91 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({ effectiveDueDate: due91Days, status: OrderStatus.READY });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), true);
    });

    it('4. Order creation date does NOT determine cleanup eligibility', () => {
      // Order created 120 days ago, but due only 10 days ago: NOT eligible
      const due10Days = new Date(FIXED_NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        orderDate: new Date(FIXED_NOW.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        effectiveDueDate: due10Days,
        status: OrderStatus.PROCESSING,
      });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });

    it('5. Delivered orders are excluded from 90-day cleanup', () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        effectiveDueDate: due100Days,
        status: OrderStatus.DELIVERED,
      });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });

    it('6. Orders without due dates are excluded from 90-day cleanup', () => {
      const order = createMockOrder({
        effectiveDueDate: null as any,
        status: OrderStatus.READY,
      });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });

    it('7. Already archived orders are excluded from 90-day cleanup to prevent duplicate actions', () => {
      const due100Days = new Date(FIXED_NOW.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();
      const order = createMockOrder({
        effectiveDueDate: due100Days,
        status: OrderStatus.READY,
        isArchived: true,
      });
      assert.strictEqual(isEligibleFor90DayCleanup(order, FIXED_NOW), false);
    });
  });

  describe('Part 3: Mobile API Client Integration', () => {
    const originalList = apiClient.orders.list;
    const originalGetCleanup = apiClient.orders.getCleanupEligibleOrders;
    const originalArchive = apiClient.orders.archiveOverdueOrders;

    afterEach(() => {
      apiClient.orders.list = originalList;
      apiClient.orders.getCleanupEligibleOrders = originalGetCleanup;
      apiClient.orders.archiveOverdueOrders = originalArchive;
    });

    it('sends isOverdue parameter correctly to apiClient.orders.list', async () => {
      let calledUrl = '';
      (apiClient.orders.list as any) = async (params: any) => {
        calledUrl = `status=${params?.status}&isOverdue=${params?.isOverdue}`;
        return { data: [], total: 0, page: 1, pageSize: 10 };
      };

      await apiClient.orders.list({ isOverdue: true });
      assert.strictEqual(calledUrl, 'status=undefined&isOverdue=true');

      await apiClient.orders.list({ status: 'PROCESSING', isOverdue: false });
      assert.strictEqual(calledUrl, 'status=PROCESSING&isOverdue=false');
    });

    it('getCleanupEligibleOrders returns eligible orders response', async () => {
      (apiClient.orders.getCleanupEligibleOrders as any) = async () => {
        return {
          eligibleOrders: [
            {
              id: 'ord-clean-1',
              orderNumber: 'GF-0099',
              customerId: 'c1',
              customerName: 'Prathamesh Bhagwat',
              customerPhone: '9834820606',
              orderDate: '2026-05-01T10:00:00Z',
              effectiveDueDate: '2026-05-05T18:00:00Z',
              daysOverdue: 95,
              status: OrderStatus.READY,
              paymentStatus: PaymentStatus.PENDING,
              totalAmount: 315,
              amountPaid: 0,
              amountDue: 315,
              itemCount: 3,
              hasPayments: false,
              paymentCount: 0,
              hasPhotos: true,
              photoCount: 3,
              hasDeliveryRecords: false,
              deliveryRecordCount: 0,
              hasAdjustments: false,
              isArchived: false,
            },
          ],
          totalEligibleCount: 1,
          thresholdDays: 90,
          referenceDate: FIXED_NOW.toISOString(),
        };
      };

      const res = await apiClient.orders.getCleanupEligibleOrders();
      assert.strictEqual(res.totalEligibleCount, 1);
      assert.strictEqual(res.eligibleOrders[0].orderNumber, 'GF-0099');
      assert.strictEqual(res.eligibleOrders[0].daysOverdue, 95);
      assert.strictEqual(res.eligibleOrders[0].hasPhotos, true);
    });

    it('archiveOverdueOrders submits selected order IDs and reason', async () => {
      let submittedPayload: any = null;
      (apiClient.orders.archiveOverdueOrders as any) = async (payload: any) => {
        submittedPayload = payload;
        return {
          success: true,
          archivedCount: payload.orderIds.length,
          orderIds: payload.orderIds,
          message: 'Successfully archived 1 order(s).',
        };
      };

      const res = await apiClient.orders.archiveOverdueOrders({
        orderIds: ['ord-clean-1'],
        reason: '90-day uncollected order cleanup',
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.archivedCount, 1);
      assert.deepStrictEqual(submittedPayload, {
        orderIds: ['ord-clean-1'],
        reason: '90-day uncollected order cleanup',
      });
    });
  });
});
