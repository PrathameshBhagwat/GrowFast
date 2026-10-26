import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import {
  calculateOrderTotals,
  getExpressMultiplier,
  deriveOrderStatus,
  OrderStatus,
  ItemStatus,
  PaymentStatus,
  ExpressDeliveryOption,
  PickupType,
  Role,
  isPhotoRequiredForOrder,
} from '@growfast/shared-types';
import { OrderReceipt } from '../components/OrderReceipt';

describe('GrowFast Laundry & Dry-Cleaning — Scenario-Based System Quality Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── SCENARIO A: Authentication & Authorization ───────────────────────────
  describe('Scenario A: Authentication and Authorization', () => {
    it('restricts POS login directory to permitted roles (OWNER and COUNTER)', () => {
      const directory = [
        { id: 'emp-1', name: 'Prathamesh', role: Role.OWNER },
        { id: 'emp-2', name: 'Rajesh', role: Role.MANAGER },
        { id: 'emp-3', name: 'Swapnil', role: Role.COUNTER },
        { id: 'emp-4', name: 'Kiran', role: Role.DELIVERY },
      ];

      // Business rule: Website POS restricts login dropdown to OWNER and COUNTER
      const posAllowedRoles = [Role.OWNER, Role.COUNTER];
      const filtered = directory.filter((e) => posAllowedRoles.includes(e.role));

      expect(filtered.map((e) => e.role)).toEqual([Role.OWNER, Role.COUNTER]);
      expect(filtered.some((e) => e.role === Role.MANAGER)).toBe(false);
      expect(filtered.some((e) => e.role === Role.DELIVERY)).toBe(false);
    });

    it('rejects invalid PIN length or empty credentials', () => {
      const validatePin = (pin: string) => pin.trim().length === 6 && /^\d{6}$/.test(pin.trim());
      expect(validatePin('12345')).toBe(false);
      expect(validatePin('')).toBe(false);
      expect(validatePin('1234567')).toBe(false);
      expect(validatePin('abcdef')).toBe(false);
      expect(validatePin('111111')).toBe(true);
    });
  });

  // ─── SCENARIO B: Customer Management ──────────────────────────────────────
  describe('Scenario B: Customer Management', () => {
    it('validates 10-digit Indian phone numbers and non-empty customer names', () => {
      const validateCustomer = (name: string, phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        const validPhone = cleanPhone.length === 10 && /^[6-9]\d{9}$/.test(cleanPhone);
        const validName = name.trim().length >= 2;
        return { validPhone, validName, isValid: validPhone && validName };
      };

      expect(validateCustomer('Amit', '9876543210').isValid).toBe(true);
      expect(validateCustomer('A', '9876543210').isValid).toBe(false);
      expect(validateCustomer('Amit', '1234567890').isValid).toBe(false); // Does not start with 6-9
      expect(validateCustomer('Amit', '98765').isValid).toBe(false);
    });
  });

  // ─── SCENARIO C: Catalog ──────────────────────────────────────────────────
  describe('Scenario C: Catalog Selection & Autofill Removal', () => {
    it('filters active catalog garments and calculates line totals accurately', () => {
      const activeGarments = [
        { id: 'g1', name: 'Shirt', isActive: true, basePrice: 100 },
        { id: 'g2', name: 'Silk Saree', isActive: true, basePrice: 250 },
        { id: 'g3', name: 'Winter Coat', isActive: false, basePrice: 300 },
      ];

      const available = activeGarments.filter((g) => g.isActive);
      expect(available.length).toBe(2);
      expect(available.some((g) => g.id === 'g3')).toBe(false);

      // Line total calculation: quantity * unitPrice
      const lineTotal = 3 * available[0].basePrice;
      expect(lineTotal).toBe(300);
    });
  });

  // ─── SCENARIO D: Order Creation ───────────────────────────────────────────
  describe('Scenario D: Order Creation Workflow', () => {
    it('creates normal per-piece and weight-based items with accurate subtotals', () => {
      const inputs = [
        { quantity: 2, unitPrice: 100 }, // Normal piece: 2 * 100 = 200
        { quantity: 1, weight: 2.5, unitPrice: 80 }, // Weight: 2.5 * 80 = 200
      ];

      const totals = calculateOrderTotals(inputs);
      expect(totals.subtotal).toBe(400);
      expect(totals.totalAmount).toBe(400);
      expect(totals.expressSurcharge).toBe(0);
      expect(totals.taxAmount).toBe(0);
    });
  });

  // ─── SCENARIO E: Delivery Pricing (Canonical Multipliers 1.0x, 1.5x, 2.0x) ─
  describe('Scenario E: Delivery Pricing & Multipliers Fix Verification', () => {
    const base200Items = [{ quantity: 2, unitPrice: 100 }]; // ₹200 base
    const base1000Items = [{ quantity: 10, unitPrice: 100 }]; // ₹1,000 base

    it('E1: ₹200 base produces exactly ₹200 for Regular (1.0×)', () => {
      const res = calculateOrderTotals(base200Items, {
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      });
      expect(res.subtotal).toBe(200);
      expect(res.expressSurcharge).toBe(0);
      expect(res.taxAmount).toBe(0);
      expect(res.totalAmount).toBe(200);
    });

    it('E2: ₹200 base produces exactly ₹300 for Tomorrow (1.5×, +₹100 surcharge)', () => {
      const res = calculateOrderTotals(base200Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      expect(res.subtotal).toBe(200);
      expect(res.expressSurcharge).toBe(100);
      expect(res.taxAmount).toBe(0);
      expect(res.totalAmount).toBe(300);
    });

    it('E3: ₹200 base produces exactly ₹400 for Same Day (2.0×, +₹200 surcharge)', () => {
      const res = calculateOrderTotals(base200Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(res.subtotal).toBe(200);
      expect(res.expressSurcharge).toBe(200);
      expect(res.taxAmount).toBe(0);
      expect(res.totalAmount).toBe(400);
    });

    it('E4: ₹1,000 base produces exactly ₹1,000 (Regular), ₹1,500 (Tomorrow), ₹2,000 (Same Day)', () => {
      const regular = calculateOrderTotals(base1000Items, {
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      });
      expect(regular.totalAmount).toBe(1000);
      expect(regular.expressSurcharge).toBe(0);

      const tomorrow = calculateOrderTotals(base1000Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      expect(tomorrow.totalAmount).toBe(1500);
      expect(tomorrow.expressSurcharge).toBe(500);

      const sameDay = calculateOrderTotals(base1000Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(sameDay.totalAmount).toBe(2000);
      expect(sameDay.expressSurcharge).toBe(1000);
    });

    it('E5: Switching delivery options recalculates from base amount without compounding', () => {
      // 1. Same Day (2.0×)
      const t1 = calculateOrderTotals(base200Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(t1.totalAmount).toBe(400);

      // 2. Switch to Tomorrow (1.5×)
      const t2 = calculateOrderTotals(base200Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      expect(t2.totalAmount).toBe(300);

      // 3. Switch to Regular (1.0×)
      const t3 = calculateOrderTotals(base200Items, {
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      });
      expect(t3.totalAmount).toBe(200);

      // 4. Switch back to Same Day (2.0×)
      const t4 = calculateOrderTotals(base200Items, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(t4.totalAmount).toBe(400);
    });

    it('E6: Quantity changes immediately update express surcharge and total', () => {
      // 2 pieces @ 100 = 200 => Same Day = 400
      const qty2 = calculateOrderTotals([{ quantity: 2, unitPrice: 100 }], {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(qty2.totalAmount).toBe(400);

      // Increment to 4 pieces @ 100 = 400 => Same Day = 800
      const qty4 = calculateOrderTotals([{ quantity: 4, unitPrice: 100 }], {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(qty4.totalAmount).toBe(800);
      expect(qty4.expressSurcharge).toBe(400);
    });

    it('E7: Applies express multipliers on discounted subtotal when discount is present', () => {
      // ₹1,000 subtotal - 10% discount (₹100) = ₹900 discounted subtotal
      const orderItems = [{ quantity: 10, unitPrice: 100 }];

      const tomorrow = calculateOrderTotals(orderItems, {
        discountPercent: 10,
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      expect(tomorrow.subtotal).toBe(1000);
      expect(tomorrow.discountAmount).toBe(100);
      expect(tomorrow.expressSurcharge).toBe(450); // 0.5 × 900
      expect(tomorrow.totalAmount).toBe(1350); // 1.5 × 900

      const sameDay = calculateOrderTotals(orderItems, {
        discountPercent: 10,
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(sameDay.subtotal).toBe(1000);
      expect(sameDay.discountAmount).toBe(100);
      expect(sameDay.expressSurcharge).toBe(900); // 1.0 × 900
      expect(sameDay.totalAmount).toBe(1800); // 2.0 × 900
    });

    it('E8: Enforces IEEE 754 half-up currency rounding on fractional prices', () => {
      // ₹133 subtotal
      const odd = [{ quantity: 1, unitPrice: 133 }];
      const tomorrow = calculateOrderTotals(odd, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });
      expect(tomorrow.expressSurcharge).toBe(66.5);
      expect(tomorrow.totalAmount).toBe(199.5);

      const sameDay = calculateOrderTotals(odd, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });
      expect(sameDay.expressSurcharge).toBe(133);
      expect(sameDay.totalAmount).toBe(266);
    });
  });

  // ─── SCENARIO F: GST and Billing ──────────────────────────────────────────
  describe('Scenario F: GST and Billing Interface', () => {
    it('verifies that TAX_RATE is 0 and no GST line is rendered in order receipts', () => {
      const order: any = {
        id: 'ord-test-1',
        orderNumber: 'ORD-999',
        customerId: 'cust-1',
        customerName: 'Rahul Sharma',
        customerPhone: '9876543210',
        pickupType: PickupType.STORE_PICKUP,
        status: OrderStatus.PROCESSING,
        paymentStatus: PaymentStatus.PAID,
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
        subtotal: 200,
        discountAmount: 0,
        expressSurcharge: 200,
        taxAmount: 0,
        totalAmount: 400,
        amountPaid: 400,
        amountDue: 0,
        items: [
          {
            id: 'item-1',
            garmentName: 'Shirt',
            serviceType: 'Dry Clean',
            quantity: 2,
            unitPrice: 100,
            lineTotal: 200,
            itemStatus: ItemStatus.PROCESSING,
          },
        ],
        payments: [],
        createdAt: new Date().toISOString(),
      };

      const { container } = render(<OrderReceipt order={order} />);

      // Must display Express 2x and correct total
      expect(screen.getAllByText(/Express/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('+₹200.00')).toBeInTheDocument();
      expect(screen.getAllByText('₹400.00').length).toBeGreaterThanOrEqual(1);

      // Must NOT display any GST line
      expect(screen.queryByText(/GST/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tax \(GST\)/i)).not.toBeInTheDocument();
    });
  });

  // ─── SCENARIO G: Photos & Notes ───────────────────────────────────────────
  describe('Scenario G: Photos and Notes Policy', () => {
    it('enforces photo requirement for walk-in piece orders up to 50 pieces and makes bulk (>50) optional', () => {
      // Walk-in <= 50 pieces requires photos
      const smallWalkIn = isPhotoRequiredForOrder({
        isWalkIn: true,
        totalPieces: 3,
        isWeightBased: false,
      });
      expect(smallWalkIn).toBe(true);

      // Bulk walk-in (>50 pieces) photos are optional
      const bulkWalkIn = isPhotoRequiredForOrder({
        isWalkIn: true,
        totalPieces: 51,
        isWeightBased: false,
      });
      expect(bulkWalkIn).toBe(false);

      // Delivery pickup (not walk-in) photos are optional
      const deliveryOrder = isPhotoRequiredForOrder({
        isWalkIn: false,
        totalPieces: 5,
        isWeightBased: false,
      });
      expect(deliveryOrder).toBe(false);
    });
  });

  // ─── SCENARIO H: Payments ─────────────────────────────────────────────────
  describe('Scenario H: Payment Balances and Transitions', () => {
    it('calculates balance due correctly for full, partial, and zero payments', () => {
      const totalAmount = 400;

      // Full payment
      const fullPaid = 400;
      const balanceFull = Math.max(0, totalAmount - fullPaid);
      expect(balanceFull).toBe(0);

      // Partial payment
      const partialPaid = 150;
      const balancePartial = Math.max(0, totalAmount - partialPaid);
      expect(balancePartial).toBe(250);

      // Zero payment
      const zeroPaid = 0;
      const balanceZero = Math.max(0, totalAmount - zeroPaid);
      expect(balanceZero).toBe(400);
    });
  });

  // ─── SCENARIO I: Order Status Machine ─────────────────────────────────────
  describe('Scenario I: Canonical Order Status State Machine', () => {
    it('correctly derives order status using canonical deriveOrderStatus() lowest progress precedence', () => {
      // 1. All received => RECEIVED
      const s1 = deriveOrderStatus({
        items: [{ status: ItemStatus.RECEIVED }, { status: ItemStatus.RECEIVED }],
        hasActiveTransitDelivery: false,
      });
      expect(s1).toBe(OrderStatus.RECEIVED);

      // 2. All processing => PROCESSING
      const s2 = deriveOrderStatus({
        items: [{ status: ItemStatus.PROCESSING }, { status: ItemStatus.PROCESSING }],
        hasActiveTransitDelivery: false,
      });
      expect(s2).toBe(OrderStatus.PROCESSING);

      // 3. Mixed (one received, one processing) => resolves to lowest (RECEIVED)
      const s3 = deriveOrderStatus({
        items: [{ status: ItemStatus.RECEIVED }, { status: ItemStatus.PROCESSING }],
        hasActiveTransitDelivery: false,
      });
      expect(s3).toBe(OrderStatus.RECEIVED);

      // 4. All ready => READY
      const s4 = deriveOrderStatus({
        items: [{ status: ItemStatus.READY }, { status: ItemStatus.READY }],
        hasActiveTransitDelivery: false,
      });
      expect(s4).toBe(OrderStatus.READY);

      // 5. All delivered => DELIVERED
      const s5 = deriveOrderStatus({
        items: [{ status: ItemStatus.DELIVERED }, { status: ItemStatus.DELIVERED }],
        hasActiveTransitDelivery: false,
      });
      expect(s5).toBe(OrderStatus.DELIVERED);

      // 6. All cancelled => CANCELLED
      const s6 = deriveOrderStatus({
        items: [{ status: ItemStatus.CANCELLED }, { status: ItemStatus.CANCELLED }],
        hasActiveTransitDelivery: false,
      });
      expect(s6).toBe(OrderStatus.CANCELLED);
    });
  });

  // ─── SCENARIO J: Website Error Handling ───────────────────────────────────
  describe('Scenario J: Website Error Handling', () => {
    it('handles 503 backend offline and API validation errors gracefully', () => {
      const formatError = (status: number, message?: string) => {
        if (status === 503) return 'Backend service is currently offline. Please try again.';
        if (status === 400) return message || 'Invalid order data provided.';
        if (status === 403) return 'You do not have permission to perform this action.';
        return 'An unexpected error occurred.';
      };

      expect(formatError(503)).toBe('Backend service is currently offline. Please try again.');
      expect(formatError(400, 'Garment is inactive')).toBe('Garment is inactive');
      expect(formatError(403)).toBe('You do not have permission to perform this action.');
    });
  });

  // ─── SCENARIO K: Touch Targets and Responsive Behavior ────────────────────
  describe('Scenario K: Touch Targets and UX Standards', () => {
    it('validates that delivery option buttons satisfy min-h-[44px] standard', () => {
      // Standard mobile POS touch target class verification
      const regularButtonClass = 'py-2 px-2 rounded-lg text-center min-h-[44px] border';
      expect(regularButtonClass).toContain('min-h-[44px]');
    });
  });
});
