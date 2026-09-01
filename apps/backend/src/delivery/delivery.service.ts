import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeliveryStatus,
  ItemStatus,
  OrderStatus,
  deriveOrderStatus,
  Role,
} from '@growfast/shared-types';

/**
 * Delivery State Machine — valid transitions.
 *
 * SCHEDULED  → ASSIGNED    (manager assigns driver)
 * ASSIGNED   → IN_TRANSIT  (driver starts delivery)
 * ASSIGNED   → FAILED      (driver cannot deliver)
 * IN_TRANSIT → COMPLETED   (driver marks delivered — handled via completeDelivery)
 * IN_TRANSIT → FAILED      (delivery failed en route)
 * FAILED     → SCHEDULED   (reschedule for retry)
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  [DeliveryStatus.SCHEDULED]: [DeliveryStatus.ASSIGNED],
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.IN_TRANSIT, DeliveryStatus.FAILED],
  [DeliveryStatus.IN_TRANSIT]: [DeliveryStatus.COMPLETED, DeliveryStatus.FAILED],
  [DeliveryStatus.FAILED]: [DeliveryStatus.SCHEDULED],
  [DeliveryStatus.COMPLETED]: [],
};

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new delivery record for an order.
   * Only OWNER, MANAGER, COUNTER can create.
   */
  async createDelivery(
    orderId: string,
    address: string,
    scheduledAt: string | undefined,
    storeId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Validate order exists and belongs to store
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { customer: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.storeId !== storeId) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }

      const delivery = await tx.deliveryRecord.create({
        data: {
          orderId,
          address,
          status: DeliveryStatus.SCHEDULED,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
        include: {
          order: { include: { customer: true, items: true } },
          rider: true,
        },
      });

      return this.mapToDto(delivery);
    });
  }

  /**
   * Assign a delivery driver. Validates the driver belongs to the same store.
   * Transition: SCHEDULED → ASSIGNED
   */
  async assignDriver(
    deliveryId: string,
    riderId: string,
    scheduledAt: string | undefined,
    storeId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRecord.findUnique({
        where: { id: deliveryId },
        include: { order: true },
      });

      if (!delivery) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }
      if (delivery.order.storeId !== storeId) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }

      if (delivery.status !== DeliveryStatus.SCHEDULED) {
        throw new BadRequestException(
          `Cannot assign driver: delivery is in "${delivery.status}" state, expected "SCHEDULED"`,
        );
      }

      // Validate rider exists, belongs to same store, and has DELIVERY role
      const rider = await tx.employee.findUnique({ where: { id: riderId } });
      if (!rider) {
        throw new NotFoundException(`Employee with ID "${riderId}" not found`);
      }
      if (rider.storeId !== storeId) {
        throw new BadRequestException(`Driver does not belong to this store`);
      }
      if (rider.role !== Role.DELIVERY) {
        throw new BadRequestException(`Employee "${rider.name}" does not have the DELIVERY role`);
      }
      if (!rider.isActive) {
        throw new BadRequestException(`Driver "${rider.name}" is not active`);
      }

      const updated = await tx.deliveryRecord.update({
        where: { id: deliveryId },
        data: {
          riderId,
          status: DeliveryStatus.ASSIGNED,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : delivery.scheduledAt,
        },
        include: {
          order: { include: { customer: true, items: true } },
          rider: true,
        },
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * List deliveries for a store.
   * DELIVERY role users only see their own assignments.
   */
  async findDeliveries(
    storeId: string,
    employeeId: string,
    employeeRole: string,
    filters?: { status?: string },
  ) {
    const where: any = {
      order: { storeId },
    };

    // DELIVERY role: only see own deliveries
    if (employeeRole === Role.DELIVERY) {
      where.riderId = employeeId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const deliveries = await this.prisma.deliveryRecord.findMany({
      where,
      include: {
        order: { include: { customer: true } },
        rider: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return deliveries.map((d) => this.mapToDto(d));
  }

  /**
   * Get a single delivery by ID with store isolation and driver ownership.
   */
  async findDeliveryById(
    deliveryId: string,
    storeId: string,
    employeeId: string,
    employeeRole: string,
  ) {
    const delivery = await this.prisma.deliveryRecord.findUnique({
      where: { id: deliveryId },
      include: {
        order: { include: { customer: true } },
        rider: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
    }
    if (delivery.order.storeId !== storeId) {
      throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
    }

    // DELIVERY role: can only see own deliveries
    if (employeeRole === Role.DELIVERY && delivery.riderId !== employeeId) {
      throw new ForbiddenException(`You can only view your own deliveries`);
    }

    return this.mapToDto(delivery);
  }

  /**
   * Update delivery status with state machine validation.
   * DELIVERY role can only update their own deliveries.
   */
  async updateDeliveryStatus(
    deliveryId: string,
    newStatus: DeliveryStatus,
    notes: string | undefined,
    storeId: string,
    employeeId: string,
    employeeRole: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRecord.findUnique({
        where: { id: deliveryId },
        include: { order: { include: { items: true } } },
      });

      if (!delivery) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }
      if (delivery.order.storeId !== storeId) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }

      // DELIVERY role: can only update own deliveries
      if (employeeRole === Role.DELIVERY && delivery.riderId !== employeeId) {
        throw new ForbiddenException(`You can only update your own deliveries`);
      }

      // State machine validation
      const allowed = VALID_TRANSITIONS[delivery.status] || [];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status transition from "${delivery.status}" to "${newStatus}"`,
        );
      }

      // Cannot complete via this endpoint — use completeDelivery instead
      if (newStatus === DeliveryStatus.COMPLETED) {
        throw new BadRequestException(
          `Use the complete delivery endpoint to mark a delivery as completed`,
        );
      }

      const updateData: any = {
        status: newStatus,
      };
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      // When rescheduling from FAILED, clear rider
      if (newStatus === DeliveryStatus.SCHEDULED) {
        updateData.riderId = null;
      }

      const updated = await tx.deliveryRecord.update({
        where: { id: deliveryId },
        data: updateData,
        include: {
          order: { include: { customer: true } },
          rider: true,
        },
      });

      // If transitioning to IN_TRANSIT, update order status
      if (newStatus === DeliveryStatus.IN_TRANSIT) {
        const order = delivery.order;
        const itemsForStatus = order.items.map((i) => ({
          status: i.itemStatus as ItemStatus,
        }));
        const derivedStatus = deriveOrderStatus({
          items: itemsForStatus,
          currentOrderStatus: order.status as OrderStatus,
          hasActiveTransitDelivery: true,
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: derivedStatus },
        });
      }

      return this.mapToDto(updated);
    });
  }

  /**
   * Complete a delivery: apply delivered quantities (partial or full) and recalculate order status.
   */
  async completeDelivery(
    deliveryId: string,
    proofPhotoUrl: string | undefined,
    notes: string | undefined,
    deliveredItems: { itemId: string; quantity: number }[] | undefined,
    storeId: string,
    employeeId: string,
    employeeRole: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryRecord.findUnique({
        where: { id: deliveryId },
        include: {
          order: { include: { items: true } },
        },
      });

      if (!delivery) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }
      if (delivery.order.storeId !== storeId) {
        throw new NotFoundException(`Delivery with ID "${deliveryId}" not found`);
      }

      // DELIVERY role: can only complete own deliveries
      if (employeeRole === Role.DELIVERY && delivery.riderId !== employeeId) {
        throw new ForbiddenException(`You can only complete your own deliveries`);
      }

      // Must be IN_TRANSIT to complete
      if (delivery.status !== DeliveryStatus.IN_TRANSIT) {
        throw new BadRequestException(
          `Cannot complete delivery: status is "${delivery.status}", expected "IN_TRANSIT"`,
        );
      }

      const order = delivery.order;

      // Update quantities
      if (deliveredItems && deliveredItems.length > 0) {
        // Partial Delivery (Specific quantities provided)
        for (const inputItem of deliveredItems) {
          const currentItem = order.items.find((i) => i.id === inputItem.itemId);
          if (!currentItem) {
            throw new BadRequestException(
              `Order item "${inputItem.itemId}" does not belong to this order.`,
            );
          }
          if (currentItem.itemStatus === ItemStatus.CANCELLED) {
            throw new BadRequestException(`Cannot deliver cancelled item "${inputItem.itemId}".`);
          }

          const newDelivered = currentItem.deliveredQuantity + inputItem.quantity;
          if (newDelivered > currentItem.quantity) {
            throw new BadRequestException(
              `Cannot deliver ${inputItem.quantity} for item "${inputItem.itemId}". Delivered total would be ${newDelivered} which exceeds ordered quantity ${currentItem.quantity}.`,
            );
          }

          const updateResult = await tx.orderItem.updateMany({
            where: {
              id: currentItem.id,
              deliveredQuantity: currentItem.deliveredQuantity, // OCC lock
            },
            data: {
              deliveredQuantity: newDelivered,
              itemStatus:
                newDelivered === currentItem.quantity
                  ? ItemStatus.DELIVERED
                  : currentItem.itemStatus,
            },
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(
              `Concurrent modification detected for order item "${currentItem.id}". Please try again.`,
            );
          }
        }
      } else {
        // Full Delivery Fallback: Deliver all remaining quantities
        for (const item of order.items) {
          if (item.itemStatus === ItemStatus.CANCELLED) continue;
          if (item.deliveredQuantity >= item.quantity) continue;

          const updateResult = await tx.orderItem.updateMany({
            where: {
              id: item.id,
              deliveredQuantity: item.deliveredQuantity, // OCC lock
            },
            data: {
              deliveredQuantity: item.quantity,
              itemStatus: ItemStatus.DELIVERED,
            },
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(
              `Concurrent modification detected for order item "${item.id}". Please try again.`,
            );
          }
        }
      }

      // Mark delivery as COMPLETED using OCC on status
      const deliveryUpdateResult = await tx.deliveryRecord.updateMany({
        where: {
          id: deliveryId,
          status: DeliveryStatus.IN_TRANSIT,
        },
        data: {
          status: DeliveryStatus.COMPLETED,
          completedAt: new Date(),
          proofPhotoUrl: proofPhotoUrl || null,
          notes: notes !== undefined ? notes : delivery.notes,
        },
      });

      if (deliveryUpdateResult.count === 0) {
        throw new BadRequestException(
          `Delivery "${deliveryId}" is already completed or concurrently modified.`,
        );
      }

      // Re-fetch items after update and derive order status
      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true },
      });

      // Check if there are other active (non-completed) deliveries for this order
      const activeDeliveries = await tx.deliveryRecord.count({
        where: {
          orderId: order.id,
          status: DeliveryStatus.IN_TRANSIT,
          id: { not: deliveryId },
        },
      });

      const itemsForStatus = updatedOrder!.items.map((i) => ({
        status: i.itemStatus as ItemStatus,
      }));
      const derivedStatus = deriveOrderStatus({
        items: itemsForStatus,
        currentOrderStatus: updatedOrder!.status as OrderStatus,
        hasActiveTransitDelivery: activeDeliveries > 0,
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: derivedStatus },
      });

      // Return the final delivery record
      const finalDelivery = await tx.deliveryRecord.findUnique({
        where: { id: deliveryId },
        include: {
          order: { include: { customer: true } },
          rider: true,
        },
      });

      return this.mapToDto(finalDelivery!);
    });
  }

  /** Map Prisma DeliveryRecord to shared DTO */
  private mapToDto(delivery: any) {
    return {
      id: delivery.id,
      orderId: delivery.orderId,
      orderNumber: delivery.order?.orderNumber || '',
      customerName: delivery.order?.customer?.name || '',
      address: delivery.address,
      riderId: delivery.riderId,
      riderName: delivery.rider?.name || null,
      status: delivery.status,
      scheduledAt: delivery.scheduledAt?.toISOString() || null,
      completedAt: delivery.completedAt?.toISOString() || null,
      proofPhotoUrl: delivery.proofPhotoUrl,
      notes: delivery.notes,
      items: delivery.order?.items
        ? delivery.order.items.map((i: any) => ({
            id: i.id,
            orderId: i.orderId,
            garmentCatalogId: i.garmentCatalogId,
            serviceTypeId: i.serviceTypeId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            itemStatus: i.itemStatus,
            deliveredQuantity: i.deliveredQuantity,
          }))
        : undefined,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
    };
  }
}
