import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentRequest, PaymentDTO } from '@growfast/shared-types';
import { PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(
    employeeId: string,
    storeId: string,
    dto: RecordPaymentRequest,
  ): Promise<PaymentDTO> {
    if (dto.amount <= 0 || !Number.isFinite(dto.amount)) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch order with exclusive lock or rely on Serializable isolation
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

        // 3. Financial validation
        // We round the values to 2 decimal places to avoid floating point issues if applicable,
        // but for safety we just check > amountDue.
        if (dto.amount > order.amountDue) {
          throw new BadRequestException(
            `Payment amount (${dto.amount}) exceeds amount due (${order.amountDue})`,
          );
        }

        // 4. Calculate new totals
        const newAmountPaid = order.amountPaid + dto.amount;
        const newAmountDue = order.totalAmount - newAmountPaid;
        
        let newPaymentStatus = order.paymentStatus;
        if (newAmountDue <= 0) {
          newPaymentStatus = PaymentStatus.PAID;
        } else if (newAmountPaid > 0) {
          newPaymentStatus = PaymentStatus.PARTIAL;
        }

        // 5. Insert payment
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

        // 6. Update order financial state
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
