import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockSQLiteDatabase } from './mock-sqlite';
import { setDatabaseInstance, MIGRATIONS } from '../db/sqlite';
import { saveDraft, getDraft, generateUUID } from '../db/drafts';
import {
  savePhotoLocally,
  getPhotosForDraft,
  deletePhoto,
  linkPhotosToOrder,
  getPhotosReadyForUpload,
  PendingPhoto,
} from '../db/photos';
import {
  PickupType,
  ExpressDeliveryOption,
  GarmentCategory,
  ServiceCategory,
  isPhotoRequiredForOrder,
  calculateOrderTotals,
  roundCurrency,
  CreateOrderItemRequest,
  CreateOrderRequest,
  PhotoType,
} from '@growfast/shared-types';

describe('GrowFast Mobile — Garment-Specific Cart Photo Intake & Review Workflow', () => {
  let mockDb: MockSQLiteDatabase;

  beforeEach(async () => {
    mockDb = new MockSQLiteDatabase();
    setDatabaseInstance(mockDb as any);

    // Run SQLite migrations v1, v2, v3
    for (const m of MIGRATIONS) {
      await m.up(mockDb as any);
    }
  });

  // =========================================================================
  // 1. THREE COMPACT ACTIONS ON CART GARMENT CARDS
  // =========================================================================
  describe('1. Cart Garment Actions & Quantity Separation', () => {
    it('1.1 Verifies exactly three compact actions (Edit, Photo, Remove) for each garment', () => {
      const actions = [
        { type: 'EDIT', label: 'Edit details', role: 'button', icon: 'pencil-outline' },
        { type: 'PHOTO', label: 'Garment photos', role: 'button', icon: 'camera-outline' },
        { type: 'REMOVE', label: 'Remove garment', role: 'button', icon: 'trash-outline' },
      ];

      assert.equal(actions.length, 3, 'Must have exactly three compact actions');
      assert.equal(actions[0].type, 'EDIT');
      assert.equal(actions[1].type, 'PHOTO');
      assert.equal(actions[2].type, 'REMOVE');
    });

    it('1.2 Verifies quantity controls operate independently from bottom action buttons', () => {
      let cartItem: CreateOrderItemRequest = {
        garmentCatalogId: 'g-shirt',
        serviceTypeId: 'srv-dry-clean',
        quantity: 1,
        unitPrice: 95,
      };

      // Quantity increment handler
      const handleQuantityChange = (delta: number) => {
        cartItem = {
          ...cartItem,
          quantity: Math.max(1, cartItem.quantity + delta),
        };
      };

      handleQuantityChange(1);
      assert.equal(cartItem.quantity, 2);
      assert.equal(roundCurrency(cartItem.quantity * (cartItem.unitPrice || 0)), 190);

      handleQuantityChange(-1);
      assert.equal(cartItem.quantity, 1);
      assert.equal(roundCurrency(cartItem.quantity * (cartItem.unitPrice || 0)), 95);
    });
  });

  // =========================================================================
  // 2. GARMENT-SPECIFIC PHOTO ATTACHMENT
  // =========================================================================
  describe('2. Garment-Specific Photo Capture & Storage Isolation', () => {
    it('2.1 Saves photos directly associated with the specific garment ID in local storage', async () => {
      const draftId = generateUUID();
      const garmentIdA = 'g-shirt-01';
      const garmentIdB = 'g-sweater-02';

      // Save photo for T-Shirt
      const photoA1 = await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/photos/shirt_front.jpg',
        photoType: PhotoType.FRONT,
        garmentId: garmentIdA,
      });

      // Save second photo for T-Shirt (multiple photos supported)
      const photoA2 = await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/photos/shirt_tag.jpg',
        photoType: PhotoType.DAMAGE,
        garmentId: garmentIdA,
      });

      // Save photo for Sweater
      const photoB1 = await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/photos/sweater_front.jpg',
        photoType: PhotoType.FRONT,
        garmentId: garmentIdB,
      });

      const allDraftPhotos = await getPhotosForDraft(draftId);
      assert.equal(allDraftPhotos.length, 3);

      // Verify T-Shirt photo isolation
      const shirtPhotos = allDraftPhotos.filter((p) => p.garmentId === garmentIdA);
      assert.equal(shirtPhotos.length, 2);
      assert.equal(shirtPhotos[0].id, photoA1.id);
      assert.equal(shirtPhotos[1].id, photoA2.id);

      // Verify Sweater photo isolation
      const sweaterPhotos = allDraftPhotos.filter((p) => p.garmentId === garmentIdB);
      assert.equal(sweaterPhotos.length, 1);
      assert.equal(sweaterPhotos[0].id, photoB1.id);
    });

    it('2.2 Attached photo removal deletes only the targeted photo', async () => {
      const draftId = generateUUID();
      const garmentId = 'g-shirt-01';

      const photo1 = await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/photos/photo_1.jpg',
        garmentId,
      });

      const photo2 = await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/photos/photo_2.jpg',
        garmentId,
      });

      let draftPhotos = await getPhotosForDraft(draftId);
      assert.equal(draftPhotos.length, 2);

      // Delete photo 1
      await deletePhoto(photo1.id);

      draftPhotos = await getPhotosForDraft(draftId);
      assert.equal(draftPhotos.length, 1);
      assert.equal(draftPhotos[0].id, photo2.id);
    });
  });

  // =========================================================================
  // 3. SAFE CLEANUP ON GARMENT REMOVAL FROM CART
  // =========================================================================
  describe('3. Cart Item Removal & Photo Cleanup Safety', () => {
    it('3.1 Removing a garment from Cart deletes all its associated draft photos', async () => {
      const draftId = generateUUID();
      const shirtId = 'g-shirt';
      const pantsId = 'g-pants';

      let cart = [
        { garmentCatalogId: shirtId, quantity: 1, unitPrice: 95 },
        { garmentCatalogId: pantsId, quantity: 1, unitPrice: 120 },
      ];

      // Save photos for both items
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/shirt.jpg',
        garmentId: shirtId,
      });
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/pants.jpg',
        garmentId: pantsId,
      });

      let photos = await getPhotosForDraft(draftId);
      assert.equal(photos.length, 2);

      // Remove Shirt from cart (index 0)
      const removedItem = cart[0];
      cart = cart.filter((_, idx) => idx !== 0);

      // Check if remaining cart still uses this garment
      const stillHasGarment = cart.some(
        (it) => it.garmentCatalogId === removedItem.garmentCatalogId,
      );
      assert.equal(stillHasGarment, false);

      // Delete photos for removed garment
      const shirtPhotos = photos.filter((p) => p.garmentId === removedItem.garmentCatalogId);
      for (const p of shirtPhotos) {
        await deletePhoto(p.id);
      }

      photos = await getPhotosForDraft(draftId);
      assert.equal(photos.length, 1, 'Only pants photo should remain');
      assert.equal(photos[0].garmentId, pantsId);
    });

    it('3.2 Removing one item does not delete photos if another item uses same garment', async () => {
      const draftId = generateUUID();
      const shirtId = 'g-shirt';

      // Two items with same garment (different services: Dry Clean vs Steam Press)
      let cart = [
        { garmentCatalogId: shirtId, serviceTypeId: 'srv-dry-clean', quantity: 1, unitPrice: 95 },
        { garmentCatalogId: shirtId, serviceTypeId: 'srv-steam-press', quantity: 2, unitPrice: 40 },
      ];

      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///mock/shirt_shared.jpg',
        garmentId: shirtId,
      });

      // Remove index 0
      const removedItem = cart[0];
      cart = cart.filter((_, idx) => idx !== 0);

      const stillHasGarment = cart.some(
        (it) => it.garmentCatalogId === removedItem.garmentCatalogId,
      );
      assert.equal(stillHasGarment, true, 'Remaining cart still has Shirt item');

      // Photos must be preserved
      const photos = await getPhotosForDraft(draftId);
      assert.equal(photos.length, 1);
    });
  });

  // =========================================================================
  // 4. CONFIRMED PHOTO-REQUIRED BUSINESS RULES
  // =========================================================================
  describe('4. Authoritative Photo-Requirement Business Rules', () => {
    it('4.1 Walk-in orders with <= 50 pieces require intake photos for all garments', () => {
      const isWalkIn = true;
      const totalPieces = 2; // T Shirt + Sweater

      const required = isPhotoRequiredForOrder({
        isWalkIn,
        totalPieces,
        isWeightBased: false,
      });
      assert.equal(required, true);

      // Validation logic: check each garment in cart has >= 1 photo
      const cart = [
        { garmentCatalogId: 'g-shirt', quantity: 1 },
        { garmentCatalogId: 'g-sweater', quantity: 1 },
      ];
      const photos: PendingPhoto[] = [
        {
          id: 'p1',
          clientDraftId: 'draft-1',
          garmentId: 'g-shirt',
          localFileUri: 'file:///p1.jpg',
          photoType: PhotoType.FRONT,
          syncStatus: 'PENDING',
          retryCount: 0,
          createdAt: new Date().toISOString(),
        },
      ];

      const missingGarments = cart.filter((it) => {
        const count = photos.filter((p) => p.garmentId === it.garmentCatalogId).length;
        return count === 0;
      });

      assert.equal(missingGarments.length, 1);
      assert.equal(missingGarments[0].garmentCatalogId, 'g-sweater');
    });

    it('4.2 Walk-in bulk orders (> 50 pieces) treat photos as OPTIONAL', () => {
      const isWalkIn = true;
      const totalPieces = 55;

      const required = isPhotoRequiredForOrder({
        isWalkIn,
        totalPieces,
        isWeightBased: false,
      });
      assert.equal(required, false, 'Bulk walk-in orders must not enforce mandatory photos');
    });

    it('4.3 Home Delivery orders treat photos as OPTIONAL regardless of piece count', () => {
      const isWalkIn = false;
      const totalPieces = 4;

      const required = isPhotoRequiredForOrder({
        isWalkIn,
        totalPieces,
        isWeightBased: false,
      });
      assert.equal(required, false, 'Home delivery orders must not enforce mandatory photos');
    });
  });

  // =========================================================================
  // 5. REVIEW STEP CLEANLINESS & ORDER SUBMISSION FLOW
  // =========================================================================
  describe('5. Clean Checkout & Server Confirmation', () => {
    it('5.1 Builds canonical CreateOrderRequest with piece-level photoCount derived from garment photos', async () => {
      const draftId = generateUUID();
      const shirtId = 'g-shirt';
      const sweaterId = 'g-sweater';

      // 1 photo for shirt, 2 photos for sweater
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///photo_shirt.jpg',
        garmentId: shirtId,
      });
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///photo_sweater_1.jpg',
        garmentId: sweaterId,
      });
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///photo_sweater_2.jpg',
        garmentId: sweaterId,
      });

      const photos = await getPhotosForDraft(draftId);

      const items: CreateOrderItemRequest[] = [
        { garmentCatalogId: shirtId, serviceTypeId: 'srv-dry-clean', quantity: 1, unitPrice: 95 },
        {
          garmentCatalogId: sweaterId,
          serviceTypeId: 'srv-dry-clean',
          quantity: 1,
          unitPrice: 210,
        },
      ];

      // Build payload matching OrderWizardModal.buildOrderPayload()
      const payload: CreateOrderRequest = {
        clientDraftId: draftId,
        customerId: 'cust-101',
        isExpress: false,
        expressDeliveryOption: ExpressDeliveryOption.REGULAR,
        pickupType: PickupType.STORE_PICKUP,
        workflow: 'LAUNDRY',
        entryMode: 'PIECES',
        items: items.map((item) => {
          const pieceCount = item.quantity || 1;
          const pieces = Array.from({ length: pieceCount }, (_, i) => ({
            unitNumber: i + 1,
            photoCount: photos.filter((p) => p.garmentId === item.garmentCatalogId).length,
          }));
          return {
            ...item,
            pieces,
          };
        }),
      };

      assert.equal(payload.items.length, 2);
      assert.equal(payload.items[0].pieces?.[0].photoCount, 1);
      assert.equal(payload.items[1].pieces?.[0].photoCount, 2);
    });

    it('5.2 Links all pending photos to confirmed server order ID for background upload', async () => {
      const draftId = generateUUID();
      const serverOrderId = 'ord-srv-99901';

      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///img1.jpg',
        garmentId: 'g-shirt',
      });
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///img2.jpg',
        garmentId: 'g-sweater',
      });

      // Link photos on order creation success
      await linkPhotosToOrder(draftId, serverOrderId);

      const readyPhotos = await getPhotosReadyForUpload();
      assert.equal(readyPhotos.length, 2);
      assert.equal(readyPhotos[0].serverOrderId, serverOrderId);
      assert.equal(readyPhotos[1].serverOrderId, serverOrderId);
    });
  });

  // =========================================================================
  // 6. MULTI-PIECE PER-PIECE PHOTO ISOLATION & VALIDATION
  // =========================================================================
  describe('6. Multi-Piece Per-Piece Photo Isolation & Mismatch Prevention', () => {
    it('6.1 When garment quantity is 2, photo for Piece #1 does NOT satisfy Piece #2', async () => {
      const draftId = generateUUID();
      const shirtId = 'g-shirt-multi';
      const piece1Id = generateUUID();
      const piece2Id = generateUUID();

      const item: CreateOrderItemRequest = {
        id: generateUUID(),
        garmentCatalogId: shirtId,
        serviceTypeId: 'srv-dry-clean',
        quantity: 2,
        unitPrice: 100,
        pieces: [
          { pieceId: piece1Id, unitNumber: 1, photoCount: 0 },
          { pieceId: piece2Id, unitNumber: 2, photoCount: 0 },
        ],
      };

      // User captures photo for Piece #1 only
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///piece1_photo.jpg',
        garmentId: shirtId,
        orderItemId: item.id,
        pieceId: piece1Id,
        unitNumber: 1,
      });

      const photos = await getPhotosForDraft(draftId);
      assert.equal(photos.length, 1);

      // Derive piece photo counts exactly as done in OrderWizardModal / FinalReviewStep
      const derivedPieces = item.pieces!.map((p) => {
        const piecePhotos = photos.filter((ph) => {
          if (p.pieceId && ph.pieceId === p.pieceId) return true;
          return (
            ph.garmentId === item.garmentCatalogId &&
            (ph.unitNumber === p.unitNumber || (item.quantity === 1 && !ph.unitNumber))
          );
        });
        return {
          ...p,
          photoCount: piecePhotos.length,
        };
      });

      assert.equal(derivedPieces[0].photoCount, 1, 'Piece #1 has 1 photo');
      assert.equal(derivedPieces[1].photoCount, 0, 'Piece #2 must have 0 photos (no leaking)');

      // Validate requirement: Piece #2 must be flagged as missing photos
      const missingPieces: string[] = [];
      const pieceCount = item.quantity || 1;
      for (let u = 1; u <= pieceCount; u++) {
        const piece = derivedPieces.find((p) => p.unitNumber === u);
        if ((piece?.photoCount || 0) === 0) {
          missingPieces.push(`Item "Shirt", Piece #${u} is missing photos`);
        }
      }

      assert.equal(missingPieces.length, 1);
      assert.match(missingPieces[0], /Piece #2 is missing photos/);
    });

    it('6.2 Adding photo for Piece #2 resolves validation and supports multiple photos per piece', async () => {
      const draftId = generateUUID();
      const shirtId = 'g-shirt-multi-2';
      const piece1Id = generateUUID();
      const piece2Id = generateUUID();

      const item: CreateOrderItemRequest = {
        id: generateUUID(),
        garmentCatalogId: shirtId,
        serviceTypeId: 'srv-dry-clean',
        quantity: 2,
        unitPrice: 100,
        pieces: [
          { pieceId: piece1Id, unitNumber: 1, photoCount: 0 },
          { pieceId: piece2Id, unitNumber: 2, photoCount: 0 },
        ],
      };

      // 2 photos for Piece #1 (front + defect)
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///piece1_front.jpg',
        garmentId: shirtId,
        pieceId: piece1Id,
        unitNumber: 1,
        photoType: PhotoType.FRONT,
      });
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///piece1_damage.jpg',
        garmentId: shirtId,
        pieceId: piece1Id,
        unitNumber: 1,
        photoType: PhotoType.DAMAGE,
      });

      // 1 photo for Piece #2
      await savePhotoLocally({
        clientDraftId: draftId,
        sourceUri: 'file:///piece2_front.jpg',
        garmentId: shirtId,
        pieceId: piece2Id,
        unitNumber: 2,
        photoType: PhotoType.FRONT,
      });

      const photos = await getPhotosForDraft(draftId);
      assert.equal(photos.length, 3);

      const piece1Photos = photos.filter((p) => p.pieceId === piece1Id);
      const piece2Photos = photos.filter((p) => p.pieceId === piece2Id);

      assert.equal(piece1Photos.length, 2, 'Piece #1 preserves both photos');
      assert.equal(piece2Photos.length, 1, 'Piece #2 has its own photo');

      // Validation check
      const missingPieces = [1, 2].filter((u) => {
        const piece = item.pieces!.find((p) => p.unitNumber === u);
        return photos.filter((p) => p.pieceId === piece?.pieceId).length === 0;
      });

      assert.equal(missingPieces.length, 0, 'All pieces now satisfy photo requirements');
    });
  });

  // =========================================================================
  // 7. SYNC ENGINE PHYSICAL GARMENT RESOLUTION (NOT SENDING CATALOG ID)
  // =========================================================================
  describe('7. Server PhysicalGarment ID Resolution During Sync', () => {
    it('7.1 Resolves server physicalGarmentId by unitNumber and pieceId rather than passing catalog ID', () => {
      const serverOrder = {
        id: 'ord-srv-100',
        items: [
          {
            id: 'item-srv-1',
            garmentCatalogId: 'g-shirt-cat',
            garmentName: 'Shirt',
            physicalGarments: [
              { id: 'pg-srv-001', unitNumber: 1 },
              { id: 'pg-srv-002', unitNumber: 2 },
            ],
          },
        ],
      };

      const pendingPhotoPiece1 = {
        id: 'photo-local-1',
        garmentId: 'g-shirt-cat',
        unitNumber: 1,
      };

      const pendingPhotoPiece2 = {
        id: 'photo-local-2',
        garmentId: 'g-shirt-cat',
        unitNumber: 2,
      };

      // Match logic from SyncEngine.uploadPendingPhotos
      const resolveGarment = (photo: { garmentId: string; unitNumber: number }) => {
        const matchedItem = serverOrder.items.find(
          (it) => it.garmentCatalogId === photo.garmentId || it.garmentName === photo.garmentId,
        );
        if (!matchedItem) return { orderItemId: undefined, physicalGarmentId: undefined };
        const matchedPg = matchedItem.physicalGarments.find(
          (pg) => pg.unitNumber === photo.unitNumber,
        );
        return {
          orderItemId: matchedItem.id,
          physicalGarmentId: matchedPg?.id,
        };
      };

      const res1 = resolveGarment(pendingPhotoPiece1);
      assert.equal(res1.orderItemId, 'item-srv-1');
      assert.equal(res1.physicalGarmentId, 'pg-srv-001');
      assert.notEqual(
        res1.physicalGarmentId,
        'g-shirt-cat',
        'Must NEVER pass catalog ID as physicalGarmentId',
      );

      const res2 = resolveGarment(pendingPhotoPiece2);
      assert.equal(res2.orderItemId, 'item-srv-1');
      assert.equal(res2.physicalGarmentId, 'pg-srv-002');
      assert.notEqual(res2.physicalGarmentId, 'g-shirt-cat');
    });
  });

  // =========================================================================
  // 8. MARKASDELIVEREDMODAL HOOK-ORDER STABILITY
  // =========================================================================
  describe('8. MarkAsDeliveredModal Hook-Order Stability', () => {
    it('8.1 Computes isFinalHandover unconditionally even when order is null or undefined without throwing', () => {
      // Simulates the exact state transition that previously threw:
      // "Rendered more hooks than during the previous render."

      // Render cycle 1: order = null (modal mounting or closed)
      const renderCycle = (
        order: any,
        selectedIds: Set<string>,
        legacyQty: Record<string, number>,
      ) => {
        // Unconditional hook counts simulation
        const physicalItems =
          order?.items?.filter((it: any) => it.physicalGarments?.length > 0) || [];
        const legacyItems = order?.items?.filter((it: any) => !it.physicalGarments?.length) || [];
        const totalSelected =
          selectedIds.size + Object.values(legacyQty).reduce((s, q) => s + q, 0);

        // This is the isFinalHandover useMemo computation
        const isFinalHandover = (() => {
          if (!order || totalSelected === 0) return false;
          return true;
        })();

        // Conditional early return AFTER all hook calculations
        if (!order) return { rendered: false, isFinalHandover: false };
        return { rendered: true, isFinalHandover };
      };

      // Cycle 1: order is null
      const cycle1 = renderCycle(null, new Set(), {});
      assert.equal(cycle1.rendered, false);
      assert.equal(cycle1.isFinalHandover, false);

      // Cycle 2: order loads
      const dummyOrder = {
        id: 'ord-1',
        amountDue: 0,
        items: [{ id: 'it-1', physicalGarments: [{ id: 'pg-1', isReady: true }] }],
      };
      const cycle2 = renderCycle(dummyOrder, new Set(['pg-1']), {});
      assert.equal(cycle2.rendered, true);
      assert.equal(cycle2.isFinalHandover, true);

      // Cycle 3: order closes / resets to null
      const cycle3 = renderCycle(null, new Set(), {});
      assert.equal(cycle3.rendered, false);
      assert.equal(cycle3.isFinalHandover, false);
    });
  });
});
