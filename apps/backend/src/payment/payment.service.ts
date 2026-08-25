import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  RecordPaymentRequest,
  PaymentDTO,
  PaymentMode,
  PaymentSummaryDTO,
} from '@growfast/shared-types';
import { PaymentStatus, OrderStatus, Prisma } from '@prisma/client';

/** Canonical set of valid payment modes for fast lookup */
const VALID_PAYMENT_MODES = new Set<string>(Object.values(PaymentMode));

/**
 * Canonical payment status derivation — ONE source of truth.
 *
 * Rules:
 * - REFUNDED is never overwritten by payment activity.
 * - amountPaid === 0  → PENDING
 * - 0 < amountPaid < totalAmount → PARTIAL
 * - amountPaid >= totalAmount → PAID
 *
 * Uses .toFixed(2) precision to mitigate Float drift.
 */
export function derivePaymentStatus(
  amountPaid: number,
  totalAmount: number,
  currentStatus: PaymentStatus,
): PaymentStatus {
  // Never overwrite a legitimate REFUNDED state
  if (currentStatus === PaymentStatus.REFUNDED) {
    return PaymentStatus.REFUNDED;
  }

  const safePaid = Number(amountPaid.toFixed(2));
  const safeDue = Number((totalAmount - safePaid).toFixed(2));

  if (safeDue < 0) {
    throw new ConflictException(
      `Financial inconsistency: amountPaid (${safePaid}) exceeds totalAmount (${totalAmount})`,
    );
  }

  if (safeDue === 0) {
    return PaymentStatus.PAID;
  }
  if (safePaid > 0) {
    return PaymentStatus.PARTIAL;
  }
  return PaymentStatus.PENDING;
}

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        attempts++;
        // Prisma error P2034: Transaction failed due to a write conflict or a deadlock.
        if (error.code === 'P2034' && attempts < maxRetries) {
          // Exponential backoff or simple delay before retry
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 * attempts));
          continue;
        }
        throw error; // Rethrow if it's not a serialization conflict or max retries reached
      }
    }
    throw new Error('Transaction failed after maximum retries');
  }

  async recordPayment(
    employeeId: string,
    storeId: string,
    dto: RecordPaymentRequest,
  ): Promise<PaymentDTO> {
    // 0a. Amount validation — reject zero, negative, NaN, Infinity
    if (dto.amount <= 0 || !Number.isFinite(dto.amount)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // 0b. PaymentMode validation — reject invalid modes before DB round-trip
    if (!VALID_PAYMENT_MODES.has(dto.mode)) {
      throw new BadRequestException(
        `Invalid payment mode: ${dto.mode}. Valid modes: ${[...VALID_PAYMENT_MODES].join(', ')}`,
      );
    }

    return this.executeWithRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          // 1. Fetch order — Serializable isolation prevents concurrent races
          const order = await tx.order.findUnique({
            where: { id: dto.orderId },
          });

          if (!order) {
            throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
          }

          // 2. Store isolation
          if (order.storeId !== storeId) {
            throw new ForbiddenException('Cannot access orders from a different store');
          }

          // 3. Cancelled order guard — do not accept payment for cancelled orders
          if (order.status === OrderStatus.CANCELLED) {
            throw new BadRequestException('Cannot record payment for a cancelled order');
          }

          // 3b. Refunded order guard
          if (order.paymentStatus === PaymentStatus.REFUNDED) {
            throw new BadRequestException('Cannot record payment for a refunded order');
          }

          // 4. Financial validation — reject overpayment
          if (dto.amount > order.amountDue) {
            throw new BadRequestException(
              `Payment amount (${dto.amount}) exceeds amount due (${order.amountDue})`,
            );
          }

          // 5. Calculate new totals with floating-point safety
          const newAmountPaid = Number((order.amountPaid + dto.amount).toFixed(2));
          const newAmountDue = Number((order.totalAmount - newAmountPaid).toFixed(2));

          // 5b. Derive canonical payment status
          const newPaymentStatus = derivePaymentStatus(
            newAmountPaid,
            order.totalAmount,
            order.paymentStatus,
          );

          // 6. Insert payment
          const payment = await tx.payment.create({
            data: {
              orderId: dto.orderId,
              amount: dto.amount,
              mode: dto.mode,
              reference: dto.reference || null,
              receivedById: employeeId,
            },
            include: {
              receivedBy: true,
            },
          });

          // 7. Update order financial state atomically
          await tx.order.update({
            where: { id: dto.orderId },
            data: {
              amountPaid: newAmountPaid,
              amountDue: newAmountDue,
              paymentStatus: newPaymentStatus,
            },
          });

          // Map to DTO
          return {
            id: payment.id,
            orderId: payment.orderId,
            amount: payment.amount,
            mode: payment.mode as any,
            reference: payment.reference,
            receivedById: payment.receivedById,
            receivedByName: payment.receivedBy.name,
            createdAt: payment.createdAt.toISOString(),
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  /**
   * C4 — Payment Summary with Balance Reconciliation.
   *
   * Returns the authoritative financial state for an order by computing
   * amountPaid from the actual sum of Payment records, then deriving
   * amountDue and paymentStatus canonically.
   *
   * The `isConsistent` flag indicates whether the persisted order financial
   * fields match the computed values. An inconsistency means the persisted
   * order.amountPaid has drifted from the authoritative sum of payments.
   */
  async getPaymentSummary(orderId: string, storeId: string): Promise<PaymentSummaryDTO> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          select: { amount: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.storeId !== storeId) {
      throw new ForbiddenException('Cannot access orders from a different store');
    }

    // Authoritative sum from actual payment records
    const computedPaid = Number(
      order.payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
    );
    const computedDue = Number((order.totalAmount - computedPaid).toFixed(2));
    const computedStatus = derivePaymentStatus(
      computedPaid,
      order.totalAmount,
      order.paymentStatus,
    );

    // Consistency check: do persisted values match computed values exactly?
    const persistedPaid = Number(order.amountPaid.toFixed(2));
    const persistedDue = Number(order.amountDue.toFixed(2));
    const isConsistent =
      persistedPaid === computedPaid &&
      persistedDue === computedDue &&
      order.paymentStatus === computedStatus;

    return {
      orderId: order.id,
      totalAmount: order.totalAmount,
      amountPaid: computedPaid,
      amountDue: computedDue,
      paymentStatus: computedStatus as any,
      paymentCount: order.payments.length,
      isConsistent,
    };
  }

  async getOrderPayments(orderId: string, storeId: string): Promise<PaymentDTO[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          include: { receivedBy: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.storeId !== storeId) {
      throw new ForbiddenException('Cannot access orders from a different store');
    }

    return order.payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amount: p.amount,
      mode: p.mode as any,
      reference: p.reference,
      receivedById: p.receivedById,
      receivedByName: p.receivedBy.name,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
