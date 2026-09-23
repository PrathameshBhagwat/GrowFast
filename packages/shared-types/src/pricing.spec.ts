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
