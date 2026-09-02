import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import {
  OrderPriority,
  PaymentStatus,
  calculateOrderTotals,
  calculateFulfillmentBreakdown,
  PricingItemInput,
  deriveOrderStatus,
  ItemStatus,
  OrderStatus,
  NotificationEventType,
  NotificationChannel,
} from '@growfast/shared-types';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
    private readonly notificationService: NotificationService,
  ) {}

  async createOrder(dto: CreateOrderDto, employeeId: string, storeId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Validate customer
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer with ID "${dto.customerId}" not found`);
      }

      // 1.5 Fetch Store config
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) {
        throw new NotFoundException(`Store with ID "${storeId}" not found`);
      }
      if (dto.isExpress && store.expressSurchargePercent == null) {
        throw new BadRequestException(`Express service is not configured for this store`);
      }

      // 2. Fetch all garments and services to validate them and get properties
      const garmentIds = [...new Set(dto.items.map((item) => item.garmentCatalogId))];
      const serviceIds = [...new Set(dto.items.map((item) => item.serviceTypeId))];

      const garments = await tx.garmentCatalog.findMany({
        where: { id: { in: garmentIds } },
      });
      const services = await tx.serviceType.findMany({
        where: { id: { in: serviceIds } },
      });

      const garmentMap = new Map(garments.map((g) => [g.id, g]));
      const serviceMap = new Map(services.map((s) => [s.id, s]));

      // 3. Fetch Pricing
      const prices = await tx.serviceGarmentPrice.findMany({
        where: {
          garmentCatalogId: { in: garmentIds },
          serviceTypeId: { in: serviceIds },
        },
      });
      const priceMap = new Map(
        prices.map((p) => [`${p.garmentCatalogId}_${p.serviceTypeId}`, p.price]),
      );

      // Validate items
      const orderItemsData = [];
      const serviceCounts = new Map<string, number>();
      const pricingInputs: PricingItemInput[] = [];
      let maxEstimatedDays = 0;

      for (const item of dto.items) {
        const garment = garmentMap.get(item.garmentCatalogId);
        const service = serviceMap.get(item.serviceTypeId);

        if (!garment) {
          throw new NotFoundException(`Garment with ID "${item.garmentCatalogId}" not found`);
        }
        if (!garment.isActive) {
          throw new BadRequestException(`Garment "${garment.name}" is not active`);
        }
        if (!service) {
          throw new NotFoundException(`Service type with ID "${item.serviceTypeId}" not found`);
        }
        if (!service.isActive) {
          throw new BadRequestException(`Service type "${service.name}" is not active`);
        }

        const priceKey = `${garment.id}_${service.id}`;
        const unitPrice = priceMap.get(priceKey) ?? 0;
        const lineTotal = unitPrice * item.quantity;

        // For summary
        serviceCounts.set(service.name, (serviceCounts.get(service.name) || 0) + item.quantity);

        orderItemsData.push({
          garmentCatalogId: garment.id,
          serviceTypeId: service.id,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
          colorTags: item.colorTags || [],
          defectNotes: item.defectNotes,
        });

        pricingInputs.push({
          unitPrice,
          quantity: item.quantity,
        });

        if (service.estimatedDays > maxEstimatedDays) {
          maxEstimatedDays = service.estimatedDays;
        }
      }

      // Calculate Totals (B5 canonical pricing + B7 express surcharge)
      const totals = calculateOrderTotals(pricingInputs, {
        isExpress: dto.isExpress,
        expressSurchargePercent: store.expressSurchargePercent ?? undefined,
      });

      // 4. Due date placeholder (Deferred to B6)
      const orderDate = new Date();

      // 5. Generate Order Number (Concurrency-safe placeholder until sequence table is implemented)
      const randomPart = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${randomPart}`;

      // 6. Build summary string
      const serviceSummaryParts = [];
      for (const [name, qty] of serviceCounts.entries()) {
        serviceSummaryParts.push(`${name} × ${qty}`);
      }
      const serviceSummary = serviceSummaryParts.join(', ');

      // 7. Calculate Due Date (B6 normal / B7 express)
      const systemDueDate = new Date(orderDate);
      if (dto.isExpress) {
        // B7: Express orders get halved turnaround (rounded up)
        systemDueDate.setDate(systemDueDate.getDate() + Math.ceil(maxEstimatedDays / 2));
      } else {
        systemDueDate.setDate(systemDueDate.getDate() + maxEstimatedDays);
      }

      const itemsForStatus = orderItemsData.map((item) => ({
        status: ItemStatus.RECEIVED,
      }));
      const orderStatus = deriveOrderStatus({
        items: itemsForStatus,
        hasActiveTransitDelivery: false,
      });

      // 8. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: dto.customerId,
          orderDate,
          systemDueDate,
          effectiveDueDate: systemDueDate,
          isExpress: dto.isExpress,
          serviceSummary,
          status: orderStatus,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          expressSurcharge: totals.expressSurcharge,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountDue: totals.totalAmount, // Assuming no payment collected during creation in this phase
          paymentStatus: PaymentStatus.PENDING,
          pickupType: dto.pickupType,
          priority: dto.isExpress ? OrderPriority.EXPRESS : OrderPriority.STANDARD,
          notes: dto.notes,
          createdById: employeeId,
          storeId,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              garmentCatalog: true,
              serviceType: true,
            },
          },
          customer: true,
          createdBy: true,
        },
      });

      return this.mapToDetailDto(order);
    });

    // C6: Trigger ORDER_CREATED notification outside transaction
    if (result && result.customerPhone) {
      this.notificationService
        .createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_CREATED,
          NotificationChannel.SMS,
          result.customerPhone,
          result.id,
          result.customerId,
          { orderNumber: result.orderNumber, totalAmount: result.totalAmount },
        )
        .catch((err) => {
          // Swallow any unhandled promises just in case
        });
    }

    return result;
  }

  async findOrderById(id: string, storeId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            garmentCatalog: true,
            serviceType: true,
          },
        },
        customer: true,
        createdBy: true,
        payments: true, // we might need to map these properly
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    if (storeId && order.storeId !== storeId) {
      throw new NotFoundException(`Order with ID "${id}" not found`);
    }

    return this.mapToDetailDto(order);
  }

  async findAllOrders(query: GetOrdersQueryDto, storeId: string) {
    const { customerId, status, paymentStatus, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: any = { storeId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((o) => this.mapToSummaryDto(o)),
      total,
      page,
      pageSize,
    };
  }

  async updateOrderItem(orderId: string, itemId: string, dto: UpdateOrderItemDto, storeId: string) {
    const { oldOrderStatus, oldItemStatus, updatedOrder } = await this.prisma.$transaction(async (tx) => {
      // 1. Validate order exists and belongs to store
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.storeId !== storeId) {
        throw new BadRequestException(`Order does not belong to your store`);
      }

      // 1.5 Fetch Store config
      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) {
        throw new NotFoundException(`Store with ID "${storeId}" not found`);
      }
      if (order.isExpress && store.expressSurchargePercent == null) {
        throw new BadRequestException(`Express service is not configured for this store`);
      }

      // 2. Validate order item belongs to order
      const orderItem = order.items.find((item) => item.id === itemId);
      if (!orderItem) {
        throw new NotFoundException(
          `OrderItem with ID "${itemId}" not found in order "${orderId}"`,
        );
      }

      // 3. Validate garment / service if updated
      if (dto.garmentCatalogId) {
        const garment = await tx.garmentCatalog.findUnique({ where: { id: dto.garmentCatalogId } });
        if (!garment)
          throw new NotFoundException(`Garment with ID "${dto.garmentCatalogId}" not found`);
        if (!garment.isActive)
          throw new BadRequestException(`Garment "${garment.name}" is not active`);
      }
      if (dto.serviceTypeId) {
        const service = await tx.serviceType.findUnique({ where: { id: dto.serviceTypeId } });
        if (!service)
          throw new NotFoundException(`Service type with ID "${dto.serviceTypeId}" not found`);
        if (!service.isActive)
          throw new BadRequestException(`Service type "${service.name}" is not active`);
      }

      // 4. Validate quantities
      const newQuantity = dto.quantity !== undefined ? dto.quantity : orderItem.quantity;
      const newDeliveredQuantity =
        dto.deliveredQuantity !== undefined ? dto.deliveredQuantity : orderItem.deliveredQuantity;

      if (newDeliveredQuantity > newQuantity) {
        throw new BadRequestException(
          `Delivered quantity (${newDeliveredQuantity}) cannot exceed total quantity (${newQuantity})`,
        );
      }

      // 5. Calculate new line total
      const garmentCatalogId = dto.garmentCatalogId || orderItem.garmentCatalogId;
      const serviceTypeId = dto.serviceTypeId || orderItem.serviceTypeId;

      const priceRecord = await tx.serviceGarmentPrice.findFirst({
        where: {
          garmentCatalogId,
          serviceTypeId,
          OR: [{ storeId: null }, { storeId }],
        },
      });
      const unitPrice = priceRecord?.price ?? orderItem.unitPrice;
      const lineTotal = unitPrice * newQuantity;

      // 6. Update OrderItem
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          garmentCatalogId: dto.garmentCatalogId,
          serviceTypeId: dto.serviceTypeId,
          quantity: dto.quantity,
          unitPrice,
          lineTotal,
          colorTags: dto.colorTags,
          defectNotes: dto.defectNotes,
          itemStatus: dto.itemStatus,
          deliveredQuantity: dto.deliveredQuantity,
        },
      });

      // 7. Recalculate Order Totals
      const updatedOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { 
          items: {
            include: {
              garmentCatalog: true,
              serviceType: true
            }
          } 
        },
      });

      const pricingInputs = updatedOrder!.items.map((i) => ({
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      }));
      const totals = calculateOrderTotals(pricingInputs, {
        isExpress: updatedOrder!.isExpress,
        expressSurchargePercent: store.expressSurchargePercent ?? undefined,
      });

      const itemsForStatus = updatedOrder!.items.map((i: any) => ({
        status: i.itemStatus as ItemStatus,
      }));
      const newOrderStatus = deriveOrderStatus({
        items: itemsForStatus,
        currentOrderStatus: updatedOrder!.status as OrderStatus,
        hasActiveTransitDelivery: false,
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newOrderStatus,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          expressSurcharge: totals.expressSurcharge,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountDue: totals.totalAmount - updatedOrder!.amountPaid,
        },
      });

      // 8. Return updated order detail
      return {
        oldOrderStatus: order.status,
        oldItemStatus: orderItem.itemStatus,
        updatedOrder: await this.findOrderById(orderId),
      };
    });

    // C6: Trigger ORDER_READY notification outside transaction
    if (
      dto.itemStatus === ItemStatus.READY &&
      oldItemStatus !== ItemStatus.READY &&
      updatedOrder.customerPhone
    ) {
      // Find all ready items to include in the payload
      const readyItems = updatedOrder.items.filter((i: any) => i.itemStatus === ItemStatus.READY);
      const remainingItems = updatedOrder.items.filter(
        (i: any) => i.itemStatus !== ItemStatus.READY && i.itemStatus !== ItemStatus.DELIVERED && i.itemStatus !== ItemStatus.CANCELLED,
      );

      // We can also calculate current value of ready items
      const breakdown = calculateFulfillmentBreakdown(
        updatedOrder.totalAmount,
        updatedOrder.amountPaid,
        updatedOrder.items as any,
      );

      this.notificationService
        .createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_READY,
          NotificationChannel.SMS,
          updatedOrder.customerPhone,
          updatedOrder.id,
          updatedOrder.customerId,
          { 
            orderNumber: updatedOrder.orderNumber,
            totalAmount: updatedOrder.totalAmount,
            amountPaid: updatedOrder.amountPaid,
            amountDue: updatedOrder.amountDue,
            readyAmount: breakdown.readyAmount,
            remainingAmount: breakdown.remainingAmount,
            readyItems: readyItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity
            })),
            remainingItems: remainingItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity
            }))
          },
        )
        .catch(() => {});
    }

    return updatedOrder;
  }

  // --- B6 Due Date Override ---
  async updateDueDate(
    orderId: string,
    effectiveDueDate: string,
    reason: string,
    employeeId: string,
    storeId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.storeId !== storeId) {
        throw new BadRequestException(`Order does not belong to your store`);
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          effectiveDueDate: new Date(effectiveDueDate),
          dueDateOverrideReason: reason,
          dueDateOverriddenBy: employeeId,
        },
      });

      return await this.findOrderById(orderId);
    });
  }

  // --- Helpers ---
  private mapToSummaryDto(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      orderDate: order.orderDate.toISOString(),
      effectiveDueDate: order.effectiveDueDate.toISOString(),
      isExpress: order.isExpress,
      priority: order.priority,
      status: order.status,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      expressSurcharge: order.expressSurcharge,
      amountPaid: order.amountPaid,
      amountDue: order.amountDue,
      paymentStatus: order.paymentStatus,
      pickupType: order.pickupType,
      itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      ...calculateFulfillmentBreakdown(order.totalAmount, order.amountPaid, order.items),
    };
  }

  private mapToDetailDto(order: any) {
    const summary = this.mapToSummaryDto(order);
    return {
      ...summary,
      itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      systemDueDate: order.systemDueDate.toISOString(),
      dueDateOverrideReason: order.dueDateOverrideReason,
      dueDateOverriddenBy: order.dueDateOverriddenBy,
      serviceSummary: order.serviceSummary,
      storeId: order.storeId,
      createdById: order.createdById,
      createdByName: order.createdBy.name,
      items: order.items.map((item: any) => ({
        id: item.id,
        garmentName: item.garmentCatalog.name,
        garmentCategory: item.garmentCatalog.category,
        serviceType: item.serviceType.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        colorTags: item.colorTags,
        defectNotes: item.defectNotes,
        itemStatus: item.itemStatus,
        deliveredQuantity: item.deliveredQuantity,
        itemDueDate: item.itemDueDate?.toISOString() || null,
      })),
      payments:
        order.payments?.map((p: any) => ({
          id: p.id,
          orderId: p.orderId,
          amount: p.amount,
          mode: p.mode,
          reference: p.reference,
          receivedById: p.receivedById,
          receivedByName: 'Unknown', // Need to join employee for this later if needed
          createdAt: p.createdAt.toISOString(),
        })) || [],
    };
  }
}
