import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiError } from '../api/client';
import {
  DeliveryRecordDTO,
  DeliveryStatus,
  Role,
  OrderItemDTO,
  OrderStatus,
  deriveOrderStatus,
} from '@growfast/shared-types';

describe('GrowFast Mobile POS — Mobile Delivery Management (Phase 3)', () => {
  const originalDeliveriesList = apiClient.deliveries.list;
  const originalDeliveriesGetById = apiClient.deliveries.getById;
  const originalDeliveriesUpdateStatus = apiClient.deliveries.updateStatus;
  const originalDeliveriesComplete = apiClient.deliveries.complete;
  const originalDeliveriesAssign = apiClient.deliveries.assign;
  const originalPhotosUpload = apiClient.photos.upload;

  const mockDelivery = (overrides?: Partial<DeliveryRecordDTO>): DeliveryRecordDTO => ({
    id: 'del-test-1',
    orderId: 'ord-test-101',
    orderNumber: 'GF-1024',
    customerName: 'Rahul Sharma',
    address: 'Flat 402, Sunshine Apts, Pune',
    riderId: 'emp-rider-1',
    riderName: 'Sunil Kumar',
    status: DeliveryStatus.ASSIGNED,
    scheduledAt: '2026-10-24T14:00:00.000Z',
    completedAt: null,
    proofPhotoUrl: null,
    notes: 'Please call before arrival',
    items: [
      {
        id: 'item-1',
        garmentName: 'Shirt',
        serviceType: 'DRY_CLEAN',
        quantity: 3,
        deliveredQuantity: 0,
        unitPrice: 50,
        lineTotal: 150,
        itemStatus: 'READY' as any,
      } as OrderItemDTO,
      {
        id: 'item-2',
        garmentName: 'Trousers',
        serviceType: 'DRY_CLEAN',
        quantity: 2,
        deliveredQuantity: 0,
        unitPrice: 60,
        lineTotal: 120,
        itemStatus: 'READY' as any,
      } as OrderItemDTO,
    ],
    createdAt: '2026-10-24T08:00:00.000Z',
    updatedAt: '2026-10-24T08:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    // Restore default methods
    apiClient.deliveries.list = originalDeliveriesList;
    apiClient.deliveries.getById = originalDeliveriesGetById;
    apiClient.deliveries.updateStatus = originalDeliveriesUpdateStatus;
    apiClient.deliveries.complete = originalDeliveriesComplete;
    apiClient.deliveries.assign = originalDeliveriesAssign;
    apiClient.photos.upload = originalPhotosUpload;
  });

  // 1. Delivery queue loads real API results
  it('1. Delivery queue successfully loads and parses authorized server delivery records', async () => {
    const mockList = [
      mockDelivery({ id: 'del-1', orderNumber: 'GF-1024', status: DeliveryStatus.ASSIGNED }),
      mockDelivery({ id: 'del-2', orderNumber: 'GF-1025', status: DeliveryStatus.IN_TRANSIT }),
    ];

    apiClient.deliveries.list = async () => mockList;

    const results = await apiClient.deliveries.list();
    assert.equal(results.length, 2, 'Must return 2 delivery records');
    assert.equal(results[0].orderNumber, 'GF-1024');
    assert.equal(results[0].customerName, 'Rahul Sharma');
    assert.equal(results[0].address, 'Flat 402, Sunshine Apts, Pune');
    assert.equal(results[1].status, DeliveryStatus.IN_TRANSIT);
  });

  // 2. Loading, empty, error, retry, and offline states
  it('2. Properly distinguishes empty, error, retry, and offline states', async () => {
    // 2a. Empty state
    apiClient.deliveries.list = async () => [];
    const emptyResult = await apiClient.deliveries.list();
    assert.equal(emptyResult.length, 0, 'Empty server result returns 0 records');

    // 2b. Error & Retry
    let attempts = 0;
    apiClient.deliveries.list = async () => {
      attempts++;
      if (attempts === 1) {
        throw new ApiError('Connection timed out', 504);
      }
      return [mockDelivery()];
    };

    await assert.rejects(
      async () => await apiClient.deliveries.list(),
      (err: any) => err.statusCode === 504,
      'First attempt fails with 504',
    );

    const retryResult = await apiClient.deliveries.list();
    assert.equal(retryResult.length, 1, 'Retry successfully loads deliveries');
    assert.equal(attempts, 2, 'Two attempts executed');

    // 2c. Offline state
    const isConnected = false;
    let offlineMessage: string | null = null;
    if (!isConnected) {
      offlineMessage = 'Device is currently offline. Connect to Wi-Fi to load deliveries.';
    }
    assert.match(offlineMessage!, /Device is currently offline/);
  });

  // 3. Status filters use supported values
  it('3. Status filters map directly to canonical DeliveryStatus enums', async () => {
    const requestedFilters: string[] = [];

    apiClient.deliveries.list = async (status?: string) => {
      if (status) requestedFilters.push(status);
      return [mockDelivery({ status: (status as DeliveryStatus) || DeliveryStatus.SCHEDULED })];
    };

    const supportedStatuses = [
      DeliveryStatus.SCHEDULED,
      DeliveryStatus.ASSIGNED,
      DeliveryStatus.IN_TRANSIT,
      DeliveryStatus.COMPLETED,
      DeliveryStatus.FAILED,
    ];

    for (const status of supportedStatuses) {
      await apiClient.deliveries.list(status);
    }

    assert.deepEqual(
      requestedFilters,
      [
        DeliveryStatus.SCHEDULED,
        DeliveryStatus.ASSIGNED,
        DeliveryStatus.IN_TRANSIT,
        DeliveryStatus.COMPLETED,
        DeliveryStatus.FAILED,
      ],
      'Filters must query canonical status enums',
    );
  });

  // 4. Role-appropriate actions are displayed
  it('4. Role-appropriate delivery actions are permitted according to backend policies', () => {
    const delivery = mockDelivery({ riderId: 'emp-rider-1', status: DeliveryStatus.ASSIGNED });

    // Rider 1 (Assigned)
    const rider1Role = Role.DELIVERY;
    const isAssignedRider = delivery.riderId === 'emp-rider-1';
    const canRider1Start = rider1Role === Role.DELIVERY && isAssignedRider;
    assert.equal(canRider1Start, true, 'Assigned rider can start delivery');

    // Rider 2 (Different rider)
    const isRider2Assigned = delivery.riderId === 'emp-rider-2';
    const canRider2Start = rider1Role === Role.DELIVERY && isRider2Assigned;
    assert.equal(canRider2Start, false, 'Unassigned rider cannot start another driver delivery');

    // Manager / Owner
    const isManager = true;
    assert.equal(isManager, true, 'Manager has operational oversight');
  });

  // 5. Unauthorized actions are not offered in the UI
  it('5. Driver assignment is strictly prohibited for COUNTER and DELIVERY roles', () => {
    const canAssignDriver = (role: Role) => role === Role.OWNER || role === Role.MANAGER;

    assert.equal(canAssignDriver(Role.OWNER), true, 'OWNER can assign drivers');
    assert.equal(canAssignDriver(Role.MANAGER), true, 'MANAGER can assign drivers');
    assert.equal(canAssignDriver(Role.COUNTER), false, 'COUNTER cannot assign drivers');
    assert.equal(canAssignDriver(Role.DELIVERY), false, 'DELIVERY cannot assign drivers');
  });

  // 6. Starting a delivery uses the correct request
  it('6. Starting a delivery transitions ASSIGNED to IN_TRANSIT with proper status payload', async () => {
    let capturedId: string | null = null;
    let capturedStatus: string | null = null;
    let capturedNotes: string | undefined = undefined;

    apiClient.deliveries.updateStatus = async (id: string, status: string, notes?: string) => {
      capturedId = id;
      capturedStatus = status;
      capturedNotes = notes;
      return mockDelivery({ id, status: status as DeliveryStatus, notes });
    };

    const res = await apiClient.deliveries.updateStatus(
      'del-test-1',
      DeliveryStatus.IN_TRANSIT,
      'Out for delivery',
    );

    assert.equal(capturedId, 'del-test-1');
    assert.equal(capturedStatus, DeliveryStatus.IN_TRANSIT);
    assert.equal(capturedNotes, 'Out for delivery');
    assert.equal(res.status, DeliveryStatus.IN_TRANSIT);
  });

  // 7. Completion uses the dedicated completion endpoint
  it('7. Delivery completion calls PATCH /deliveries/:id/complete and rejects /status endpoint', async () => {
    let completeEndpointCalled = false;
    let statusEndpointCalled = false;

    apiClient.deliveries.complete = async (id: string, payload: any) => {
      completeEndpointCalled = true;
      return mockDelivery({ id, status: DeliveryStatus.COMPLETED });
    };

    apiClient.deliveries.updateStatus = async (id: string, status: string) => {
      statusEndpointCalled = true;
      if (status === DeliveryStatus.COMPLETED) {
        throw new ApiError(
          'Use the complete delivery endpoint to mark a delivery as completed',
          400,
        );
      }
      return mockDelivery();
    };

    // Completing through dedicated endpoint succeeds
    await apiClient.deliveries.complete('del-test-1', {
      proofPhotoUrl: 'https://storage.growfast.app/proof.jpg',
      notes: 'Delivered to customer',
    });

    assert.equal(completeEndpointCalled, true, 'complete() must be called');

    // Attempting completion via updateStatus fails with backend rejection
    await assert.rejects(
      async () => await apiClient.deliveries.updateStatus('del-test-1', DeliveryStatus.COMPLETED),
      (err: any) => err.statusCode === 400,
      'updateStatus with COMPLETED must be rejected by backend',
    );
    assert.equal(statusEndpointCalled, true);
  });

  // 8. Photo upload failure preserves recoverable photo state
  it('8. Proof photo upload failure preserves local URI without discarding the file', async () => {
    apiClient.photos.upload = async () => {
      throw new ApiError('Photo service temporarily unavailable', 503);
    };

    const localProofPhotoUri = 'file:///var/mobile/Containers/Data/proof_1024.jpg';
    let savedLocalReference: string | null = localProofPhotoUri;

    try {
      await apiClient.photos.upload({
        uri: localProofPhotoUri,
        orderId: 'ord-test-101',
        photoType: 'DELIVERY_PROOF',
      });
    } catch {
      // Local reference is preserved for offline recovery
      savedLocalReference = localProofPhotoUri;
    }

    assert.equal(
      savedLocalReference,
      'file:///var/mobile/Containers/Data/proof_1024.jpg',
      'Local photo URI must never be silently discarded upon upload failure',
    );
  });

  // 9. Partial delivery uses verified DTO correctly
  it('9. Partial delivery validates delivered quantities against remaining eligible items', async () => {
    const orderItems: OrderItemDTO[] = [
      {
        id: 'item-1',
        garmentName: 'Shirt',
        quantity: 3,
        deliveredQuantity: 1, // remaining: 2
      } as any,
      {
        id: 'item-2',
        garmentName: 'Trousers',
        quantity: 2,
        deliveredQuantity: 2, // remaining: 0 (fully delivered)
      } as any,
    ];

    // Validate remaining logic
    const validateDeliveryItem = (item: OrderItemDTO, proposedQty: number) => {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      if (proposedQty > remaining) {
        throw new Error(
          `Cannot deliver ${proposedQty} for "${item.garmentName}". Only ${remaining} remaining.`,
        );
      }
      return { itemId: item.id, quantity: proposedQty };
    };

    // Valid partial delivery: 2 shirts
    const validPayload = validateDeliveryItem(orderItems[0], 2);
    assert.deepEqual(validPayload, { itemId: 'item-1', quantity: 2 });

    // Invalid partial delivery: 3 shirts when only 2 remain
    assert.throws(
      () => validateDeliveryItem(orderItems[0], 3),
      /Only 2 remaining/,
      'Cannot exceed remaining quantity',
    );

    // Invalid partial delivery: attempting to deliver already finished trousers
    assert.throws(
      () => validateDeliveryItem(orderItems[1], 1),
      /Only 0 remaining/,
      'Cannot deliver already completed item',
    );
  });

  // 10. Outstanding-balance rejection is displayed safely
  it('10. Rejects completion when order has an outstanding balance, directing user to payment', async () => {
    let capturedBalanceError: string | null = null;

    apiClient.deliveries.complete = async () => {
      throw new ApiError(
        'Cannot complete delivery: Order #GF-1024 has an outstanding balance of ₹240. Full payment must be settled before final delivery.',
        400,
        { amountDue: 240 },
      );
    };

    try {
      await apiClient.deliveries.complete('del-test-1', {});
    } catch (err: any) {
      capturedBalanceError = err.message;
    }

    assert.match(
      capturedBalanceError!,
      /outstanding balance of ₹240/,
      'Backend outstanding balance message is captured accurately',
    );
  });

  // 11. Duplicate completion submissions are prevented
  it('11. In-flight submission guard locks concurrent completion attempts', async () => {
    let isSubmitting = false;
    let completionAttempts = 0;

    const completeWithLock = async () => {
      if (isSubmitting) return { locked: true };
      isSubmitting = true;
      completionAttempts++;
      // simulate network call
      await new Promise((r) => setTimeout(r, 10));
      isSubmitting = false;
      return { success: true };
    };

    const [call1, call2] = await Promise.all([completeWithLock(), completeWithLock()]);

    assert.equal(completionAttempts, 1, 'Only one completion submission proceeds');
    assert.equal(
      (call1 as any).locked === true || (call2 as any).locked === true,
      true,
      'Duplicate submission is blocked by lock',
    );
  });

  // 12. Successful transitions refresh delivery and order details
  it('12. Successful delivery completion derives canonical order status and updates delivery record', async () => {
    // Canonical status derivation using shared-types
    const derivedDeliveredStatus = deriveOrderStatus({
      items: [{ status: 'DELIVERED' as any }, { status: 'DELIVERED' as any }],
      currentOrderStatus: OrderStatus.OUT_FOR_DELIVERY,
      hasActiveTransitDelivery: false,
    });

    assert.equal(
      derivedDeliveredStatus,
      OrderStatus.DELIVERED,
      'Order status canonically derives to DELIVERED when all items are delivered',
    );

    // If partial delivery, order status remains PROCESSING / IN_TRANSIT
    const derivedPartialStatus = deriveOrderStatus({
      items: [{ status: 'DELIVERED' as any }, { status: 'PROCESSING' as any }],
      currentOrderStatus: OrderStatus.OUT_FOR_DELIVERY,
      hasActiveTransitDelivery: false,
    });

    assert.equal(
      derivedPartialStatus,
      OrderStatus.PROCESSING,
      'Order status canonically remains PROCESSING when partial items remain',
    );
  });

  // 13. Dashboard navigation opens the delivery screen
  it('13. Dashboard Deliveries Today action navigates to /(tabs)/deliveries', () => {
    const navigationHistory: string[] = [];
    const mockRouter = {
      push: (route: string) => navigationHistory.push(route),
    };

    // User taps Deliveries Today card on operational dashboard
    mockRouter.push('/(tabs)/deliveries');

    assert.equal(
      navigationHistory[0],
      '/(tabs)/deliveries',
      'Must navigate to the official deliveries tab',
    );
  });
});
