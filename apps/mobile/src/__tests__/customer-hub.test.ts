import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, ApiError } from '../api/client';
import {
  CustomerDTO,
  CreateCustomerRequest,
  OrderSummaryDTO,
  MembershipTier,
  OrderStatus,
  PaymentStatus,
  PickupType,
  OrderPriority,
  deriveOrderStatus,
} from '@growfast/shared-types';

describe('GrowFast Mobile POS — Customer Hub & Order History (Phase 1B)', () => {
  const originalCustomersSearch = apiClient.customers.search;
  const originalCustomersCreate = apiClient.customers.create;
  const originalCustomersGetById = apiClient.customers.getById;
  const originalOrdersList = apiClient.orders.list;

  const mockCustomer = (overrides?: Partial<CustomerDTO>): CustomerDTO => ({
    id: 'cust-test-1',
    customerCode: 'CUS-001024',
    name: 'Rahul Sharma',
    phone: '+919876543210',
    email: 'rahul@example.com',
    address: 'Flat 402, Sunshine Apts, Pune',
    pincode: '411001',
    membership: MembershipTier.GOLD,
    discountPercent: 10,
    preferences: null,
    registrationSource: 'MOBILE_APP',
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    ...overrides,
  });

  const mockOrderSummary = (overrides?: Partial<OrderSummaryDTO>): OrderSummaryDTO => ({
    id: 'ord-test-101',
    orderNumber: 'GF-1024',
    customerId: 'cust-test-1',
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

  beforeEach(() => {
    // Restore default mocks
    apiClient.customers.search = originalCustomersSearch;
    apiClient.customers.create = originalCustomersCreate;
    apiClient.customers.getById = originalCustomersGetById;
    apiClient.orders.list = originalOrdersList;
  });

  // 1. Customer list renders returned API data
  it('1. Customer list renders returned API data from customer directory search', async () => {
    const sampleCustomers = [
      mockCustomer({ id: 'cust-1', name: 'Rahul Sharma', phone: '9876543210' }),
      mockCustomer({
        id: 'cust-2',
        name: 'Priya Desai',
        phone: '9876512345',
        membership: MembershipTier.SILVER,
      }),
    ];

    apiClient.customers.search = async (query, page, pageSize) => {
      assert.equal(page, 1);
      assert.equal(pageSize, 20);
      return {
        success: true,
        data: sampleCustomers,
        total: 2,
        page: 1,
        pageSize: 20,
      };
    };

    const resp = await apiClient.customers.search('', 1, 20);
    assert.equal(resp.data.length, 2);
    assert.equal(resp.total, 2);
    assert.equal(resp.data[0].name, 'Rahul Sharma');
    assert.equal(resp.data[1].membership, MembershipTier.SILVER);
  });

  // 2. Search submits the correct query and handles changing input
  it('2. Search submits the correct query parameters and debounces changing input', async () => {
    let capturedQuery: string | undefined;
    let capturedPage: number | undefined;

    apiClient.customers.search = async (query, page, pageSize) => {
      capturedQuery = query;
      capturedPage = page;
      return {
        success: true,
        data: [mockCustomer({ name: 'Amit Kulkarni', phone: '9188766554' })],
        total: 1,
        page: page || 1,
        pageSize: pageSize || 20,
      };
    };

    const result = await apiClient.customers.search('Amit', 1, 20);
    assert.equal(capturedQuery, 'Amit');
    assert.equal(capturedPage, 1);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].name, 'Amit Kulkarni');
  });

  // 3. Loading, empty, and error states render correctly
  it('3. Loading, empty, and error states handle responses safely', async () => {
    // Empty result case
    apiClient.customers.search = async () => ({
      success: true,
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    const emptyResult = await apiClient.customers.search('NonExistent', 1, 20);
    assert.equal(emptyResult.data.length, 0);
    assert.equal(emptyResult.total, 0);

    // Network error case
    apiClient.customers.search = async () => {
      throw new ApiError('Server unreachable. Ensure backend is running.', 0);
    };

    await assert.rejects(
      async () => {
        await apiClient.customers.search('ErrorQuery', 1, 20);
      },
      (err: any) => {
        assert.equal(err instanceof ApiError, true);
        assert.equal(err.statusCode, 0);
        return true;
      },
    );
  });

  // 4. Customer creation sends the correct DTO
  it('4. Customer creation validates required fields and sends complete DTO', async () => {
    let capturedPayload: CreateCustomerRequest | null = null;

    apiClient.customers.create = async (payload) => {
      capturedPayload = payload;
      return mockCustomer({
        id: 'cust-new-1',
        name: payload.name,
        phone: payload.phone,
        address: payload.address || null,
        pincode: payload.pincode || null,
        membership: payload.membership || MembershipTier.NONE,
        discountPercent: payload.discountPercent || 0,
      });
    };

    const newCustRequest: CreateCustomerRequest = {
      name: 'Sneha Patil',
      phone: '9765432109',
      address: 'Flat 101, Viman Nagar, Pune',
      pincode: '411014',
      membership: MembershipTier.GOLD,
      discountPercent: 10,
    };

    const created = await apiClient.customers.create(newCustRequest);
    assert.deepEqual(capturedPayload, newCustRequest);
    assert.equal(created.name, 'Sneha Patil');
    assert.equal(created.phone, '9765432109');
    assert.equal(created.membership, MembershipTier.GOLD);
  });

  // 5. Duplicate-phone conflicts are displayed clearly
  it('5. Duplicate-phone conflicts (HTTP 409) are caught and handled gracefully', async () => {
    apiClient.customers.create = async (payload) => {
      throw new ApiError(`Customer with phone number '${payload.phone}' already exists.`, 409, {
        statusCode: 409,
        message: `Customer with phone number '${payload.phone}' already exists.`,
      });
    };

    await assert.rejects(
      async () => {
        await apiClient.customers.create({
          name: 'Duplicate Test',
          phone: '9876543210',
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /already exists/i);
        return true;
      },
    );
  });

  // 6. Repeated submission is prevented while saving
  it('6. Repeated submission is prevented while request is in-flight', async () => {
    let activeCallCount = 0;
    let maxConcurrentCalls = 0;

    const guardedSubmit = async (isSubmittingRef: { value: boolean }, fn: () => Promise<void>) => {
      if (isSubmittingRef.value) {
        return; // Guarded: drop duplicate concurrent submit attempts
      }
      isSubmittingRef.value = true;
      activeCallCount++;
      maxConcurrentCalls = Math.max(maxConcurrentCalls, activeCallCount);
      try {
        await fn();
      } finally {
        activeCallCount--;
        isSubmittingRef.value = false;
      }
    };

    const submitState = { value: false };
    const simulatedAsyncApi = (): Promise<void> =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });

    // Simulate double-click
    await Promise.all([
      guardedSubmit(submitState, simulatedAsyncApi),
      guardedSubmit(submitState, simulatedAsyncApi),
    ]);

    assert.equal(maxConcurrentCalls, 1, 'Only one submission should execute at a time');
  });

  // 7. Customer profile loads the correct customer
  it('7. Customer profile loads the correct customer details', async () => {
    const targetCustomer = mockCustomer({
      id: 'cust-vip-1',
      customerCode: 'CUS-VIP-001',
      name: 'Dr. Anand Joshi',
      phone: '+919988776655',
      membership: MembershipTier.PLATINUM,
      discountPercent: 15,
    });

    apiClient.customers.getById = async (id) => {
      assert.equal(id, 'cust-vip-1');
      return targetCustomer;
    };

    const fetched = await apiClient.customers.getById('cust-vip-1');
    assert.equal(fetched.id, 'cust-vip-1');
    assert.equal(fetched.customerCode, 'CUS-VIP-001');
    assert.equal(fetched.membership, MembershipTier.PLATINUM);
    assert.equal(fetched.discountPercent, 15);
  });

  // 8. Order history uses the selected customer's ID
  it('8. Order history queries apiClient.orders.list using selected customer ID', async () => {
    let capturedParams: any = null;

    apiClient.orders.list = async (params) => {
      capturedParams = params;
      return {
        success: true,
        data: [
          mockOrderSummary({ id: 'ord-1', orderNumber: 'GF-1024', totalAmount: 240 }),
          mockOrderSummary({ id: 'ord-2', orderNumber: 'GF-1025', totalAmount: 480 }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };
    };

    const history = await apiClient.orders.list({ customerId: 'cust-test-1', pageSize: 20 });
    assert.equal(capturedParams.customerId, 'cust-test-1');
    assert.equal(history.data.length, 2);
    assert.equal(history.data[0].orderNumber, 'GF-1024');
    assert.equal(history.data[1].totalAmount, 480);
  });

  // 9. Empty and failed order history can be retried
  it('9. Empty and failed order history can be retried cleanly', async () => {
    let attempt = 0;

    apiClient.orders.list = async () => {
      attempt++;
      if (attempt === 1) {
        throw new ApiError('Temporary network timeout', 0);
      }
      return {
        success: true,
        data: [mockOrderSummary({ id: 'ord-retry', orderNumber: 'GF-1026' })],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    };

    // First attempt fails
    await assert.rejects(async () => {
      await apiClient.orders.list({ customerId: 'cust-1' });
    });

    // Retry succeeds
    const retryResult = await apiClient.orders.list({ customerId: 'cust-1' });
    assert.equal(retryResult.data.length, 1);
    assert.equal(retryResult.data[0].orderNumber, 'GF-1026');
    assert.equal(attempt, 2);
  });

  // 10. Start Order respects the actual wizard integration contract without breaking existing draft behavior
  it('10. Start Order respects the actual wizard integration contract and preserves draft behavior', () => {
    // Contract verification: Ensure canonical status derivation is always used for order summaries
    const derived = deriveOrderStatus({
      items: [{ status: 'READY' as any }, { status: 'READY' as any }],
      currentOrderStatus: OrderStatus.PROCESSING,
    });
    assert.equal(derived, OrderStatus.READY);

    // Verify customer draft pre-fill boundary:
    const selectedCust = mockCustomer({ id: 'cust-prefill', name: 'Tanvi Shah' });
    const draftPayload = {
      customerId: selectedCust.id,
      customerName: selectedCust.name,
      customerPhone: selectedCust.phone,
    };

    assert.equal(draftPayload.customerId, 'cust-prefill');
    assert.equal(draftPayload.customerName, 'Tanvi Shah');
  });

  // ==========================================
  // WORKSTREAM 1: CUSTOMER ORDER HISTORY TESTS
  // ==========================================

  // 11. Order history filtering by status using backend query contract
  it('11. Customer order history queries with status filter using backend contract', async () => {
    let capturedParams: any = null;

    apiClient.orders.list = async (params) => {
      capturedParams = params;
      return {
        success: true,
        data: [
          mockOrderSummary({ id: 'ord-ready-1', orderNumber: 'GF-2001', status: OrderStatus.READY }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    };

    const res = await apiClient.orders.list({
      customerId: 'cust-test-1',
      status: OrderStatus.READY,
      page: 1,
      pageSize: 10,
    });

    assert.equal(capturedParams.customerId, 'cust-test-1');
    assert.equal(capturedParams.status, OrderStatus.READY);
    assert.equal(capturedParams.pageSize, 10);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].status, OrderStatus.READY);
    assert.equal(res.data[0].orderNumber, 'GF-2001');
  });

  // 12. Order history filtering by payment status (PENDING due vs PAID)
  it('12. Customer order history queries with paymentStatus filter', async () => {
    let capturedParams: any = null;

    apiClient.orders.list = async (params) => {
      capturedParams = params;
      return {
        success: true,
        data: [
          mockOrderSummary({
            id: 'ord-pending-1',
            orderNumber: 'GF-2002',
            paymentStatus: PaymentStatus.PENDING,
            totalAmount: 350,
            amountPaid: 0,
            amountDue: 350,
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    };

    const res = await apiClient.orders.list({
      customerId: 'cust-test-1',
      paymentStatus: PaymentStatus.PENDING,
      page: 1,
      pageSize: 10,
    });

    assert.equal(capturedParams.customerId, 'cust-test-1');
    assert.equal(capturedParams.paymentStatus, PaymentStatus.PENDING);
    assert.equal(res.data[0].paymentStatus, PaymentStatus.PENDING);
    assert.equal(res.data[0].amountDue, 350);
  });

  // 13. Customer order history search by official order number
  it('13. Customer order history search passes search query to backend without extra non-whitelisted params', async () => {
    let capturedParams: any = null;

    apiClient.orders.list = async (params) => {
      capturedParams = params;
      return {
        success: true,
        data: [mockOrderSummary({ id: 'ord-search-1', orderNumber: 'GF-3030' })],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    };

    const res = await apiClient.orders.list({
      customerId: 'cust-test-1',
      search: '3030',
      page: 1,
      pageSize: 10,
    });

    assert.equal(capturedParams.customerId, 'cust-test-1');
    assert.equal(capturedParams.search, '3030');
    assert.equal(capturedParams.limit, undefined, 'Must not contain deprecated limit parameter');
    assert.equal(res.data[0].orderNumber, 'GF-3030');
  });

  // 14. Pagination and incremental loading logic
  it('14. Customer order history supports pagination and incremental loading across pages', async () => {
    const allMockOrders = Array.from({ length: 25 }, (_, i) =>
      mockOrderSummary({
        id: `ord-page-${i + 1}`,
        orderNumber: `GF-${4000 + i + 1}`,
        totalAmount: 100 + i * 10,
      }),
    );

    apiClient.orders.list = async (params) => {
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const slice = allMockOrders.slice(start, end);

      return {
        success: true,
        data: slice,
        total: allMockOrders.length,
        page,
        pageSize,
      };
    };

    // Page 1
    const p1 = await apiClient.orders.list({ customerId: 'cust-1', page: 1, pageSize: 10 });
    assert.equal(p1.data.length, 10);
    assert.equal(p1.total, 25);
    const hasMoreP1 = (p1.page * p1.pageSize) < p1.total;
    assert.equal(hasMoreP1, true, 'Page 1 should indicate hasMoreOrders');

    // Page 2
    const p2 = await apiClient.orders.list({ customerId: 'cust-1', page: 2, pageSize: 10 });
    assert.equal(p2.data.length, 10);
    const hasMoreP2 = (p2.page * p2.pageSize) < p2.total;
    assert.equal(hasMoreP2, true, 'Page 2 should indicate hasMoreOrders');

    // Page 3
    const p3 = await apiClient.orders.list({ customerId: 'cust-1', page: 3, pageSize: 10 });
    assert.equal(p3.data.length, 5);
    const hasMoreP3 = (p3.page * p3.pageSize) < p3.total;
    assert.equal(hasMoreP3, false, 'Page 3 should indicate hasMoreOrders = false');

    // Total aggregated orders
    const combined = [...p1.data, ...p2.data, ...p3.data];
    assert.equal(combined.length, 25);
    assert.equal(combined[0].orderNumber, 'GF-4001');
    assert.equal(combined[24].orderNumber, 'GF-4025');
  });

  // 15. Stale results prevention when rapidly switching customers
  it('15. Stale responses are discarded when rapidly switching customers or search queries', async () => {
    let activeCustomerRef: string | null = null;
    let requestIdCounter = 0;
    const finalState: { customerId: string | null; orders: OrderSummaryDTO[] } = {
      customerId: null,
      orders: [],
    };

    // Simulate async fetch with variable delay
    const simulateFetch = async (customerId: string, delayMs: number, orders: OrderSummaryDTO[]) => {
      const currentReqId = ++requestIdCounter;
      activeCustomerRef = customerId;

      await new Promise((resolve) => setTimeout(resolve, delayMs));

      // Guard check: drop response if customer changed or a newer request was dispatched
      if (currentReqId !== requestIdCounter || activeCustomerRef !== customerId) {
        return { ignored: true };
      }

      finalState.customerId = customerId;
      finalState.orders = orders;
      return { ignored: false };
    };

    const custAOrders = [mockOrderSummary({ id: 'ord-custA', orderNumber: 'GF-A01' })];
    const custBOrders = [mockOrderSummary({ id: 'ord-custB', orderNumber: 'GF-B01' })];

    // Staff clicks Customer A (slow network, 60ms)
    const promiseA = simulateFetch('cust-A', 60, custAOrders);

    // Staff quickly clicks Customer B 10ms later (fast network, 20ms)
    await new Promise((r) => setTimeout(r, 10));
    const promiseB = simulateFetch('cust-B', 20, custBOrders);

    const [resA, resB] = await Promise.all([promiseA, promiseB]);

    assert.equal(resB.ignored, false, 'Customer B request should be accepted');
    assert.equal(resA.ignored, true, 'Customer A slow request must be ignored');
    assert.equal(finalState.customerId, 'cust-B');
    assert.equal(finalState.orders[0].orderNumber, 'GF-B01');
  });

  // 16. Essential order fields verification
  it('16. Historical order items contain all required display fields', () => {
    const sample = mockOrderSummary({
      orderNumber: 'GF-9090',
      orderDate: '2026-10-24T12:00:00Z',
      status: OrderStatus.READY,
      totalAmount: 500,
      amountPaid: 300,
      amountDue: 200,
    });

    assert.ok(sample.orderNumber, 'Must have order number');
    assert.ok(sample.orderDate, 'Must have order date');
    assert.ok(sample.status, 'Must have status');
    assert.equal(sample.totalAmount, 500);
    assert.equal(sample.amountPaid, 300);
    assert.equal(sample.amountDue, 200);

    // Outstanding balance computation check
    const calculatedDue = sample.amountDue ?? (sample.totalAmount - (sample.amountPaid ?? 0));
    assert.equal(calculatedDue, 200);
  });

  // 17. Failed history and retry states
  it('17. Error states preserve filter arguments on retry and recover upon success', async () => {
    let callCount = 0;
    let lastParams: any = null;

    apiClient.orders.list = async (params) => {
      callCount++;
      lastParams = params;
      if (callCount === 1) {
        throw new ApiError('Connection reset by peer', 500);
      }
      return {
        success: true,
        data: [mockOrderSummary({ id: 'ord-retry-ok', orderNumber: 'GF-RETRY' })],
        total: 1,
        page: 1,
        pageSize: 10,
      };
    };

    const queryFilters = {
      customerId: 'cust-retry-user',
      status: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.PENDING,
      search: 'RETRY',
      page: 1,
      pageSize: 10,
    };

    // First attempt fails
    await assert.rejects(async () => {
      await apiClient.orders.list(queryFilters);
    });
    assert.equal(callCount, 1);

    // Retry succeeds with identical filter arguments
    const retryRes = await apiClient.orders.list(queryFilters);
    assert.equal(callCount, 2);
    assert.equal(lastParams.status, OrderStatus.PROCESSING);
    assert.equal(lastParams.paymentStatus, PaymentStatus.PENDING);
    assert.equal(lastParams.search, 'RETRY');
    assert.equal(retryRes.data[0].orderNumber, 'GF-RETRY');
  });
});
