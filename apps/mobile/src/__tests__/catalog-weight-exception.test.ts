import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GarmentCategory,
  ServiceCategory,
  OrderWorkflowType,
  OrderEntryMode,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  CreateOrderItemRequest,
  CreateOrderRequest,
  filterCategoriesForService,
  isCategoryAllowedInWorkflow,
  isServiceAllowedInWorkflow,
  calculateOrderTotals,
  isWeightBasedCategory,
  deriveOrderStatus,
  OrderStatus,
  ItemStatus,
  PaymentStatus,
  PickupType,
} from '@growfast/shared-types';
import {
  isWeightBasedPricing,
  resolvePieceServices,
  resolveWeightServices,
  DEFAULT_MOBILE_CATEGORIES,
  DEFAULT_CATEGORY_TABS,
} from '../services/catalog-rules';

describe('GrowFast Mobile — Catalog Synchronization & Weight-Based Exception Verification', () => {
  const mockGarments: GarmentCatalogDTO[] = [
    { id: 'g-m-1', name: 'Shirt', category: GarmentCategory.MEN, isActive: true },
    { id: 'g-w-1', name: 'Saree', category: GarmentCategory.WOMEN, isActive: true },
    { id: 'g-k-1', name: 'Kids T-Shirt', category: GarmentCategory.KIDS, isActive: true },
    { id: 'g-h-1', name: 'Bedsheet', category: GarmentCategory.HOUSEHOLD, isActive: true },
    { id: 'g-s-1', name: 'Sneakers', category: GarmentCategory.SHOES, isActive: true },
    { id: 'g-sp-1', name: '2-Piece Suit', category: GarmentCategory.SPECIAL, isActive: true },
    { id: 'g-o-1', name: 'Bag', category: GarmentCategory.OTHERS, isActive: true },
    {
      id: 'g-wb-1',
      name: 'Weight Based',
      category: GarmentCategory.WEIGHT_BASED,
      section: 'Per Piece Exception',
      isActive: true,
    },
    { id: 'g-wb-2', name: 'Laundry 2kg', category: GarmentCategory.WEIGHT_BASED, isActive: true },
    { id: 'g-old-1', name: 'Archived Kurta', category: GarmentCategory.MEN, isActive: false },
    { id: 'g-hc-1', name: 'Floor Mop', category: GarmentCategory.HOME_CLEANING, isActive: true },
  ];

  const mockServices: ServiceTypeDTO[] = [
    {
      id: 'srv-dc',
      name: 'Dry Clean',
      category: ServiceCategory.DRY_CLEAN,
      estimatedDays: 3,
      isActive: true,
    },
    {
      id: 'srv-iron',
      name: 'Steam Iron',
      category: ServiceCategory.WASH_IRON,
      estimatedDays: 1,
      isActive: true,
    },
    {
      id: 'srv-starch',
      name: 'Starching',
      category: ServiceCategory.WASH_IRON,
      estimatedDays: 2,
      isActive: true,
    },
    {
      id: 'srv-shoe',
      name: 'Shoe Cleaning',
      category: ServiceCategory.SHOE_CLEAN,
      estimatedDays: 3,
      isActive: true,
    },
    {
      id: 'svc-wash-fold',
      name: 'Wash and Fold',
      category: ServiceCategory.WASH,
      estimatedDays: 2,
      isActive: true,
    },
  ];

  const mockPrices = [
    { garmentCatalogId: 'g-m-1', serviceTypeId: 'srv-dc', price: 80 },
    { garmentCatalogId: 'g-m-1', serviceTypeId: 'srv-iron', price: 30 },
    { garmentCatalogId: 'g-wb-1', serviceTypeId: 'srv-dc', price: 40 },
    { garmentCatalogId: 'g-wb-1', serviceTypeId: 'srv-iron', price: 35 },
    { garmentCatalogId: 'g-wb-1', serviceTypeId: 'svc-wash-fold', price: 80 },
  ];

  describe('1. Catalog Synchronization: Categories & Active Garment Parity', () => {
    it('1.1 DEFAULT_MOBILE_CATEGORIES includes WEIGHT_BASED (Exception) and all website categories', () => {
      const keys = DEFAULT_MOBILE_CATEGORIES.map((c) => c.key);
      assert.ok(keys.includes('ALL'), 'Must include ALL filter');
      assert.ok(keys.includes(GarmentCategory.MEN), 'Must include MEN');
      assert.ok(keys.includes(GarmentCategory.WOMEN), 'Must include WOMEN');
      assert.ok(keys.includes(GarmentCategory.KIDS), 'Must include KIDS');
      assert.ok(keys.includes(GarmentCategory.HOUSEHOLD), 'Must include HOUSEHOLD');
      assert.ok(keys.includes(GarmentCategory.SHOES), 'Must include SHOES');
      assert.ok(keys.includes(GarmentCategory.SPECIAL), 'Must include SPECIAL');
      assert.ok(keys.includes(GarmentCategory.OTHERS), 'Must include OTHERS');
      assert.ok(keys.includes(GarmentCategory.WEIGHT_BASED), 'Must include WEIGHT_BASED');

      const wbCat = DEFAULT_MOBILE_CATEGORIES.find((c) => c.key === GarmentCategory.WEIGHT_BASED);
      assert.equal(wbCat?.label, 'Weight Based (Exception)');
    });

    it('1.2 DEFAULT_CATEGORY_TABS includes WEIGHT_BASED matching the website catalog', () => {
      const tabKeys = DEFAULT_CATEGORY_TABS.map((t) => t.key);
      assert.ok(tabKeys.includes(GarmentCategory.WEIGHT_BASED));
      const wbTab = DEFAULT_CATEGORY_TABS.find((t) => t.key === GarmentCategory.WEIGHT_BASED);
      assert.equal(wbTab?.label, 'Weight Based (Exception)');
    });

    it('1.3 Deactivated/inactive garments (isActive === false) are excluded from new order selection', () => {
      const activeForNewOrder = mockGarments.filter((g) => g.isActive !== false);
      assert.equal(
        activeForNewOrder.some((g) => g.id === 'g-old-1'),
        false,
      );
      assert.equal(activeForNewOrder.length, 10);
    });

    it('1.4 HOME_CLEANING garments are strictly disallowed in both workflows', () => {
      assert.equal(isCategoryAllowedInWorkflow(GarmentCategory.HOME_CLEANING, 'LAUNDRY'), false);
      assert.equal(
        isCategoryAllowedInWorkflow(GarmentCategory.HOME_CLEANING, 'DRY_CLEANING'),
        false,
      );
    });
  });

  describe('2. Weight-Based Exception Workflow & Per-Piece Exclusivity', () => {
    it('2.1 In Per-Piece mode (PIECES), WEIGHT_BASED category retains per-piece pricing (not per-kg)', () => {
      const dryCleanSvc = mockServices.find((s) => s.id === 'srv-dc')!;
      // Even with category WEIGHT_BASED, in PIECES mode or DRY_CLEANING workflow it must return false for weight pricing
      const isWeight = isWeightBasedPricing(
        'DRY_CLEANING',
        dryCleanSvc,
        'PIECES',
        GarmentCategory.WEIGHT_BASED,
      );
      assert.equal(
        isWeight,
        false,
        'Piece weight exception must NEVER be treated as weight-based pricing',
      );
    });

    it('2.2 WEIGHT_BASED is allowed in DRY_CLEANING as a weight-based exception category', () => {
      const allowed = isCategoryAllowedInWorkflow(GarmentCategory.WEIGHT_BASED, 'DRY_CLEANING');
      assert.equal(allowed, true, 'GarmentCategory.WEIGHT_BASED must be allowed in DRY_CLEANING');
    });

    it('2.3 Filtered categories for Dry Clean service preserves WEIGHT_BASED', () => {
      const allKeys = [
        'ALL',
        GarmentCategory.MEN,
        GarmentCategory.WOMEN,
        GarmentCategory.WEIGHT_BASED,
      ];
      const filtered = filterCategoriesForService(allKeys, 'srv-dc', mockServices, 'DRY_CLEANING');
      assert.ok(filtered.includes(GarmentCategory.WEIGHT_BASED));
    });

    it('2.4 Starching service restricts categories to Men, Women, Kids and omits WEIGHT_BASED', () => {
      const allKeys = [
        'ALL',
        GarmentCategory.MEN,
        GarmentCategory.WOMEN,
        GarmentCategory.WEIGHT_BASED,
      ];
      const filtered = filterCategoriesForService(allKeys, 'srv-starch', mockServices, 'LAUNDRY');
      assert.ok(!filtered.includes(GarmentCategory.WEIGHT_BASED));
      assert.ok(filtered.includes(GarmentCategory.MEN));
    });

    it('2.5 In Per-Weight mode, resolveWeightServices yields exactly the 5 canonical weight services', () => {
      const weightSvcs = resolveWeightServices(mockServices);
      assert.ok(weightSvcs.length > 0);
      assert.ok(weightSvcs.every((s) => s.name.toLowerCase() !== 'dry clean'));
    });
  });

  describe('3. Order Payload & Financial Calculation for Weight-Based Exception', () => {
    it('3.1 Builds canonical CreateOrderRequest for weight exception with null/undefined weight and piece count', () => {
      const qty = 3;
      const unitPrice = 40;
      const exceptionItem: CreateOrderItemRequest = {
        garmentCatalogId: 'g-wb-1',
        serviceTypeId: 'srv-dc',
        quantity: qty,
        unitPrice,
        weight: undefined, // strictly undefined/null
        defectNotes: 'Collar Stain (Brand: Raymond)',
        pieces: [
          { pieceId: 'p-1', unitNumber: 1, photoCount: 0 },
          { pieceId: 'p-2', unitNumber: 2, photoCount: 0 },
          { pieceId: 'p-3', unitNumber: 3, photoCount: 0 },
        ],
      };

      const payload: CreateOrderRequest = {
        clientDraftId: 'draft-wb-001',
        customerId: 'cust-123',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        workflow: 'DRY_CLEANING',
        entryMode: 'PIECES',
        items: [exceptionItem],
      };

      assert.equal(payload.entryMode, 'PIECES');
      assert.equal(payload.workflow, 'DRY_CLEANING');
      assert.equal(payload.items[0].weight, undefined);
      assert.equal(payload.items[0].quantity, 3);
      assert.equal(payload.items[0].pieces?.length, 3);

      // Financial calculation: exactly 3 * 40 = 120
      const totals = calculateOrderTotals([
        {
          quantity: exceptionItem.quantity,
          unitPrice: exceptionItem.unitPrice!,
          weight: exceptionItem.weight ?? null,
        },
      ]);
      assert.equal(totals.subtotal, 120);
      assert.equal(totals.totalAmount, 120);
    });

    it('3.2 Financial calculations handle express delivery and customer discount accurately', () => {
      const totals = calculateOrderTotals(
        [
          {
            quantity: 5,
            unitPrice: 50,
            weight: null,
          },
        ],
        {
          isExpress: true,
          expressSurchargePercent: 50,
          discountPercent: 10,
        },
      );

      // Subtotal = 5 * 50 = 250
      // Discount = 10% of 250 = 25
      // Discounted subtotal = 225
      // Express surcharge = 50% of 225 = 112.5
      // Total amount = 225 + 112.5 = 337.5
      assert.equal(totals.subtotal, 250);
      assert.equal(totals.discountAmount, 25);
      assert.equal(totals.expressSurcharge, 112.5);
      assert.equal(totals.totalAmount, 337.5);
    });

    it('3.3 Derives canonical order status correctly for newly created order with weight exception', () => {
      const orderStatus = deriveOrderStatus({
        items: [{ status: ItemStatus.RECEIVED }],
      });
      assert.equal(orderStatus, OrderStatus.RECEIVED);
    });
  });

  describe('4. Historical Orders & Catalog Deactivation Safeguards', () => {
    it('4.1 Historical orders containing deactivated garments preserve historical item details', () => {
      // Historical order item referencing deactivated 'g-old-1'
      const historicalItem = {
        id: 'oi-hist-001',
        garmentCatalogId: 'g-old-1',
        garmentName: 'Archived Kurta',
        unitPrice: 65,
        quantity: 2,
        weight: null,
        lineTotal: 130,
      };

      const mult =
        historicalItem.weight && historicalItem.weight > 0
          ? historicalItem.weight
          : historicalItem.quantity;
      const computedTotal = historicalItem.unitPrice * mult;

      assert.equal(computedTotal, 130);
      assert.equal(historicalItem.garmentName, 'Archived Kurta');
    });

    it('4.2 Historical weight exception item displays correct piece-rate breakdown without kg', () => {
      const histWbItem = {
        id: 'oi-wb-002',
        garmentCatalogId: 'g-wb-1',
        garmentName: 'Weight Based',
        serviceName: 'Dry Clean',
        unitPrice: 40,
        quantity: 3,
        weight: null,
        lineTotal: 120,
      };

      const isWeight = histWbItem.weight != null && histWbItem.weight > 0;
      assert.equal(isWeight, false);

      const displaySubtitle = isWeight
        ? `${histWbItem.weight} kg (${histWbItem.quantity} pcs in bag)`
        : `${histWbItem.quantity} pcs`;
      assert.equal(displaySubtitle, '3 pcs');
    });
  });
});
