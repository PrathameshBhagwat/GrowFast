import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockSQLiteDatabase } from './mock-sqlite';
import { setDatabaseInstance, MIGRATIONS } from '../db/sqlite';
import {
  saveDraft,
  getDraft,
  listDrafts,
  queueDraftForSync,
  deleteDraft,
  updateDraftSyncStatus,
  generateUUID,
} from '../db/drafts';
import {
  savePhotoLocally,
  getPhotosForDraft,
  linkPhotosToOrder,
  getPhotosReadyForUpload,
  updatePhotoSyncStatus,
  deletePhoto,
} from '../db/photos';
import { SyncEngine } from '../services/sync-engine';
import { apiClient, ApiError } from '../api/client';
import { saveAuthToken, removeAuthToken } from '../storage/secure-store';
import { PhotoType, PickupType, ServiceCategory } from '@growfast/shared-types';

describe('GrowFast Mobile Phase C — Offline Drafts & Synchronization Engine', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(async () => {
    mockDb = new MockSQLiteDatabase();
    setDatabaseInstance(mockDb as any);

    // Apply migrations v1, v2, v3
    for (const m of MIGRATIONS) {
      await m.up(mockDb as any);
    }

    // Set a valid auth token by default in memory
    await saveAuthToken('test-valid-jwt-token');
  });

  // 1. Create, edit, reopen, and delete a local draft
  it('1. Create, edit, reopen, and delete a local draft', async () => {
    const draftId = generateUUID();
    const storeId = 'store-mumbai-01';

    // Create
    const created = await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Aarav Patel',
      customerPhone: '9876543210',
      payload: {
        customerId: 'cust-1',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-1',
            serviceTypeId: ServiceCategory.WASH_IRON,
            quantity: 3,
            defectNotes: 'Blue shirt',
          },
        ],
      },
    });

    assert.equal(created.clientDraftId, draftId);
    assert.equal(created.customerName, 'Aarav Patel');
    assert.equal(created.syncStatus, 'DRAFT');

    // Reopen
    const reopened = await getDraft(draftId);
    assert.ok(reopened);
    assert.equal(reopened.customerPhone, '9876543210');
    assert.equal(reopened.payload.items.length, 1);

    // Edit
    const updated = await saveDraft({
      clientDraftId: draftId,
      storeId,
      customerName: 'Aarav Patel (VIP)',
      customerPhone: '9876543210',
      isExpress: true,
      payload: {
        customerId: 'cust-1',
        isExpress: true,
        pickupType: PickupType.STORE_PICKUP,
        items: [
          {
            garmentCatalogId: 'cat-1',
            serviceTypeId: ServiceCategory.WASH_IRON,
            quantity: 5,
            defectNotes: 'Blue shirts batch',
          },
        ],
      },
    });

    assert.equal(updated.customerName, 'Aarav Patel (VIP)');
    assert.equal(updated.isExpress, true);
    assert.equal(updated.payload.items[0].quantity, 5);

    // Delete
    const deleted = await deleteDraft(draftId);
    assert.equal(deleted, true);

    const recheck = await getDraft(draftId);
    assert.equal(recheck, null);
  });

  // 2. Draft persistence after simulated app restart
  it('2. Draft persistence after simulated app restart', async () => {
    const draftId = generateUUID();

    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Sneha Sharma',
      customerPhone: '9123456789',
      payload: {
        customerId: 'cust-2',
        isExpress: false,
        pickupType: PickupType.HOME_DELIVERY,
        items: [],
      },
    });

    // Simulate restart: re-initialize database instance pointing to existing backing tables
    const restartedDb = new MockSQLiteDatabase();
    restartedDb.tables = mockDb.tables;
    setDatabaseInstance(restartedDb as any);

    const persisted = await getDraft(draftId);
    assert.ok(persisted);
    assert.equal(persisted.customerName, 'Sneha Sharma');
    assert.equal(persisted.clientDraftId, draftId);
  });

  // 3. SQLite migration from previous schema without data loss
  it('3. SQLite migration from previous schema without data loss', async () => {
    const migrationDb = new MockSQLiteDatabase();

    // Step 1: Run Version 1
    await MIGRATIONS[0].up(migrationDb as any);
    await migrationDb.runAsync(
      `INSERT INTO order_drafts (id, client_draft_id, store_id, customer_name, customer_phone, payload_json, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [
        'id-1',
        'draft-v1',
        'store-1',
        'Legacy User',
        '9999999999',
        '{}',
        '2026-10-01',
        '2026-10-01',
      ],
    );

    // Step 2: Run Version 2
    await MIGRATIONS[1].up(migrationDb as any);
    await migrationDb.runAsync(
      `INSERT INTO pending_photos (id, client_draft_id, local_file_uri, photo_type, sync_status, created_at)
       VALUES (?, ?, ?, 'FRONT', 'PENDING', ?)`,
      ['photo-1', 'draft-v1', 'file:///photos/legacy.jpg', '2026-10-01'],
    );

    // Step 3: Run Version 3 (additive columns)
    await MIGRATIONS[2].up(migrationDb as any);

    // Verify existing data preserved
    const draftRows = await migrationDb.getAllAsync<any>(
      'SELECT * FROM order_drafts WHERE client_draft_id = ?',
      ['draft-v1'],
    );
    assert.equal(draftRows.length, 1);
    assert.equal(draftRows[0].customer_name, 'Legacy User');
    assert.equal(draftRows[0].server_order_id, null); // New column present and nullable
    assert.equal(draftRows[0].retry_count, null);

    const photoRows = await migrationDb.getAllAsync<any>(
      'SELECT * FROM pending_photos WHERE client_draft_id = ?',
      ['draft-v1'],
    );
    assert.equal(photoRows.length, 1);
    assert.equal(photoRows[0].server_photo_id, null);
  });

  // 4. Offline submission queues a draft without inventing an official order
  it('4. Offline submission queues a draft without inventing an official order', async () => {
    const draftId = generateUUID();

    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Pooja Verma',
      customerPhone: '9888877777',
      payload: {
        customerId: 'cust-3',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });

    const queued = await queueDraftForSync(draftId);
    assert.equal(queued.syncStatus, 'QUEUED');
    assert.equal(queued.serverOrderId, null);
    assert.equal(queued.serverOrderNumber, null); // NEVER generate official order number locally
  });

  // 5. Successful synchronization updates the draft with server-confirmed order reference
  it('5. Successful synchronization updates the draft with server-confirmed order reference', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Vikram Malhotra',
      customerPhone: '9777766666',
      payload: {
        customerId: 'cust-4',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    // Mock apiClient
    const originalCreate = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };
    apiClient.orders.create = async (payload) => {
      return {
        id: 'ord-srv-901',
        orderNumber: 'T20261022-001',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.orderId, 'ord-srv-901');
    assert.equal(result.orderNumber, 'T20261022-001');

    const syncedDraft = await getDraft(draftId);
    assert.ok(syncedDraft);
    assert.equal(syncedDraft.syncStatus, 'SYNCED');
    assert.equal(syncedDraft.serverOrderId, 'ord-srv-901');
    assert.equal(syncedDraft.serverOrderNumber, 'T20261022-001');

    // Restore
    apiClient.orders.create = originalCreate;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 6. A timeout after the server commits recovers the original order without duplication
  it('6. A timeout after the server commits recovers the original order without duplication', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Neha Gupta',
      customerPhone: '9666655555',
      payload: {
        customerId: 'cust-5',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    const originalCreate = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    // Simulate: create order throws network timeout, but backend actually committed it
    let createCalled = false;
    apiClient.orders.create = async () => {
      createCalled = true;
      throw new Error('ETIMEDOUT: Connection timed out');
    };

    // getByDraftId succeeds because server committed the order
    apiClient.orders.getByDraftId = async (id) => {
      return {
        id: 'ord-recovered-102',
        orderNumber: 'T20261022-102',
        clientDraftId: id,
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.recovered, true);
    assert.equal(result.orderId, 'ord-recovered-102');
    assert.equal(result.orderNumber, 'T20261022-102');

    const synced = await getDraft(draftId);
    assert.equal(synced?.syncStatus, 'SYNCED');
    assert.equal(synced?.serverOrderId, 'ord-recovered-102');

    apiClient.orders.create = originalCreate;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 7. Repeated synchronization does not create duplicate orders
  it('7. Repeated synchronization does not create duplicate orders', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Kunal Sen',
      customerPhone: '9555544444',
      payload: {
        customerId: 'cust-6',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });

    // Mark as already SYNCED
    await updateDraftSyncStatus(draftId, 'SYNCED', {
      serverOrderId: 'ord-existing-303',
      serverOrderNumber: 'T20261022-303',
    });

    let networkCallOccurred = false;
    const originalCreate = apiClient.orders.create;
    apiClient.orders.create = async () => {
      networkCallOccurred = true;
      return {} as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.orderId, 'ord-existing-303');
    assert.equal(networkCallOccurred, false); // Zero network calls made for already synced draft

    apiClient.orders.create = originalCreate;
  });

  // 8. Concurrent sync attempts do not submit the same draft twice unnecessarily
  it('8. Concurrent sync attempts do not submit the same draft twice unnecessarily', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Ananya Roy',
      customerPhone: '9444433333',
      payload: {
        customerId: 'cust-7',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    let createCallCount = 0;
    const originalCreate = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };
    apiClient.orders.create = async (payload) => {
      createCallCount++;
      // Artificial delay to simulate in-flight request
      await new Promise((res) => setTimeout(res, 30));
      return {
        id: 'ord-concurrent-404',
        orderNumber: 'T-404',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    const engine = new SyncEngine();

    // Trigger two sync calls concurrently
    const [p1, p2] = await Promise.all([engine.syncDraft(draftId), engine.syncDraft(draftId)]);

    // One succeeds, second is blocked by lock
    assert.equal(createCallCount, 1);
    assert.ok(p1.success || p2.success);
    if (!p1.success) {
      assert.ok(p1.error?.includes('already'));
    } else if (!p2.success) {
      assert.ok(p2.error?.includes('already'));
    }

    apiClient.orders.create = originalCreate;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 9. HTTP 409 preserves the draft and exposes a recoverable conflict
  it('9. HTTP 409 preserves the draft and exposes a recoverable conflict', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Conflict Customer',
      customerPhone: '9333322222',
      payload: {
        customerId: 'cust-8',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    const originalCreate = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };
    apiClient.orders.create = async () => {
      throw new ApiError(
        'Client draft ID was already submitted with different payload details.',
        409,
      );
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, false);
    assert.equal(result.isConflict, true);

    const draft = await getDraft(draftId);
    assert.ok(draft);
    assert.equal(draft.syncStatus, 'CONFLICT');
    assert.ok(draft.conflictDetails?.includes('different payload'));

    apiClient.orders.create = originalCreate;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 10. Authentication expiry does not discard local work
  it('10. Authentication expiry does not discard local work', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Auth Expired User',
      customerPhone: '9222211111',
      payload: {
        customerId: 'cust-9',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    // Remove auth token to simulate expired session
    await removeAuthToken();

    let authExpiredTriggered = false;
    const engine = new SyncEngine({
      onAuthExpired: () => {
        authExpiredTriggered = true;
      },
    });

    const result = await engine.syncDraft(draftId);
    assert.equal(result.success, false);
    assert.equal(authExpiredTriggered, true);

    // Verify draft is preserved intact
    const preserved = await getDraft(draftId);
    assert.ok(preserved);
    assert.equal(preserved.syncStatus, 'FAILED_RETRYABLE');
    assert.equal(preserved.customerName, 'Auth Expired User');
  });

  // 11. Retryable failures use bounded backoff
  it('11. Retryable failures use bounded backoff', () => {
    const engine = new SyncEngine({
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    });

    const delay0 = engine.calculateBackoff(0);
    assert.ok(delay0 >= 1000 && delay0 <= 1500, `delay0 ${delay0} out of range`);

    const delay1 = engine.calculateBackoff(1);
    assert.ok(delay1 >= 2000 && delay1 <= 2500, `delay1 ${delay1} out of range`);

    const delay2 = engine.calculateBackoff(2);
    assert.ok(delay2 >= 4000 && delay2 <= 4500, `delay2 ${delay2} out of range`);

    // High attempt capped at maxDelayMs (30000 + 500 jitter)
    const delayHigh = engine.calculateBackoff(10);
    assert.ok(delayHigh >= 30000 && delayHigh <= 30500, `delayHigh ${delayHigh} out of range`);
  });

  // 12. Photo metadata persists across restarts and failed uploads can retry
  it('12. Photo metadata persists across restarts and failed uploads can retry', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerName: 'Photo User',
      payload: {
        customerId: 'c1',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });

    const photo = await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: 'file:///data/local_photo.jpg',
      photoType: PhotoType.FRONT,
    });

    assert.ok(photo.id);
    assert.equal(photo.syncStatus, 'PENDING');

    // Simulate failed upload
    await updatePhotoSyncStatus(photo.id, 'FAILED', {
      error: '503 Service Unavailable',
      incrementRetry: true,
    });

    const draftPhotos = await getPhotosForDraft(draftId);
    assert.equal(draftPhotos.length, 1);
    assert.equal(draftPhotos[0].syncStatus, 'FAILED');
    assert.equal(draftPhotos[0].retryCount, 1);
  });

  // 13. Missing or deleted local photo files are handled safely
  it('13. Missing or deleted local photo files are handled safely', async () => {
    const draftId = generateUUID();
    const photo = await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: 'file:///nonexistent/deleted_file.jpg',
      photoType: PhotoType.DAMAGE,
    });

    await linkPhotosToOrder(draftId, 'ord-server-555');

    const engine = new SyncEngine();
    // syncPhotosForDraft should detect missing file and mark FILE_MISSING without throwing
    const res = await engine.syncPhotosForDraft(draftId, 'ord-server-555');
    assert.equal(res.failed, 1);

    const photos = await getPhotosForDraft(draftId);
    assert.equal(photos[0].syncStatus, 'FILE_MISSING');
  });

  // 14. Photo upload cannot begin before the required server order confirmation
  it('14. Photo upload cannot begin before the required server order confirmation', async () => {
    const draftId = generateUUID();
    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: 'file:///data/unconfirmed.jpg',
      photoType: PhotoType.FRONT,
    });

    // Before order confirmation, photos have no server_order_id
    const readyPhotos = await getPhotosReadyForUpload();
    assert.equal(readyPhotos.length, 0); // No photos eligible for upload

    // Once server order confirmed:
    await linkPhotosToOrder(draftId, 'ord-confirmed-777');
    const eligiblePhotos = await getPhotosReadyForUpload();
    assert.equal(eligiblePhotos.length, 1);
    assert.equal(eligiblePhotos[0].serverOrderId, 'ord-confirmed-777');
  });

  // 15. Successful uploads are not repeated unnecessarily
  it('15. Successful uploads are not repeated unnecessarily', async () => {
    const draftId = generateUUID();
    const photo = await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: 'file:///data/uploaded.jpg',
      photoType: PhotoType.FRONT,
    });

    await linkPhotosToOrder(draftId, 'ord-888');

    // Mark as already UPLOADED
    await updatePhotoSyncStatus(photo.id, 'UPLOADED', {
      serverPhotoId: 'srv-photo-uuid-999',
    });

    const readyPhotos = await getPhotosReadyForUpload();
    assert.equal(readyPhotos.length, 0); // Already uploaded photos are skipped
  });

  // 16. Offline temporary customer ID resolves existing customer by phone and submits order idempotently
  it('16. Offline temporary customer ID resolves existing server customer by phone and submits order idempotently', async () => {
    const draftId = generateUUID();
    const tempCustomerId = 'cust-offline-temp';

    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerId: tempCustomerId,
      customerName: 'Ananya Deshmukh',
      customerPhone: '9820011223',
      payload: {
        customerId: tempCustomerId,
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    const originalSearch = apiClient.customers.search;
    const originalCreateCust = apiClient.customers.create;
    const originalCreateOrder = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    let customerSearchCalledWith: string | null = null;
    let customerCreateCalled = false;
    let orderSubmittedCustomerId: string | null = null;

    apiClient.customers.search = async (query?: string) => {
      customerSearchCalledWith = query || null;
      return {
        success: true,
        data: [
          {
            id: 'cust-server-real-789',
            name: 'Ananya Deshmukh',
            phone: '9820011223',
          } as any,
        ],
        total: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      };
    };

    apiClient.customers.create = async () => {
      customerCreateCalled = true;
      throw new Error('Should not create duplicate customer when existing found');
    };

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };

    apiClient.orders.create = async (payload) => {
      orderSubmittedCustomerId = payload.customerId;
      assert.notEqual(
        payload.customerId,
        tempCustomerId,
        'Order submission must never receive temporary customer ID',
      );
      assert.equal(payload.clientDraftId, draftId, 'Original idempotency key must be preserved');
      return {
        id: 'ord-srv-real-555',
        orderNumber: 'ORD-20261025-0001',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(customerSearchCalledWith, '9820011223');
    assert.equal(customerCreateCalled, false, 'Duplicate customer must not be created');
    assert.equal(orderSubmittedCustomerId, 'cust-server-real-789');

    const syncedDraft = await getDraft(draftId);
    assert.ok(syncedDraft);
    assert.equal(syncedDraft.syncStatus, 'SYNCED');
    assert.equal(syncedDraft.customerId, 'cust-server-real-789');
    assert.equal(syncedDraft.payload.customerId, 'cust-server-real-789');
    assert.equal(syncedDraft.serverOrderId, 'ord-srv-real-555');

    // Restore
    apiClient.customers.search = originalSearch;
    apiClient.customers.create = originalCreateCust;
    apiClient.orders.create = originalCreateOrder;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 17. Offline temporary customer creates new server customer when phone not found and submits order
  it('17. Offline temporary customer creates new server customer when phone not found and submits order', async () => {
    const draftId = generateUUID();
    const tempCustomerId = 'cust-offline-temp';

    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerId: tempCustomerId,
      customerName: 'Pooja Hegde',
      customerPhone: '9833344455',
      payload: {
        customerId: tempCustomerId,
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    const originalSearch = apiClient.customers.search;
    const originalCreateCust = apiClient.customers.create;
    const originalCreateOrder = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    let customerCreatedPayload: any = null;
    let orderSubmittedCustomerId: string | null = null;

    apiClient.customers.search = async () => ({
      success: true,
      data: [],
      total: 0,
      page: 1,
      pageSize: 5,
      totalPages: 0,
    });

    apiClient.customers.create = async (payload) => {
      customerCreatedPayload = payload;
      return {
        id: 'cust-brand-new-999',
        name: payload.name,
        phone: payload.phone,
      } as any;
    };

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };

    apiClient.orders.create = async (payload) => {
      orderSubmittedCustomerId = payload.customerId;
      assert.equal(payload.customerId, 'cust-brand-new-999');
      return {
        id: 'ord-brand-new-111',
        orderNumber: 'ORD-20261025-0002',
        clientDraftId: payload.clientDraftId,
      } as any;
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(customerCreatedPayload.name, 'Pooja Hegde');
    assert.equal(customerCreatedPayload.phone, '9833344455');
    assert.equal(orderSubmittedCustomerId, 'cust-brand-new-999');

    const synced = await getDraft(draftId);
    assert.equal(synced?.customerId, 'cust-brand-new-999');
    assert.equal(synced?.payload.customerId, 'cust-brand-new-999');
    assert.equal(synced?.serverOrderId, 'ord-brand-new-111');

    // Restore
    apiClient.customers.search = originalSearch;
    apiClient.customers.create = originalCreateCust;
    apiClient.orders.create = originalCreateOrder;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 18. Customer resolution failure retains draft in FAILED_RETRYABLE and never submits temporary customer ID
  it('18. Customer resolution failure retains draft in FAILED_RETRYABLE and never submits temporary customer ID', async () => {
    const draftId = generateUUID();
    const tempCustomerId = 'cust-offline-temp';

    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerId: tempCustomerId,
      customerName: 'Fail Test User',
      customerPhone: '9811122233',
      payload: {
        customerId: tempCustomerId,
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await queueDraftForSync(draftId);

    const originalSearch = apiClient.customers.search;
    const originalCreateOrder = apiClient.orders.create;
    const originalGetByDraft = apiClient.orders.getByDraftId;

    let orderCreateAttempted = false;

    apiClient.orders.getByDraftId = async () => {
      throw new ApiError('Not found', 404);
    };

    apiClient.customers.search = async () => {
      throw new Error('Customer service network timeout');
    };

    apiClient.orders.create = async () => {
      orderCreateAttempted = true;
      throw new Error('Order creation must not be called when customer resolution fails');
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, false);
    assert.equal(
      orderCreateAttempted,
      false,
      'Must never submit order with unresolved temporary customer ID',
    );
    assert.match(result.error || '', /Customer resolution failed/i);

    const draftAfterFail = await getDraft(draftId);
    assert.ok(draftAfterFail);
    assert.equal(draftAfterFail.syncStatus, 'FAILED_RETRYABLE');
    assert.equal(draftAfterFail.retryCount, 1);
    assert.equal(
      draftAfterFail.clientDraftId,
      draftId,
      'Original draft identity must be preserved',
    );

    // Restore
    apiClient.customers.search = originalSearch;
    apiClient.orders.create = originalCreateOrder;
    apiClient.orders.getByDraftId = originalGetByDraft;
  });

  // 19. Repeated sync on resolved/synced order returns existing confirmed server order idempotently
  it('19. Repeated sync on resolved/synced order returns existing confirmed server order idempotently', async () => {
    const draftId = generateUUID();
    await saveDraft({
      clientDraftId: draftId,
      storeId: 'store-1',
      customerId: 'cust-resolved-444',
      customerName: 'Idempotency Check',
      customerPhone: '9900011122',
      payload: {
        customerId: 'cust-resolved-444',
        isExpress: false,
        pickupType: PickupType.STORE_PICKUP,
        items: [],
      },
    });
    await updateDraftSyncStatus(draftId, 'SYNCED', {
      serverOrderId: 'ord-already-synced-777',
      serverOrderNumber: 'ORD-20261025-0044',
    });

    let networkCallMade = false;
    const originalCreateOrder = apiClient.orders.create;
    apiClient.orders.create = async () => {
      networkCallMade = true;
      throw new Error('Network call should not be made for already SYNCED draft');
    };

    const engine = new SyncEngine();
    const result = await engine.syncDraft(draftId);

    assert.equal(result.success, true);
    assert.equal(result.orderId, 'ord-already-synced-777');
    assert.equal(result.orderNumber, 'ORD-20261025-0044');
    assert.equal(networkCallMade, false, 'No duplicate server submission should occur');

    // Restore
    apiClient.orders.create = originalCreateOrder;
  });
});
