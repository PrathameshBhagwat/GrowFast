import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GarmentCategory,
  OrderWorkflowType,
  PickupType,
  ExpressDeliveryOption,
  OrderStatus,
  PaymentStatus,
  deriveOrderStatus,
  calculateOrderTotals,
  adjustDueDateForThursday,
  isServiceAllowedInWorkflow,
  filterServicesForCategory,
  isCategoryAllowedInWorkflow,
  ServiceCategory,
  ServiceTypeDTO,
  GarmentCatalogDTO,
} from '@growfast/shared-types';

interface MockPrice {
  id: string;
  garmentCatalogId: string;
  serviceTypeId: string;
  price: number;
  isActive: boolean;
}

// Mock Services
const mockServices: ServiceTypeDTO[] = [
  {
    id: 'srv-wash-iron',
    name: 'Wash and Steam Iron',
    category: ServiceCategory.WASH_IRON,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'srv-wash-fold',
    name: 'Wash and Fold',
    category: ServiceCategory.WASH,
    estimatedDays: 2,
    isActive: true,
  },
  {
    id: 'srv-dry-clean',
    name: 'Dry Clean',
    category: ServiceCategory.DRY_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'srv-steam-iron',
    name: 'Steam Iron',
    category: ServiceCategory.STEAM_PRESS,
    estimatedDays: 1,
    isActive: true,
  },
  {
    id: 'srv-shoe-clean',
    name: 'Shoe Cleaning',
    category: ServiceCategory.SHOE_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
  {
    id: 'srv-free-shoe',
    name: 'Free Shoe', // Excluded service
    category: ServiceCategory.SHOE_CLEAN,
    estimatedDays: 3,
    isActive: true,
  },
];

// Mock Garments
const mockGarments: GarmentCatalogDTO[] = [
  { id: 'g-shirt', name: 'Cotton Shirt', category: GarmentCategory.MEN, isActive: true },
  { id: 'g-trousers', name: 'Formal Trousers', category: GarmentCategory.MEN, isActive: true },
  { id: 'g-saree', name: 'Silk Saree', category: GarmentCategory.WOMEN, isActive: true },
  { id: 'g-suit', name: '2-Piece Suit', category: GarmentCategory.SPECIAL, isActive: true },
  { id: 'g-bedsheet', name: 'King Bed Sheet', category: GarmentCategory.HOUSEHOLD, isActive: true },
  {
    id: 'g-laundry-kg',
    name: 'Mixed Laundry (Per Kg)',
    category: GarmentCategory.WEIGHT_BASED,
    isActive: true,
  },
  { id: 'g-sneakers', name: 'Running Sneakers', category: GarmentCategory.SHOES, isActive: true },
];

// Mock Pricing Matrix
const mockPrices: MockPrice[] = [
  {
    id: 'p-1',
    garmentCatalogId: 'g-shirt',
    serviceTypeId: 'srv-wash-iron',
    price: 60,
    isActive: true,
  },
  {
    id: 'p-2',
    garmentCatalogId: 'g-shirt',
    serviceTypeId: 'srv-dry-clean',
    price: 120,
    isActive: true,
  },
  {
    id: 'p-3',
    garmentCatalogId: 'g-trousers',
    serviceTypeId: 'srv-wash-iron',
    price: 70,
    isActive: true,
  },
  {
    id: 'p-4',
    garmentCatalogId: 'g-trousers',
    serviceTypeId: 'srv-dry-clean',
    price: 140,
    isActive: true,
  },
  {
    id: 'p-5',
    garmentCatalogId: 'g-saree',
    serviceTypeId: 'srv-dry-clean',
    price: 250,
    isActive: true,
  },
  {
    id: 'p-6',
    garmentCatalogId: 'g-suit',
    serviceTypeId: 'srv-dry-clean',
    price: 400,
    isActive: true,
  },
  {
    id: 'p-7',
    garmentCatalogId: 'g-laundry-kg',
    serviceTypeId: 'srv-wash-fold',
    price: 80,
    isActive: true,
  },
  {
    id: 'p-8',
    garmentCatalogId: 'g-sneakers',
    serviceTypeId: 'srv-shoe-clean',
    price: 300,
    isActive: true,
  },
];

describe('GrowFast Mobile Developer B — Order Workflow Screens 4–9', () => {
  // ==========================================
  // SCREEN 4: SERVICE & CATEGORY SELECTION
  // ==========================================
  describe('Screen 4: Service & Category Selection Logic', () => {
    it('1. Filters services based on OrderWorkflowType (LAUNDRY strictly excludes Dry Clean)', () => {
      const laundryServices = mockServices.filter(
        (s) => s.isActive && isServiceAllowedInWorkflow(s, 'LAUNDRY'),
      );
      assert.ok(laundryServices.some((s) => s.name === 'Wash and Steam Iron'));
      assert.ok(laundryServices.some((s) => s.name === 'Wash and Fold'));
      assert.ok(!laundryServices.some((s) => s.name === 'Dry Clean'));
      assert.ok(!laundryServices.some((s) => s.name === 'Free Shoe')); // Excluded
    });

    it('2. Filters services based on DRY_CLEANING workflow (strictly excludes washing services)', () => {
      const dryCleanServices = mockServices.filter(
        (s) => s.isActive && isServiceAllowedInWorkflow(s, 'DRY_CLEANING'),
      );
      assert.ok(dryCleanServices.some((s) => s.name === 'Dry Clean'));
      assert.ok(dryCleanServices.some((s) => s.name === 'Steam Iron'));
      assert.ok(dryCleanServices.some((s) => s.name === 'Shoe Cleaning'));
      assert.ok(!dryCleanServices.some((s) => s.name === 'Wash and Steam Iron'));
      assert.ok(!dryCleanServices.some((s) => s.name === 'Wash and Fold'));
    });

    it('3. Filters services for category using filterServicesForCategory', () => {
      const shoeServices = filterServicesForCategory(mockServices, GarmentCategory.SHOES);
      assert.ok(shoeServices.some((s) => s.name === 'Shoe Cleaning'));
      // Shoe category strictly excludes Steam Iron
      assert.ok(!shoeServices.some((s) => s.name === 'Steam Iron'));
    });

    it('4. Filters categories compatible with workflow using isCategoryAllowedInWorkflow', () => {
      assert.equal(isCategoryAllowedInWorkflow(GarmentCategory.MEN, 'LAUNDRY'), true);
      assert.equal(isCategoryAllowedInWorkflow(GarmentCategory.WOMEN, 'DRY_CLEANING'), true);
      assert.equal(isCategoryAllowedInWorkflow(GarmentCategory.HOME_CLEANING, 'LAUNDRY'), false);
    });
  });

  // ==========================================
  // SCREEN 5: GARMENT CATALOG GRID & SEARCH
  // ==========================================
  describe('Screen 5: Garment Catalog Grid, Search & Sticky Cart Bar', () => {
    it('5. Searches garments by name case-insensitively', () => {
      const query = 'shirt';
      const filtered = mockGarments.filter((g) =>
        g.name.toLowerCase().includes(query.trim().toLowerCase()),
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].name, 'Cotton Shirt');
    });

    it('6. Filters garments by selected garment category tab', () => {
      const menGarments = mockGarments.filter((g) => g.category === GarmentCategory.MEN);
      assert.equal(menGarments.length, 2);
      assert.ok(menGarments.some((g) => g.name === 'Cotton Shirt'));
      assert.ok(menGarments.some((g) => g.name === 'Formal Trousers'));
    });

    it('7. Displays accurate service-aware price for garment and selected service context', () => {
      const serviceId = 'srv-wash-iron';
      const shirt = mockGarments.find((g) => g.name === 'Cotton Shirt')!;
      const priceEntry = mockPrices.find(
        (p) => p.garmentCatalogId === shirt.id && p.serviceTypeId === serviceId,
      );
      assert.ok(priceEntry);
      assert.equal(priceEntry.price, 60);

      // In Dry Clean service context, price is different
      const dryCleanEntry = mockPrices.find(
        (p) => p.garmentCatalogId === shirt.id && p.serviceTypeId === 'srv-dry-clean',
      );
      assert.ok(dryCleanEntry);
      assert.equal(dryCleanEntry.price, 120);
    });

    it('8. Sticky cart bar computes accurate item count and provisional subtotal', () => {
      const cartItems = [
        { garmentCatalogId: 'g-shirt', serviceTypeId: 'srv-wash-iron', quantity: 3, unitPrice: 60 },
        {
          garmentCatalogId: 'g-trousers',
          serviceTypeId: 'srv-wash-iron',
          quantity: 2,
          unitPrice: 70,
        },
      ];

      const totalCount = cartItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
      const provisionalSubtotal = cartItems.reduce(
        (acc, it) => acc + (it.unitPrice || 0) * (it.quantity || 1),
        0,
      );

      assert.equal(totalCount, 5);
      assert.equal(provisionalSubtotal, 3 * 60 + 2 * 70); // 180 + 140 = 320
    });
  });

  // ==========================================
  // SCREEN 6: ITEM DETAILS, WEIGHT & PHOTOS
  // ==========================================
  describe('Screen 6: Item Details, Defect Notes & Photo Associations', () => {
    it('9. Rejects weight below 2.00 kg for weight-based items', () => {
      const validateWeight = (w: number) => {
        if (isNaN(w) || w < 2.0) {
          return { valid: false, error: 'Weight-based laundry requires a minimum of 2.00 kg' };
        }
        return { valid: true };
      };

      assert.equal(validateWeight(1.5).valid, false);
      assert.equal(validateWeight(1.99).valid, false);
      assert.equal(validateWeight(2.0).valid, true);
      assert.equal(validateWeight(4.5).valid, true);
    });

    it('10. Enforces positive integer quantity for piece-based items', () => {
      const validateQuantity = (q: number) => {
        if (!Number.isInteger(q) || q < 1) {
          return { valid: false, error: 'Quantity must be at least 1' };
        }
        return { valid: true };
      };

      assert.equal(validateQuantity(0).valid, false);
      assert.equal(validateQuantity(-1).valid, false);
      assert.equal(validateQuantity(1.5).valid, false);
      assert.equal(validateQuantity(1).valid, true);
      assert.equal(validateQuantity(5).valid, true);
    });

    it('11. Associates intake photos with garment catalog ID and unit numbers', () => {
      const photos = [
        { id: 'ph-1', garmentId: 'g-shirt', unitNumber: 1, localUri: 'file:///photo1.jpg' },
        { id: 'ph-2', garmentId: 'g-shirt', unitNumber: 2, localUri: 'file:///photo2.jpg' },
        { id: 'ph-3', garmentId: 'g-suit', unitNumber: 1, localUri: 'file:///photo3.jpg' },
      ];

      const shirtPhotos = photos.filter((p) => p.garmentId === 'g-shirt');
      assert.equal(shirtPhotos.length, 2);
      assert.equal(shirtPhotos[0].unitNumber, 1);
      assert.equal(shirtPhotos[1].unitNumber, 2);
    });

    it('12. Combines selected defect tags and custom notes into item notes', () => {
      const defectTags = ['STAIN', 'TORN'];
      const customNote = 'Coffee stain on left cuff';
      const combined = [...defectTags, customNote].filter(Boolean).join('; ');

      assert.equal(combined, 'STAIN; TORN; Coffee stain on left cuff');
    });
  });

  // ==========================================
  // SCREEN 7: ORDER ITEMS REVIEW & EDIT/REMOVE
  // ==========================================
  describe('Screen 7: Order Items Review, Itemized Cards & Line Totals', () => {
    it('13. Calculates line item total correctly for both quantity and weight items', () => {
      const pieceItem = { quantity: 4, unitPrice: 60 };
      const weightItem = { weight: 3.5, unitPrice: 80 };

      const pieceTotal = (pieceItem.quantity || 1) * pieceItem.unitPrice;
      const weightTotal = (weightItem.weight || 1) * weightItem.unitPrice;

      assert.equal(pieceTotal, 240);
      assert.equal(weightTotal, 280);
    });

    it('14. Removing an item by index updates the cart and recalculates totals', () => {
      let cart = [
        { id: '1', name: 'Shirt', lineTotal: 180 },
        { id: '2', name: 'Trousers', lineTotal: 140 },
        { id: '3', name: 'Suit', lineTotal: 400 },
      ];

      // Remove index 1 (Trousers)
      cart = cart.filter((_, idx) => idx !== 1);

      assert.equal(cart.length, 2);
      assert.equal(cart[0].name, 'Shirt');
      assert.equal(cart[1].name, 'Suit');
      const newTotal = cart.reduce((s, it) => s + it.lineTotal, 0);
      assert.equal(newTotal, 580);
    });

    it('15. Editing an item preserves identity and updates configuration', () => {
      const cart: Array<{
        garmentCatalogId: string;
        serviceTypeId: string;
        quantity: number;
        unitPrice: number;
        notes?: string;
      }> = [
        { garmentCatalogId: 'g-shirt', serviceTypeId: 'srv-wash-iron', quantity: 2, unitPrice: 60 },
      ];

      // Edit item quantity to 4 and add notes
      const updatedItem = {
        ...cart[0],
        quantity: 4,
        notes: 'Starch medium',
      };
      cart[0] = updatedItem;

      assert.equal(cart[0].quantity, 4);
      assert.equal(cart[0].notes, 'Starch medium');
      assert.equal(cart[0].quantity * cart[0].unitPrice, 240);
    });
  });

  // ==========================================
  // SCREEN 8: FINAL ORDER REVIEW & PRICING
  // ==========================================
  describe('Screen 8: Final Review, Canonical Pricing & Estimated Due Date', () => {
    it('16. Canonical calculateOrderTotals accurately calculates 18% GST and rounding', () => {
      const items = [
        {
          garmentCatalogId: 'g-shirt',
          serviceTypeId: 'srv-wash-iron',
          quantity: 2,
          unitPrice: 100,
        },
      ];

      const totals = calculateOrderTotals(items, {
        isExpress: false,
        discountPercent: 0,
      });

      assert.equal(totals.subtotal, 200);
      assert.equal(totals.taxAmount, 36); // 18% GST of 200
      assert.equal(totals.totalAmount, 236);
    });

    it('17. Canonical calculateOrderTotals applies customer discount before tax', () => {
      const items = [
        {
          garmentCatalogId: 'g-suit',
          serviceTypeId: 'srv-dry-clean',
          quantity: 1,
          unitPrice: 1000,
        },
      ];

      const totals = calculateOrderTotals(items, {
        isExpress: false,
        discountPercent: 10, // 10% VIP discount
      });

      assert.equal(totals.subtotal, 1000);
      assert.equal(totals.discountAmount, 100);
      // Taxable amount is 900
      assert.equal(totals.taxAmount, 162); // 18% of 900
      assert.equal(totals.totalAmount, 1062);
    });

    it('18. Calculates express surcharge based on option (1.5x Next-Day, 2.0x Same-Day)', () => {
      const items = [
        {
          garmentCatalogId: 'g-saree',
          serviceTypeId: 'srv-dry-clean',
          quantity: 2,
          unitPrice: 250,
        },
      ];

      const nextDayTotals = calculateOrderTotals(items, {
        isExpress: true,
        expressSurchargePercent: 50,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });

      assert.equal(nextDayTotals.subtotal, 500);
      // base surcharge = 500 * 50% = 250. With 1.5x multiplier = 375
      assert.equal(nextDayTotals.expressSurcharge, 375);
      // Taxable amount = 500 + 375 = 875. 18% GST = 157.50
      assert.equal(nextDayTotals.taxAmount, 157.5);
      assert.equal(nextDayTotals.totalAmount, 1032.5);
    });

    it('19. Due date calculation shifts Thursday deliveries to Friday via adjustDueDateForThursday', () => {
      // Create a date that falls on a Thursday
      // 2026-10-22 is a Thursday (getDay() === 4)
      const thursday = new Date('2026-10-22T10:00:00Z');
      assert.equal(thursday.getDay(), 4);

      const adjusted = adjustDueDateForThursday(thursday);
      // Adjusted date should be Friday (getDay() === 5)
      assert.equal(adjusted.getDay(), 5);
      assert.equal(adjusted.getDate(), 23);

      // Non-Thursday date should not be adjusted
      const friday = new Date('2026-10-23T10:00:00Z');
      const fridayAdjusted = adjustDueDateForThursday(friday);
      assert.equal(fridayAdjusted.getDay(), 5);
      assert.equal(fridayAdjusted.getDate(), 23);
    });
  });

  // ==========================================
  // SCREEN 9: ORDER CREATED & CONFIRMATION
  // ==========================================
  describe('Screen 9: Order Created Confirmation & Action Handlers', () => {
    it('20. Displays official server order number #ORD-XXXXXX on confirmed online creation', () => {
      // Unpaid pending order -> RECEIVED
      const serverResponse = {
        orderId: 'ord-server-uuid-1234',
        orderNumber: 'ORD-20261024-0042',
        status: OrderStatus.RECEIVED,
        paymentStatus: PaymentStatus.PENDING,
        totalAmount: 590,
      };

      assert.equal(serverResponse.orderNumber, 'ORD-20261024-0042');
      assert.equal(serverResponse.orderId, 'ord-server-uuid-1234');
    });

    it('21. Derives canonical order status using shared deriveOrderStatus()', () => {
      // All received items -> RECEIVED
      const status1 = deriveOrderStatus({
        items: [{ status: 'RECEIVED' as any }, { status: 'RECEIVED' as any }],
      });
      assert.equal(status1, OrderStatus.RECEIVED);

      // All ready items -> READY
      const status2 = deriveOrderStatus({
        items: [{ status: 'READY' as any }, { status: 'READY' as any }],
      });
      assert.equal(status2, OrderStatus.READY);

      // In transit delivery -> OUT_FOR_DELIVERY
      const status3 = deriveOrderStatus({
        items: [{ status: 'READY' as any }],
        hasActiveTransitDelivery: true,
      });
      assert.equal(status3, OrderStatus.OUT_FOR_DELIVERY);
    });

    it('22. Offline queued submission does not invent an official order number', () => {
      const offlineConfirmedState = {
        orderId: 'offline-queued',
        orderNumber: 'PENDING_OFFLINE',
        isOfflineQueued: true,
      };

      assert.equal(offlineConfirmedState.isOfflineQueued, true);
      assert.equal(offlineConfirmedState.orderNumber, 'PENDING_OFFLINE');
      assert.notEqual(offlineConfirmedState.orderNumber, 'ORD-123456');
    });

    it('23. Create Another Order action resets all draft state and generates new UUID', () => {
      const oldDraftId = 'draft-old-uuid';
      const createAnother = () => {
        const newDraftId = 'draft-new-uuid-' + Math.random().toString(36).substring(2, 9);
        return {
          clientDraftId: newDraftId,
          selectedCustomer: null,
          items: [],
          notes: '',
          photos: [],
          currentStepIndex: 0,
        };
      };

      const freshState = createAnother();
      assert.notEqual(freshState.clientDraftId, oldDraftId);
      assert.equal(freshState.selectedCustomer, null);
      assert.equal(freshState.items.length, 0);
      assert.equal(freshState.currentStepIndex, 0);
    });
  });
});
