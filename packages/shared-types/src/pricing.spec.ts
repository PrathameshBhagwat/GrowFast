import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateOrderTotals, calculateFulfillmentBreakdown } from './pricing';
import { ItemStatus } from './enums';

describe('Pricing Calculation - calculateOrderTotals', () => {
  it('calculates totals correctly for standard piece-based items', () => {
    const items = [
      { quantity: 2, unitPrice: 100 }, // subtotal: 200
    ];
    const totals = calculateOrderTotals(items);
    // Subtotal: 200, Tax: 0 (GST removed), Total: 200
    assert.strictEqual(totals.subtotal, 200);
    assert.strictEqual(totals.discountAmount, 0);
    assert.strictEqual(totals.expressSurcharge, 0);
    assert.strictEqual(totals.taxAmount, 0);
    assert.strictEqual(totals.totalAmount, 200);
  });

  describe('Weight-Based Items Pricing', () => {
    it('calculates 0.5 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 0.5, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 0.5 * 80 = 40
      // Tax: 0 (GST removed)
      // total: 40
      assert.strictEqual(totals.subtotal, 40);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 40);
    });

    it('calculates 1.25 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 1.25, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 1.25 * 80 = 100
      // Tax: 0 (GST removed)
      // total: 100
      assert.strictEqual(totals.subtotal, 100);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 100);
    });

    it('calculates 2.5 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 2.5, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 2.5 * 80 = 200
      // Tax: 0 (GST removed)
      // total: 200
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 200);
    });

    it('calculates 5.75 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 5.75, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 5.75 * 80 = 460
      // Tax: 0 (GST removed)
      // total: 460
      assert.strictEqual(totals.subtotal, 460);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 460);
    });

    it('calculates 10 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 10, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 10 * 80 = 800
      // Tax: 0 (GST removed)
      // total: 800
      assert.strictEqual(totals.subtotal, 800);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 800);
    });

    it('handles mixed normal piece items + weight-based items', () => {
      const items = [
        { quantity: 2, unitPrice: 100 }, // Shirt x 2 = 200
        { quantity: 1, weight: 5, unitPrice: 80 }, // Wash & Iron 5kg @ 80 = 400
      ];
      const totals = calculateOrderTotals(items);
      // subtotal: 200 + 400 = 600
      // Tax: 0 (GST removed)
      // total: 600
      assert.strictEqual(totals.subtotal, 600);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 600);
    });

    it('handles multiple weight-based items in one order', () => {
      const items = [
        { quantity: 1, weight: 5, unitPrice: 80 }, // 5kg @ 80 = 400
        { quantity: 1, weight: 2, unitPrice: 120 }, // 2kg @ 120 = 240
      ];
      const totals = calculateOrderTotals(items);
      // subtotal: 400 + 240 = 640
      // Tax: 0 (GST removed)
      // total: 640
      assert.strictEqual(totals.subtotal, 640);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 640);
    });

    it('applies express surcharge to weight-based items correctly', () => {
      const items = [{ quantity: 1, weight: 5.5, unitPrice: 80 }]; // subtotal: 440
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressSurchargePercent: 50,
      });
      // subtotal: 440
      // express: 220 (50% of 440)
      // taxable: 660
      // Tax: 0 (GST removed)
      // total: 660
      assert.strictEqual(totals.subtotal, 440);
      assert.strictEqual(totals.expressSurcharge, 220);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 660);
    });

    it('applies discount to weight-based items correctly', () => {
      const items = [{ quantity: 1, weight: 10, unitPrice: 100 }]; // subtotal: 1000
      const totals = calculateOrderTotals(items, {
        discountPercent: 10,
      });
      // subtotal: 1000
      // discount: 100
      // discounted subtotal: 900
      // Tax: 0 (GST removed)
      // total: 900
      assert.strictEqual(totals.subtotal, 1000);
      assert.strictEqual(totals.discountAmount, 100);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 900);
    });
  });

  describe('Express Delivery Pricing Multipliers (Canonical Rules)', () => {
    const items = [{ quantity: 2, unitPrice: 100 }]; // subtotal = 200
    it('Regular delivery results in 0 express charge even if isExpress flag is set', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'REGULAR',
      });
      // Regular delivery has NO express charge (1.0× multiplier)
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 0);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 200);
    });

    it('Tomorrow/next-day evening express charge: ₹200 base × 1.5 multiplier = ₹300 total', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      // 1.5× base: surcharge = ₹100, total = ₹300
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 100);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 300);
    });

    it('Same-day express charge: ₹200 base × 2.0 multiplier = ₹400 total', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      // 2.0× base: surcharge = ₹200, total = ₹400
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 200);
      assert.strictEqual(totals.taxAmount, 0);
      assert.strictEqual(totals.totalAmount, 400);
    });

    it('Calculates ₹1,000 base amount correctly for all 3 delivery options', () => {
      const thousandItems = [{ quantity: 10, unitPrice: 100 }];
      
      // Regular: 1.0× => ₹1,000
      const regularTotals = calculateOrderTotals(thousandItems, {
        isExpress: false,
        expressDeliveryOption: 'REGULAR',
      });
      assert.strictEqual(regularTotals.subtotal, 1000);
      assert.strictEqual(regularTotals.expressSurcharge, 0);
      assert.strictEqual(regularTotals.totalAmount, 1000);

      // Tomorrow: 1.5× => ₹1,500 (+₹500 surcharge)
      const tomorrowTotals = calculateOrderTotals(thousandItems, {
        isExpress: true,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      assert.strictEqual(tomorrowTotals.subtotal, 1000);
      assert.strictEqual(tomorrowTotals.expressSurcharge, 500);
      assert.strictEqual(tomorrowTotals.totalAmount, 1500);

      // Same Day: 2.0× => ₹2,000 (+₹1,000 surcharge)
      const sameDayTotals = calculateOrderTotals(thousandItems, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(sameDayTotals.subtotal, 1000);
      assert.strictEqual(sameDayTotals.expressSurcharge, 1000);
      assert.strictEqual(sameDayTotals.totalAmount, 2000);
    });

    it('Switching delivery options recalculates from base without compounding', () => {
      // 1. Same Day (2.0×) => 400
      const step1 = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(step1.totalAmount, 400);

      // 2. Switch to Tomorrow (1.5×) => 300
      const step2 = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      assert.strictEqual(step2.totalAmount, 300);

      // 3. Switch to Regular (1.0×) => 200
      const step3 = calculateOrderTotals(items, {
        isExpress: false,
        expressDeliveryOption: 'REGULAR',
      });
      assert.strictEqual(step3.totalAmount, 200);

      // 4. Switch back to Same Day (2.0×) => 400
      const step4 = calculateOrderTotals(items, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(step4.totalAmount, 400);
    });

    it('Quantity change immediately updates express surcharge and total', () => {
      // 2 items @ ₹100 = ₹200 => Same Day = ₹400
      const twoItems = [{ quantity: 2, unitPrice: 100 }];
      const res2 = calculateOrderTotals(twoItems, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(res2.subtotal, 200);
      assert.strictEqual(res2.expressSurcharge, 200);
      assert.strictEqual(res2.totalAmount, 400);

      // Increase to 3 items @ ₹100 = ₹300 => Same Day = ₹600
      const threeItems = [{ quantity: 3, unitPrice: 100 }];
      const res3 = calculateOrderTotals(threeItems, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(res3.subtotal, 300);
      assert.strictEqual(res3.expressSurcharge, 300);
      assert.strictEqual(res3.totalAmount, 600);
    });

    it('Applies express multipliers on discounted subtotal when discount is present', () => {
      // Subtotal ₹1000, 10% discount => discountedSubtotal = ₹900
      const orderItems = [{ quantity: 10, unitPrice: 100 }];
      
      const tomorrowWithDiscount = calculateOrderTotals(orderItems, {
        discountPercent: 10,
        isExpress: true,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      assert.strictEqual(tomorrowWithDiscount.subtotal, 1000);
      assert.strictEqual(tomorrowWithDiscount.discountAmount, 100);
      assert.strictEqual(tomorrowWithDiscount.expressSurcharge, 450); // 0.5 × 900
      assert.strictEqual(tomorrowWithDiscount.totalAmount, 1350); // 1.5 × 900

      const sameDayWithDiscount = calculateOrderTotals(orderItems, {
        discountPercent: 10,
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(sameDayWithDiscount.subtotal, 1000);
      assert.strictEqual(sameDayWithDiscount.discountAmount, 100);
      assert.strictEqual(sameDayWithDiscount.expressSurcharge, 900); // 1.0 × 900
      assert.strictEqual(sameDayWithDiscount.totalAmount, 1800); // 2.0 × 900
    });

    it('Enforces consistent 2-decimal currency rounding on fractional amounts', () => {
      // Subtotal 133
      // Tomorrow 1.5× => Surcharge = 66.50, Total = 199.50
      const oddItems = [{ quantity: 1, unitPrice: 133 }];
      const tomorrowTotals = calculateOrderTotals(oddItems, {
        isExpress: true,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      assert.strictEqual(tomorrowTotals.subtotal, 133);
      assert.strictEqual(tomorrowTotals.expressSurcharge, 66.5);
      assert.strictEqual(tomorrowTotals.totalAmount, 199.5);

      // Same Day 2.0× => Surcharge = 133.00, Total = 266.00
      const sameDayTotals = calculateOrderTotals(oddItems, {
        isExpress: true,
        expressDeliveryOption: 'SAME_DAY',
      });
      assert.strictEqual(sameDayTotals.subtotal, 133);
      assert.strictEqual(sameDayTotals.expressSurcharge, 133);
      assert.strictEqual(sameDayTotals.totalAmount, 266);
    });
  });

  describe('Fulfillment Breakdown', () => {
    it('calculates fulfillment for weight items correctly', () => {
      const items = [
        { lineTotal: 440, itemStatus: ItemStatus.READY },
        { lineTotal: 200, itemStatus: ItemStatus.RECEIVED },
      ];
      const breakdown = calculateFulfillmentBreakdown(755.2, 0, items);
      assert.ok(breakdown.readyAmount > 0);
      assert.ok(breakdown.remainingAmount > 0);
    });
  });
});
