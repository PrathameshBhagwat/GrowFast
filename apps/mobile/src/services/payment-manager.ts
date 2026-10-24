import {
  PaymentDTO,
  PaymentMode,
  PaymentSummaryDTO,
  RecordPaymentRequest,
} from '@growfast/shared-types';
import { apiClient, ApiError } from '../api/client';

export interface PaymentExecutionResult {
  success: boolean;
  payment?: PaymentDTO;
  idempotencyKey: string;
  error?: string;
  isRetryable?: boolean;
  isConflict?: boolean;
  isUnauthorized?: boolean;
  isBadRequest?: boolean;
}

/**
 * Generates a stable unique idempotency key for a single payment attempt.
 * Format: pay_{orderId}_{timestamp}_{random}
 */
export function generatePaymentIdempotencyKey(orderId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `pay_${orderId}_${timestamp}_${random}`;
}

/**
 * Validates payment inputs on client as an immediate usability guard.
 * Note: The backend authoritatively enforces all financial validations.
 */
export function validatePaymentInput(
  rawAmount: number | string,
  amountDue: number,
): { isValid: boolean; error?: string; sanitizedAmount?: number } {
  // If user entered a string, check if they manually typed more than 2 decimal places
  if (typeof rawAmount === 'string') {
    const trimmed = rawAmount.trim();
    if (trimmed.includes('.') && trimmed.split('.')[1].length > 2) {
      return { isValid: false, error: 'Payment amount cannot have more than 2 decimal places.' };
    }
  }

  const num = typeof rawAmount === 'string' ? parseFloat(rawAmount) : rawAmount;

  if (isNaN(num) || !Number.isFinite(num)) {
    return { isValid: false, error: 'Payment amount must be a valid number.' };
  }

  if (num <= 0) {
    return { isValid: false, error: 'Payment amount must be greater than zero.' };
  }

  const safeAmount = Number(num.toFixed(2));
  const safeDue = Number(amountDue.toFixed(2));

  if (safeAmount > safeDue) {
    return {
      isValid: false,
      error: `Payment amount (₹${safeAmount.toFixed(2)}) cannot exceed outstanding balance (₹${safeDue.toFixed(2)}).`,
    };
  }

  return { isValid: true, sanitizedAmount: safeAmount };
}

/**
 * In-flight set to prevent duplicate concurrent submissions of the same idempotency key
 */
const inFlightKeys = new Set<string>();

/**
 * Records a payment with idempotency guarantee, timeout recovery, and safe retry.
 */
export async function executePaymentWithIdempotency(params: {
  orderId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
  idempotencyKey?: string;
}): Promise<PaymentExecutionResult> {
  const idempotencyKey = params.idempotencyKey || generatePaymentIdempotencyKey(params.orderId);

  // Prevent concurrent duplicate submission of identical idempotency key
  if (inFlightKeys.has(idempotencyKey)) {
    return {
      success: false,
      idempotencyKey,
      error: 'Payment submission is already in progress for this transaction. Please wait.',
      isRetryable: false,
    };
  }

  inFlightKeys.add(idempotencyKey);

  const payload: RecordPaymentRequest = {
    orderId: params.orderId,
    amount: Number(params.amount.toFixed(2)),
    mode: params.mode,
    reference: params.reference?.trim() || undefined,
    idempotencyKey,
  };

  try {
    const payment = await apiClient.payments.record(payload);
    inFlightKeys.delete(idempotencyKey);
    return {
      success: true,
      payment,
      idempotencyKey,
    };
  } catch (error: any) {
    inFlightKeys.delete(idempotencyKey);

    // 1. ApiError from server with known HTTP status codes
    if (error instanceof ApiError) {
      if (error.statusCode === 409) {
        return {
          success: false,
          idempotencyKey,
          error:
            error.message ||
            'Idempotency key was previously used with different payment details. Transaction rejected.',
          isConflict: true,
        };
      }

      if (error.statusCode === 401) {
        return {
          success: false,
          idempotencyKey,
          error: 'Authentication expired or invalid. Please re-login to proceed.',
          isUnauthorized: true,
        };
      }

      if (error.statusCode === 400) {
        return {
          success: false,
          idempotencyKey,
          error: error.message || 'Payment rejected by server rules.',
          isBadRequest: true,
        };
      }

      return {
        success: false,
        idempotencyKey,
        error: error.message || `Server error (${error.statusCode}).`,
        isRetryable: error.statusCode >= 500,
      };
    }

    // 2. Network error / Timeout scenario
    // Attempt verification: check if server actually committed the payment before network dropped
    try {
      const existingPayments = await apiClient.payments.getOrderPayments(params.orderId);
      const matched = existingPayments.find((p) => p.idempotencyKey === idempotencyKey);
      if (matched) {
        return {
          success: true,
          payment: matched,
          idempotencyKey,
        };
      }
    } catch {
      // Verification failed due to continued offline/network failure
    }

    // Network timeout or drop: return retryable state with the SAME idempotency key preserved
    const guidance = 'You can safely retry with the preserved transaction key.';
    const errorMsg = error?.message
      ? `Network connection interrupted (${error.message}). ${guidance}`
      : `Network connection interrupted during payment submission. ${guidance}`;

    return {
      success: false,
      idempotencyKey,
      error: errorMsg,
      isRetryable: true,
    };
  }
}
