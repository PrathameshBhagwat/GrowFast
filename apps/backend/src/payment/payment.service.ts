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
  PaymentStatus as SharedPaymentStatus,
  PaymentMode as SharedPaymentMode,
  AdjustmentType as SharedAdjustmentType,
  AdjustmentStatus as SharedAdjustmentStatus,
  FinancialAdjustmentDTO,
  CreateAdjustmentRequest,
  Role,
  NotificationEventType,
  NotificationChannel,
} from '@growfast/shared-types';
import { NotificationService } from '../notification/notification.service';
import {
  PaymentStatus,
  OrderStatus,
  Prisma,
  AdjustmentType,
  AdjustmentStatus,
} from '@prisma/client';

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
  const safeTotal = Number(totalAmount.toFixed(2));
  const safeDue = Number((safeTotal - safePaid).toFixed(2));

  if (safeDue < 0) {
    throw new ConflictException(
      `Financial inconsistency: amountPaid (${safePaid}) exceeds totalAmount (${safeTotal})`,
    );
  }

  if (safeTotal === 0 && safePaid === 0) {
    return PaymentStatus.PAID;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

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

  /**
   * Helper to compute total completed refunds and store credits for an order.
   */
  getAdjustmentsTotals(
    adjustments: { amount: number; type: AdjustmentType; status: AdjustmentStatus }[] = [],
  ) {
    const adj = adjustments || [];
    const refundAmount = Number(
      adj
        .filter((a) => a.status === AdjustmentStatus.COMPLETED && a.type === AdjustmentType.REFUND)
        .reduce((sum, a) => sum + a.amount, 0)
        .toFixed(2),
    );
    const storeCreditAmount = Number(
      adj
        .filter(
          (a) => a.status === AdjustmentStatus.COMPLETED && a.type === AdjustmentType.STORE_CREDIT,
        )
        .reduce((sum, a) => sum + a.amount, 0)
        .toFixed(2),
    );
    const totalAdjustments = Number((refundAmount + storeCreditAmount).toFixed(2));
    return { refundAmount, storeCreditAmount, totalAdjustments };
  }

  /**
   * Authoritatively computes an order's financial state (adjustments, effectivePaid,
   * amountDue, and canonical paymentStatus) based on Phase 3E financial rules.
   */
  calculateOrderFinancialState(order: {
    totalAmount: number;
    amountPaid: number;
    paymentStatus: PaymentStatus;
    adjustments?: { amount: number; type: AdjustmentType; status: AdjustmentStatus }[];
  }) {
    const { refundAmount, storeCreditAmount, totalAdjustments } = this.getAdjustmentsTotals(
      order.adjustments,
    );
    const effectivePaid = Number((order.amountPaid - totalAdjustments).toFixed(2));
    const amountDue = Math.max(0, Number((order.totalAmount - effectivePaid).toFixed(2)));
    let paymentStatus = derivePaymentStatus(effectivePaid, order.totalAmount, order.paymentStatus);

    if (
      order.totalAmount === 0 ||
      (effectivePaid === 0 && order.amountPaid > 0 && refundAmount >= order.amountPaid)
    ) {
      paymentStatus = PaymentStatus.REFUNDED;
    }

    return {
      refundAmount,
      storeCreditAmount,
      totalAdjustments,
      effectivePaid,
      amountDue,
      paymentStatus,
    };
  }

  async recordPayment(
    employeeId: string,
    storeId: string,
    dto: RecordPaymentRequest,
    externalTx?: Prisma.TransactionClient,
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

    const runInTx = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch order — Serializable isolation prevents concurrent races
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: { adjustments: true },
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
      const financialState = this.calculateOrderFinancialState({
        totalAmount: order.totalAmount,
        amountPaid: newAmountPaid,
        paymentStatus: order.paymentStatus,
        adjustments: order.adjustments,
      });

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
          amountDue: financialState.amountDue,
          paymentStatus: financialState.paymentStatus,
        },
      });

      // Map to DTO
      return {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        mode: payment.mode as unknown as SharedPaymentMode,
        reference: payment.reference,
        receivedById: payment.receivedById,
        receivedByName: payment.receivedBy.name,
        createdAt: payment.createdAt.toISOString(),
      };
    };

    let paymentDto: PaymentDTO;
    if (externalTx) {
      paymentDto = await runInTx(externalTx);
    } else {
      paymentDto = await this.executeWithRetry(() =>
        this.prisma.$transaction(runInTx, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      );

      // C6: Trigger PAYMENT_RECEIVED notification outside transaction
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { customer: true },
      });

      if (order && order.customer?.phone) {
        this.notificationService
          .createNotificationEvent(
            storeId,
            NotificationEventType.PAYMENT_RECEIVED,
            NotificationChannel.SMS,
            order.customer.phone,
            order.id,
            order.customer.id,
            {
              amountPaid: dto.amount,
              totalAmount: order.totalAmount,
              amountDue: order.amountDue,
            },
          )
          .catch(() => {});
      }
    }

    return paymentDto;
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
        adjustments: {
          select: { amount: true, type: true, status: true },
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
    const payments = order.payments || [];
    const computedGrossPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
    const financialState = this.calculateOrderFinancialState({
      totalAmount: order.totalAmount,
      amountPaid: computedGrossPaid,
      paymentStatus: order.paymentStatus,
      adjustments: order.adjustments,
    });

    // Consistency check: do persisted values match computed values exactly?
    const persistedPaid = Number(order.amountPaid.toFixed(2));
    const persistedDue = Number(order.amountDue.toFixed(2));
    const isConsistent =
      persistedPaid === computedGrossPaid &&
      persistedDue === financialState.amountDue &&
      order.paymentStatus === financialState.paymentStatus;

    return {
      orderId: order.id,
      totalAmount: order.totalAmount,
      amountPaid: computedGrossPaid,
      refundAmount: financialState.refundAmount,
      storeCreditAmount: financialState.storeCreditAmount,
      effectivePaid: financialState.effectivePaid,
      amountDue: financialState.amountDue,
      paymentStatus: financialState.paymentStatus as unknown as SharedPaymentStatus,
      paymentCount: payments.length,
      adjustmentCount: (order.adjustments || []).length,
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
      mode: p.mode as unknown as SharedPaymentMode,
      reference: p.reference,
      receivedById: p.receivedById,
      receivedByName: p.receivedBy.name,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  // ─── Financial Adjustments ──────────────────────────────────────────

  async createAdjustment(
    employeeId: string,
    storeId: string,
    employeeRole: string,
    dto: CreateAdjustmentRequest,
    externalTx?: Prisma.TransactionClient,
  ): Promise<FinancialAdjustmentDTO> {
    // 1. Role Authorization — Only OWNER can authorize adjustments
    if (employeeRole !== Role.OWNER) {
      throw new ForbiddenException('Only store owners can authorize financial adjustments');
    }

    // 2. Validation
    if (dto.amount <= 0 || !Number.isFinite(dto.amount)) {
      throw new BadRequestException('Adjustment amount must be greater than zero');
    }

    if (!dto.reason || typeof dto.reason !== 'string' || dto.reason.trim().length === 0) {
      throw new BadRequestException('Adjustment reason is required');
    }

    if (
      dto.type !== SharedAdjustmentType.REFUND &&
      dto.type !== SharedAdjustmentType.STORE_CREDIT
    ) {
      throw new BadRequestException(`Invalid adjustment type: ${dto.type}`);
    }

    const runInTx = async (tx: Prisma.TransactionClient) => {
      // 3. Fetch order with lock / serializable isolation
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: {
          payments: true,
          adjustments: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
      }

      // 4. Store isolation
      if (order.storeId !== storeId) {
        throw new ForbiddenException('Cannot access orders from a different store');
      }

      // 5. Calculate existing adjustments and authoritative eligible amount
      const { totalAdjustments: existingAdjustmentsTotal } = this.getAdjustmentsTotals(
        order.adjustments,
      );

      // Eligible adjustment: overpayment relative to totalAmount
      const maxEligible = Math.max(
        0,
        Number((order.amountPaid - order.totalAmount - existingAdjustmentsTotal).toFixed(2)),
      );

      if (dto.amount > maxEligible) {
        throw new BadRequestException(
          `Adjustment amount (₹${dto.amount}) exceeds maximum eligible amount (₹${maxEligible})`,
        );
      }

      if (existingAdjustmentsTotal + dto.amount > order.amountPaid) {
        throw new BadRequestException('Total adjustments cannot exceed amount paid on the order');
      }

      // 6. Create immutable FinancialAdjustment record
      const adjustment = await tx.financialAdjustment.create({
        data: {
          orderId: dto.orderId,
          type: dto.type as unknown as AdjustmentType,
          amount: Number(dto.amount.toFixed(2)),
          reason: dto.reason.trim(),
          reference: dto.reference || null,
          status: AdjustmentStatus.COMPLETED,
          createdById: employeeId,
        },
        include: {
          createdBy: true,
        },
      });

      // 7. Update order totals atomically
      const newAdjustments = [...(order.adjustments || []), adjustment];
      const newFinancialState = this.calculateOrderFinancialState({
        totalAmount: order.totalAmount,
        amountPaid: order.amountPaid,
        paymentStatus: order.paymentStatus,
        adjustments: newAdjustments,
      });

      await tx.order.update({
        where: { id: dto.orderId },
        data: {
          amountDue: newFinancialState.amountDue,
          paymentStatus: newFinancialState.paymentStatus,
        },
      });

      return {
        id: adjustment.id,
        orderId: adjustment.orderId,
        type: adjustment.type as unknown as SharedAdjustmentType,
        amount: adjustment.amount,
        reason: adjustment.reason,
        status: adjustment.status as unknown as SharedAdjustmentStatus,
        reference: adjustment.reference,
        createdById: adjustment.createdById,
        createdByName: adjustment.createdBy.name,
        createdAt: adjustment.createdAt.toISOString(),
        updatedAt: adjustment.updatedAt.toISOString(),
      };
    };

    if (externalTx) {
      return runInTx(externalTx);
    }

    return this.executeWithRetry(() =>
      this.prisma.$transaction(runInTx, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  }

  async getOrderAdjustments(orderId: string, storeId: string): Promise<FinancialAdjustmentDTO[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        adjustments: {
          include: { createdBy: true },
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

    return order.adjustments.map((a) => ({
      id: a.id,
      orderId: a.orderId,
      type: a.type as unknown as SharedAdjustmentType,
      amount: a.amount,
      reason: a.reason,
      status: a.status as unknown as SharedAdjustmentStatus,
      reference: a.reference,
      createdById: a.createdById,
      createdByName: a.createdBy.name,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }
}
