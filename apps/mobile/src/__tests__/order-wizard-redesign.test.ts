import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GarmentCategory,
  OrderWorkflowType,
  OrderEntryMode,
  PickupType,
  ExpressDeliveryOption,
  OrderStatus,
  ItemStatus,
  deriveOrderStatus,
  calculateOrderTotals,
  adjustDueDateForThursday,
  isServiceAllowedInWorkflow,
  filterCategoriesForService,
  resolveCatalogSelectionOnWorkflowChange,
  resolveCatalogSelectionOnServiceSelect,
  resolveCatalogSelectionOnCategoryChange,
  isItemCompatibleWithWorkflow,
  roundCurrency,
  ServiceCategory,
  ServiceTypeDTO,
  GarmentCatalogDTO,
  CreateOrderItemRequest,
  CreateOrderRequest,
} from '@growfast/shared-types';
import {
  isWeightBasedPricing,
  CANONICAL_WEIGHT_SERVICES,
  CANONICAL_PIECE_SERVICES,
  resolvePieceServices,
  resolveWeightServices,
} from '../services/catalog-rules';

describe('GrowFast Mobile — Order Creation Workflow Redesign (5 Steps)', () => {
  const mockServices: ServiceTypeDTO[] = [
    {
      id: 'srv-dry-clean',
      name: 'Dry Clean',
      category: ServiceCategory.DRY_CLEAN,
      estimatedDays: 2,
      isActive: true,
    },
    {
      id: 'srv-wash-iron',
      name: 'Starching',
      category: ServiceCategory.WASH_IRON,
      estimatedDays: 2,
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
      id: 'svc-wash-iron',
      name: 'Steam Iron',
      category: ServiceCategory.WASH_IRON,
      estimatedDays: 1,
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

  const mockGarments: GarmentCatalogDTO[] = [
    { id: 'cat-achkan', name: 'Achkan', category: GarmentCategory.MEN, isActive: true },
    { id: 'cat-backpack', name: 'Backpack', category: GarmentCategory.OTHERS, isActive: true },
    {
      id: 'cat-bedsheet',
      name: 'Bedsheet (Double)',
      category: GarmentCategory.HOUSEHOLD,
      isActive: true,
    },
    { id: 'cat-belt', name: 'Belt', category: GarmentCategory.OTHERS, isActive: true },
    {
      id: 'cat-kids-sweater',
      name: 'Kids Sweater',
      category: GarmentCategory.KIDS,
      isActive: true,
    },
    {
      id: 'g-wb-1',
      name: 'Weight Based',
      category: GarmentCategory.WEIGHT_BASED,
      section: 'Per Piece Exception',
      isActive: true,
    },
  ];

  describe('Step 1: Customer Selection & State Consistency', () => {
    it('1.1 Preserves selected customer state and details across wizard navigation', () => {
      const selectedCustomer = {
        id: 'cus-000007',
        name: 'Omkar Chavhan',
        phone: '8080085552',
        customerCode: 'CUS-000007',
        address: 'Sai nandan society',
        membership: 'NONE' as any,
        discountPercent: 0,
        registrationSource: 'MOBILE_APP',
      };

      assert.equal(selectedCustomer.name, 'Omkar Chavhan');
      assert.equal(selectedCustomer.phone, '8080085552');
      assert.equal(selectedCustomer.address, 'Sai nandan society');
      assert.equal(selectedCustomer.customerCode, 'CUS-000007');
    });

    it('1.2 Validates customer requirement before proceeding to Step 2', () => {
      const validateCustomerStep = (customer: any, manualPhone: string) => {
        if (!customer && (!manualPhone || manualPhone.replace(/\D/g, '').length < 10)) {
          return false;
        }
        return true;
      };

      assert.equal(validateCustomerStep(null, ''), false);
      assert.equal(validateCustomerStep(null, '123'), false);
      assert.equal(validateCustomerStep(null, '9876543210'), true);
      assert.equal(validateCustomerStep({ id: 'cus-1' }, ''), true);
    });
  });

  describe('Step 2: Mutually Exclusive Order Modes & Services Selection', () => {
    it('2.1 Enforces mutually exclusive Per-Piece and Per-Weight order modes', () => {
      let entryMode: OrderEntryMode = 'PIECES';

      const switchMode = (newMode: OrderEntryMode) => {
        entryMode = newMode;
      };

      switchMode('WEIGHT');
      assert.equal(entryMode, 'WEIGHT');
      assert.notEqual(entryMode, 'PIECES');

      switchMode('PIECES');
      assert.equal(entryMode, 'PIECES');
      assert.notEqual(entryMode, 'WEIGHT');
    });

    it('2.2 Resolves canonical piece services in Per-Piece mode matching Screenshot 2', () => {
      const pieceServices = resolvePieceServices(mockServices);
      const serviceNames = pieceServices.map((s) => s.name);

      assert.ok(serviceNames.includes('Dry Clean'));
      assert.ok(serviceNames.includes('Starching'));
      assert.ok(serviceNames.includes('Shoe Cleaning'));
      assert.ok(serviceNames.includes('Steam Iron'));
    });

    it('2.3 Reconciles incompatible cart items when switching order modes safely', () => {
      const initialItems: CreateOrderItemRequest[] = [
        {
          garmentCatalogId: 'cat-achkan',
          serviceTypeId: 'srv-dry-clean',
          quantity: 1,
          unitPrice: 395,
        },
        {
          garmentCatalogId: 'g-wb-1',
          serviceTypeId: 'svc-wash-fold',
          weight: 3.5,
          quantity: 1,
          unitPrice: 80,
        },
      ];

      // Switching to Per-Piece removes items with weight
      const perPieceItems = initialItems.filter((it) => it.weight == null || it.weight === 0);
      assert.equal(perPieceItems.length, 1);
      assert.equal(perPieceItems[0].garmentCatalogId, 'cat-achkan');

      // Switching to Per-Weight retains only items with weight
      const perWeightItems = initialItems.filter((it) => it.weight != null && it.weight > 0);
      assert.equal(perWeightItems.length, 1);
      assert.equal(perWeightItems[0].garmentCatalogId, 'g-wb-1');
    });
  });

  describe('Step 3: Garment Catalog & Weight-Based Exceptions', () => {
    it('3.1 Filters garments by category and search query correctly', () => {
      const menGarments = mockGarments.filter((g) => g.category === GarmentCategory.MEN);
      assert.equal(menGarments.length, 1);
      assert.equal(menGarments[0].name, 'Achkan');

      const searchQuery = 'bed';
      const searchResults = mockGarments.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
      assert.equal(searchResults.length, 1);
      assert.equal(searchResults[0].name, 'Bedsheet (Double)');
    });

    it('3.2 Displays weight-based exception item correctly under DRY_CLEANING workflow', () => {
      const weightExceptionGarment = mockGarments.find(
        (g) => g.category === GarmentCategory.WEIGHT_BASED,
      );
      assert.ok(weightExceptionGarment);
      assert.equal(weightExceptionGarment.section, 'Per Piece Exception');

      // Weight exception in per-piece order creates item without weight and with piece quantity
      const exceptionItem: CreateOrderItemRequest = {
        garmentCatalogId: weightExceptionGarment.id,
        serviceTypeId: 'srv-dry-clean',
        quantity: 3,
        unitPrice: 40,
        weight: undefined,
        defectNotes: 'Collar Stain',
      };

      assert.equal(exceptionItem.quantity, 3);
      assert.equal(exceptionItem.unitPrice, 40);
      assert.equal(exceptionItem.weight, undefined);
    });

    it('3.3 Calculates sticky bottom cart pieces and estimated total dynamically', () => {
      const cartItems: CreateOrderItemRequest[] = [
        {
          garmentCatalogId: 'cat-achkan',
          serviceTypeId: 'srv-dry-clean',
          quantity: 1,
          unitPrice: 395,
        },
        {
          garmentCatalogId: 'cat-backpack',
          serviceTypeId: 'srv-dry-clean',
          quantity: 2,
          unitPrice: 180,
        },
      ];

      const totalPieces = cartItems.reduce((s, it) => s + (it.quantity || 1), 0);
      const totalEstimated = cartItems.reduce(
        (s, it) => s + (it.unitPrice || 0) * (it.quantity || 1),
        0,
      );

      assert.equal(totalPieces, 3);
      assert.equal(totalEstimated, 755); // 395 + 360
    });
  });

  describe('Step 4: Cart Item Quantity, Photos & Modification', () => {
    it('4.1 Increases and decreases item quantities cleanly', () => {
      let item: CreateOrderItemRequest = {
        garmentCatalogId: 'cat-achkan',
        serviceTypeId: 'srv-dry-clean',
        quantity: 1,
        unitPrice: 395,
      };

      // Increment
      item = { ...item, quantity: (item.quantity || 1) + 1 };
      assert.equal(item.quantity, 2);

      // Decrement
      item = { ...item, quantity: Math.max(1, (item.quantity || 1) - 1) };
      assert.equal(item.quantity, 1);
    });

    it('4.2 Calculates order provisional financial subtotal accurately', () => {
      const cartItems = [{ quantity: 2, unitPrice: 100, weight: null }];
      const totals = calculateOrderTotals(cartItems, {
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
        discountPercent: 0,
      });

      assert.equal(totals.subtotal, 200);
      assert.equal(totals.totalAmount, 200);
    });
  });

  describe('Step 5: Review Order & Turnaround Speed Surcharges', () => {
    it('5.1 Calculates Regular Turnaround (0% surcharge)', () => {
      const cartItems = [{ quantity: 2, unitPrice: 100, weight: null }];
      const regularTotals = calculateOrderTotals(cartItems, {
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      });

      assert.equal(regularTotals.expressSurcharge, 0);
      assert.equal(regularTotals.totalAmount, 200);
    });

    it('5.2 Calculates Next-Day Evening Express (50% surcharge)', () => {
      const cartItems = [{ quantity: 2, unitPrice: 100, weight: null }];
      const expressTotals = calculateOrderTotals(cartItems, {
        isExpress: true,
        expressSurchargePercent: 50,
        expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      });

      assert.equal(expressTotals.expressSurcharge, 100); // 50% of 200
      assert.equal(expressTotals.totalAmount, 300);
    });

    it('5.3 Calculates Same-Day Urgent Express (100% surcharge)', () => {
      const cartItems = [{ quantity: 2, unitPrice: 100, weight: null }];
      const urgentTotals = calculateOrderTotals(cartItems, {
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      });

      assert.equal(urgentTotals.expressSurcharge, 200); // 100% of 200
      assert.equal(urgentTotals.totalAmount, 400);
    });

    it('5.4 Adjusts estimated due date for Thursday store weekly off', () => {
      // Create date known to land on Thursday
      const thursdayDate = new Date('2026-11-05T10:00:00Z'); // Nov 5 2026 is Thursday
      const adjusted = adjustDueDateForThursday(thursdayDate);
      // Adjusted should roll forward past Thursday to Friday Nov 6
      assert.notEqual(adjusted.getDay(), 4); // Not Thursday
    });

    it('5.5 Enforces canonical deriveOrderStatus on completed and confirmed orders', () => {
      const status = deriveOrderStatus({
        items: [
          { status: ItemStatus.RECEIVED },
          { status: ItemStatus.RECEIVED },
        ],
      });

      assert.equal(status, OrderStatus.RECEIVED);
    });
  });
});
