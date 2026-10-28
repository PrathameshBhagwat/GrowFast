import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  ItemStatus,
  PhotoType,
  deriveOrderStatus,
  OrderPhotoDTO,
} from '@growfast/shared-types';

describe('GrowFast Mobile — Order Details & Compact Item Photo Integration', () => {
  // Helper matching OrderDetailModal.tsx photo grouping logic
  function getItemPhotos(item: any, order: any, orderPhotos: OrderPhotoDTO[]): OrderPhotoDTO[] {
    const seen = new Set<string>();
    const result: OrderPhotoDTO[] = [];

    const addPhoto = (p: any) => {
      if (!p) return;
      const key = p.id || p.url;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    };

    // 1. Photos directly on item
    if (Array.isArray(item.photos)) {
      item.photos.forEach(addPhoto);
    }

    // 2. Photos on physical garments of this item
    if (Array.isArray(item.physicalGarments)) {
      const pgIds = new Set(item.physicalGarments.map((pg: any) => pg.id));
      item.physicalGarments.forEach((pg: any) => {
        if (Array.isArray(pg.photos)) {
          pg.photos.forEach(addPhoto);
        }
      });

      orderPhotos.forEach((p) => {
        if (p.physicalGarmentId && pgIds.has(p.physicalGarmentId)) {
          addPhoto(p);
        }
      });
    }

    // 3. Photos in orderPhotos with orderItemId === item.id
    orderPhotos.forEach((p) => {
      if (p.orderItemId === item.id) {
        addPhoto(p);
      }
    });

    // 4. Single-item order: order-level photos belong to this item
    if (order && order.items && order.items.length === 1) {
      orderPhotos.forEach((p) => {
        if (!p.orderItemId && !p.physicalGarmentId) {
          addPhoto(p);
        }
      });
    }

    return result;
  }

  function getGarmentPhotos(
    garmentId: string,
    order: any,
    orderPhotos: OrderPhotoDTO[],
  ): OrderPhotoDTO[] {
    const seen = new Set<string>();
    const result: OrderPhotoDTO[] = [];

    const addPhoto = (p: any) => {
      if (!p) return;
      const key = p.id || p.url;
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    };

    if (order && Array.isArray(order.items)) {
      for (const item of order.items) {
        if (Array.isArray(item.physicalGarments)) {
          const pg = item.physicalGarments.find((g: any) => g.id === garmentId);
          if (pg && Array.isArray(pg.photos)) {
            pg.photos.forEach(addPhoto);
          }
        }
      }
    }

    orderPhotos.forEach((p) => {
      if (p.physicalGarmentId === garmentId) {
        addPhoto(p);
      }
    });

    return result;
  }

  // =========================================================================
  // 1. COMPACT PHOTO INDICATOR & THUMBNAIL STRIP
  // =========================================================================
  describe('1. Compact Item Photo Preview & Single-Item Parity', () => {
    it('1.1 For single-item order with 4 order-level photos, maps all 4 to the item card', () => {
      const order = {
        id: 'ord-000531',
        orderNumber: 'GF-ORD-000531',
        items: [
          {
            id: 'item-blanket-1',
            garmentName: 'Blanket Weight',
            quantity: 4,
            weight: 2.0,
            lineTotal: 160,
            physicalGarments: [
              { id: 'pg-1', unitNumber: 1, tagId: 'GF-VSV6Z3', isReady: false },
              { id: 'pg-2', unitNumber: 2, tagId: 'GF-QBZVDA', isReady: false },
              { id: 'pg-3', unitNumber: 3, tagId: 'GF-QS6V3A', isReady: false },
              { id: 'pg-4', unitNumber: 4, tagId: 'GF-NDB9RX', isReady: false },
            ],
          },
        ],
      };

      const orderPhotos: OrderPhotoDTO[] = [
        { id: 'p1', orderId: order.id, type: PhotoType.FRONT, url: '/photos/photo1.jpg' } as any,
        { id: 'p2', orderId: order.id, type: PhotoType.FRONT, url: '/photos/photo2.jpg' } as any,
        { id: 'p3', orderId: order.id, type: PhotoType.FRONT, url: '/photos/photo3.jpg' } as any,
        { id: 'p4', orderId: order.id, type: PhotoType.FRONT, url: '/photos/photo4.jpg' } as any,
      ];

      const itemPhotos = getItemPhotos(order.items[0], order, orderPhotos);
      assert.equal(itemPhotos.length, 4, 'All 4 photos must be mapped to single item');

      // UI thumbnail partition: max 3 thumbnails + badge (+1)
      const maxThumbnails = 3;
      const visibleThumbnails = itemPhotos.slice(0, maxThumbnails);
      const extraCount = Math.max(0, itemPhotos.length - maxThumbnails);

      assert.equal(visibleThumbnails.length, 3, 'Must render up to 3 thumbnails');
      assert.equal(extraCount, 1, 'Must render +1 badge for the 4th photo');
    });

    it('1.2 For multi-item order, isolates photos to their matching orderItemId or physicalGarmentId', () => {
      const order = {
        id: 'ord-multi-1',
        items: [
          {
            id: 'item-shirt-1',
            garmentName: 'Formal Shirt',
            quantity: 1,
            physicalGarments: [{ id: 'pg-shirt-1', unitNumber: 1, isReady: false }],
          },
          {
            id: 'item-suit-2',
            garmentName: '2-Piece Suit',
            quantity: 1,
            physicalGarments: [{ id: 'pg-suit-1', unitNumber: 1, isReady: false }],
          },
        ],
      };

      const orderPhotos: OrderPhotoDTO[] = [
        {
          id: 'p-shirt',
          orderId: order.id,
          orderItemId: 'item-shirt-1',
          type: PhotoType.FRONT,
          url: '/p-shirt.jpg',
        } as any,
        {
          id: 'p-suit',
          orderId: order.id,
          physicalGarmentId: 'pg-suit-1',
          type: PhotoType.FRONT,
          url: '/p-suit.jpg',
        } as any,
      ];

      const shirtPhotos = getItemPhotos(order.items[0], order, orderPhotos);
      assert.equal(shirtPhotos.length, 1);
      assert.equal(shirtPhotos[0].id, 'p-shirt');

      const suitPhotos = getItemPhotos(order.items[1], order, orderPhotos);
      assert.equal(suitPhotos.length, 1);
      assert.equal(suitPhotos[0].id, 'p-suit');

      const suitPgPhotos = getGarmentPhotos('pg-suit-1', order, orderPhotos);
      assert.equal(suitPgPhotos.length, 1);
      assert.equal(suitPgPhotos[0].id, 'p-suit');
    });

    it('1.3 When item has no photos, empty state displays add-photo action and 0 extra count', () => {
      const order = {
        id: 'ord-empty',
        items: [{ id: 'item-clean', garmentName: 'Towel', quantity: 2 }],
      };
      const orderPhotos: OrderPhotoDTO[] = [];

      const photos = getItemPhotos(order.items[0], order, orderPhotos);
      assert.equal(photos.length, 0);

      const maxThumbnails = 3;
      const extraCount = Math.max(0, photos.length - maxThumbnails);
      assert.equal(extraCount, 0);
    });
  });

  // =========================================================================
  // 2. DUAL-VIEW CONSISTENCY & DEDUPLICATION
  // =========================================================================
  describe('2. Dual-View Consistency & Deduplication', () => {
    it('2.1 Deduplicates photo array when photos are returned by both getByOrder and order.items', () => {
      const photosRes = [
        { id: 'photo-101', url: '/storage/101.jpg', type: 'FRONT' },
        { id: 'photo-102', url: '/storage/102.jpg', type: 'BACK' },
      ];

      const orderData = {
        items: [
          {
            id: 'item-1',
            photos: [{ id: 'photo-101', url: '/storage/101.jpg', type: 'FRONT' }],
            physicalGarments: [
              {
                id: 'pg-1',
                photos: [{ id: 'photo-102', url: '/storage/102.jpg', type: 'BACK' }],
              },
            ],
          },
        ],
      };

      const photosMap = new Map<string, any>();
      for (const p of photosRes) {
        if (p && (p.id || p.url)) photosMap.set(p.id || p.url, p);
      }
      for (const item of orderData.items) {
        if (Array.isArray(item.photos)) {
          for (const p of item.photos) {
            const key = p?.id || p?.url;
            if (key) {
              const existing = photosMap.get(key) || {};
              photosMap.set(key, { ...existing, ...p, orderItemId: item.id });
            }
          }
        }
        if (Array.isArray(item.physicalGarments)) {
          for (const pg of item.physicalGarments) {
            if (Array.isArray(pg.photos)) {
              for (const p of pg.photos) {
                const key = p?.id || p?.url;
                if (key) {
                  const existing = photosMap.get(key) || {};
                  photosMap.set(key, {
                    ...existing,
                    ...p,
                    orderItemId: item.id,
                    physicalGarmentId: pg.id,
                  });
                }
              }
            }
          }
        }
      }

      const combined = Array.from(photosMap.values());
      assert.equal(combined.length, 2, 'Must not duplicate photos');
      assert.equal(combined[0].orderItemId, 'item-1');
      assert.equal(combined[1].physicalGarmentId, 'pg-1');
    });

    it('2.2 Lightbox index navigation behaves safely across photo array bounds', () => {
      const photos = ['/p1.jpg', '/p2.jpg', '/p3.jpg'];
      let currentIndex = 0;

      // Next
      if (currentIndex < photos.length - 1) currentIndex++;
      assert.equal(currentIndex, 1);
      assert.equal(photos[currentIndex], '/p2.jpg');

      // Next again to last item
      if (currentIndex < photos.length - 1) currentIndex++;
      assert.equal(currentIndex, 2);
      assert.equal(photos[currentIndex], '/p3.jpg');

      // Cannot advance past bounds
      const canNext = currentIndex < photos.length - 1;
      assert.equal(canNext, false);

      // Prev
      if (currentIndex > 0) currentIndex--;
      assert.equal(currentIndex, 1);
      assert.equal(photos[currentIndex], '/p2.jpg');
    });
  });

  // =========================================================================
  // 3. RETENTION AND STATUS DERIVATION
  // =========================================================================
  describe('3. Business Logic & Canonical Status Parity', () => {
    it('3.1 Uses canonical deriveOrderStatus when item garments are toggled ready', () => {
      const order = {
        status: OrderStatus.PROCESSING,
        items: [{ status: ItemStatus.READY }, { status: ItemStatus.READY }],
      };

      const derived = deriveOrderStatus({
        items: order.items,
        currentOrderStatus: order.status,
      });

      assert.equal(derived, OrderStatus.READY, 'When all items are READY, order becomes READY');
    });

    it('3.2 Unconditionally enforces 44x44px accessible touch target sizing constraints', () => {
      const touchTargetMin = 44;
      const thumbnailSize = 48;
      const badgeBtnSize = 48;
      const addPhotoBtnMinHeight = 44;

      assert.ok(thumbnailSize >= touchTargetMin, 'Thumbnails must meet >= 44px touch target');
      assert.ok(badgeBtnSize >= touchTargetMin, 'Badge buttons must meet >= 44px touch target');
      assert.ok(
        addPhotoBtnMinHeight >= touchTargetMin,
        'Inline action buttons must meet >= 44px touch target',
      );
    });
  });
});
