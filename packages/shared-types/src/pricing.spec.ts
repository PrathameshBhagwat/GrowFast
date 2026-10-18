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
    // Subtotal: 200, Tax (18%): 36, Total: 236
    assert.strictEqual(totals.subtotal, 200);
    assert.strictEqual(totals.discountAmount, 0);
    assert.strictEqual(totals.expressSurcharge, 0);
    assert.strictEqual(totals.taxAmount, 36);
    assert.strictEqual(totals.totalAmount, 236);
  });

  describe('Weight-Based Items Pricing', () => {
    it('calculates 0.5 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 0.5, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 0.5 * 80 = 40
      // 18% GST: 7.20
      // total: 47.20
      assert.strictEqual(totals.subtotal, 40);
      assert.strictEqual(totals.taxAmount, 7.2);
      assert.strictEqual(totals.totalAmount, 47.2);
    });

    it('calculates 1.25 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 1.25, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 1.25 * 80 = 100
      // 18% GST: 18.00
      // total: 118.00
      assert.strictEqual(totals.subtotal, 100);
      assert.strictEqual(totals.taxAmount, 18);
      assert.strictEqual(totals.totalAmount, 118);
    });

    it('calculates 2.5 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 2.5, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 2.5 * 80 = 200
      // 18% GST: 36.00
      // total: 236.00
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.taxAmount, 36);
      assert.strictEqual(totals.totalAmount, 236);
    });

    it('calculates 5.75 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 5.75, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 5.75 * 80 = 460
      // 18% GST: 82.80
      // total: 542.80
      assert.strictEqual(totals.subtotal, 460);
      assert.strictEqual(totals.taxAmount, 82.8);
      assert.strictEqual(totals.totalAmount, 542.8);
    });

    it('calculates 10 kg at ₹80/kg correctly', () => {
      const items = [{ quantity: 1, weight: 10, unitPrice: 80 }];
      const totals = calculateOrderTotals(items);
      // subtotal: 10 * 80 = 800
      // 18% GST: 144.00
      // total: 944.00
      assert.strictEqual(totals.subtotal, 800);
      assert.strictEqual(totals.taxAmount, 144);
      assert.strictEqual(totals.totalAmount, 944);
    });

    it('handles mixed normal piece items + weight-based items', () => {
      const items = [
        { quantity: 2, unitPrice: 100 }, // Shirt x 2 = 200
        { quantity: 1, weight: 5, unitPrice: 80 }, // Wash & Iron 5kg @ 80 = 400
      ];
      const totals = calculateOrderTotals(items);
      // subtotal: 200 + 400 = 600
      // GST: 108
      // total: 708
      assert.strictEqual(totals.subtotal, 600);
      assert.strictEqual(totals.taxAmount, 108);
      assert.strictEqual(totals.totalAmount, 708);
    });

    it('handles multiple weight-based items in one order', () => {
      const items = [
        { quantity: 1, weight: 5, unitPrice: 80 }, // 5kg @ 80 = 400
        { quantity: 1, weight: 2, unitPrice: 120 }, // 2kg @ 120 = 240
      ];
      const totals = calculateOrderTotals(items);
      // subtotal: 400 + 240 = 640
      // GST: 115.20
      // total: 755.20
      assert.strictEqual(totals.subtotal, 640);
      assert.strictEqual(totals.taxAmount, 115.2);
      assert.strictEqual(totals.totalAmount, 755.2);
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
      // GST (18% of 660): 118.80
      // total: 778.80
      assert.strictEqual(totals.subtotal, 440);
      assert.strictEqual(totals.expressSurcharge, 220);
      assert.strictEqual(totals.taxAmount, 118.8);
      assert.strictEqual(totals.totalAmount, 778.8);
    });

    it('applies discount to weight-based items correctly', () => {
      const items = [{ quantity: 1, weight: 10, unitPrice: 100 }]; // subtotal: 1000
      const totals = calculateOrderTotals(items, {
        discountPercent: 10,
      });
      // subtotal: 1000
      // discount: 100
      // discounted subtotal: 900
      // GST (18% of 900): 162
      // total: 1062
      assert.strictEqual(totals.subtotal, 1000);
      assert.strictEqual(totals.discountAmount, 100);
      assert.strictEqual(totals.taxAmount, 162);
      assert.strictEqual(totals.totalAmount, 1062);
    });
  });

  describe('Express Delivery Pricing Multipliers (Canonical Rules)', () => {
    const items = [{ quantity: 2, unitPrice: 100 }]; // subtotal = 200
    const expressSurchargePercent = 25; // base express = 25% of 200 = 50

    it('Regular delivery does not receive either multiplier (base charge × 1.0)', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressSurchargePercent,
        expressDeliveryOption: 'REGULAR',
      });
      // Base express: 50 * 1.0 = 50
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 50);
      // Taxable: 250, GST (18%): 45, Total: 295
      assert.strictEqual(totals.taxAmount, 45);
      assert.strictEqual(totals.totalAmount, 295);
    });

    it('Tomorrow/next-day evening express charge = base charge × 1.5', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressSurchargePercent,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      // Base express: 50 * 1.5 = 75
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 75);
      // Taxable: 275, GST (18%): 49.50, Total: 324.50
      assert.strictEqual(totals.taxAmount, 49.5);
      assert.strictEqual(totals.totalAmount, 324.5);
    });

    it('Same-day express charge = base charge × 2.0', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: true,
        expressSurchargePercent,
        expressDeliveryOption: 'SAME_DAY',
      });
      // Base express: 50 * 2.0 = 100
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 100);
      // Taxable: 300, GST (18%): 54, Total: 354
      assert.strictEqual(totals.taxAmount, 54);
      assert.strictEqual(totals.totalAmount, 354);
    });

    it('Regular delivery without express produces 0 express charge', () => {
      const totals = calculateOrderTotals(items, {
        isExpress: false,
        expressSurchargePercent,
        expressDeliveryOption: 'REGULAR',
      });
      assert.strictEqual(totals.subtotal, 200);
      assert.strictEqual(totals.expressSurcharge, 0);
      assert.strictEqual(totals.taxAmount, 36);
      assert.strictEqual(totals.totalAmount, 236);
    });

    it('Enforces consistent 2-decimal currency rounding on fractional multipliers', () => {
      // Subtotal 133, express 15% => base express = 19.95
      // 1.5x => 29.925 => rounded to 29.93
      const oddItems = [{ quantity: 1, unitPrice: 133 }];
      const totals = calculateOrderTotals(oddItems, {
        isExpress: true,
        expressSurchargePercent: 15,
        expressDeliveryOption: 'NEXT_DAY_EVENING',
      });
      assert.strictEqual(totals.subtotal, 133);
      assert.strictEqual(totals.expressSurcharge, 29.93);
      // Taxable: 162.93, 18% GST: 29.3274 => 29.33, Total: 192.26
      assert.strictEqual(totals.taxAmount, 29.33);
      assert.strictEqual(totals.totalAmount, 192.26);
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
