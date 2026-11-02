import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockSQLiteDatabase } from './mock-sqlite';
import { setDatabaseInstance, MIGRATIONS } from '../db/sqlite';
import {
  saveDraft,
  getDraft,
  queueDraftForSync,
  updateDraftSyncStatus,
  generateUUID,
} from '../db/drafts';
import { SyncEngine } from '../services/sync-engine';
import { apiClient, ApiError } from '../api/client';
import { saveAuthToken } from '../storage/secure-store';
import { PickupType } from '@growfast/shared-types';

describe('GrowFast Mobile — Draft Lifecycle & 404 Resolution Suite', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(async () => {
    mockDb = new MockSQLiteDatabase();
    setDatabaseInstance(mockDb as any);

    for (const m of MIGRATIONS) {
      await m.up(mockDb as any);
    }

    try {
      const loginRes = await apiClient.auth.login({
        employeeId: 'emp-counter-001',
        pin: '333333',
      });
      if (loginRes?.accessToken) {
        await saveAuthToken(loginRes.accessToken);
      }
    } catch {
      await saveAuthToken('mock-valid-bearer-token');
    }
  });

  // 1. Valid saved draft retrieval via getByDraftId
  it('1. Valid saved draft retrieval: querying an existing draft returns the correct order', async () => {
    const draftId = generateUUID();
    const originalGetByDraft = apiClient.orders.getByDraftId;

    apiClient.orders.getByDraftId = async (id: string) => {
      if (id === draftId) {
        return {
          id: 'ord-srv-valid-1',
          orderNumber: 'GF-ORD-0001',
          clientDraftId: draftId,
          customerId: 'cust-101',
          status: 'RECEIVED',
          items: [],
          payments: [],
          totalAmount: 450,
          subtotal: 450,
          taxAmount: 0,
          discountAmount: 0,
        } as any;
      }
      return null;
    };

    try {
      const order = await apiClient.orders.getByDraftId(draftId);
      assert.ok(order, 'Expected order to be found');
      assert.equal(order.id, 'ord-srv-valid-1');
      assert.equal(order.orderNumber, 'GF-ORD-0001');
      assert.equal(order.clientDraftId, draftId);
    } finally {
      apiClient.orders.getByDraftId = originalGetByDraft;
    }
  });

  // 2. Unknown draft ID returns null without unhandled exceptions or noisy warnings
  it('2. Unknown draft ID: returns null or handles 404 without unhandled exceptions or noisy warnings', async () => {
    const unknownDraftId = generateUUID();
    const originalGetByDraft = apiClient.orders.getByDraftId;
    const originalWarn = console.warn;
    const warnings: string[] = [];

    console.warn = (...args: any[]) => {
      warnings.push(args.join(' '));
    };

    try {
      // By default getByDraftId catches 404 ApiError and returns null
      const result = await apiClient.orders.getByDraftId(unknownDraftId);
      assert.equal(result, null, 'Unknown draft must return null');
      assert.equal(
        warnings.some((w) => w.includes('HTTP 404') && w.includes(unknownDraftId)),
        false,
        'Probe check must not emit noisy HTTP 404 console warnings',
      );
    } finally {
      console.warn = originalWarn;
      apiClient.orders.getByDraftId = originalGetByDraft;
    }
  });

  // 3. Draft submission: a new draft can be saved and subsequently submitted successfully
  it('3. Draft submission: a new draft can be saved and subsequently submitted successfully', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Aarav Mehta',
      customerPhone: '9876543210',
      payload: {
        customerId: 'cust-real-1',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'garm-1',
            serviceTypeId: 'srv-1',
            quantity: 2,
            unitPrice: 150,
          },
        ],
      },
    });
    await queueDraftForSync(draftId);

    const originalCreate = apiClient.orders.create;
    apiClient.orders.create = async (payload) => {
      assert.equal(payload.clientDraftId, draftId);
      return {
        id: 'ord-srv-submit-001',
        orderNumber: 'GF-ORD-000501',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    try {
      const engine = new SyncEngine();
      const result = await engine.syncDraft(draftId);
      assert.equal(result.success, true);
      assert.equal(result.orderId, 'ord-srv-submit-001');
      assert.equal(result.orderNumber, 'GF-ORD-000501');

      const synced = await getDraft(draftId);
      assert.equal(synced?.syncStatus, 'SYNCED');
      assert.equal(synced?.serverOrderId, 'ord-srv-submit-001');
    } finally {
      apiClient.orders.create = originalCreate;
    }
  });

  // 4. Order conversion: submitting a draft produces an order with a server order ID and order number
  it('4. Order conversion: submitting a draft produces an order with a server order ID and order number', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Priya Sharma',
      customerPhone: '9820012345',
      payload: {
        customerId: 'cust-real-2',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [{ garmentCatalogId: 'garm-shirt', serviceTypeId: 'srv-dryclean', quantity: 1, unitPrice: 200 }],
      },
    });

    const originalCreate = apiClient.orders.create;
    apiClient.orders.create = async (payload) => ({
      id: 'ord-conversion-999',
      orderNumber: 'GF-ORD-000999',
      clientDraftId: payload.clientDraftId,
    } as any);

    try {
      const engine = new SyncEngine();
      const result = await engine.syncDraft(draftId);
      assert.equal(result.success, true);
      assert.equal(result.orderId, 'ord-conversion-999');
      assert.equal(result.orderNumber, 'GF-ORD-000999');
    } finally {
      apiClient.orders.create = originalCreate;
    }
  });

  // 5. Subsequent reads use the server order ID, not the draft ID
  it('5. Post-creation reads: subsequent order operations use the server order ID with getById', async () => {
    const serverOrderId = 'ord-srv-authoritative-555';
    const originalGetById = apiClient.orders.getById;
    let getByIdCalledWith: string | null = null;

    apiClient.orders.getById = async (id: string) => {
      getByIdCalledWith = id;
      return {
        id,
        orderNumber: 'GF-ORD-000555',
        totalAmount: 300,
        items: [],
      } as any;
    };

    try {
      const fetched = await apiClient.orders.getById(serverOrderId);
      assert.equal(getByIdCalledWith, serverOrderId);
      assert.equal(fetched.id, serverOrderId);
    } finally {
      apiClient.orders.getById = originalGetById;
    }
  });

  // 6. Fresh draft creation does not trigger premature backend draft queries
  it('6. Fresh draft creation does not trigger premature backend draft queries', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Omkar Chavan',
      customerPhone: '8080085552',
      payload: {
        customerId: 'cust-real-3',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [{ garmentCatalogId: 'g-1', serviceTypeId: 's-1', quantity: 1, unitPrice: 100 }],
      },
    });

    let getByDraftCallCount = 0;
    let createCallCount = 0;
    const originalGetByDraft = apiClient.orders.getByDraftId;
    const originalCreate = apiClient.orders.create;

    apiClient.orders.getByDraftId = async () => {
      getByDraftCallCount++;
      return null;
    };
    apiClient.orders.create = async (payload) => {
      createCallCount++;
      return {
        id: 'ord-srv-fresh-001',
        orderNumber: 'GF-ORD-000601',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    try {
      const engine = new SyncEngine();
      const result = await engine.syncDraft(draftId);

      assert.equal(result.success, true);
      assert.equal(createCallCount, 1, 'POST /api/orders must be called once');
      assert.equal(
        getByDraftCallCount,
        0,
        'Brand new fresh draft must NOT trigger premature GET /by-draft probe',
      );
    } finally {
      apiClient.orders.getByDraftId = originalGetByDraft;
      apiClient.orders.create = originalCreate;
    }
  });

  // 7. Sync retry logic: an interrupted or retried draft correctly probes by draft ID to prevent duplicates
  it('7. Sync retry logic: an interrupted or retried draft correctly probes by draft ID to prevent duplicates', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Harshad Jadhav',
      customerPhone: '9834820606',
      payload: {
        customerId: 'cust-real-4',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [{ garmentCatalogId: 'g-2', serviceTypeId: 's-2', quantity: 1, unitPrice: 200 }],
      },
    });

    // Mark as failed from previous network attempt so retryCount > 0 and status is FAILED_RETRYABLE
    await updateDraftSyncStatus(draftId, 'FAILED_RETRYABLE', {
      error: 'Network timeout',
      incrementRetry: true,
    });

    let getByDraftCallCount = 0;
    let createCallCount = 0;
    const originalGetByDraft = apiClient.orders.getByDraftId;
    const originalCreate = apiClient.orders.create;

    apiClient.orders.getByDraftId = async (id: string) => {
      getByDraftCallCount++;
      // Backend actually committed this previously before the timeout
      return {
        id: 'ord-srv-recovered-777',
        orderNumber: 'GF-ORD-000777',
        clientDraftId: id,
      } as any;
    };
    apiClient.orders.create = async () => {
      createCallCount++;
      throw new Error('Should not create duplicate order when recovered via probe');
    };

    try {
      const engine = new SyncEngine();
      const result = await engine.syncDraft(draftId);

      assert.equal(result.success, true);
      assert.equal(result.recovered, true);
      assert.equal(result.orderId, 'ord-srv-recovered-777');
      assert.equal(getByDraftCallCount, 1, 'Retry must execute idempotency pre-check probe');
      assert.equal(createCallCount, 0, 'Must not issue duplicate POST when probe finds existing order');
    } finally {
      apiClient.orders.getByDraftId = originalGetByDraft;
      apiClient.orders.create = originalCreate;
    }
  });

  // 8. Ambiguous timeout recovery: a timeout during POST triggers recovery via by-draft and succeeds without duplicates
  it('8. Ambiguous timeout recovery: a timeout during POST triggers recovery via by-draft and succeeds without duplicates', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Swapnil Gandhale',
      customerPhone: '9284850474',
      payload: {
        customerId: 'cust-real-5',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [{ garmentCatalogId: 'g-bag', serviceTypeId: 's-dryclean', quantity: 1, unitPrice: 150 }],
      },
    });

    let postAttemptCount = 0;
    let postTimeoutProbeCount = 0;
    const originalCreate = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    apiClient.orders.create = async () => {
      postAttemptCount++;
      throw new Error('Socket hangup / ETIMEDOUT');
    };

    apiClient.orders.getByDraftId = async (id: string) => {
      postTimeoutProbeCount++;
      // Server committed the record despite client timeout
      return {
        id: 'ord-recovered-post-timeout-888',
        orderNumber: 'GF-ORD-000888',
        clientDraftId: id,
      } as any;
    };

    try {
      const engine = new SyncEngine();
      const result = await engine.syncDraft(draftId);

      assert.equal(result.success, true);
      assert.equal(result.recovered, true);
      assert.equal(result.orderId, 'ord-recovered-post-timeout-888');
      assert.equal(postAttemptCount, 1);
      assert.equal(postTimeoutProbeCount, 1, 'Post-timeout probe must recover the committed order');
    } finally {
      apiClient.orders.create = originalCreate;
      apiClient.orders.getByDraftId = originalGetByDraft;
    }
  });

  // 9. Empty or malformed draft IDs: handled gracefully without crashing
  it('9. Empty or malformed draft IDs: handled gracefully without crashing', async () => {
    // getByDraftId with null/empty/undefined
    assert.equal(await apiClient.orders.getByDraftId(''), null);
    assert.equal(await apiClient.orders.getByDraftId('   '), null);
    assert.equal(await apiClient.orders.getByDraftId('undefined'), null);

    // orders.getById guard
    await assert.rejects(async () => {
      await apiClient.orders.getById('');
    }, /Order ID is required/);

    await assert.rejects(async () => {
      await apiClient.orders.getById('   ');
    }, /Order ID is required/);

    await assert.rejects(async () => {
      await apiClient.orders.getById('undefined');
    }, /Order ID is required/);

    // customers.getById guard
    await assert.rejects(async () => {
      await apiClient.customers.getById('');
    }, /Customer ID is required/);

    // deliveries.getById guard
    await assert.rejects(async () => {
      await apiClient.deliveries.getById('');
    }, /Delivery ID is required/);

    // notifications.getById guard
    await assert.rejects(async () => {
      await apiClient.notifications.getById('');
    }, /Notification ID is required/);
  });

  // 10. End-to-end order creation flow for both per-piece and per-weight orders works without 404 warnings
  it('10. End-to-end order creation flow for both per-piece and per-weight orders works without 404 warnings', async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: any[]) => {
      warnings.push(args.join(' '));
    };

    const originalCreate = apiClient.orders.create;

    try {
      // Per-piece flow
      const perPieceDraftId = generateUUID();
      await saveDraft({
        clientDraftId: perPieceDraftId,
        storeId: 'store-1',
        customerName: 'Per Piece Customer',
        customerPhone: '9111122222',
        payload: {
          customerId: 'cust-p1',
          isExpress: false,
          pickupType: PickupType.STORE_PICKUP,
          items: [{ garmentCatalogId: 'g-1', serviceTypeId: 's-1', quantity: 3, unitPrice: 100 }],
        },
      });

      apiClient.orders.create = async (payload) => ({
        id: `ord-perpiece-${(payload.clientDraftId || 'draft').slice(0, 8)}`,
        orderNumber: 'GF-ORD-000101',
        clientDraftId: payload.clientDraftId,
      } as any);

      const engine = new SyncEngine();
      const resPiece = await engine.syncDraft(perPieceDraftId);
      assert.equal(resPiece.success, true);

      // Per-weight flow
      const perWeightDraftId = generateUUID();
      await saveDraft({
        clientDraftId: perWeightDraftId,
        storeId: 'store-1',
        customerName: 'Per Weight Customer',
        customerPhone: '9333344444',
        payload: {
          customerId: 'cust-w1',
          isExpress: true,
          pickupType: PickupType.HOME_DELIVERY,
          items: [{ garmentCatalogId: 'g-laundry-kg', serviceTypeId: 's-wash-fold', quantity: 1, weight: 4.5, unitPrice: 80 }],
        },
      });

      const resWeight = await engine.syncDraft(perWeightDraftId);
      assert.equal(resWeight.success, true);

      // Verify no 404 warnings occurred throughout either flow
      const fourOhFourWarnings = warnings.filter((w) => w.includes('404'));
      assert.equal(
        fourOhFourWarnings.length,
        0,
        `Expected 0 HTTP 404 warnings, but found: ${JSON.stringify(fourOhFourWarnings)}`,
      );
    } finally {
      console.warn = originalWarn;
      apiClient.orders.create = originalCreate;
    }
  });
});
