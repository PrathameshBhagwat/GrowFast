import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockSQLiteDatabase } from './mock-sqlite';
import { setDatabaseInstance, MIGRATIONS } from '../db/sqlite';
import {
  saveDraft,
  generateUUID,
} from '../db/drafts';
import {
  savePhotoLocally,
  getPhotosForDraft,
  linkPhotosToOrder,
  getPhotosReadyForUpload,
  updatePhotoSyncStatus,
  setFileExistsInTest,
  checkFileExists,
  cleanupExpiredMobilePhotos,
  PendingPhoto,
} from '../db/photos';
import { SyncEngine } from '../services/sync-engine';
import { apiClient } from '../api/client';
import { saveAuthToken } from '../storage/secure-store';
import { PhotoType, PickupType } from '@growfast/shared-types';

describe('GrowFast Mobile — 10-Day Photo Retention & Managed Storage Cleanup', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(async () => {
    mockDb = new MockSQLiteDatabase();
    setDatabaseInstance(mockDb as any);

    for (const m of MIGRATIONS) {
      await m.up(mockDb as any);
    }

    await saveAuthToken('test-valid-jwt-token');
  });

  const fixedNow = new Date('2026-10-25T12:00:00.000Z');

  // ── Test 15: Expired cached photo is removed after synchronization ────
  it('15. Expired cached photo is removed after synchronization', async () => {
    const draftId = generateUUID();
    const serverOrderId = 'server-order-expired-15';
    const fakeUri = 'file:///app_storage/growfast_photos/photo-exp-15.jpg';
    setFileExistsInTest(fakeUri, true);

    // Save photo and link to server order
    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: fakeUri,
      photoType: PhotoType.FRONT,
    });
    await linkPhotosToOrder(draftId, serverOrderId);

    // Simulate photo was previously synced
    const photos = await getPhotosForDraft(draftId);
    assert.strictEqual(photos.length, 1);
    await updatePhotoSyncStatus(photos[0].id, 'UPLOADED', { serverPhotoId: 'srv-p1' });

    // Order delivered 15 days ago (expired under 10-day retention)
    const deliveredOrders = new Map<string, string>([
      [serverOrderId, '2026-10-10T12:00:00.000Z'],
    ]);

    const result = await cleanupExpiredMobilePhotos({
      deliveredOrders,
      now: fixedNow,
    });

    assert.strictEqual(result.cleanedCount, 1);
    assert.strictEqual(result.filesDeleted, 1);

    // Verify local file deleted from managed storage
    const fileStillExists = await checkFileExists(fakeUri);
    assert.strictEqual(fileStillExists, false);

    // Verify SQLite record removed
    const remainingPhotos = await getPhotosForDraft(draftId);
    assert.strictEqual(remainingPhotos.length, 0);
  });

  // ── Test 16: Active-order photos remain available ─────────────────────
  it('16. Active-order photos remain available (not expired)', async () => {
    const draftId = generateUUID();
    const serverOrderId = 'server-order-active-16';
    const fakeUri = 'file:///app_storage/growfast_photos/photo-active-16.jpg';
    setFileExistsInTest(fakeUri, true);

    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: fakeUri,
      photoType: PhotoType.FRONT,
    });
    await linkPhotosToOrder(draftId, serverOrderId);

    // Delivered only 3 days ago (not expired)
    const deliveredOrders = new Map<string, string>([
      [serverOrderId, '2026-10-22T12:00:00.000Z'],
    ]);

    const result = await cleanupExpiredMobilePhotos({
      deliveredOrders,
      now: fixedNow,
    });

    assert.strictEqual(result.cleanedCount, 0);
    assert.strictEqual(result.skippedActiveCount, 1);

    // File and SQLite record preserved
    assert.strictEqual(await checkFileExists(fakeUri), true);
    const photos = await getPhotosForDraft(draftId);
    assert.strictEqual(photos.length, 1);
  });

  // ── Test 17: Offline drafts and pending uploads are handled safely ────
  it('17. Offline drafts and pending uploads are handled safely without being prematurely deleted', async () => {
    const draftId = generateUUID();
    const fakeUri = 'file:///app_storage/growfast_photos/photo-draft-17.jpg';
    setFileExistsInTest(fakeUri, true);

    // Draft created offline, serverOrderId is null
    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: fakeUri,
      photoType: PhotoType.FRONT,
    });

    const result = await cleanupExpiredMobilePhotos({
      now: fixedNow,
    });

    assert.strictEqual(result.cleanedCount, 0);
    assert.strictEqual(result.skippedActiveCount, 1);

    // Draft photo remains available
    assert.strictEqual(await checkFileExists(fakeUri), true);
    const photos = await getPhotosForDraft(draftId);
    assert.strictEqual(photos.length, 1);
  });

  // ── Test 18: An expired photo is not uploaded again after reconnection ─
  it('18. An expired photo is not uploaded again after reconnection', async () => {
    const draftId = generateUUID();
    const serverOrderId = 'server-order-18';
    const fakeUri = 'file:///app_storage/growfast_photos/photo-reconnect-18.jpg';
    setFileExistsInTest(fakeUri, true);

    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: fakeUri,
      photoType: PhotoType.FRONT,
    });
    await linkPhotosToOrder(draftId, serverOrderId);

    let uploadCalled = false;
    // Mock apiClient
    apiClient.orders.getById = async (orderId: string): Promise<any> => {
      assert.strictEqual(orderId, serverOrderId);
      return {
        id: serverOrderId,
        status: 'DELIVERED',
        deliveredAt: '2026-10-10T12:00:00.000Z', // 15 days ago -> expired!
      };
    };

    apiClient.photos.upload = async () => {
      uploadCalled = true;
      return { id: 'p1', url: 'http://example.com/p1.jpg' };
    };

    const syncEngine = new SyncEngine();
    const syncResult = await syncEngine.syncPhotosForDraft(draftId, serverOrderId);

    // Verify upload was NOT called because photo is expired
    assert.strictEqual(uploadCalled, false);
    assert.strictEqual(syncResult.uploaded, 0);

    // Verify photo was cleaned up from local storage upon detecting expiration
    const remainingPhotos = await getPhotosForDraft(draftId);
    assert.strictEqual(remainingPhotos.length, 0);
    assert.strictEqual(await checkFileExists(fakeUri), false);
  });

  // ── Test 19: App restart does not restore deleted managed photo ───────
  it('19. App restart does not restore a deleted managed photo from stale metadata', async () => {
    const draftId = generateUUID();
    const serverOrderId = 'server-order-19';
    const fakeUri = 'file:///app_storage/growfast_photos/photo-restart-19.jpg';
    setFileExistsInTest(fakeUri, true);

    await savePhotoLocally({
      clientDraftId: draftId,
      sourceUri: fakeUri,
      photoType: PhotoType.FRONT,
    });
    await linkPhotosToOrder(draftId, serverOrderId);

    // Run cleanup
    await cleanupExpiredMobilePhotos({
      expiredOrderIds: [serverOrderId],
      now: fixedNow,
    });

    // Simulate app restart by querying SQLite anew
    const photosAfterRestart = await getPhotosForDraft(draftId);
    assert.strictEqual(photosAfterRestart.length, 0);

    const readyForUpload = await getPhotosReadyForUpload();
    assert.strictEqual(readyForUpload.length, 0);

    assert.strictEqual(await checkFileExists(fakeUri), false);
  });

  // ── Test 20: Cleanup does not erase unrelated cached data ─────────────
  it('20. Cleanup does not erase unrelated cached data or photos of other active orders', async () => {
    const activeDraftId = generateUUID();
    const activeServerOrderId = 'server-order-active-20';
    const activeUri = 'file:///app_storage/growfast_photos/active-photo-20.jpg';
    setFileExistsInTest(activeUri, true);

    const expiredDraftId = generateUUID();
    const expiredServerOrderId = 'server-order-expired-20';
    const expiredUri = 'file:///app_storage/growfast_photos/expired-photo-20.jpg';
    setFileExistsInTest(expiredUri, true);

    // Save both photos
    await savePhotoLocally({
      clientDraftId: activeDraftId,
      sourceUri: activeUri,
    });
    await linkPhotosToOrder(activeDraftId, activeServerOrderId);

    await savePhotoLocally({
      clientDraftId: expiredDraftId,
      sourceUri: expiredUri,
    });
    await linkPhotosToOrder(expiredDraftId, expiredServerOrderId);

    // Run cleanup targeting only the expired order
    const result = await cleanupExpiredMobilePhotos({
      expiredOrderIds: [expiredServerOrderId],
      now: fixedNow,
    });

    assert.strictEqual(result.cleanedCount, 1);

    // Expired photo is gone
    assert.strictEqual(await checkFileExists(expiredUri), false);
    const expiredRemaining = await getPhotosForDraft(expiredDraftId);
    assert.strictEqual(expiredRemaining.length, 0);

    // Active photo is preserved and completely untouched
    assert.strictEqual(await checkFileExists(activeUri), true);
    const activeRemaining = await getPhotosForDraft(activeDraftId);
    assert.strictEqual(activeRemaining.length, 1);
    assert.strictEqual(activeRemaining[0].localFileUri, activeUri);
  });
});
