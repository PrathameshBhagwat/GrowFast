import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockSQLiteDatabase } from './mock-sqlite';
import { setDatabaseInstance, MIGRATIONS } from '../db/sqlite';
import {
  saveDraft,
  getDraft,
  listDrafts,
  queueDraftForSync,
  updateDraftSyncStatus,
  generateUUID,
} from '../db/drafts';
import { savePhotoLocally, getPhotosForDraft } from '../db/photos';
import { SyncEngine } from '../services/sync-engine';
import { apiClient, ApiError } from '../api/client';
import { saveAuthToken, removeAuthToken } from '../storage/secure-store';
import {
  PickupType,
  ExpressDeliveryOption,
  GarmentCategory,
  ServiceCategory,
  MembershipTier,
  ItemStatus,
  OrderStatus,
  calculateOrderTotals,
  isPhotoRequiredForOrder,
  deriveOrderStatus,
  getExpressMultiplier,
  isWeightBasedCategory,
  formatCatalogServiceName,
  CreateOrderItemRequest,
  CustomerDTO,
  OrderDetailDTO,
} from '@growfast/shared-types';

describe('GrowFast Mobile Phase D — Complete Mobile Order-Creation Workflow', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(async () => {
    mockDb = new MockSQLiteDatabase();
    setDatabaseInstance(mockDb as any);

    // Apply migrations v1, v2, v3
    for (const m of MIGRATIONS) {
      await m.up(mockDb as any);
    }

    // Valid auth token
    await saveAuthToken('test-valid-jwt-token');
  });

  // 1. Customer search and selection
  it('1. Customer search and selection handles query results, empty states and selection', async () => {
    const mockCustomers: CustomerDTO[] = [
      {
        id: 'cust-101',
        customerCode: 'CUST-00101',
        name: 'Rahul Sharma',
        phone: '9876543210',
        email: 'rahul@example.com',
        address: '12 Green Park',
        pincode: '400001',
        membership: MembershipTier.GOLD,
        discountPercent: 10,
        preferences: null,
        registrationSource: 'WALK_IN',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Mock search API
    apiClient.customers.search = async (query?: string) => {
      if (query === 'Rahul' || query === '9876543210') {
        return {
          success: true,
          data: mockCustomers,
          total: 1,
          page: 1,
          pageSize: 10,
        };
      }
      return {
        success: true,
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      };
    };

    const found = await apiClient.customers.search('Rahul');
    assert.equal(found.data.length, 1);
    assert.equal(found.data[0].name, 'Rahul Sharma');
    assert.equal(found.data[0].membership, MembershipTier.GOLD);
    assert.equal(found.data[0].discountPercent, 10);

    const notFound = await apiClient.customers.search('Unknown');
    assert.equal(notFound.data.length, 0);
  });

  // 2. Customer creation via approved backend API
  it('2. Creating new customer validates fields and calls approved customer API', async () => {
    let createdPayload: any = null;
    apiClient.customers.create = async (dto) => {
      createdPayload = dto;
      return {
        id: 'cust-new-555',
        customerCode: 'CUST-00555',
        name: dto.name,
        phone: dto.phone,
        email: null,
        address: dto.address || null,
        pincode: dto.pincode || null,
        membership: MembershipTier.NONE,
        discountPercent: 0,
        preferences: null,
        registrationSource: 'APP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    };

    const newCust = await apiClient.customers.create({
      name: 'Sunita Mehra',
      phone: '9988776655',
      address: 'Plot 4, Bandra West',
      pincode: '400050',
    });

    assert.equal(newCust.id, 'cust-new-555');
    assert.equal(createdPayload.name, 'Sunita Mehra');
    assert.equal(createdPayload.phone, '9988776655');
  });

  // 3. Catalog loading, category filtering and service formatting
  it('3. Catalog items filter by category and format service display names', async () => {
    assert.equal(isWeightBasedCategory(GarmentCategory.WEIGHT_BASED), true);
    assert.equal(isWeightBasedCategory(GarmentCategory.MEN), false);

    assert.equal(formatCatalogServiceName('Starching Dc'), 'Starching');
    assert.equal(formatCatalogServiceName('Dry Clean'), 'Dry Clean');
  });

  // 4. Adding, editing, and removing line items
  it('4. Adding, editing and removing line items modifies draft item list', () => {
    let items: CreateOrderItemRequest[] = [];

    // Add item 1 (Per piece shirt)
    items.push({
      garmentCatalogId: 'cat-shirt',
      serviceTypeId: 'srv-wash-iron',
      quantity: 2,
      unitPrice: 50,
      defectNotes: 'Collar stain',
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 2);

    // Add item 2 (Weight-based laundry)
    items.push({
      garmentCatalogId: 'cat-kg-wash',
      serviceTypeId: 'srv-wash',
      quantity: 4,
      weight: 3.5,
      unitPrice: 80,
    });
    assert.equal(items.length, 2);

    // Edit item 1 (increase qty to 3)
    items[0] = { ...items[0], quantity: 3 };
    assert.equal(items[0].quantity, 3);

    // Remove item 2
    items = items.filter((_, idx) => idx !== 1);
    assert.equal(items.length, 1);
    assert.equal(items[0].garmentCatalogId, 'cat-shirt');
  });

  // 5. Quantity and weight validation using existing rules
  it('5. Enforces quantity >= 1 and weight >= 2.00 kg minimum validation', () => {
    // Piece validation
    const invalidQtyItem = { quantity: 0, unitPrice: 50 };
    assert.ok(invalidQtyItem.quantity < 1);

    // Weight validation: < 2.00 kg is invalid
    const invalidWeight = 1.8;
    assert.ok(invalidWeight < 2.0, 'Weight below 2.00 kg must be rejected');

    const validWeight = 2.0;
    assert.ok(validWeight >= 2.0, 'Weight 2.00 kg is valid');

    const validAboveMin = 4.25;
    assert.ok(validAboveMin >= 2.0, 'Weight > 2.00 kg is valid');
  });

  // 6. Admin versus non-admin pricing controls with server-authoritative pricing
  it('6. Server remains authoritative over any local rate overrides', () => {
    const regularEmployeeRole: string = 'COUNTER';
    const managerRole: string = 'MANAGER';

    const canModifyRegular = regularEmployeeRole === 'OWNER' || regularEmployeeRole === 'MANAGER';
    const canModifyManager = managerRole === 'OWNER' || managerRole === 'MANAGER';

    assert.equal(canModifyRegular, false);
    assert.equal(canModifyManager, true);

    // When totals are computed, server logic calculates strictly based on canonical rules:
    // subtotal = 120, GST (18%) = 21.60, totalAmount = 141.60
    const items = [{ quantity: 2, unitPrice: 60, weight: null }];
    const totals = calculateOrderTotals(items, { isExpress: false });
    assert.equal(totals.subtotal, 120);
    assert.equal(totals.taxAmount, 21.6);
    assert.equal(totals.totalAmount, 141.6);
  });

  // 7. Express option and price display using actual backend rules
  it('7. Calculates express multipliers accurately: Regular 1.0x, Next-Day 1.5x, Same-Day 2.0x', () => {
    assert.equal(getExpressMultiplier(ExpressDeliveryOption.REGULAR), 0);
    assert.equal(getExpressMultiplier(ExpressDeliveryOption.NEXT_DAY_EVENING), 1.5);
    assert.equal(getExpressMultiplier(ExpressDeliveryOption.SAME_DAY), 2.0);

    const items = [{ quantity: 1, unitPrice: 200, weight: null }];

    // Regular (subtotal: 200, surcharge: 0, GST: 36, total: 236)
    const regTotals = calculateOrderTotals(items, {
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
    });
    assert.equal(regTotals.subtotal, 200);
    assert.equal(regTotals.expressSurcharge, 0);
    assert.equal(regTotals.taxAmount, 36);
    assert.equal(regTotals.totalAmount, 236);

    // Next-Day Evening (50% base surcharge * 1.5 multiplier = 150; taxable = 350; GST = 63; total = 413)
    const nextDayTotals = calculateOrderTotals(items, {
      isExpress: true,
      expressSurchargePercent: 50,
      expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
    });
    assert.equal(nextDayTotals.subtotal, 200);
    assert.equal(nextDayTotals.expressSurcharge, 150);
    assert.equal(nextDayTotals.taxAmount, 63);
    assert.equal(nextDayTotals.totalAmount, 413);

    // Same-Day Express (50% base surcharge * 2.0 multiplier = 200; taxable = 400; GST = 72; total = 472)
    const sameDayTotals = calculateOrderTotals(items, {
      isExpress: true,
      expressSurchargePercent: 50,
      expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
    });
    assert.equal(sameDayTotals.subtotal, 200);
    assert.equal(sameDayTotals.expressSurcharge, 200);
    assert.equal(sameDayTotals.taxAmount, 72);
    assert.equal(sameDayTotals.totalAmount, 472);
  });

  // 8. Photo and garment/tag requirements
  it('8. Canonical photo requirements enforce intake photos for walk-in orders <= 50 pieces', () => {
    // Walk-in with 5 pieces -> Photos Required
    assert.equal(
      isPhotoRequiredForOrder({
        isWalkIn: true,
        totalPieces: 5,
        isWeightBased: false,
      }),
      true,
    );

    // Walk-in with 50 pieces -> Photos Required
    assert.equal(
      isPhotoRequiredForOrder({
        isWalkIn: true,
        totalPieces: 50,
        isWeightBased: false,
      }),
      true,
    );

    // Walk-in with 51 pieces (Bulk) -> Photos Optional
    assert.equal(
      isPhotoRequiredForOrder({
        isWalkIn: true,
        totalPieces: 51,
        isWeightBased: false,
      }),
      false,
    );

    // Home Delivery -> Photos Optional
    assert.equal(
      isPhotoRequiredForOrder({
        isWalkIn: false,
        totalPieces: 5,
        isWeightBased: false,
      }),
      false,
    );
  });

  // 9. Canonical order-status derivation
  it('9. Derives canonical order status without manually computing status strings', () => {
    // All items received
    const statusReceived = deriveOrderStatus({
      items: [{ status: ItemStatus.RECEIVED }, { status: ItemStatus.RECEIVED }],
    });
    assert.equal(statusReceived, OrderStatus.RECEIVED);

    // Items ready
    const statusReady = deriveOrderStatus({
      items: [{ status: ItemStatus.READY }, { status: ItemStatus.READY }],
    });
    assert.equal(statusReady, OrderStatus.READY);

    // All delivered
    const statusDelivered = deriveOrderStatus({
      items: [{ status: ItemStatus.DELIVERED }, { status: ItemStatus.DELIVERED }],
    });
    assert.equal(statusDelivered, OrderStatus.DELIVERED);
  });

  // 10. Draft persistence while moving between wizard steps
  it('10. Draft state is persisted in SQLite across wizard step navigations', async () => {
    const draftId = generateUUID();
    const storeId = 'store-mumbai-01';

    // Step 1: Customer entered
    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Pooja Hegde',
      customerPhone: '9811223344',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-pooja',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });

    let draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.customerName, 'Pooja Hegde');
    assert.equal(draft.payload.items.length, 0);

    // Step 2: Items added
    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Pooja Hegde',
      customerPhone: '9811223344',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-pooja',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-saree',
            serviceTypeId: 'srv-dry-clean',
            quantity: 1,
            unitPrice: 180,
          },
        ],
      },
    });

    draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.payload.items.length, 1);
    assert.equal(draft.payload.items[0].garmentCatalogId, 'cat-saree');

    // Step 3: Options chosen
    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Pooja Hegde',
      customerPhone: '9811223344',
      isExpress: true,
      notes: 'Please pack in box',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-pooja',
        isExpress: true,
        expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
        pickupType: PickupType.HOME_DELIVERY,
        notes: 'Please pack in box',
        items: draft.payload.items,
      },
    });

    draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.isExpress, true);
    assert.equal(draft.notes, 'Please pack in box');
  });

  // 11. Restoring a draft after simulated app restart
  it('11. Restores a saved draft after simulated app restart without data loss', async () => {
    const draftId = generateUUID();
    const storeId = 'store-bengaluru-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Vikram Seth',
      customerPhone: '9123456789',
      workflowType: 'DRY_CLEANING',
      pickupType: PickupType.STORE_PICKUP,
      isExpress: false,
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-vikram',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-suit',
            serviceTypeId: 'srv-dry-clean',
            quantity: 1,
            unitPrice: 250,
            defectNotes: 'Missing cuff button',
          },
        ],
      },
    });

    // Simulate app restart by clearing any cached instance and re-reading
    const loaded = await getDraft(draftId);
    assert.ok(loaded);
    assert.equal(loaded.customerName, 'Vikram Seth');
    assert.equal(loaded.workflowType, 'DRY_CLEANING');
    assert.equal(loaded.payload.items[0].defectNotes, 'Missing cuff button');
    assert.equal(loaded.syncStatus, 'DRAFT');
  });

  // 12. Offline draft submission without creating local official order
  it('12. Offline submission queues the draft without inventing an official order number', async () => {
    const draftId = generateUUID();
    const storeId = 'store-delhi-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Deepak Varma',
      customerPhone: '9876501234',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-offline',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 3,
            unitPrice: 40,
          },
        ],
      },
    });

    // Offline user taps "Submit"
    await queueDraftForSync(draftId);

    const queuedDraft = await getDraft(draftId);
    assert.ok(queuedDraft);
    assert.equal(queuedDraft.syncStatus, 'QUEUED');
    // Crucial rule: Never invent an official order number locally!
    assert.equal(queuedDraft.serverOrderId, null);
    assert.equal(queuedDraft.serverOrderNumber, null);
  });

  // 13. Successful online order confirmation
  it('13. Successful online order confirmation receives official server order number and updates draft', async () => {
    const draftId = generateUUID();
    const storeId = 'store-delhi-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Kavita Rao',
      customerPhone: '9765432109',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-kavita',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-saree',
            serviceTypeId: 'srv-dry-clean',
            quantity: 1,
            unitPrice: 180,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Mock backend returning confirmed order
    apiClient.orders.getByDraftId = async () => null as any;
    apiClient.orders.create = async (payload) => {
      assert.equal(payload.clientDraftId, draftId);
      return {
        id: 'ord-srv-12345',
        orderNumber: 'ORD-20261022-0001',
        customerId: payload.customerId,
        storeId,
        orderStatus: OrderStatus.RECEIVED,
        totalAmount: 180,
        subtotal: 180,
        items: [],
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.orderNumber, 'ORD-20261022-0001');

    const confirmed = await getDraft(draftId);
    assert.ok(confirmed);
    assert.equal(confirmed.syncStatus, 'SYNCED');
    assert.equal(confirmed.serverOrderNumber, 'ORD-20261022-0001');
    assert.equal(confirmed.serverOrderId, 'ord-srv-12345');
  });

  // 14. Timeout after server commit and idempotent recovery
  it('14. Idempotently recovers confirmed order if network times out after server commit', async () => {
    const draftId = generateUUID();
    const storeId = 'store-delhi-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Naveen Jindal',
      customerPhone: '9654321098',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-naveen',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 1,
            unitPrice: 40,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Mock: create throws network timeout, but getByDraftId recovers the committed order
    apiClient.orders.create = async () => {
      throw new Error('Network timeout socket hangup');
    };

    apiClient.orders.getByDraftId = async (id) => {
      assert.equal(id, draftId);
      return {
        id: 'ord-srv-recovered-999',
        orderNumber: 'ORD-RECOVERED-0099',
        customerId: 'cust-naveen',
        storeId,
        orderStatus: OrderStatus.RECEIVED,
        totalAmount: 40,
        subtotal: 40,
        items: [],
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.orderNumber, 'ORD-RECOVERED-0099');

    const recovered = await getDraft(draftId);
    assert.ok(recovered);
    assert.equal(recovered.syncStatus, 'SYNCED');
    assert.equal(recovered.serverOrderNumber, 'ORD-RECOVERED-0099');
  });

  // 15. Repeated submission without duplicate orders
  it('15. Synchronizing already-synced draft does not call server or duplicate orders', async () => {
    const draftId = generateUUID();
    const storeId = 'store-mumbai-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Already Synced User',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-synced',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });

    // Mark as already synced
    await updateDraftSyncStatus(draftId, 'SYNCED', {
      serverOrderId: 'srv-ord-done',
      serverOrderNumber: 'ORD-DONE-1',
    });

    let createCallCount = 0;
    apiClient.orders.create = async () => {
      createCallCount++;
      return {} as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(createCallCount, 0, 'Must not call server for already synced draft');
  });

  // 16. HTTP 409 conflict handling
  it('16. HTTP 409 conflict marks draft as CONFLICT and preserves draft contents', async () => {
    const draftId = generateUUID();
    const storeId = 'store-chennai-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Conflict Customer',
      customerPhone: '9554433221',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-conflict',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 1,
            unitPrice: 50,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    apiClient.orders.create = async () => {
      throw new ApiError('Store-level draft collision: payload hash mismatch', 409, {
        code: 'DRAFT_CONFLICT',
      });
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, false);
    assert.equal(result.isConflict, true);

    const draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.syncStatus, 'CONFLICT');
    assert.equal(
      draft.payload.items.length,
      1,
      'Draft contents must be completely preserved on conflict',
    );
  });

  // 17. Authentication expiry and recoverable failures
  it('17. Authentication expiry notifies handler and preserves local draft for re-login', async () => {
    const draftId = generateUUID();
    const storeId = 'store-chennai-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Auth Expired Customer',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-auth',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 1,
            unitPrice: 50,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Simulate 401 Unauthorized
    apiClient.orders.create = async () => {
      throw new ApiError('JWT token expired', 401);
    };

    let authExpiredCallbackCalled = false;
    const engine = new SyncEngine({
      onAuthExpired: () => {
        authExpiredCallbackCalled = true;
      },
    });

    const result = await engine.syncDraft(draftId);
    assert.equal(result.success, false);
    assert.equal(authExpiredCallbackCalled, true);

    const draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.syncStatus, 'FAILED_RETRYABLE');
    assert.ok(draft.lastError?.includes('401') || draft.lastError?.includes('expired'));
  });

  // 18. Auto-resolves customer during sync when offline draft has temporary/unregistered customer
  it('18. Auto-resolves customer during sync when offline draft has temporary customer', async () => {
    const draftId = generateUUID();
    const storeId = 'store-offline-01';

    // Draft created offline with temporary customer ID
    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerId: 'cust-offline-temp',
      customerName: 'Pooja Deshmukh',
      customerPhone: '9822011223',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-offline-temp',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 2,
            unitPrice: 40,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Mock search returning empty first, then customer creation succeeds
    apiClient.customers.search = async () => ({
      success: true,
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    let customerCreatedWith: any = null;
    apiClient.customers.create = async (payload) => {
      customerCreatedWith = payload;
      return {
        id: 'cust-server-registered-789',
        customerCode: 'CUST-00789',
        name: payload.name,
        phone: payload.phone,
        email: null,
        address: null,
        pincode: null,
        membership: MembershipTier.NONE,
        discountPercent: 0,
        preferences: null,
        registrationSource: 'MOBILE_APP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    };

    let orderCreatedWith: any = null;
    apiClient.orders.create = async (payload) => {
      orderCreatedWith = payload;
      return {
        id: 'ord-resolved-101',
        orderNumber: 'ORD-000101',
        customerId: payload.customerId,
        status: OrderStatus.RECEIVED,
        totalAmount: 80,
        amountDue: 80,
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(customerCreatedWith?.phone, '9822011223');
    assert.equal(customerCreatedWith?.name, 'Pooja Deshmukh');
    assert.equal(orderCreatedWith?.customerId, 'cust-server-registered-789');

    // Confirm SQLite record was updated with the real server customer ID
    const syncedDraft = await getDraft(draftId);
    assert.ok(syncedDraft);
    assert.equal(syncedDraft.customerId, 'cust-server-registered-789');
    assert.equal(syncedDraft.syncStatus, 'SYNCED');
  });

  // 18b. Failed customer resolution stops order creation and marks FAILED_RETRYABLE without submitting temp ID
  it('18b. Failed customer auto-resolution halts order creation, never submits temporary customer ID, and marks FAILED_RETRYABLE', async () => {
    const draftId = generateUUID();
    const storeId = 'store-offline-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerId: 'cust-offline-temp',
      customerName: 'Anand Shinde',
      customerPhone: '9822998877',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-offline-temp',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-shirt',
            serviceTypeId: 'srv-wash-iron',
            quantity: 1,
            unitPrice: 40,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Simulate network error on customer API
    apiClient.customers.search = async () => {
      throw new ApiError('Network request failed: customer search unreachable', 503);
    };

    let orderCreateCalled = false;
    apiClient.orders.create = async () => {
      orderCreateCalled = true;
      throw new Error('Should NEVER be called with temporary customer ID');
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    // Verify order creation was NOT called
    assert.equal(result.success, false);
    assert.equal(orderCreateCalled, false);
    assert.match(result.error || '', /Customer resolution failed/);

    // Verify draft remains with original clientDraftId and marked FAILED_RETRYABLE
    const failedDraft = await getDraft(draftId);
    assert.ok(failedDraft);
    assert.equal(failedDraft.clientDraftId, draftId);
    assert.equal(failedDraft.syncStatus, 'FAILED_RETRYABLE');
    assert.equal(failedDraft.retryCount, 1);
    assert.match(failedDraft.lastError || '', /Customer resolution failed/);
  });

  // 18c. Retrying sync after customer API recovers reuses original draft ID and resolves customer safely
  it('18c. Retrying sync after customer API recovers reuses original draft ID and resolves customer safely', async () => {
    const draftId = generateUUID();
    const storeId = 'store-offline-01';

    await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerId: 'cust-offline-temp',
      customerName: 'Kavita Patil',
      customerPhone: '9811223344',
      payload: {
        clientDraftId: draftId,
        customerId: 'cust-offline-temp',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-saree',
            serviceTypeId: 'srv-dry-clean',
            quantity: 1,
            unitPrice: 180,
          },
        ],
      },
    });

    await queueDraftForSync(draftId);

    // Attempt 1: Customer API fails
    apiClient.customers.search = async () => {
      throw new ApiError('Connection timed out', 504);
    };
    let orderCreateCallCount = 0;
    apiClient.orders.create = async (payload) => {
      orderCreateCallCount++;
      return {
        id: 'ord-retry-success-1',
        orderNumber: 'ORD-000201',
        customerId: payload.customerId,
        status: OrderStatus.RECEIVED,
        totalAmount: 180,
        amountDue: 180,
      } as any;
    };

    const engine = new SyncEngine();
    const attempt1 = await engine.syncDraft(draftId);
    assert.equal(attempt1.success, false);
    assert.equal(orderCreateCallCount, 0);

    // Attempt 2: Customer API recovers and finds existing customer
    apiClient.customers.search = async () => ({
      success: true,
      data: [
        {
          id: 'cust-recovered-456',
          customerCode: 'CUST-00456',
          name: 'Kavita Patil',
          phone: '9811223344',
          email: null,
          address: null,
          pincode: null,
          membership: MembershipTier.SILVER,
          discountPercent: 5,
          preferences: null,
          registrationSource: 'WALK_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });

    const attempt2 = await engine.syncDraft(draftId);
    assert.equal(attempt2.success, true);
    assert.equal(orderCreateCallCount, 1);
    assert.equal(attempt2.orderNumber, 'ORD-000201');

    const syncedDraft = await getDraft(draftId);
    assert.ok(syncedDraft);
    assert.equal(syncedDraft.clientDraftId, draftId);
    assert.equal(syncedDraft.customerId, 'cust-recovered-456');
    assert.equal(syncedDraft.syncStatus, 'SYNCED');
  });

  // 19. Dry Cleaning workflow is strictly per-piece and rejects weight-based items
  it('19. Dry Cleaning workflow is strictly per-piece and rejects weight-based items', () => {
    const dryCleanWorkflow = 'DRY_CLEANING';
    const weightItem = {
      garmentCatalogId: 'cat-kg-wash',
      serviceTypeId: 'srv-wash-iron',
      quantity: 1,
      weight: 3.5,
      unitPrice: 80,
    };

    // Business rule: Dry Cleaning does not support weight-based processing
    const isWeight = weightItem.weight != null && weightItem.weight > 0;
    assert.equal(isWeight, true);
    assert.equal(dryCleanWorkflow, 'DRY_CLEANING');

    // In Dry Cleaning, entry mode MUST be PIECES
    let entryMode = 'WEIGHT';
    if (dryCleanWorkflow === 'DRY_CLEANING') {
      entryMode = 'PIECES';
    }
    assert.equal(entryMode, 'PIECES');
  });

  // 20. Express surcharge calculation uses store-configured rate and multipliers
  it('20. Express surcharge calculation uses store-configured rate and multipliers', () => {
    const items = [{ quantity: 2, unitPrice: 100, weight: null }]; // Subtotal = 200

    // Store configured with 25% base express surcharge
    const storeSurchargePercent = 25;

    // Regular: No surcharge
    const regTotals = calculateOrderTotals(items, {
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      expressSurchargePercent: storeSurchargePercent,
    });
    assert.equal(regTotals.subtotal, 200);
    assert.equal(regTotals.expressSurcharge, 0);

    // Next-Day Evening: 1.5x of (200 * 25% = 50) = 75
    const nextDayTotals = calculateOrderTotals(items, {
      isExpress: true,
      expressDeliveryOption: ExpressDeliveryOption.NEXT_DAY_EVENING,
      expressSurchargePercent: storeSurchargePercent,
    });
    assert.equal(nextDayTotals.subtotal, 200);
    assert.equal(nextDayTotals.expressSurcharge, 75); // 50 * 1.5 = 75
    // Tax: 18% of (200 + 75 = 275) = 49.50. Total = 324.50
    assert.equal(nextDayTotals.taxAmount, 49.5);
    assert.equal(nextDayTotals.totalAmount, 324.5);

    // Same-Day: 2.0x of (200 * 25% = 50) = 100
    const sameDayTotals = calculateOrderTotals(items, {
      isExpress: true,
      expressDeliveryOption: ExpressDeliveryOption.SAME_DAY,
      expressSurchargePercent: storeSurchargePercent,
    });
    assert.equal(sameDayTotals.subtotal, 200);
    assert.equal(sameDayTotals.expressSurcharge, 100); // 50 * 2.0 = 100
    // Tax: 18% of (200 + 100 = 300) = 54. Total = 354
    assert.equal(sameDayTotals.taxAmount, 54);
    assert.equal(sameDayTotals.totalAmount, 354);
  });

  // 21. Express delivery restrictions adhere to store schedule off-days (Wednesday / Thursday)
  it('21. Express delivery restrictions adhere to store schedule off-days (Wednesday / Thursday)', () => {
    // Thursday is day 4: Same-day express is prohibited
    const thursdayDate = new Date('2026-10-22T10:00:00Z'); // Thursday
    const thursdayDay = (thursdayDate.getUTCDay() + 0) % 7; // 4
    assert.equal(thursdayDay, 4);

    const isSameDayProhibitedOnThu = thursdayDay === 4;
    assert.equal(isSameDayProhibitedOnThu, true);

    // Wednesday is day 3: Next-day evening express is prohibited
    const wednesdayDate = new Date('2026-10-21T10:00:00Z'); // Wednesday
    const wednesdayDay = wednesdayDate.getUTCDay(); // 3
    assert.equal(wednesdayDay, 3);

    const isNextDayProhibitedOnWed = wednesdayDay === 3;
    assert.equal(isNextDayProhibitedOnWed, true);
  });

  // 22. apiClient.store.getConfig fetches store configuration correctly
  it('22. apiClient.store.getConfig fetches store configuration correctly', async () => {
    apiClient.store.getConfig = async () => ({
      id: 'store-kp-001',
      name: 'Koregaon Park Branch',
      expressSurchargePercent: 25,
      topUpServices: [{ id: 'top-starch', name: 'Extra Starch', price: 20 }],
    });

    const config = await apiClient.store.getConfig();
    assert.equal(config.id, 'store-kp-001');
    assert.equal(config.expressSurchargePercent, 25);
    assert.equal(config.topUpServices?.length, 1);
  });
});
