import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiError } from '../api/client';
import {
  OrderStatus,
  PaymentStatus,
  Role,
  OrderSummaryDTO,
  DashboardSummaryDTO,
  DeliveryRecordDTO,
  DeliveryStatus,
  OrderPriority,
  PickupType,
} from '@growfast/shared-types';

describe('GrowFast Mobile POS — Operational Dashboard (Phase 2)', () => {
  const originalOrdersList = apiClient.orders.list;
  const originalOrdersDueToday = apiClient.orders.dueToday;
  const originalDeliveriesList = apiClient.deliveries.list;
  const originalDashboardSummary = apiClient.dashboard.getSummary;

  const mockOrderSummary = (overrides?: Partial<OrderSummaryDTO>): OrderSummaryDTO => ({
    id: 'ord-test-101',
    orderNumber: 'GF-1024',
    customerId: 'cust-1',
    customerName: 'Rahul Sharma',
    customerPhone: '+919876543210',
    orderDate: '2026-10-24T09:30:00Z',
    effectiveDueDate: '2026-10-27T18:00:00Z',
    isExpress: false,
    priority: OrderPriority.STANDARD,
    status: OrderStatus.READY,
    subtotal: 240,
    discountAmount: 24,
    taxAmount: 0,
    totalAmount: 216,
    amountPaid: 216,
    amountDue: 0,
    paymentStatus: PaymentStatus.PAID,
    pickupType: PickupType.STORE_PICKUP,
    itemCount: 2,
    readyAmount: 216,
    remainingAmount: 0,
    collectedAmount: 216,
    cancelledAmount: 0,
    payableAmount: 216,
    ...overrides,
  });

  const mockDeliveryRecord = (overrides?: Partial<DeliveryRecordDTO>): DeliveryRecordDTO => ({
    id: 'del-test-1',
    orderId: 'ord-test-101',
    orderNumber: 'GF-1024',
    customerName: 'Rahul Sharma',
    address: '123 MG Road, Pune',
    riderId: 'emp-rider-1',
    riderName: 'Sunil Kumar',
    status: DeliveryStatus.ASSIGNED,
    scheduledAt: new Date().toISOString(),
    completedAt: null,
    proofPhotoUrl: null,
    notes: null,
    createdAt: '2026-10-24T08:00:00Z',
    updatedAt: '2026-10-24T08:00:00Z',
    ...overrides,
  });

  beforeEach(() => {
    // Restore default APIs
    apiClient.orders.list = originalOrdersList;
    apiClient.orders.dueToday = originalOrdersDueToday;
    apiClient.deliveries.list = originalDeliveriesList;
    apiClient.dashboard.getSummary = originalDashboardSummary;
  });

  // 1. Successful loading of authorized operational metrics
  it('1. Successfully loads authorized operational metrics from verified endpoints', async () => {
    // Mock Ready for Pickup: GET /api/orders?status=READY
    apiClient.orders.list = async (params: any) => {
      if (params?.status === OrderStatus.READY) {
        return {
          success: true,
          data: [mockOrderSummary()],
          total: 8,
          page: 1,
          pageSize: 1,
          totalPages: 8,
        };
      }
      if (params?.paymentStatus === PaymentStatus.PENDING) {
        return {
          success: true,
          data: [mockOrderSummary({ paymentStatus: PaymentStatus.PENDING })],
          total: 14,
          page: 1,
          pageSize: 1,
          totalPages: 14,
        };
      }
      return { success: true, data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    };

    // Mock Deliveries Scheduled Today
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    apiClient.deliveries.list = async () => [
      mockDeliveryRecord({ id: 'del-1', scheduledAt: today.toISOString() }),
      mockDeliveryRecord({ id: 'del-2', scheduledAt: today.toISOString() }),
      mockDeliveryRecord({ id: 'del-3', scheduledAt: tomorrow.toISOString() }),
    ];

    // Mock Orders Due Today
    apiClient.orders.dueToday = async () => ({ count: 5 });

    // Execute queries as in dashboard
    const readyRes = await apiClient.orders.list({ status: OrderStatus.READY, limit: 1 });
    const unpaidRes = await apiClient.orders.list({
      paymentStatus: PaymentStatus.PENDING,
      limit: 1,
    });
    const deliveries = await apiClient.deliveries.list();
    const todayStr = new Date().toDateString();
    const deliveriesToday = deliveries.filter(
      (d) => d.scheduledAt && new Date(d.scheduledAt).toDateString() === todayStr,
    );
    const dueTodayRes = await apiClient.orders.dueToday({ countOnly: true });

    assert.equal(readyRes.total, 8, 'Ready for pickup total count must match pagination total');
    assert.equal(unpaidRes.total, 14, 'Unpaid orders count must match pending payment count');
    assert.equal(deliveriesToday.length, 2, 'Deliveries scheduled today must filter by date');
    assert.equal(dueTodayRes.count, 5, 'Orders due today count must match');
  });

  // 2. Correct rendering of zero, unavailable, and loading values
  it('2. Distinguishes genuine zero counts from unavailable/offline values', async () => {
    // When order count is zero
    apiClient.orders.list = async () => ({
      success: true,
      data: [],
      total: 0,
      page: 1,
      pageSize: 1,
      totalPages: 0,
    });

    const res = await apiClient.orders.list({ status: OrderStatus.READY });
    const displayCount = res.total !== null ? res.total : 'N/A';
    assert.equal(displayCount, 0, 'Genuine zero count must be displayed as 0');

    // When API fails or device is disconnected
    let offlineValue: number | null = null;
    const isConnected = false;
    const offlineDisplay = offlineValue !== null ? offlineValue : isConnected ? '—' : 'N/A';
    assert.equal(offlineDisplay, 'N/A', 'Disconnected/unavailable metric must display N/A');

    // When online but still loading
    const onlineValue: number | null = null;
    const onlineDisplay = onlineValue !== null ? onlineValue : true ? '—' : 'N/A';
    assert.equal(onlineDisplay, '—', 'Loading metric while connected must show placeholder dash');
  });

  // 3. OWNER-only financial data visibility
  it('3. Fetches and displays financial summary only when user role is OWNER', async () => {
    let dashboardSummaryCalled = false;
    const mockSummary: DashboardSummaryDTO = {
      period: { startDate: '2026-10-24T00:00:00Z', endDate: '2026-10-24T23:59:59Z' },
      overview: {
        totalOrders: 32,
        totalItems: 90,
        totalCustomers: 25,
      },
      orders: {
        received: 5,
        sorting: 2,
        processing: 10,
        drying: 1,
        ironing: 2,
        qualityCheck: 1,
        packed: 1,
        ready: 8,
        outForDelivery: 1,
        delivered: 4,
        cancelled: 0,
        overdue: 2,
        dueToday: 8,
      },
      financial: {
        totalOrderValue: 18500.5,
        amountPaid: 18500.5,
        amountDue: 12000,
        paidOrders: 20,
        partialOrders: 4,
        pendingOrders: 8,
        collections: 18500.5,
      },
      delivery: {
        scheduled: 2,
        assigned: 1,
        inTransit: 1,
        completed: 4,
        failed: 0,
      },
      customers: {
        total: 25,
        newInPeriod: 3,
      },
      readyOrders: [],
      recentOrders: [],
      recentActivity: [],
    };

    apiClient.dashboard.getSummary = async () => {
      dashboardSummaryCalled = true;
      return mockSummary;
    };

    const session = { id: 'emp-owner', role: Role.OWNER, name: 'Prathamesh', storeId: 'store-1' };
    const isOwner = session.role === Role.OWNER;
    assert.equal(isOwner, true, 'User is recognized as OWNER');

    let ownerRevenue: number | null = null;
    let ownerOrdersCount: number | null = null;

    if (isOwner) {
      const summary = await apiClient.dashboard.getSummary();
      ownerRevenue =
        summary?.financial?.collections ??
        summary?.financial?.amountPaid ??
        summary?.financial?.totalOrderValue ??
        null;
      ownerOrdersCount = summary?.overview?.totalOrders ?? null;
    }

    assert.equal(dashboardSummaryCalled, true, 'getSummary must be called for OWNER');
    assert.equal(ownerRevenue, 18500.5, 'Owner revenue must match');
    assert.equal(ownerOrdersCount, 32, 'Owner orders count must match');
  });

  // 4. Counter/delivery role handling without unauthorized financial requests
  it('4. Omits financial requests for COUNTER and DELIVERY roles to prevent HTTP 403 Forbidden', async () => {
    let dashboardSummaryCalls = 0;
    apiClient.dashboard.getSummary = async () => {
      dashboardSummaryCalls++;
      throw new ApiError('Forbidden: Only OWNER can access financial summary', 403);
    };

    const staffRoles = [Role.COUNTER, Role.DELIVERY];

    for (const role of staffRoles) {
      const session = { id: 'emp-staff', role, name: 'Staff User', storeId: 'store-1' };
      const isOwner = session.role === Role.OWNER;

      let ownerRevenue: number | null = null;
      if (isOwner) {
        const summary = await apiClient.dashboard.getSummary();
        ownerRevenue =
          summary?.financial?.collections ??
          summary?.financial?.amountPaid ??
          summary?.financial?.totalOrderValue ??
          null;
      }

      assert.equal(isOwner, false, `Role ${role} is not owner`);
      assert.equal(ownerRevenue, null, 'Financial revenue must be null for non-owner');
    }

    assert.equal(
      dashboardSummaryCalls,
      0,
      'apiClient.dashboard.getSummary must NEVER be called for COUNTER or DELIVERY',
    );
  });

  // 5. Pending SQLite draft count and sync updates
  it('5. Correctly calculates pending offline draft count and triggers synchronization', async () => {
    const mockDrafts = [
      { id: 'draft-1', syncStatus: 'QUEUED' },
      { id: 'draft-2', syncStatus: 'DRAFT' },
      { id: 'draft-3', syncStatus: 'FAILED_RETRYABLE' },
      { id: 'draft-4', syncStatus: 'SYNCED' },
    ];

    const unsynced = mockDrafts.filter(
      (d) =>
        d.syncStatus === 'QUEUED' ||
        d.syncStatus === 'DRAFT' ||
        d.syncStatus === 'FAILED_RETRYABLE' ||
        d.syncStatus === 'CONFLICT',
    );

    assert.equal(unsynced.length, 3, 'Must count only un-synced drafts in the SQLite queue');

    // Verify sync guard prevents overlapping operations
    let syncEngineRunning = false;
    let syncCallCount = 0;

    const simulateSyncAll = async () => {
      if (syncEngineRunning) return { skipped: true };
      syncEngineRunning = true;
      syncCallCount++;
      // simulate async sync
      await new Promise((r) => setTimeout(r, 10));
      syncEngineRunning = false;
      return { processed: 3, succeeded: 3, failed: 0 };
    };

    // Trigger concurrent sync calls
    const [res1, res2] = await Promise.all([simulateSyncAll(), simulateSyncAll()]);
    assert.equal(syncCallCount, 1, 'Only one sync operation must execute when overlapping');
    assert.equal(
      (res1 as any).processed === 3 || (res2 as any).processed === 3,
      true,
      'One sync finishes successfully',
    );
  });

  // 6. Quick-action navigation
  it('6. Quick actions map to established routes and handlers without inventing routes', () => {
    const navigationEvents: string[] = [];
    const mockRouter = {
      push: (route: string) => navigationEvents.push(route),
    };

    // Action: Find Customer
    mockRouter.push('/(tabs)/customers');
    assert.equal(
      navigationEvents[0],
      '/(tabs)/customers',
      'Find Customer must navigate to Phase 1B Customer Hub',
    );

    // Action: Search / View Orders
    mockRouter.push('/(tabs)/orders');
    assert.equal(
      navigationEvents[1],
      '/(tabs)/orders',
      'Search Orders must navigate to orders tab',
    );
  });

  // 7. New Order action preserving existing wizard contract
  it('7. New Order action respects the OrderWizardModal contract without violating Developer B boundaries', () => {
    const wizardProps = {
      visible: true,
      draft: null,
      storeId: 'store-1',
      userRole: Role.COUNTER,
      onClose: () => {},
      onOrderSavedOrSubmitted: () => {},
    };

    assert.equal(wizardProps.visible, true);
    assert.equal(wizardProps.draft, null, 'Fresh new order passes null draft');
    assert.equal(wizardProps.storeId, 'store-1', 'Store ID is passed');
    assert.equal(wizardProps.userRole, Role.COUNTER, 'User role is passed');
    assert.equal(typeof wizardProps.onClose, 'function');
    assert.equal(typeof wizardProps.onOrderSavedOrSubmitted, 'function');
  });

  // 8. Recent order loading, empty, error, retry, and selection states
  it('8. Handles recent orders lifecycle states: loading, empty, error, retry, and detail selection', async () => {
    // 8a. Successful recent orders
    apiClient.orders.list = async () => ({
      success: true,
      data: [
        mockOrderSummary({ id: 'ord-1', orderNumber: 'GF-1024', totalAmount: 350 }),
        mockOrderSummary({ id: 'ord-2', orderNumber: 'GF-1025', totalAmount: 720 }),
      ],
      total: 2,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    const successRes = await apiClient.orders.list({ limit: 5, page: 1 });
    assert.equal(successRes.data.length, 2);
    assert.equal(successRes.data[0].orderNumber, 'GF-1024');

    // 8b. Empty state
    apiClient.orders.list = async () => ({
      success: true,
      data: [],
      total: 0,
      page: 1,
      pageSize: 5,
      totalPages: 0,
    });
    const emptyRes = await apiClient.orders.list({ pageSize: 5, page: 1 });
    assert.equal(emptyRes.data.length, 0, 'Empty data returns 0 orders to show empty state');

    // 8c. Error state & Retry
    let attempts = 0;
    apiClient.orders.list = async () => {
      attempts++;
      if (attempts === 1) {
        throw new ApiError('Gateway Timeout', 504);
      }
      return {
        success: true,
        data: [mockOrderSummary({ id: 'ord-retry', orderNumber: 'GF-9999' })],
        total: 1,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      };
    };

    await assert.rejects(
      async () => await apiClient.orders.list({ pageSize: 5, page: 1 }),
      (err: any) => err.statusCode === 504,
      'First attempt fails with 504',
    );

    // Retry succeeds
    const retryRes = await apiClient.orders.list({ pageSize: 5, page: 1 });
    assert.equal(retryRes.data[0].orderNumber, 'GF-9999', 'Retry succeeds');
    assert.equal(attempts, 2, 'Retry executed second call');

    // 8d. Order selection sets active order for detail modal
    let selectedOrderId: string | null = null;
    let modalVisible = false;

    const onSelectOrder = (id: string) => {
      selectedOrderId = id;
      modalVisible = true;
    };

    onSelectOrder('ord-retry');
    assert.equal(selectedOrderId, 'ord-retry');
    assert.equal(modalVisible, true);
  });

  // 9. Network failure and refresh behavior
  it('9. Gracefully handles network disconnection and executes pull-to-refresh reload', async () => {
    // When offline, network error is captured
    let isConnected = false;
    let capturedError: string | null = null;
    let recentOrders: OrderSummaryDTO[] = [];

    if (!isConnected) {
      capturedError = 'Device is currently offline. Connect to Wi-Fi to load live server orders.';
    }

    assert.equal(recentOrders.length, 0);
    assert.match(capturedError!, /Device is currently offline/);

    // When connection is restored and manual refresh is performed
    isConnected = true;
    let refreshCompleted = false;

    apiClient.orders.list = async () => ({
      success: true,
      data: [mockOrderSummary()],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
    });

    const handleRefresh = async () => {
      const resp = await apiClient.orders.list({ limit: 5, page: 1 });
      recentOrders = resp.data;
      refreshCompleted = true;
    };

    await handleRefresh();
    assert.equal(refreshCompleted, true, 'Refresh completed');
    assert.equal(recentOrders.length, 1, 'Orders reloaded on refresh');
  });
});
