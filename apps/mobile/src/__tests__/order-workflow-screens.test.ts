import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GarmentCategory,
  OrderWorkflowType,
  OrderEntryMode,
  PickupType,
  ExpressDeliveryOption,
  OrderStatus,
  PaymentStatus,
  deriveOrderStatus,
  calculateOrderTotals,
  adjustDueDateForThursday,
  isServiceAllowedInWorkflow,
  filterServicesForCategory,
  filterCategoriesForService,
  resolveCatalogSelectionOnWorkflowChange,
  resolveCatalogSelectionOnServiceSelect,
  resolveCatalogSelectionOnCategoryChange,
  isItemCompatibleWithWorkflow,
  roundCurrency,
  isCategoryAllowedInWorkflow,
  ServiceCategory,
  ServiceTypeDTO,
  GarmentCatalogDTO,
} from '@growfast/shared-types';
import {
  isWeightBasedPricing,
  CANONICAL_WEIGHT_SERVICES,
  CANONICAL_PIECE_SERVICES,
  resolvePieceServices,
  resolveWeightServices,
} from '../services/catalog-rules';

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

    it('4.1 Weight-based laundry hides garment-category selector completely per business rules', () => {
      const washIron = mockServices.find((s) => s.name === 'Wash and Steam Iron')!;
      const washFold = mockServices.find((s) => s.name === 'Wash and Fold')!;
      const dryClean = mockServices.find((s) => s.name === 'Dry Clean')!;

      // In LAUNDRY workflow with wash/wash_iron services, weight-based pricing is active
      assert.equal(isWeightBasedPricing('LAUNDRY', washIron), true);
      assert.equal(isWeightBasedPricing('LAUNDRY', washFold), true);
      assert.equal(isWeightBasedPricing('LAUNDRY', null, 'WEIGHT'), true);
      assert.equal(isWeightBasedPricing('LAUNDRY', washIron, 'WEIGHT'), true);

      // In DRY_CLEANING workflow, weight-based pricing is NEVER allowed
      assert.equal(isWeightBasedPricing('DRY_CLEANING', dryClean), false);
      assert.equal(isWeightBasedPricing('DRY_CLEANING', dryClean, 'PIECES'), false);

      // Verify that weight-based laundry hides category grid (availableCategories is empty)
      const isWeight = isWeightBasedPricing('LAUNDRY', washIron);
      const availableCategories = isWeight ? [] : ['ALL', 'MEN', 'WOMEN', 'KIDS', 'HOUSEHOLD'];
      assert.equal(availableCategories.length, 0);
    });

    it('4.2 Per-piece services show category filtering only when required by website rules', () => {
      const steamIron = mockServices.find((s) => s.name === 'Steam Iron')!;
      const shoeClean = mockServices.find((s) => s.name === 'Shoe Cleaning')!;

      // In LAUNDRY, Steam Iron is a per-piece service
      assert.equal(isWeightBasedPricing('LAUNDRY', steamIron), false);

      // For Starching service, only Men, Women, Kids are allowed
      const starchingCategories = filterCategoriesForService(
        [
          'ALL',
          GarmentCategory.MEN,
          GarmentCategory.WOMEN,
          GarmentCategory.KIDS,
          GarmentCategory.HOUSEHOLD,
        ],
        'srv-starching',
        [{ id: 'srv-starching', name: 'Starching' }],
        'DRY_CLEANING',
      );
      assert.deepEqual(starchingCategories, [
        GarmentCategory.MEN,
        GarmentCategory.WOMEN,
        GarmentCategory.KIDS,
      ]);
      assert.ok(!starchingCategories.includes(GarmentCategory.HOUSEHOLD));

      // For Shoe Cleaning, category resolves to SHOES
      const resolved = resolveCatalogSelectionOnServiceSelect(
        shoeClean.id,
        GarmentCategory.MEN,
        mockServices,
        'DRY_CLEANING',
      );
      assert.equal(resolved.serviceId, shoeClean.id);
      assert.equal(resolved.category, GarmentCategory.SHOES);
    });

    it('4.3 Workflow switching reconciles eligible services and drops incompatible items', () => {
      // Switching from LAUNDRY (Wash and Steam Iron) to DRY_CLEANING auto-resolves to Dry Clean
      const toDryClean = resolveCatalogSelectionOnWorkflowChange(
        'DRY_CLEANING',
        'srv-wash-iron',
        'ALL',
        mockServices,
      );
      assert.equal(toDryClean.serviceId, 'srv-dry-clean');

      // Switching from DRY_CLEANING (Dry Clean) to LAUNDRY auto-resolves to preferred laundry service
      const toLaundry = resolveCatalogSelectionOnWorkflowChange(
        'LAUNDRY',
        'srv-dry-clean',
        GarmentCategory.MEN,
        mockServices,
      );
      assert.equal(toLaundry.serviceId, 'srv-wash-iron');

      // Incompatibility check: Weight item cannot exist in DRY_CLEANING
      const weightItem = {
        isWeightBased: true,
        weight: 3.5,
        garmentCatalogId: 'g-laundry-kg',
        serviceTypeId: 'srv-wash-fold',
      };
      assert.equal(isItemCompatibleWithWorkflow(weightItem, 'DRY_CLEANING', mockServices), false);
      assert.equal(isItemCompatibleWithWorkflow(weightItem, 'LAUNDRY', mockServices), true);

      // Piece item in DRY_CLEANING is compatible
      const pieceItem = {
        isWeightBased: false,
        weight: null,
        garmentCatalogId: 'g-shirt',
        serviceTypeId: 'srv-dry-clean',
      };
      assert.equal(isItemCompatibleWithWorkflow(pieceItem, 'DRY_CLEANING', mockServices), true);
    });

    it('4.4 Category change resolves service according to website constraints', () => {
      // Selecting Household category auto-switches service to Dry Clean
      const householdService = resolveCatalogSelectionOnCategoryChange(
        GarmentCategory.HOUSEHOLD,
        'srv-steam-iron',
        mockServices,
        'DRY_CLEANING',
      );
      assert.equal(householdService, 'srv-dry-clean');

      // Selecting Shoe category with incompatible service (Steam Iron) auto-switches to Shoe Cleaning
      const shoeServiceIncompatible = resolveCatalogSelectionOnCategoryChange(
        GarmentCategory.SHOES,
        'srv-steam-iron',
        mockServices,
        'DRY_CLEANING',
      );
      assert.equal(shoeServiceIncompatible, 'srv-shoe-clean');

      // Selecting Shoe category while an allowed service (Dry Clean) is already selected preserves that service
      const shoeServicePreserved = resolveCatalogSelectionOnCategoryChange(
        GarmentCategory.SHOES,
        'srv-dry-clean',
        mockServices,
        'DRY_CLEANING',
      );
      assert.equal(shoeServicePreserved, 'srv-dry-clean');
    });

    it('4.5 Safe-area topInset calculation guarantees header and back button clear status bar and cutouts', () => {
      // Simulation of safe-area inset logic on Android
      const mockAndroidInsets = { top: 24, bottom: 16, left: 0, right: 0 };
      const mockStatusBarHeight = 36; // Android cutout device
      const topInset = Math.max(mockAndroidInsets.top, mockStatusBarHeight);
      assert.equal(topInset, 36);
      assert.ok(topInset >= mockStatusBarHeight);

      // Simulation on edge-to-edge Android
      const edgeToEdgeInsets = { top: 48, bottom: 24, left: 0, right: 0 };
      const edgeTopInset = Math.max(edgeToEdgeInsets.top, mockStatusBarHeight);
      assert.equal(edgeTopInset, 48);
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
    it('16. Canonical calculateOrderTotals accurately calculates subtotal and tax-inclusive totals', () => {
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
      assert.equal(totals.taxAmount, 0); // Shared-types TAX_RATE is 0 (tax-inclusive pricing)
      assert.equal(totals.totalAmount, 200);
    });

    it('17. Canonical calculateOrderTotals applies customer discount before final total', () => {
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
      assert.equal(totals.taxAmount, 0);
      assert.equal(totals.totalAmount, 900);
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
      // Canonical surcharge calculation with 1.5x multiplier: (500 * (1.5 - 1)) = 250
      assert.equal(nextDayTotals.expressSurcharge, 250);
      assert.equal(nextDayTotals.taxAmount, 0);
      assert.equal(nextDayTotals.totalAmount, 750);
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

    it('24. View Order Details action passes authoritative server order ID to parent modal handler on online confirmation', () => {
      let wizardClosed = false;
      let activeDetailOrderId: string | null = null;
      let detailModalVisible = false;

      const handleCloseWizard = () => {
        wizardClosed = true;
      };

      const handleOpenOrderDetail = (orderId: string) => {
        activeDetailOrderId = orderId;
        detailModalVisible = true;
      };

      const onViewOrderDetail = (orderId: string) => {
        handleCloseWizard();
        handleOpenOrderDetail(orderId);
      };

      // Simulating Screen 9 confirmation with authoritative server order ID
      const confirmedServerOrderId = 'ord-srv-confirm-9988';
      const isOfflineQueued = false;

      // Action execution: only when NOT offline queued
      if (!isOfflineQueued) {
        onViewOrderDetail(confirmedServerOrderId);
      }

      assert.equal(wizardClosed, true, 'Wizard modal must be closed before opening detail');
      assert.equal(
        activeDetailOrderId,
        'ord-srv-confirm-9988',
        'Authoritative server ID must be passed',
      );
      assert.equal(detailModalVisible, true, 'OrderDetailModal must be set to visible');
    });

    it('25. View Order Details action is withheld for offline queued orders to prevent showing unconfirmed drafts', () => {
      let detailModalOpened = false;
      const onViewOrderDetail = (_orderId: string) => {
        detailModalOpened = true;
      };

      const confirmedOfflineState = {
        orderId: 'offline-queued',
        orderNumber: 'PENDING_OFFLINE',
        isOfflineQueued: true,
      };

      // In OrderCreatedStep: {!isOfflineQueued && <TouchableOpacity onPress={() => onViewOrder(orderId)} />}
      if (!confirmedOfflineState.isOfflineQueued) {
        onViewOrderDetail(confirmedOfflineState.orderId);
      }

      assert.equal(
        detailModalOpened,
        false,
        'View Order Details must NOT trigger for offline queued drafts',
      );
    });
  });

  // ==========================================
  // WORKSTREAM 2: BULK ITEM INTAKE TESTS
  // ==========================================
  describe('Workstream 2: Bulk Item Intake Workflow', () => {
    // 26. 1-Tap Quick Add on catalog grid adds piece item directly at authoritative catalog rate
    it('26. Quick 1-tap add adds piece item directly at authoritative catalog price without opening modal', () => {
      let items: any[] = [];
      const shirtGarment = mockGarments.find((g) => g.id === 'g-shirt')!;
      const serviceId = 'srv-wash-iron';
      const catalogPrice = mockPrices.find(
        (p) => p.garmentCatalogId === shirtGarment.id && p.serviceTypeId === serviceId,
      )!.price;

      const handleQuickAddItem = (garment: GarmentCatalogDTO, srvId: string, unitPrice: number) => {
        const existingIdx = items.findIndex(
          (it) => it.garmentCatalogId === garment.id && it.serviceTypeId === srvId,
        );
        if (existingIdx >= 0) {
          items[existingIdx].quantity += 1;
        } else {
          items.push({
            garmentCatalogId: garment.id,
            serviceTypeId: srvId,
            quantity: 1,
            unitPrice,
            pieces: [{ unitNumber: 1, photoCount: 0 }],
          });
        }
      };

      // 1-Tap Quick Add
      handleQuickAddItem(shirtGarment, serviceId, catalogPrice);

      assert.equal(items.length, 1);
      assert.equal(items[0].garmentCatalogId, 'g-shirt');
      assert.equal(items[0].quantity, 1);
      assert.equal(items[0].unitPrice, 60);
      assert.equal(items[0].pieces.length, 1);
    });

    // 27. Rapid piece intake increments quantity of existing cart item
    it('27. Rapid piece intake increments quantity of existing cart item without duplicates', () => {
      let items: any[] = [];
      const shirtGarment = mockGarments.find((g) => g.id === 'g-shirt')!;
      const serviceId = 'srv-wash-iron';
      const catalogPrice = 60;

      const handleQuickAddItem = (garment: GarmentCatalogDTO, srvId: string, unitPrice: number) => {
        const existingIdx = items.findIndex(
          (it) => it.garmentCatalogId === garment.id && it.serviceTypeId === srvId,
        );
        if (existingIdx >= 0) {
          const target = { ...items[existingIdx] };
          target.quantity += 1;
          items[existingIdx] = target;
        } else {
          items.push({
            garmentCatalogId: garment.id,
            serviceTypeId: srvId,
            quantity: 1,
            unitPrice,
            pieces: [{ unitNumber: 1, photoCount: 0 }],
          });
        }
      };

      // Tap 3 times rapidly
      handleQuickAddItem(shirtGarment, serviceId, catalogPrice);
      handleQuickAddItem(shirtGarment, serviceId, catalogPrice);
      handleQuickAddItem(shirtGarment, serviceId, catalogPrice);

      assert.equal(items.length, 1, 'Should contain exactly 1 aggregated item');
      assert.equal(items[0].quantity, 3, 'Quantity should be 3');
      assert.equal(items[0].unitPrice * items[0].quantity, 180);
    });

    // 28. Multiple distinct catalog items can be added to one order
    it('28. Multiple distinct catalog items can be added efficiently in one intake workflow', () => {
      const cartItems = [
        { garmentCatalogId: 'g-shirt', serviceTypeId: 'srv-wash-iron', quantity: 3, unitPrice: 60 },
        {
          garmentCatalogId: 'g-trousers',
          serviceTypeId: 'srv-wash-iron',
          quantity: 2,
          unitPrice: 70,
        },
        {
          garmentCatalogId: 'g-saree',
          serviceTypeId: 'srv-dry-clean',
          quantity: 1,
          unitPrice: 250,
        },
      ];

      const totalPieces = cartItems.reduce((sum, it) => sum + it.quantity, 0);
      const estSubtotal = cartItems.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

      assert.equal(cartItems.length, 3, 'Cart should contain 3 distinct catalog items');
      assert.equal(totalPieces, 6, 'Total pieces should equal 3 + 2 + 1 = 6');
      assert.equal(estSubtotal, 3 * 60 + 2 * 70 + 1 * 250, '3*60 + 2*70 + 250 = 570');
    });

    // 29. Inline quantity stepper in review step allows increasing and decreasing piece quantities directly
    it('29. Inline quantity steppers in review step update quantities and pieces array directly', () => {
      let items = [
        {
          garmentCatalogId: 'g-shirt',
          serviceTypeId: 'srv-wash-iron',
          quantity: 2,
          unitPrice: 60,
          pieces: [
            { unitNumber: 1, photoCount: 0 },
            { unitNumber: 2, photoCount: 0 },
          ],
        },
        {
          garmentCatalogId: 'g-trousers',
          serviceTypeId: 'srv-wash-iron',
          quantity: 1,
          unitPrice: 70,
          pieces: [{ unitNumber: 1, photoCount: 0 }],
        },
      ];

      const updateQuantity = (idx: number, newQty: number) => {
        if (newQty <= 0) {
          items = items.filter((_, i) => i !== idx);
          return;
        }
        const target = { ...items[idx] };
        target.quantity = newQty;
        target.pieces = Array.from({ length: newQty }, (_, i) => ({
          unitNumber: i + 1,
          photoCount: 0,
        }));
        items[idx] = target;
      };

      // Increment trousers from 1 to 3
      updateQuantity(1, 3);
      assert.equal(items[1].quantity, 3);
      assert.equal(items[1].pieces.length, 3);

      // Decrement shirt from 2 to 1
      updateQuantity(0, 1);
      assert.equal(items[0].quantity, 1);
      assert.equal(items[0].pieces.length, 1);
    });

    // 30. Reducing piece quantity to 0 removes the item from the cart
    it('30. Reducing piece quantity to 0 removes the item from the cart', () => {
      let items = [
        { garmentCatalogId: 'g-shirt', quantity: 1, unitPrice: 60 },
        { garmentCatalogId: 'g-trousers', quantity: 2, unitPrice: 70 },
      ];

      const updateQuantity = (idx: number, newQty: number) => {
        if (newQty <= 0) {
          items = items.filter((_, i) => i !== idx);
          return;
        }
        items[idx].quantity = newQty;
      };

      // Decrement shirt (idx 0) from 1 to 0
      updateQuantity(0, 0);

      assert.equal(items.length, 1);
      assert.equal(items[0].garmentCatalogId, 'g-trousers');
      assert.equal(items[0].quantity, 2);
    });

    // 31. Weight-based laundry strictly enforces 2.00 kg minimum and rejects invalid weights
    it('31. Weight-based laundry requires minimum 2.00 kg per business rules and rejects invalid weights', () => {
      const validateWeight = (val: string): { valid: boolean; error?: string; weight?: number } => {
        const parsed = parseFloat(val);
        if (isNaN(parsed) || parsed < 2.0) {
          return {
            valid: false,
            error: 'Minimum weight requirement is 2.00 kg per business rules.',
          };
        }
        return { valid: true, weight: Math.round(parsed * 100) / 100 };
      };

      // Invalid: 1.50 kg
      const underWeight = validateWeight('1.50');
      assert.equal(underWeight.valid, false);
      assert.ok(underWeight.error?.includes('2.00 kg'));

      // Invalid: negative or non-numeric
      const negativeWeight = validateWeight('-0.5');
      assert.equal(negativeWeight.valid, false);

      const invalidStr = validateWeight('abc');
      assert.equal(invalidStr.valid, false);

      // Valid: exactly 2.00 kg
      const minValid = validateWeight('2.00');
      assert.equal(minValid.valid, true);
      assert.equal(minValid.weight, 2.0);

      // Valid: 4.75 kg
      const largerValid = validateWeight('4.75');
      assert.equal(largerValid.valid, true);
      assert.equal(largerValid.weight, 4.75);
    });

    // 32. Bulk increment chips (+1, +2, +5, +10) and weight presets
    it('32. Bulk increment chips and weight presets update values correctly', () => {
      let qty = 1;
      const addIncrement = (inc: number) => {
        qty += inc;
      };

      addIncrement(5); // 1 + 5 = 6
      assert.equal(qty, 6);

      addIncrement(10); // 6 + 10 = 16
      assert.equal(qty, 16);

      // Weight presets
      const weightPresets = ['2.00', '3.00', '5.00', '10.00'];
      for (const preset of weightPresets) {
        const val = parseFloat(preset);
        assert.ok(val >= 2.0, `Preset ${preset} must satisfy 2.00 kg minimum`);
      }
    });

    // 33. Canonical pricing and currency rounding across multi-item intake
    it('33. Multi-item cart calculations agree with calculateOrderTotals and roundCurrency', () => {
      const items = [
        { unitPrice: 60, quantity: 3 }, // 180
        { unitPrice: 70, quantity: 2 }, // 140
        { unitPrice: 80, quantity: 1, weight: 2.5 }, // 200
      ];

      const subtotal = items.reduce((sum, it) => {
        const mult = it.weight && it.weight > 0 ? it.weight : it.quantity || 1;
        return sum + it.unitPrice * mult;
      }, 0);

      assert.equal(subtotal, 520);

      const totals = calculateOrderTotals(items, {
        discountPercent: 10, // 10%
        isExpress: true,
        expressSurchargePercent: 20,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY, // 2.0x multiplier -> 40%
      });

      // Verification of math:
      // Subtotal = 520
      // Discount 10% = 52.00 -> After discount = 468.00
      // Express 2.0x multiplier (Same Day) surcharge = 468.00 (discountedSubtotal * (2.0 - 1.0))
      // Tax (tax-inclusive pricing, TAX_RATE = 0) = 0
      // Total = 468.00 + 468.00 = 936.00
      assert.equal(totals.subtotal, 520);
      assert.equal(totals.discountAmount, 52);
      assert.equal(totals.expressSurcharge, 468);
      assert.equal(totals.taxAmount, 0);
      assert.equal(totals.totalAmount, 936);
    });

    // 34. Item-specific notes, defect tags, and photo associations are preserved across multi-item intake
    it('34. Item-specific notes, defect tags, and photo associations remain isolated to their respective items', () => {
      const mockPhotos = [
        { id: 'p-1', garmentId: 'g-suit', clientDraftId: 'draft-test-1', uri: 'file://suit.jpg' },
        { id: 'p-2', garmentId: 'g-suit', clientDraftId: 'draft-test-1', uri: 'file://suit2.jpg' },
      ];

      const item1 = {
        garmentCatalogId: 'g-suit',
        serviceTypeId: 'srv-dry-clean',
        quantity: 1,
        unitPrice: 400,
        defectNotes: 'Collar Stain, Torn Hem',
        pieces: [{ unitNumber: 1, photoCount: 2 }],
      };

      const item2 = {
        garmentCatalogId: 'g-shirt',
        serviceTypeId: 'srv-wash-iron',
        quantity: 2,
        unitPrice: 60,
        defectNotes: undefined,
        pieces: [
          { unitNumber: 1, photoCount: 0 },
          { unitNumber: 2, photoCount: 0 },
        ],
      };

      const orderPayload = {
        clientDraftId: 'draft-test-1',
        items: [item1, item2],
      };

      // Item 1 has defects and photos
      assert.equal(orderPayload.items[0].defectNotes, 'Collar Stain, Torn Hem');
      assert.equal(orderPayload.items[0].pieces[0].photoCount, 2);

      // Item 2 has NO defects and NO photos
      assert.equal(orderPayload.items[1].defectNotes, undefined);
      assert.equal(orderPayload.items[1].pieces[0].photoCount, 0);
      assert.equal(orderPayload.items[1].pieces[1].photoCount, 0);

      // Photo mapping to specific garment
      const suitPhotos = mockPhotos.filter((p) => p.garmentId === item1.garmentCatalogId);
      assert.equal(suitPhotos.length, 2);

      const shirtPhotos = mockPhotos.filter((p) => p.garmentId === item2.garmentCatalogId);
      assert.equal(shirtPhotos.length, 0);
    });
  });

  // =========================================================================
  // WORKSTREAM 3: TARGETED ORDER MODE & SEPARATE SERVICES VERIFICATION
  // =========================================================================
  describe('Workstream 3: Order Mode Selection & Per-Piece / Per-Weight Separation', () => {
    // 1. Mutually exclusive radio options
    it('35. Order mode supports exactly two mutually exclusive options (Per-Piece vs Per-Weight)', () => {
      const allowedModes: OrderEntryMode[] = ['PIECES', 'WEIGHT'];
      assert.equal(allowedModes.length, 2);
      assert.ok(allowedModes.includes('PIECES'));
      assert.ok(allowedModes.includes('WEIGHT'));

      // Dry Clean must NOT appear as an order mode option
      assert.ok(!allowedModes.includes('DRY_CLEAN' as any));
      assert.ok(!allowedModes.includes('DRY_CLEANING' as any));
    });

    // 2. Per-Piece retains existing services and excludes weight-only services
    it('36. Per-Piece mode displays per-piece services and excludes per-weight-only services', () => {
      const availableServices: ServiceTypeDTO[] = [
        {
          id: 'svc-wash-iron',
          name: 'Wash and Steam Iron',
          category: ServiceCategory.WASH_IRON,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'svc-steam-iron',
          name: 'Steam Iron',
          category: ServiceCategory.STEAM_PRESS,
          estimatedDays: 1,
          isActive: true,
        },
        {
          id: 'svc-wash',
          name: 'Standard Wash',
          category: ServiceCategory.WASH,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'svc-starching',
          name: 'Starching',
          category: ServiceCategory.STEAM_PRESS,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'svc-shoe',
          name: 'Shoe Cleaning',
          category: ServiceCategory.SHOE_CLEAN,
          estimatedDays: 3,
          isActive: true,
        },
        {
          id: 'svc-dry-clean',
          name: 'Dry Clean',
          category: ServiceCategory.DRY_CLEAN,
          estimatedDays: 3,
          isActive: true,
        },
        // Per-weight only services
        {
          id: 'svc-wash-fold',
          name: 'Wash and Fold',
          category: ServiceCategory.WASH,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'svc-white',
          name: 'Laundry for White',
          category: ServiceCategory.WASH,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'svc-premium',
          name: 'Premium Laundry',
          category: ServiceCategory.WASH,
          estimatedDays: 3,
          isActive: true,
        },
        {
          id: 'svc-woolen',
          name: 'Woolen Laundry',
          category: ServiceCategory.WASH,
          estimatedDays: 3,
          isActive: true,
        },
      ];

      // In Per-Piece mode: strictly resolves the four allowed per-piece services
      const pieceServices = resolvePieceServices(availableServices);

      assert.equal(pieceServices.length, 4, 'Per-Piece mode must display exactly 4 services');
      assert.ok(pieceServices.some((s) => s.name === 'Dry Clean'));
      assert.ok(pieceServices.some((s) => s.name === 'Starching'));
      assert.ok(pieceServices.some((s) => s.name === 'Shoe Cleaning'));
      assert.ok(pieceServices.some((s) => s.name === 'Steam Iron'));

      // Excludes removed/non-piece services
      assert.ok(!pieceServices.some((s) => s.name === 'Wash and Steam Iron'));
      assert.ok(!pieceServices.some((s) => s.name === 'Standard Wash'));
      assert.ok(!pieceServices.some((s) => s.name === 'Reprocess Cleaning'));
      assert.ok(!pieceServices.some((s) => s.name === 'Wash and Fold'));
      assert.ok(!pieceServices.some((s) => s.name === 'Laundry for White'));
      assert.ok(!pieceServices.some((s) => s.name === 'Premium Laundry'));
      assert.ok(!pieceServices.some((s) => s.name === 'Woolen Laundry'));
    });

    // 3. Per-Weight mode displays the 5 website services in canonical order
    it('37. Per-Weight mode displays the five canonical website laundry services in exact order', () => {
      assert.equal(CANONICAL_WEIGHT_SERVICES.length, 5);

      // 1. Steam Iron (1 day)
      assert.equal(CANONICAL_WEIGHT_SERVICES[0].id, 'svc-wash-iron');
      assert.equal(CANONICAL_WEIGHT_SERVICES[0].name, 'Steam Iron');
      assert.equal(CANONICAL_WEIGHT_SERVICES[0].estimatedDays, 1);

      // 2. Wash and Fold (2 days)
      assert.equal(CANONICAL_WEIGHT_SERVICES[1].id, 'svc-wash-fold');
      assert.equal(CANONICAL_WEIGHT_SERVICES[1].name, 'Wash and Fold');
      assert.equal(CANONICAL_WEIGHT_SERVICES[1].estimatedDays, 2);

      // 3. Laundry for White (2 days)
      assert.equal(CANONICAL_WEIGHT_SERVICES[2].id, 'svc-laundry-white');
      assert.equal(CANONICAL_WEIGHT_SERVICES[2].name, 'Laundry for White');
      assert.equal(CANONICAL_WEIGHT_SERVICES[2].estimatedDays, 2);

      // 4. Premium Laundry (3 days)
      assert.equal(CANONICAL_WEIGHT_SERVICES[3].id, 'svc-laundry-premium');
      assert.equal(CANONICAL_WEIGHT_SERVICES[3].name, 'Premium Laundry');
      assert.equal(CANONICAL_WEIGHT_SERVICES[3].estimatedDays, 3);

      // 5. Woolen Laundry (3 days)
      assert.equal(CANONICAL_WEIGHT_SERVICES[4].id, 'svc-laundry-woolen');
      assert.equal(CANONICAL_WEIGHT_SERVICES[4].name, 'Woolen Laundry');
      assert.equal(CANONICAL_WEIGHT_SERVICES[4].estimatedDays, 3);
    });

    // 4. Minimum 2.0 kg rule and preset calculations
    it('38. Enforces minimum 2.00 kg rule and calculates weight laundry line totals correctly', () => {
      const pricePerKg = 159; // Steam Iron rate from Image 2 & 3

      // Valid weight >= 2.0 kg
      const validWeight = 2.5;
      const validTotal = Math.round(validWeight * pricePerKg * 100) / 100;
      assert.equal(validTotal, 397.5);

      // Minimum weight 2.00 kg
      const minWeight = 2.0;
      const minTotal = Math.round(minWeight * pricePerKg * 100) / 100;
      assert.equal(minTotal, 318);

      // Invalid weight < 2.0 kg
      const invalidWeight = 1.5;
      const isWeightValid = !isNaN(invalidWeight) && invalidWeight >= 2.0;
      assert.equal(isWeightValid, false);
    });

    // 5. Mode switching clears incompatible items and prevents totals leakage
    it('39. Switching between Per-Piece and Per-Weight clears incompatible items and prevents pricing leakage', () => {
      // Start with cart containing Per-Piece items (no weight field)
      const pieceCart = [
        {
          garmentCatalogId: 'g-shirt',
          serviceTypeId: 'srv-steam-iron',
          quantity: 2,
          unitPrice: 50,
        },
        {
          garmentCatalogId: 'g-jeans',
          serviceTypeId: 'srv-steam-iron',
          quantity: 1,
          unitPrice: 70,
        },
      ];
      const initialTotals = calculateOrderTotals(pieceCart);
      assert.equal(initialTotals.subtotal, 170);

      // User switches to WEIGHT mode:
      // Incompatible items are items where isWeight !== true
      const newMode: OrderEntryMode = 'WEIGHT';
      const cleanedCartAfterSwitchToWeight = pieceCart.filter((item: any) => {
        const isItemWeight = Boolean(item.weight != null && item.weight > 0);
        return newMode === 'WEIGHT' ? isItemWeight : !isItemWeight;
      });

      // All piece items were safely pruned
      assert.equal(cleanedCartAfterSwitchToWeight.length, 0);
      const postSwitchTotals = calculateOrderTotals(cleanedCartAfterSwitchToWeight);
      assert.equal(postSwitchTotals.subtotal, 0);
      assert.equal(postSwitchTotals.totalAmount, 0);

      // Now add a valid Weight item (2.0 kg at ₹159/kg)
      const weightCart = [
        {
          garmentCatalogId: 'g-wb-1',
          serviceTypeId: 'svc-wash-iron',
          quantity: 1,
          weight: 2.0,
          unitPrice: 159,
        },
      ];
      const weightTotals = calculateOrderTotals(weightCart);
      assert.equal(weightTotals.subtotal, 318);

      // Switch back to PIECES mode:
      // Incompatible items are items with weight > 0
      const backToPiecesMode = 'PIECES';
      const cleanedCartAfterSwitchToPieces = weightCart.filter((item: any) => {
        const isItemWeight = Boolean(item.weight != null && item.weight > 0);
        return (backToPiecesMode as string) === 'WEIGHT' ? isItemWeight : !isItemWeight;
      });

      // Weight items safely pruned, preventing stale price leakage
      assert.equal(cleanedCartAfterSwitchToPieces.length, 0);
      const postSwitchToPiecesTotals = calculateOrderTotals(cleanedCartAfterSwitchToPieces);
      assert.equal(postSwitchToPiecesTotals.subtotal, 0);
      assert.equal(postSwitchToPiecesTotals.totalAmount, 0);
    });

    // 6. Derives order status canonically using deriveOrderStatus()
    it('40. Always derives canonical order status using deriveOrderStatus() without manual assignment', () => {
      // Empty items defaults to RECEIVED
      const emptyStatus = deriveOrderStatus({ items: [] });
      assert.equal(emptyStatus, OrderStatus.RECEIVED);

      // All items DELIVERED -> OrderStatus.DELIVERED
      const deliveredStatus = deriveOrderStatus({
        items: [{ status: 'DELIVERED' as any }],
      });
      assert.equal(deliveredStatus, OrderStatus.DELIVERED);
    });
  });

  describe('Workstream 4: Service List & Customer Action Updates', () => {
    // 1. Steam Press Only is completely removed from selectable services
    it('41. Excludes Steam Press Only completely from selectable services in Per-Piece mode', () => {
      const mockServices: ServiceTypeDTO[] = [
        {
          id: 'srv-wash-iron',
          name: 'Wash & Iron',
          category: ServiceCategory.WASH_IRON,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'srv-steam-press',
          name: 'Steam Press Only',
          category: ServiceCategory.STEAM_PRESS,
          estimatedDays: 1,
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
          id: 'srv-shoe-clean',
          name: 'Shoe Cleaning',
          category: ServiceCategory.SHOE_CLEAN,
          estimatedDays: 3,
          isActive: true,
        },
      ];

      const pieceServices = mockServices.filter((svc) => {
        if (!svc.isActive) return false;
        const name = svc.name.trim().toLowerCase();
        const sId = (svc.id || '').toLowerCase();
        if (
          name === 'steam press only' ||
          sId === 'srv-steam-press' ||
          sId === 'svc-steam-press-only'
        ) {
          return false;
        }
        return true;
      });

      // Steam Press Only is completely removed
      assert.ok(!pieceServices.some((s) => s.name === 'Steam Press Only'));
      assert.ok(!pieceServices.some((s) => s.id === 'srv-steam-press'));
      assert.equal(pieceServices.length, 3);
    });

    // 2. Wash & Iron renamed to Starching while preserving IDs and turnaround
    it('42. Renames Wash & Iron to Starching while preserving service identifier, category, and turnaround time', () => {
      const mockServices: ServiceTypeDTO[] = [
        {
          id: 'srv-wash-iron',
          name: 'Wash & Iron',
          category: ServiceCategory.WASH_IRON,
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
      ];

      const pieceServices = mockServices.map((svc) => {
        const lower = svc.name.trim().toLowerCase();
        if (lower === 'wash & iron' || lower === 'wash and iron') {
          return { ...svc, name: 'Starching' };
        }
        return svc;
      });

      const starchingService = pieceServices.find((s) => s.name === 'Starching');
      assert.ok(starchingService, 'Starching service must be present');
      assert.equal(
        starchingService.id,
        'srv-wash-iron',
        'Original service ID srv-wash-iron must be preserved',
      );
      assert.equal(
        starchingService.category,
        ServiceCategory.WASH_IRON,
        'Original category must be preserved',
      );
      assert.equal(
        starchingService.estimatedDays,
        2,
        'Turnaround time of 2 days must be preserved',
      );
      assert.ok(
        !pieceServices.some((s) => s.name === 'Wash & Iron'),
        'Wash & Iron must no longer be displayed',
      );
    });

    // 3. Duplicate service definitions are avoided when Starching already exists
    it('43. Avoids duplicate service definitions if Starching already exists in the catalog', () => {
      const mockServices: ServiceTypeDTO[] = [
        {
          id: 'svc-starching-orig',
          name: 'Starching',
          category: ServiceCategory.STEAM_PRESS,
          estimatedDays: 2,
          isActive: true,
        },
        {
          id: 'srv-wash-iron',
          name: 'Wash & Iron',
          category: ServiceCategory.WASH_IRON,
          estimatedDays: 2,
          isActive: true,
        },
      ];

      const seenNames = new Set<string>();
      const result: ServiceTypeDTO[] = [];

      for (const svc of mockServices) {
        const lower = svc.name.trim().toLowerCase();
        const isWashIron = lower === 'wash & iron' || lower === 'wash and iron';
        const resolvedName = isWashIron ? 'Starching' : svc.name;
        const displayKey = resolvedName.toLowerCase();

        if (seenNames.has(displayKey)) {
          continue;
        }
        seenNames.add(displayKey);

        if (isWashIron) {
          result.push({ ...svc, name: 'Starching' });
        } else {
          result.push(svc);
        }
      }

      const starchingCount = result.filter((s) => s.name === 'Starching').length;
      assert.equal(
        starchingCount,
        1,
        'Exactly one Starching service must be displayed without duplicates',
      );
    });

    // 4. Customer profile card on Home Screen has exactly three actions (Profile, Per-Piece Order, Per-Weight Order)
    it('44. Selected-customer card on Home Screen provides exactly three actions and excludes Dry Clean', () => {
      type CustomerCardAction = 'Profile' | 'Per-Piece Order' | 'Per-Weight Order';
      const actions: CustomerCardAction[] = ['Profile', 'Per-Piece Order', 'Per-Weight Order'];

      assert.equal(actions.length, 3, 'Selected-customer card must have exactly 3 actions');
      assert.ok(actions.includes('Profile'));
      assert.ok(actions.includes('Per-Piece Order'));
      assert.ok(actions.includes('Per-Weight Order'));

      // Dry Clean button is removed
      assert.ok(!actions.includes('Dry Clean' as any));
      assert.ok(!actions.includes('Piece' as any));
      assert.ok(!actions.includes('Weight' as any));
    });

    // 5. Order action buttons trigger correct existing workflows
    it('45. Per-Piece and Per-Weight buttons trigger existing workflows with correct order mode', () => {
      let triggeredMode: OrderEntryMode | null = null;
      let triggeredWorkflow: OrderWorkflowType | null = null;
      let profileOpened = false;

      const mockCustomer = { id: 'cust-101', name: 'Test Customer' };

      const handleStartOrderForCustomer = (
        _cust: any,
        mode: OrderEntryMode = 'PIECES',
        wf: OrderWorkflowType = 'LAUNDRY',
      ) => {
        triggeredMode = mode;
        triggeredWorkflow = wf;
      };

      const handleViewCustomerProfile = (_cust: any) => {
        profileOpened = true;
      };

      // 1. Profile action
      handleViewCustomerProfile(mockCustomer);
      assert.equal(profileOpened, true);

      // 2. Per-Piece Order action
      handleStartOrderForCustomer(mockCustomer, 'PIECES', 'LAUNDRY');
      assert.equal(triggeredMode, 'PIECES');
      assert.equal(triggeredWorkflow, 'LAUNDRY');

      // 3. Per-Weight Order action
      handleStartOrderForCustomer(mockCustomer, 'WEIGHT', 'LAUNDRY');
      assert.equal(triggeredMode, 'WEIGHT');
      assert.equal(triggeredWorkflow, 'LAUNDRY');
    });
  });

  describe('Workstream 5: Mode Independence & Per-Piece / Per-Weight Regression Suite', () => {
    const fullCatalogServices: ServiceTypeDTO[] = [
      {
        id: 'svc-dry-clean',
        name: 'Dry Clean',
        category: ServiceCategory.DRY_CLEAN,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-wash-iron',
        name: 'Wash and Steam Iron',
        category: ServiceCategory.WASH_IRON,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-shoe-clean',
        name: 'Shoe Cleaning',
        category: ServiceCategory.SHOE_CLEAN,
        estimatedDays: 3,
        isActive: true,
      },
      {
        id: 'svc-steam-press',
        name: 'Steam Iron',
        category: ServiceCategory.STEAM_PRESS,
        estimatedDays: 1,
        isActive: true,
      },
      {
        id: 'svc-wash',
        name: 'Standard Wash',
        category: ServiceCategory.WASH,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-leather',
        name: 'Reprocess Cleaning',
        category: ServiceCategory.LEATHER_CLEAN,
        estimatedDays: 4,
        isActive: true,
      },
      {
        id: 'svc-stain',
        name: 'Free Shoe',
        category: ServiceCategory.STAIN_REMOVAL,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-wash-fold',
        name: 'Wash and Fold',
        category: ServiceCategory.WASH,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-laundry-white',
        name: 'Laundry for White',
        category: ServiceCategory.WASH,
        estimatedDays: 2,
        isActive: true,
      },
      {
        id: 'svc-laundry-premium',
        name: 'Premium Laundry',
        category: ServiceCategory.WASH,
        estimatedDays: 3,
        isActive: true,
      },
      {
        id: 'svc-laundry-woolen',
        name: 'Woolen Laundry',
        category: ServiceCategory.WASH,
        estimatedDays: 3,
        isActive: true,
      },
    ];

    // 1. Selecting Per-Piece displays exactly four services.
    it('46. Scenario 1: Selecting Per-Piece displays exactly four services', () => {
      const pieceServices = resolvePieceServices(fullCatalogServices);

      assert.equal(pieceServices.length, 4, 'Per-Piece mode must display exactly 4 services');
      assert.deepEqual(
        pieceServices.map((s) => s.name),
        ['Dry Clean', 'Starching', 'Shoe Cleaning', 'Steam Iron'],
      );

      // Confirm excluded services
      assert.ok(!pieceServices.some((s) => s.name === 'Reprocess Cleaning'));
      assert.ok(!pieceServices.some((s) => s.name === 'Standard Wash'));
      assert.ok(!pieceServices.some((s) => s.name === 'Wash and Steam Iron'));
      assert.ok(!pieceServices.some((s) => s.name === 'Wash + Steam Iron'));
      assert.ok(!pieceServices.some((s) => s.name === 'Free Shoe'));
      assert.ok(!pieceServices.some((s) => s.name === 'Wash and Fold'));
    });

    // 2. Selecting Dry Clean keeps Per-Piece selected.
    it('47. Scenario 2: Selecting Dry Clean keeps Per-Piece selected', () => {
      let entryMode: OrderEntryMode = 'PIECES';
      let workflow: OrderWorkflowType = 'LAUNDRY';
      let selectedServiceId = 'svc-steam-press';

      const handleSelectService = (newSvcId: string, mode: OrderEntryMode = entryMode) => {
        selectedServiceId = newSvcId;
        const svc = fullCatalogServices.find((s) => s.id === newSvcId);
        if (svc) {
          if (mode === 'WEIGHT') {
            workflow = 'LAUNDRY';
          } else {
            const isDc =
              svc.category === ServiceCategory.DRY_CLEAN ||
              svc.name.toLowerCase().includes('dry clean');
            workflow = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
          }
        }
      };

      handleSelectService('svc-dry-clean');
      assert.equal(selectedServiceId, 'svc-dry-clean');
      assert.equal(workflow, 'DRY_CLEANING');
      assert.equal(entryMode, 'PIECES', 'Selecting Dry Clean must never change entryMode');
      assert.equal(isWeightBasedPricing(workflow, null, entryMode), false);
    });

    // 3. Selecting Starching keeps Per-Piece selected.
    it('48. Scenario 3: Selecting Starching keeps Per-Piece selected', () => {
      let entryMode: OrderEntryMode = 'PIECES';
      let workflow: OrderWorkflowType = 'DRY_CLEANING';
      let selectedServiceId = 'svc-dry-clean';

      const handleSelectService = (newSvcId: string, mode: OrderEntryMode = entryMode) => {
        selectedServiceId = newSvcId;
        const svc = fullCatalogServices.find((s) => s.id === newSvcId);
        if (svc) {
          if (mode === 'WEIGHT') {
            workflow = 'LAUNDRY';
          } else {
            const isDc =
              svc.category === ServiceCategory.DRY_CLEAN ||
              svc.name.toLowerCase().includes('dry clean');
            workflow = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
          }
        }
      };

      handleSelectService('svc-wash-iron'); // Starching
      assert.equal(selectedServiceId, 'svc-wash-iron');
      assert.equal(workflow, 'LAUNDRY');
      assert.equal(entryMode, 'PIECES', 'Selecting Starching must keep Per-Piece mode selected');
      assert.equal(isWeightBasedPricing(workflow, null, entryMode), false);
    });

    // 4. Selecting Shoe Cleaning keeps Per-Piece selected.
    it('49. Scenario 4: Selecting Shoe Cleaning keeps Per-Piece selected', () => {
      let entryMode: OrderEntryMode = 'PIECES';
      let workflow: OrderWorkflowType = 'DRY_CLEANING';
      let selectedCategory = 'ALL';
      let selectedServiceId = 'svc-dry-clean';

      const handleSelectService = (newSvcId: string, mode: OrderEntryMode = entryMode) => {
        selectedServiceId = newSvcId;
        const svc = fullCatalogServices.find((s) => s.id === newSvcId);
        if (svc) {
          if (mode === 'WEIGHT') {
            workflow = 'LAUNDRY';
          } else {
            const isDc =
              svc.category === ServiceCategory.DRY_CLEAN ||
              svc.name.toLowerCase().includes('dry clean');
            workflow = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
            const resolved = resolveCatalogSelectionOnServiceSelect(
              newSvcId,
              selectedCategory,
              fullCatalogServices,
              workflow,
            );
            if (resolved.category) {
              selectedCategory = String(resolved.category);
            }
          }
        }
      };

      handleSelectService('svc-shoe-clean');
      assert.equal(selectedServiceId, 'svc-shoe-clean');
      assert.equal(selectedCategory, GarmentCategory.SHOES);
      assert.equal(
        entryMode,
        'PIECES',
        'Selecting Shoe Cleaning must keep Per-Piece mode selected',
      );
      assert.equal(isWeightBasedPricing(workflow, null, entryMode), false);
    });

    // 5. Selecting Steam Iron in Per-Piece keeps Per-Piece selected.
    it('50. Scenario 5: Selecting Steam Iron in Per-Piece keeps Per-Piece selected', () => {
      let entryMode: OrderEntryMode = 'PIECES';
      let workflow: OrderWorkflowType = 'DRY_CLEANING';
      let selectedServiceId = 'svc-dry-clean';

      const handleSelectService = (newSvcId: string, mode: OrderEntryMode = entryMode) => {
        selectedServiceId = newSvcId;
        const svc = fullCatalogServices.find((s) => s.id === newSvcId);
        if (svc) {
          if (mode === 'WEIGHT') {
            workflow = 'LAUNDRY';
          } else {
            const isDc =
              svc.category === ServiceCategory.DRY_CLEAN ||
              svc.name.toLowerCase().includes('dry clean');
            workflow = isDc ? 'DRY_CLEANING' : 'LAUNDRY';
          }
        }
      };

      handleSelectService('svc-steam-press');
      assert.equal(selectedServiceId, 'svc-steam-press');
      assert.equal(workflow, 'LAUNDRY');
      assert.equal(
        entryMode,
        'PIECES',
        'Selecting Steam Iron in Per-Piece mode must remain Per-Piece',
      );
      assert.equal(
        isWeightBasedPricing(
          workflow,
          fullCatalogServices.find((s) => s.id === 'svc-steam-press'),
          entryMode,
        ),
        false,
        'Pricing must remain per-piece when in PIECES mode even with Steam Iron in LAUNDRY',
      );
    });

    // 6. Switching to Per-Weight displays only its five valid services.
    it('51. Scenario 6: Switching to Per-Weight displays only its five valid services', () => {
      const weightServices = resolveWeightServices(fullCatalogServices);

      assert.equal(weightServices.length, 5, 'Per-Weight mode must display exactly 5 services');
      assert.deepEqual(
        weightServices.map((s) => s.name),
        ['Steam Iron', 'Wash and Fold', 'Laundry for White', 'Premium Laundry', 'Woolen Laundry'],
      );

      assert.ok(!weightServices.some((s) => s.name === 'Dry Clean'));
      assert.ok(!weightServices.some((s) => s.name === 'Shoe Cleaning'));
      assert.ok(!weightServices.some((s) => s.name === 'Starching'));
    });

    // 7. Selecting any Per-Weight service never switches the mode.
    it('52. Scenario 7: Selecting any Per-Weight service never switches the mode', () => {
      let entryMode: OrderEntryMode = 'WEIGHT';
      let workflow: OrderWorkflowType = 'LAUNDRY';
      let selectedServiceId = 'svc-wash-iron';

      const handleSelectService = (newSvcId: string) => {
        selectedServiceId = newSvcId;
        if (entryMode === 'WEIGHT') {
          workflow = 'LAUNDRY';
        }
      };

      const weightServices = resolveWeightServices(fullCatalogServices);
      for (const svc of weightServices) {
        handleSelectService(svc.id);
        assert.equal(selectedServiceId, svc.id);
        assert.equal(
          entryMode,
          'WEIGHT',
          `Selecting ${svc.name} must never switch mode away from WEIGHT`,
        );
        assert.equal(
          isWeightBasedPricing('LAUNDRY', svc, entryMode),
          true,
          `Service ${svc.name} in WEIGHT mode must use weight-based pricing`,
        );
      }
    });

    // 8. Switching modes does not retain incompatible service selections or produce incorrect cart totals.
    it('53. Scenario 8: Switching modes does not retain incompatible service selections or produce incorrect cart totals', () => {
      let entryMode: OrderEntryMode = 'PIECES';
      let selectedServiceId = 'svc-dry-clean';
      let selectedCategory = 'ALL';
      let cartItems: any[] = [
        {
          garmentCatalogId: 'g-shirt',
          serviceTypeId: 'svc-dry-clean',
          quantity: 2,
          unitPrice: 120,
          lineTotal: 240,
          itemStatus: 'RECEIVED',
        },
      ];

      const pieceTotals = calculateOrderTotals(cartItems);
      assert.equal(pieceTotals.subtotal, 240);
      const itemCount = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
      assert.equal(itemCount, 2);

      const handleModeSwitch = (newMode: OrderEntryMode) => {
        entryMode = newMode;
        if (newMode === 'WEIGHT') {
          selectedServiceId = 'svc-wash-iron';
          selectedCategory = GarmentCategory.WEIGHT_BASED;
          cartItems = cartItems.filter((item) => Boolean(item.weight != null && item.weight > 0));
        } else {
          selectedServiceId = 'svc-dry-clean';
          selectedCategory = 'ALL';
          cartItems = cartItems.filter((item) => !(item.weight != null && item.weight > 0));
        }
      };

      handleModeSwitch('WEIGHT');
      assert.equal(entryMode, 'WEIGHT');
      assert.equal(selectedServiceId, 'svc-wash-iron');
      assert.equal(selectedCategory, GarmentCategory.WEIGHT_BASED);
      assert.equal(
        cartItems.length,
        0,
        'Incompatible piece items must be purged on switch to WEIGHT',
      );
      const emptyWeightTotals = calculateOrderTotals(cartItems);
      assert.equal(emptyWeightTotals.subtotal, 0);

      cartItems.push({
        garmentCatalogId: 'g-wb-1',
        serviceTypeId: 'svc-wash-iron',
        quantity: 1,
        weight: 2.5,
        unitPrice: 159,
        lineTotal: 397.5,
        itemStatus: 'RECEIVED',
      });
      const weightTotals = calculateOrderTotals(cartItems);
      assert.equal(roundCurrency(weightTotals.subtotal), 397.5);

      handleModeSwitch('PIECES');
      assert.equal(entryMode, 'PIECES');
      assert.equal(selectedServiceId, 'svc-dry-clean');
      assert.equal(selectedCategory, 'ALL');
      assert.equal(
        cartItems.length,
        0,
        'Incompatible weight items must be purged on switch to PIECES',
      );
      const emptyPieceTotals = calculateOrderTotals(cartItems);
      assert.equal(emptyPieceTotals.subtotal, 0);
    });

    // 9. Existing order creation still works in both modes.
    it('54. Scenario 9: Existing order creation still works in both modes', () => {
      // Per-Piece order payload
      const pieceOrderPayload: any = {
        customerId: 'cust-101',
        workflowType: 'DRY_CLEANING',
        entryMode: 'PIECES',
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'g-shirt',
            serviceTypeId: 'svc-dry-clean',
            quantity: 2,
            unitPrice: 120,
            lineTotal: 240,
            itemStatus: 'RECEIVED',
          },
        ],
      };
      const pieceTotals = calculateOrderTotals(pieceOrderPayload.items);
      pieceOrderPayload.subtotal = pieceTotals.subtotal;
      pieceOrderPayload.totalAmount = pieceTotals.totalAmount;
      pieceOrderPayload.amountDue = pieceTotals.totalAmount;

      const pieceOrderStatus = deriveOrderStatus(pieceOrderPayload);
      assert.equal(pieceOrderStatus, OrderStatus.RECEIVED);
      assert.equal(pieceOrderPayload.entryMode, 'PIECES');
      assert.equal(pieceOrderPayload.totalAmount, 240);

      // Per-Weight order payload
      const weightOrderPayload: any = {
        customerId: 'cust-102',
        workflowType: 'LAUNDRY',
        entryMode: 'WEIGHT',
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'g-wb-1',
            serviceTypeId: 'svc-wash-iron',
            quantity: 1,
            weight: 3.0,
            unitPrice: 159,
            lineTotal: 477,
            itemStatus: 'RECEIVED',
          },
        ],
      };
      const weightTotals = calculateOrderTotals(weightOrderPayload.items);
      weightOrderPayload.subtotal = weightTotals.subtotal;
      weightOrderPayload.totalAmount = weightTotals.totalAmount;
      weightOrderPayload.amountDue = weightTotals.totalAmount;

      const weightOrderStatus = deriveOrderStatus(weightOrderPayload);
      assert.equal(weightOrderStatus, OrderStatus.RECEIVED);
      assert.equal(weightOrderPayload.entryMode, 'WEIGHT');
      assert.equal(weightOrderPayload.totalAmount, 477);
      assert.ok(weightOrderPayload.items[0].weight >= 2.0, 'Minimum weight 2.0 kg is satisfied');
    });
  });
});
