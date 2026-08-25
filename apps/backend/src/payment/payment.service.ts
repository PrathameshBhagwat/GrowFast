import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentRequest, PaymentDTO, PaymentMode } from '@growfast/shared-types';
import { PaymentStatus, OrderStatus, Prisma } from '@prisma/client';

/** Canonical set of valid payment modes for fast lookup */
const VALID_PAYMENT_MODES = new Set<string>(Object.values(PaymentMode));

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

          let newPaymentStatus = order.paymentStatus;
          if (newAmountDue <= 0) {
            newPaymentStatus = PaymentStatus.PAID;
          } else if (newAmountPaid > 0) {
            newPaymentStatus = PaymentStatus.PARTIAL;
          }

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
