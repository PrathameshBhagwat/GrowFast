import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, setApiConfig, ApiError } from '../api/client';
import {
  saveAuthToken,
  removeAuthToken,
  getAuthToken,
  saveUserSession,
  getUserSession,
} from '../storage/secure-store';
import {
  PickupType,
  ExpressDeliveryOption,
  GarmentCategory,
  ServiceCategory,
  MembershipTier,
  OrderStatus,
  ItemStatus,
  calculateOrderTotals,
  deriveOrderStatus,
  CreateOrderRequest,
} from '@growfast/shared-types';

describe('GrowFast Mobile Phase E — Live Backend & E2E Integration Suite', () => {
  const BACKEND_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
  let authToken: string;
  let testStoreId: string;
  let testCustomerId: string;
  let perPieceGarmentId: string;
  let laundryServiceId: string;
  let weightGarmentId: string;
  let confirmedOrderId: string;
  let confirmedOrderNumber: string;
  let perPieceDraftId: string;

  let isBackendRunning = false;
  const skipIfBackendOffline = (t: any) => {
    if (!isBackendRunning) {
      t.skip('Live NestJS server is offline at http://localhost:3000');
      return true;
    }
    return false;
  };

  before(async () => {
    // Configure mobile apiClient to target local development NestJS server
    setApiConfig({ baseUrl: BACKEND_URL });
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/directory`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        isBackendRunning = true;
      }
    } catch {
      isBackendRunning = false;
    }
  });

  // 1. Staff Login against Real Backend
  it('1. Staff login authenticates valid employee and rejects invalid PIN on real NestJS API', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // A. Valid Login
    const validLogin = await apiClient.auth.login({
      employeeId: 'emp-counter-001',
      pin: '333333',
    });

    assert.ok(validLogin.accessToken, 'Access token must be present');
    assert.equal(validLogin.user.role, 'COUNTER');
    assert.ok(validLogin.user.storeId, 'Store ID must be returned');

    authToken = validLogin.accessToken;
    testStoreId = validLogin.user.storeId;

    // Save in mobile secure store
    await saveAuthToken(authToken);
    await saveUserSession(validLogin.user);

    const storedToken = await getAuthToken();
    assert.equal(storedToken, authToken);

    const storedSession = await getUserSession();
    assert.equal(storedSession?.role, 'COUNTER');

    // B. Invalid PIN Login -> Should throw ApiError with 401
    await assert.rejects(
      async () => {
        await apiClient.auth.login({
          employeeId: 'emp-counter-001',
          pin: '999999',
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 401);
        return true;
      },
      'Invalid PIN must be rejected with 401',
    );
  });

  // 2. Employee Directory Retrieval
  it('2. Retrieves employee directory from real backend', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const dir = await apiClient.auth.getDirectory();
    assert.ok(Array.isArray(dir), 'Directory must be an array');
    assert.ok(dir.length > 0, 'Directory must contain seeded employees');

    const counterEmp = dir.find((e) => e.id === 'emp-counter-001');
    assert.ok(counterEmp, 'emp-counter-001 must exist in directory');
    assert.equal(counterEmp?.role, 'COUNTER');
  });

  // 3. Customer Search and Customer Creation on Real Backend
  it('3. Searches existing customers and creates a synthetic test customer on real database', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // Search existing
    const searchRes = await apiClient.customers.search('Rahul', 1, 10);
    assert.ok(searchRes.success, 'Customer search must succeed');

    // Create unique synthetic customer for E2E run
    const uniquePhone = `99${Date.now().toString().slice(-8)}`;
    const newCustomer = await apiClient.customers.create({
      name: `E2E Mobile Test Customer ${Date.now().toString().slice(-4)}`,
      phone: uniquePhone,
      address: 'Shop 10, Testing Street, Koregaon Park, Pune',
      pincode: '411001',
      membership: MembershipTier.NONE,
    });

    assert.ok(newCustomer.id, 'Created customer must have ID');
    assert.equal(newCustomer.phone, uniquePhone);
    assert.ok(newCustomer.customerCode, 'Customer must be assigned official customerCode');

    testCustomerId = newCustomer.id;

    // Search by new customer phone
    const verifySearch = await apiClient.customers.search(uniquePhone);
    assert.equal(verifySearch.data.length, 1);
    assert.equal(verifySearch.data[0].id, testCustomerId);
  });

  // 4. Duplicate Customer Rejection
  it('4. Rejects duplicate customer creation with identical phone number', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // Try to register the same phone number again
    const existingCust = await apiClient.customers.getById(testCustomerId);
    await assert.rejects(
      async () => {
        await apiClient.customers.create({
          name: 'Duplicate User',
          phone: existingCust.phone,
        });
      },
      (err: any) => {
        assert.equal(
          err.statusCode,
          409,
          'Duplicate customer registration must return HTTP 409 Conflict',
        );
        return true;
      },
    );
  });

  // 5. Catalog and Store Pricing Loading
  it('5. Loads active garments, services, and store pricing from real backend', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const [garments, services, prices] = await Promise.all([
      apiClient.catalog.getGarments(),
      apiClient.catalog.getServices(),
      apiClient.catalog.getPricing(),
    ]);

    assert.ok(garments.length > 0, 'Garments catalog must not be empty');
    assert.ok(services.length > 0, 'Services catalog must not be empty');
    assert.ok(prices.length > 0, 'Pricing table must not be empty');

    // Find a standard per-piece garment (e.g. Shirt) and service (Wash & Iron or Dry Clean)
    const shirt = garments.find(
      (g) => g.name.toLowerCase().includes('shirt') && g.category === 'MEN',
    );
    perPieceGarmentId = shirt?.id || garments[0].id;

    const washIron = services.find(
      (s) => s.category === 'WASH_IRON' || s.name.toLowerCase().includes('iron'),
    );
    laundryServiceId = washIron?.id || services[0].id;

    // Find a weight-based garment
    const weightGarment = garments.find((g) => g.category === GarmentCategory.WEIGHT_BASED);
    weightGarmentId = weightGarment?.id || garments[0].id;

    assert.ok(perPieceGarmentId, 'Per piece garment ID must be resolved');
    assert.ok(laundryServiceId, 'Service ID must be resolved');
  });

  // 6. Real Order Creation — Per-Piece Order
  it('6. Submits per-piece order to real backend, receives official order number and verifies server totals', async (t) => {
    if (skipIfBackendOffline(t)) return;
    perPieceDraftId = `draft-e2e-${Date.now()}`;

    const orderPayload: CreateOrderRequest = {
      clientDraftId: perPieceDraftId,
      customerId: testCustomerId,
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      pickupType: PickupType.STORE_PICKUP,
      workflow: 'LAUNDRY',
      entryMode: 'PIECES',
      notes: 'Phase E Live Integration Order',
      items: [
        {
          garmentCatalogId: perPieceGarmentId,
          serviceTypeId: laundryServiceId,
          quantity: 2,
          defectNotes: 'Collar stain noted at intake',
          pieces: [
            { unitNumber: 1, photoCount: 1 },
            { unitNumber: 2, photoCount: 1 },
          ],
        },
      ],
    };

    const serverOrder = await apiClient.orders.create(orderPayload);

    assert.ok(serverOrder.id, 'Server must return internal order ID');
    assert.ok(serverOrder.orderNumber, 'Server must return official order number');
    assert.ok(
      serverOrder.orderNumber.startsWith('ORD-'),
      `Order number must follow standard format: ${serverOrder.orderNumber}`,
    );
    assert.equal(serverOrder.customerId, testCustomerId);
    assert.equal(serverOrder.status || (serverOrder as any).orderStatus, OrderStatus.RECEIVED);
    assert.equal(serverOrder.items.length, 1);

    confirmedOrderId = serverOrder.id;
    confirmedOrderNumber = serverOrder.orderNumber;

    // Verify server-authoritative totals
    // 2 shirts * unitPrice, plus 18% GST
    assert.ok(serverOrder.subtotal > 0, 'Subtotal must be positive');
    assert.ok(serverOrder.taxAmount >= 0, 'Tax amount must be non-negative');
    assert.ok(serverOrder.totalAmount >= serverOrder.subtotal, 'Total amount must be greater than or equal to subtotal');
  });

  // 7. Real Order Creation — Weight-Based Order & Minimum Weight Rule Enforcement
  it('7. Enforces >= 2.00 kg minimum weight rule on real backend for weight-based order', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // A. Rejection of weight < 2.00 kg (e.g. 1.5 kg)
    const invalidWeightPayload: CreateOrderRequest = {
      clientDraftId: `draft-e2e-wt-invalid-${Date.now()}`,
      customerId: testCustomerId,
      isExpress: false,
      pickupType: PickupType.STORE_PICKUP,
      workflow: 'LAUNDRY',
      entryMode: 'WEIGHT',
      items: [
        {
          garmentCatalogId: weightGarmentId,
          serviceTypeId: laundryServiceId,
          quantity: 3,
          weight: 1.5, // Below 2.00 kg minimum
          pieces: [
            { unitNumber: 1, photoCount: 1 },
            { unitNumber: 2, photoCount: 1 },
            { unitNumber: 3, photoCount: 1 },
          ],
        },
      ],
    };

    await assert.rejects(
      async () => {
        await apiClient.orders.create(invalidWeightPayload);
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.ok(
          err.message.includes('2.00 kg') || err.message.includes('minimum'),
          'Error must cite 2.00 kg minimum weight',
        );
        return true;
      },
      'Weight below 2.00 kg must be rejected by backend',
    );

    // B. Acceptance of valid weight (e.g. 2.75 kg)
    const validWeightPayload: CreateOrderRequest = {
      clientDraftId: `draft-e2e-wt-valid-${Date.now()}`,
      customerId: testCustomerId,
      isExpress: false,
      pickupType: PickupType.STORE_PICKUP,
      workflow: 'LAUNDRY',
      entryMode: 'WEIGHT',
      items: [
        {
          garmentCatalogId: weightGarmentId,
          serviceTypeId: laundryServiceId,
          quantity: 4,
          weight: 2.75, // Valid >= 2.00 kg
          pieces: [
            { unitNumber: 1, photoCount: 1 },
            { unitNumber: 2, photoCount: 1 },
            { unitNumber: 3, photoCount: 1 },
            { unitNumber: 4, photoCount: 1 },
          ],
        },
      ],
    };

    const weightOrder = await apiClient.orders.create(validWeightPayload);
    assert.ok(weightOrder.id);
    assert.ok(weightOrder.orderNumber.startsWith('ORD-'));
    assert.equal(weightOrder.items[0].weight, 2.75);
  });

  // 8. Backend Canonical Status Derivation
  it('8. Verifies canonical order status derivation on server-returned order', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const fetchedOrder = await apiClient.orders.getById(confirmedOrderId);
    assert.equal(fetchedOrder.id, confirmedOrderId);
    assert.equal(fetchedOrder.orderNumber, confirmedOrderNumber);

    // Canonical derivation from item statuses
    const derived = deriveOrderStatus({
      items: fetchedOrder.items.map((i) => ({
        status: i.itemStatus as ItemStatus,
      })),
    });

    assert.equal(fetchedOrder.status || (fetchedOrder as any).orderStatus, derived);
    assert.equal(derived, OrderStatus.RECEIVED);
  });

  // 9. Idempotent Pre-flight & Recovery against Real Backend
  it('9. Recovers confirmed order idempotently using clientDraftId without duplicating orders', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // Call the dedicated idempotency recovery endpoint implemented in Phase B
    const recovered = await apiClient.orders.getByDraftId(perPieceDraftId);

    assert.ok(recovered, 'Order must be recovered by clientDraftId');
    assert.equal(recovered.id, confirmedOrderId);
    assert.equal(recovered.orderNumber, confirmedOrderNumber);
    assert.equal(recovered.clientDraftId, perPieceDraftId);
  });

  // 10. Repeated Submission Idempotency against Real Backend
  it('10. Repeated submission with identical payload returns existing order idempotently', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const duplicateSubmissionPayload: CreateOrderRequest = {
      clientDraftId: perPieceDraftId,
      customerId: testCustomerId,
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      pickupType: PickupType.STORE_PICKUP,
      workflow: 'LAUNDRY',
      entryMode: 'PIECES',
      notes: 'Phase E Live Integration Order',
      items: [
        {
          garmentCatalogId: perPieceGarmentId,
          serviceTypeId: laundryServiceId,
          quantity: 2,
          defectNotes: 'Collar stain noted at intake',
          pieces: [
            { unitNumber: 1, photoCount: 1 },
            { unitNumber: 2, photoCount: 1 },
          ],
        },
      ],
    };

    // Submitting the exact same draft payload should be idempotent
    const replayed = await apiClient.orders.create(duplicateSubmissionPayload);
    assert.equal(replayed.id, confirmedOrderId);
    assert.equal(replayed.orderNumber, confirmedOrderNumber);
  });

  // 11. Conflict Detection against Real Backend
  it('11. Detects payload mutation with same clientDraftId and returns HTTP 409 Conflict', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const conflictingPayload: CreateOrderRequest = {
      clientDraftId: perPieceDraftId, // Same draft ID
      customerId: testCustomerId,
      isExpress: false,
      expressDeliveryOption: ExpressDeliveryOption.REGULAR,
      pickupType: PickupType.STORE_PICKUP,
      workflow: 'LAUNDRY',
      entryMode: 'PIECES',
      notes: 'Conflicting payload attempt',
      items: [
        {
          garmentCatalogId: perPieceGarmentId,
          serviceTypeId: laundryServiceId,
          quantity: 4, // Mutated quantity!
          pieces: [
            { unitNumber: 1, photoCount: 1 },
            { unitNumber: 2, photoCount: 1 },
            { unitNumber: 3, photoCount: 1 },
            { unitNumber: 4, photoCount: 1 },
          ],
        },
      ],
    };

    await assert.rejects(
      async () => {
        await apiClient.orders.create(conflictingPayload);
      },
      (err: any) => {
        assert.equal(
          err.statusCode,
          409,
          'Mutated payload on existing draft ID must return HTTP 409',
        );
        assert.ok(
          err.message.includes('Client draft ID') &&
            err.message.includes('different order payload'),
        );
        return true;
      },
    );
  });

  // 12. Real Photo Upload to Confirmed Order
  it('12. Uploads intake photo for confirmed order to real backend storage', async (t) => {
    if (skipIfBackendOffline(t)) return;
    // Generate a minimal valid JPEG buffer for real upload testing
    const syntheticJpegBase64 =
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const imageUri = `data:image/jpeg;base64,${syntheticJpegBase64}`;

    // Test real photo upload endpoint
    const uploadResult = await apiClient.photos.upload({
      uri: imageUri,
      orderId: confirmedOrderId,
      photoType: 'FRONT',
    });

    assert.ok(uploadResult.id, 'Uploaded photo must have server ID');
    assert.ok(uploadResult.url, 'Uploaded photo must have accessible URL');

    // Verify order photo list on backend
    const token = await getAuthToken();
    const photosRes = await fetch(`${BACKEND_URL}/api/orders/${confirmedOrderId}/photos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const photosBody = await photosRes.json();
    assert.ok(photosBody.success);
    assert.ok(photosBody.data.length >= 1);
    assert.ok(photosBody.data[0].id, 'Photo must have server ID');
    assert.ok(photosBody.data[0].url, 'Photo must have server URL');
  });

  // 13. Website Integration Verification (GET /api/orders/:id)
  it('13. Confirms that the created order is fully visible and compatible with existing website OrderDetail view', async (t) => {
    if (skipIfBackendOffline(t)) return;
    const token = await getAuthToken();
    const res = await fetch(`${BACKEND_URL}/api/orders/${confirmedOrderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);
    const order = body.data;

    // Verify fields required by website OrderDetailPage.tsx and shared OrderDetailDTO contract
    assert.equal(order.id, confirmedOrderId);
    assert.equal(order.orderNumber, confirmedOrderNumber);
    assert.ok(order.customerName, 'Customer name must be loaded');
    assert.ok(order.customerPhone, 'Customer phone must be loaded');
    assert.ok(order.items.length > 0, 'Items must be populated');
    assert.ok(order.items[0].garmentName, 'Garment relation must be populated');
    assert.ok(order.items[0].serviceType, 'ServiceType relation must be populated');
    assert.ok(
      order.items[0].physicalGarments.length > 0,
      'Physical garments must be created with tags',
    );
    assert.ok(order.items[0].physicalGarments[0].tagId, 'Each piece must have a generated tagId');
    assert.ok(order.totalAmount > 0, 'Total amount must be present');
  });

  // 14. Session Cleanup / Logout
  it('14. Staff logout cleans secure store without touching database records', async (t) => {
    if (skipIfBackendOffline(t)) return;
    await removeAuthToken();
    const tokenAfterLogout = await getAuthToken();
    assert.equal(tokenAfterLogout, null, 'Token must be removed after logout');
  });
});
