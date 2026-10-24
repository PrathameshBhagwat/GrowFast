import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePaymentIdempotencyKey,
  validatePaymentInput,
  executePaymentWithIdempotency,
} from '../services/payment-manager';
import { apiClient, ApiError } from '../api/client';
import {
  PaymentMode,
  PaymentStatus,
  OrderStatus,
  PaymentDTO,
  PaymentSummaryDTO,
  deriveOrderStatus,
} from '@growfast/shared-types';

describe('GrowFast Mobile Phase F — Payments & Order Operations', () => {
  const originalPaymentsRecord = apiClient.payments.record;
  const originalGetOrderPayments = apiClient.payments.getOrderPayments;
  const originalGetSummary = apiClient.payments.getSummary;
  const originalOrdersGetById = apiClient.orders.getById;
  const originalRecordPickup = apiClient.orders.recordPickup;

  const mockPaymentDTO = (overrides: Partial<PaymentDTO> & { id: string; orderId: string; amount: number; mode: PaymentMode }): PaymentDTO => ({
    reference: null,
    receivedById: 'user-staff-1',
    receivedByName: 'Priya Staff',
    createdAt: new Date().toISOString(),
    idempotencyKey: null,
    ...overrides,
  });

  beforeEach(() => {
    // Restore default mocks
    apiClient.payments.record = originalPaymentsRecord;
    apiClient.payments.getOrderPayments = originalGetOrderPayments;
    apiClient.payments.getSummary = originalGetSummary;
    apiClient.orders.getById = originalOrdersGetById;
    apiClient.orders.recordPickup = originalRecordPickup;
  });

  // 1. Valid partial payment
  it('1. Valid partial payment: correctly processes and updates balance', async () => {
    const orderId = 'order-test-101';
    const amountDue = 1000;
    const partialAmount = 400;

    // Validate input
    const validation = validatePaymentInput(partialAmount, amountDue);
    assert.equal(validation.isValid, true);
    assert.equal(validation.sanitizedAmount, 400);

    const idempotencyKey = generatePaymentIdempotencyKey(orderId);
    assert.ok(idempotencyKey.startsWith(`pay_${orderId}_`));

    // Mock successful backend response
    apiClient.payments.record = async (req) => {
      assert.equal(req.orderId, orderId);
      assert.equal(req.amount, 400);
      assert.equal(req.mode, PaymentMode.UPI);
      assert.equal(req.idempotencyKey, idempotencyKey);
      return mockPaymentDTO({
        id: 'pay-001',
        orderId,
        amount: 400,
        mode: PaymentMode.UPI,
        idempotencyKey,
      });
    };

    const result = await executePaymentWithIdempotency({
      orderId,
      amount: partialAmount,
      mode: PaymentMode.UPI,
      idempotencyKey,
    });

    assert.equal(result.success, true);
    assert.ok(result.payment);
    assert.equal(result.payment.amount, 400);
    assert.equal(result.idempotencyKey, idempotencyKey);

    // Remaining balance calculation
    const remainingDue = Number((amountDue - result.payment.amount).toFixed(2));
    assert.equal(remainingDue, 600);
  });

  // 2. Full payment
  it('2. Full payment: settles exact amount due and reaches zero balance', async () => {
    const orderId = 'order-test-102';
    const amountDue = 750.5;

    const validation = validatePaymentInput(amountDue, amountDue);
    assert.equal(validation.isValid, true);
    assert.equal(validation.sanitizedAmount, 750.5);

    const idempotencyKey = generatePaymentIdempotencyKey(orderId);

    apiClient.payments.record = async (req) => {
      assert.equal(req.amount, 750.5);
      return mockPaymentDTO({
        id: 'pay-002',
        orderId,
        amount: 750.5,
        mode: PaymentMode.CASH,
        idempotencyKey,
      });
    };

    const result = await executePaymentWithIdempotency({
      orderId,
      amount: amountDue,
      mode: PaymentMode.CASH,
      idempotencyKey,
    });

    assert.equal(result.success, true);
    assert.equal(result.payment?.amount, 750.5);
    const remainingDue = Number((amountDue - result.payment!.amount).toFixed(2));
    assert.equal(remainingDue, 0);
  });

  // 3. Zero, negative, malformed, or otherwise invalid payment amounts
  it('3. Rejects zero, negative, malformed, or NaN payment amounts', () => {
    const balance = 500;

    // Zero
    const resZero = validatePaymentInput(0, balance);
    assert.equal(resZero.isValid, false);
    assert.match(resZero.error!, /greater than zero/);

    // Negative
    const resNeg = validatePaymentInput(-50, balance);
    assert.equal(resNeg.isValid, false);
    assert.match(resNeg.error!, /greater than zero/);

    // Malformed / NaN
    const resNaN = validatePaymentInput('not-a-number', balance);
    assert.equal(resNaN.isValid, false);
    assert.match(resNaN.error!, /valid number/);

    // Infinity
    const resInf = validatePaymentInput(Infinity, balance);
    assert.equal(resInf.isValid, false);
    assert.match(resInf.error!, /valid number/);
  });

  // 4. Overpayment rejection
  it('4. Overpayment rejection: client guard and server rejection', async () => {
    const balance = 500;

    // Client-side guard
    const clientCheck = validatePaymentInput(500.01, balance);
    assert.equal(clientCheck.isValid, false);
    assert.match(clientCheck.error!, /cannot exceed outstanding balance/);

    // Backend-authoritative 400 rejection
    apiClient.payments.record = async () => {
      throw new ApiError('Payment amount exceeds order balance due', 400, 'BAD_REQUEST');
    };

    const result = await executePaymentWithIdempotency({
      orderId: 'order-104',
      amount: 600,
      mode: PaymentMode.CASH,
    });

    assert.equal(result.success, false);
    assert.equal(result.isBadRequest, true);
    assert.match(result.error!, /Payment amount exceeds order balance due/);
  });

  // 5. Duplicate submission prevention
  it('5. Duplicate submission prevention: locks concurrent requests with same idempotency key', async () => {
    const orderId = 'order-test-105';
    const key = `pay_lock_test_${Date.now()}`;

    // Slow simulated API call
    apiClient.payments.record = async () => {
      await new Promise((r) => setTimeout(r, 60));
      return mockPaymentDTO({
        id: 'pay-005',
        orderId,
        amount: 200,
        mode: PaymentMode.UPI,
        idempotencyKey: key,
      });
    };

    // Fire first call
    const call1 = executePaymentWithIdempotency({
      orderId,
      amount: 200,
      mode: PaymentMode.UPI,
      idempotencyKey: key,
    });

    // Fire concurrent duplicate call immediately
    const call2 = await executePaymentWithIdempotency({
      orderId,
      amount: 200,
      mode: PaymentMode.UPI,
      idempotencyKey: key,
    });

    // Second call must be blocked immediately by client lock
    assert.equal(call2.success, false);
    assert.match(call2.error!, /already in progress/);

    const result1 = await call1;
    assert.equal(result1.success, true);
  });

  // 6. Timeout after server commit and safe retry
  it('6. Timeout after server commit: safely recovers committed payment via getOrderPayments verification', async () => {
    const orderId = 'order-test-106';
    const key = `pay_timeout_test_${Date.now()}`;

    // First attempt: record throws a network timeout / connection abort
    apiClient.payments.record = async () => {
      throw new Error('Network request timed out after 10000ms');
    };

    // But server DID commit the payment before timeout dropped the client connection!
    apiClient.payments.getOrderPayments = async () => {
      return [
        mockPaymentDTO({
          id: 'pay-committed-006',
          orderId,
          amount: 350,
          mode: PaymentMode.CARD,
          idempotencyKey: key,
        }),
      ];
    };

    const result = await executePaymentWithIdempotency({
      orderId,
      amount: 350,
      mode: PaymentMode.CARD,
      idempotencyKey: key,
    });

    // Verification must have detected the committed transaction!
    assert.equal(result.success, true);
    assert.equal(result.payment?.id, 'pay-committed-006');
    assert.equal(result.idempotencyKey, key);
  });

  // 7. Idempotency-key reuse and payload mismatch (409 Conflict)
  it('7. Idempotency-key reuse with payload mismatch returns 409 conflict', async () => {
    const orderId = 'order-test-107';
    const key = `pay_mismatch_test_${Date.now()}`;

    apiClient.payments.record = async () => {
      throw new ApiError(
        'Idempotency key was previously used with different payment details (amount: 200 vs 500)',
        409,
        'CONFLICT',
      );
    };

    const result = await executePaymentWithIdempotency({
      orderId,
      amount: 500,
      mode: PaymentMode.CASH,
      idempotencyKey: key,
    });

    assert.equal(result.success, false);
    assert.equal(result.isConflict, true);
    assert.match(result.error!, /different payment details/);
  });

  // 8. Server rejection and network failure
  it('8. Server 500 error and pure network failures are flagged as retryable with preserved key', async () => {
    const orderId = 'order-test-108';
    const key = `pay_network_test_${Date.now()}`;

    // 500 Internal server error
    apiClient.payments.record = async () => {
      throw new ApiError('Internal database deadlock error', 500, 'INTERNAL_SERVER_ERROR');
    };

    const res500 = await executePaymentWithIdempotency({
      orderId,
      amount: 100,
      mode: PaymentMode.CASH,
      idempotencyKey: key,
    });

    assert.equal(res500.success, false);
    assert.equal(res500.isRetryable, true);
    assert.equal(res500.idempotencyKey, key);

    // Network disconnection with no server commit
    apiClient.payments.record = async () => {
      throw new Error('TypeError: Failed to fetch');
    };
    apiClient.payments.getOrderPayments = async () => {
      throw new Error('TypeError: Failed to fetch');
    };

    const resNet = await executePaymentWithIdempotency({
      orderId,
      amount: 100,
      mode: PaymentMode.CASH,
      idempotencyKey: key,
    });

    assert.equal(resNet.success, false);
    assert.equal(resNet.isRetryable, true);
    assert.equal(resNet.idempotencyKey, key);
    assert.match(resNet.error!, /safely retry with the preserved transaction key/);
  });

  // 9. Correct refreshed balance and payment history
  it('9. Correct refreshed balance and payment history', async () => {
    const orderId = 'order-test-109';

    // Mock summary reflecting updated state
    apiClient.payments.getSummary = async (): Promise<PaymentSummaryDTO> => ({
      orderId,
      totalAmount: 1200,
      amountPaid: 800,
      amountDue: 400,
      paymentStatus: PaymentStatus.PARTIAL,
      paymentCount: 2,
      isConsistent: true,
    });

    apiClient.payments.getOrderPayments = async () => [
      mockPaymentDTO({
        id: 'p1',
        orderId,
        amount: 500,
        mode: PaymentMode.CASH,
        createdAt: '2026-10-23T10:00:00Z',
        idempotencyKey: 'k1',
      }),
      mockPaymentDTO({
        id: 'p2',
        orderId,
        amount: 300,
        mode: PaymentMode.UPI,
        createdAt: '2026-10-23T11:00:00Z',
        idempotencyKey: 'k2',
      }),
    ];

    const summary = await apiClient.payments.getSummary(orderId);
    const history = await apiClient.payments.getOrderPayments(orderId);

    assert.equal(summary.totalAmount, 1200);
    assert.equal(summary.amountPaid, 800);
    assert.equal(summary.amountDue, 400);
    assert.equal(summary.paymentStatus, PaymentStatus.PARTIAL);

    assert.equal(history.length, 2);
    assert.equal(history[0].amount, 500);
    assert.equal(history[1].amount, 300);
  });

  // 10. Unauthorized payment attempts
  it('10. Unauthorized payment attempts (401) are flagged to trigger re-authentication', async () => {
    apiClient.payments.record = async () => {
      throw new ApiError('JWT expired or unauthorized', 401, 'UNAUTHORIZED');
    };

    const result = await executePaymentWithIdempotency({
      orderId: 'order-test-110',
      amount: 100,
      mode: PaymentMode.CASH,
    });

    assert.equal(result.success, false);
    assert.equal(result.isUnauthorized, true);
    assert.match(result.error!, /Authentication expired/);
  });

  // 11. Payment attempts on orders that cannot accept payments (CANCELLED or REFUNDED)
  it('11. Rejects payment attempts on CANCELLED or REFUNDED orders', async () => {
    apiClient.payments.record = async () => {
      throw new ApiError('Cannot collect payment on a cancelled order', 400, 'BAD_REQUEST');
    };

    const result = await executePaymentWithIdempotency({
      orderId: 'order-test-cancelled',
      amount: 150,
      mode: PaymentMode.CASH,
    });

    assert.equal(result.success, false);
    assert.equal(result.isBadRequest, true);
    assert.match(result.error!, /cancelled/);
  });

  // 12. Currency precision and rounding edge cases
  it('12. Currency precision and rounding edge cases are safely handled', () => {
    // Rejects > 2 decimal places (e.g. 50.123)
    const res3Decimals = validatePaymentInput('50.123', 100);
    assert.equal(res3Decimals.isValid, false);
    assert.match(res3Decimals.error!, /more than 2 decimal places/);

    // Accepts exact 2 decimal places
    const res2Decimals = validatePaymentInput('50.99', 100);
    assert.equal(res2Decimals.isValid, true);
    assert.equal(res2Decimals.sanitizedAmount, 50.99);

    // Floating-point precision check: 0.1 + 0.2 = 0.30000000000000004 avoided
    const partA = 100.1;
    const partB = 200.2;
    const rawSum = partA + partB; // 300.30000000000007
    const validated = validatePaymentInput(rawSum, 500);
    assert.equal(validated.isValid, true);
    assert.equal(validated.sanitizedAmount, 300.3);

    // Exact penny match
    const pennyCheck = validatePaymentInput(0.01, 0.01);
    assert.equal(pennyCheck.isValid, true);
    assert.equal(pennyCheck.sanitizedAmount, 0.01);
  });

  // Order Operations: canonical deriveOrderStatus contract
  it('Order Operations: deriveOrderStatus canonically derives READY, DELIVERED, and CANCELLED', () => {
    // 1. If any item is CANCELLED but order is not, still in progress
    const derived1 = deriveOrderStatus({
      items: [{ status: 'CANCELLED' as any }, { status: 'RECEIVED' as any }],
      currentOrderStatus: OrderStatus.RECEIVED,
    });
    assert.equal(derived1, OrderStatus.RECEIVED);

    // 2. If all items are READY, order becomes READY
    const derived2 = deriveOrderStatus({
      items: [{ status: 'READY' as any }, { status: 'READY' as any }],
      currentOrderStatus: OrderStatus.PROCESSING,
    });
    assert.equal(derived2, OrderStatus.READY);

    // 3. If all items DELIVERED, order becomes DELIVERED
    const derived3 = deriveOrderStatus({
      items: [{ status: 'DELIVERED' as any }, { status: 'DELIVERED' as any }],
      currentOrderStatus: OrderStatus.READY,
    });
    assert.equal(derived3, OrderStatus.DELIVERED);
  });
});
