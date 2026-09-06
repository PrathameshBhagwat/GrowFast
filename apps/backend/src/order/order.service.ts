import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
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
  Role,
  AdjustmentType,
  AdjustmentStatus,
  CancelGarmentRequest,
  NotificationEventType,
  NotificationChannel,
} from '@growfast/shared-types';
import { NotificationService } from '../notification/notification.service';
import { PaymentService, derivePaymentStatus } from '../payment/payment.service';
import { OrderPickupDto } from './dto/order-pickup.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
    private readonly notificationService: NotificationService,
    private readonly paymentService: PaymentService,
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
          physicalGarments: {
            create: Array.from({ length: item.quantity }, (_, i) => ({
              unitNumber: i + 1,
              isReady: false,
            })),
          },
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
            physicalGarments: {
              include: { photos: true },
              orderBy: { unitNumber: 'asc' },
            },
          },
        },
        customer: true,
        createdBy: true,
        deliveredBy: true,
        store: true,
        payments: {
          include: { receivedBy: true },
          orderBy: { createdAt: 'desc' },
        },
        adjustments: {
          include: { createdBy: true },
          orderBy: { createdAt: 'desc' },
        },
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
    const { oldOrderStatus, oldItemStatus } = await this.prisma.$transaction(async (tx) => {
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

      // 2.5 Check if item has physical garments
      const physicalGarmentCount = await tx.physicalGarment.count({
        where: { orderItemId: itemId },
      });
      const hasPhysicalGarments = physicalGarmentCount > 0;

      if (hasPhysicalGarments && dto.itemStatus !== undefined) {
        throw new BadRequestException(
          'Item status is derived from physical garments and cannot be manually set.',
        );
      }

      if (
        hasPhysicalGarments &&
        dto.quantity !== undefined &&
        dto.quantity !== orderItem.quantity
      ) {
        throw new BadRequestException(
          'Quantity cannot be modified for items with physical garments.',
        );
      }

      // 3. Validate garment / service if updated
      if (dto.garmentCatalogId) {
        const garment = await tx.garmentCatalog.findUnique({
          where: { id: dto.garmentCatalogId },
        });
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

      if (
        hasPhysicalGarments &&
        dto.deliveredQuantity !== undefined &&
        dto.deliveredQuantity > orderItem.deliveredQuantity &&
        orderItem.itemStatus !== ItemStatus.READY &&
        orderItem.itemStatus !== ItemStatus.DELIVERED
      ) {
        throw new BadRequestException('Cannot deliver garments before they are marked ready.');
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
      const updatedItemStatus = hasPhysicalGarments
        ? newDeliveredQuantity === newQuantity && orderItem.itemStatus === ItemStatus.READY
          ? ItemStatus.DELIVERED
          : orderItem.itemStatus
        : dto.itemStatus !== undefined
          ? dto.itemStatus
          : orderItem.itemStatus;

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
          itemStatus: updatedItemStatus,
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
              serviceType: true,
            },
          },
          adjustments: true,
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

      const financial = this.paymentService.calculateOrderFinancialState({
        totalAmount: totals.totalAmount,
        amountPaid: updatedOrder!.amountPaid,
        paymentStatus: updatedOrder!.paymentStatus as any,
        adjustments: (updatedOrder as any).adjustments,
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
          amountDue: financial.amountDue,
          paymentStatus: financial.paymentStatus as any,
        },
      });

      // 8. Return old statuses
      return {
        oldOrderStatus: order.status,
        oldItemStatus: orderItem.itemStatus,
      };
    });

    const updatedOrder = await this.findOrderById(orderId);

    // C6: Trigger ORDER_READY notification outside transaction
    if (
      dto.itemStatus === ItemStatus.READY &&
      oldItemStatus !== ItemStatus.READY &&
      updatedOrder.customerPhone
    ) {
      // Find all ready items to include in the payload
      const readyItems = updatedOrder.items.filter((i: any) => i.itemStatus === ItemStatus.READY);
      const remainingItems = updatedOrder.items.filter(
        (i: any) =>
          i.itemStatus !== ItemStatus.READY &&
          i.itemStatus !== ItemStatus.DELIVERED &&
          i.itemStatus !== ItemStatus.CANCELLED,
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
            customerName: updatedOrder.customerName,
            totalAmount: updatedOrder.totalAmount,
            amountPaid: updatedOrder.amountPaid,
            amountDue: updatedOrder.amountDue,
            readyAmount: breakdown.readyAmount,
            remainingAmount: breakdown.remainingAmount,
            readyItems: readyItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity,
            })),
            remainingItems: remainingItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              quantity: i.quantity,
            })),
          },
        )
        .catch(() => {
          // Swallow any unhandled promises just in case
        });
    }

    // Trigger ORDER_DELIVERED when the whole order transitions to DELIVERED
    if (
      updatedOrder.status === OrderStatus.DELIVERED &&
      oldOrderStatus !== OrderStatus.DELIVERED &&
      updatedOrder.customerPhone
    ) {
      this.notificationService
        .createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_DELIVERED,
          NotificationChannel.SMS,
          updatedOrder.customerPhone,
          updatedOrder.id,
          updatedOrder.customerId,
          {
            orderNumber: updatedOrder.orderNumber,
            totalAmount: updatedOrder.totalAmount,
          },
        )
        .catch(() => {
          // Swallow any unhandled promises just in case
        });
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

  async markPhysicalGarmentReady(
    orderId: string,
    itemId: string,
    garmentId: string,
    isReady: boolean,
    storeId: string,
  ) {
    const { oldItemStatus, newItemStatus } = await this.prisma.$transaction(async (tx) => {
      // 1. Verify access
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) throw new NotFoundException(`Order not found`);
      if (order.storeId !== storeId)
        throw new BadRequestException(`Order does not belong to your store`);

      const orderItem = order.items.find((i) => i.id === itemId);
      if (!orderItem) throw new NotFoundException(`Item not found`);

      // 2. Update physical garment
      const pg = await tx.physicalGarment.findUnique({ where: { id: garmentId } });
      if (!pg || pg.orderItemId !== itemId) {
        throw new NotFoundException(`Physical garment not found`);
      }
      if (pg.isCancelled) {
        throw new BadRequestException('Cannot mark a cancelled garment as ready.');
      }

      await tx.physicalGarment.update({
        where: { id: garmentId },
        data: { isReady },
      });

      // 3. Rollup status
      const allGarments = await tx.physicalGarment.findMany({
        where: { orderItemId: itemId },
      });
      const activeGarments = allGarments.filter((g) => !g.isCancelled);
      const allReady = activeGarments.length > 0 && activeGarments.every((g) => g.isReady);
      const anyReady = activeGarments.some((g) => g.isReady);

      let newItemStatus = orderItem.itemStatus;
      if (
        orderItem.itemStatus !== ItemStatus.DELIVERED &&
        orderItem.itemStatus !== ItemStatus.CANCELLED
      ) {
        if (allReady) {
          newItemStatus = ItemStatus.READY;
        } else if (anyReady) {
          newItemStatus = ItemStatus.PROCESSING;
        } else {
          newItemStatus = ItemStatus.RECEIVED;
        }
      }

      if (newItemStatus !== orderItem.itemStatus) {
        await tx.orderItem.update({
          where: { id: itemId },
          data: { itemStatus: newItemStatus },
        });

        // 4. Rollup Order Status
        const updatedItems = await tx.orderItem.findMany({ where: { orderId } });
        const itemsForStatus = updatedItems.map((i: any) => ({
          status: i.itemStatus as ItemStatus,
        }));

        const newOrderStatus = deriveOrderStatus({
          items: itemsForStatus,
          currentOrderStatus: order.status as OrderStatus,
          hasActiveTransitDelivery: false,
        });

        if (newOrderStatus !== order.status) {
          await tx.order.update({
            where: { id: orderId },
            data: { status: newOrderStatus },
          });
        }
      }

      return { order, oldItemStatus: orderItem.itemStatus, newItemStatus };
    });

    const updatedOrder = await this.findOrderById(orderId);

    // Trigger ORDER_READY notification
    if (
      newItemStatus === ItemStatus.READY &&
      oldItemStatus !== ItemStatus.READY &&
      updatedOrder.customerPhone
    ) {
      const readyItems = updatedOrder.items.filter((i: any) => i.itemStatus === ItemStatus.READY);
      const remainingItems = updatedOrder.items.filter(
        (i: any) =>
          i.itemStatus !== ItemStatus.READY &&
          i.itemStatus !== ItemStatus.DELIVERED &&
          i.itemStatus !== ItemStatus.CANCELLED,
      );

      const breakdown = calculateFulfillmentBreakdown(
        updatedOrder.totalAmount,
        updatedOrder.amountPaid,
        updatedOrder.items as any,
      );

      this.notificationService
        ?.createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_READY,
          NotificationChannel.SMS,
          updatedOrder.customerPhone,
          updatedOrder.id,
          updatedOrder.customerId,
          {
            orderNumber: updatedOrder.orderNumber,
            customerName: updatedOrder.customerName,
            totalAmount: updatedOrder.totalAmount,
            amountPaid: updatedOrder.amountPaid,
            amountDue: updatedOrder.amountDue,
            readyAmount: breakdown.readyAmount,
            remainingAmount: breakdown.remainingAmount,
            readyItems: readyItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity,
            })),
            remainingItems: remainingItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              quantity: i.quantity,
            })),
          },
        )
        ?.catch?.(() => {});
    }

    return updatedOrder;
  }

  async addPhysicalGarment(orderId: string, itemId: string, storeId: string) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch order with store isolation and items with garments
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              physicalGarments: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.storeId !== storeId) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot add garment to a cancelled order');
      }
      if (order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException('Cannot add garment to a delivered order');
      }

      // 2. Fetch order item
      const orderItem = order.items.find((i) => i.id === itemId);
      if (!orderItem) {
        throw new NotFoundException(
          `OrderItem with ID "${itemId}" not found in order "${orderId}"`,
        );
      }

      // 3. Confirm it is backed by physical garments
      const existingGarments = orderItem.physicalGarments || [];
      if (existingGarments.length === 0) {
        throw new BadRequestException(
          'Cannot add physical garments to a legacy item without physical garments.',
        );
      }

      if (orderItem.itemStatus === ItemStatus.DELIVERED) {
        throw new BadRequestException('Cannot add garment to an item that is already delivered.');
      }
      if (orderItem.itemStatus === ItemStatus.CANCELLED) {
        throw new BadRequestException('Cannot add garment to a cancelled item.');
      }

      // 4. Determine next unit number (max + 1, never reuse cancelled numbers)
      const maxUnitNumber = existingGarments.reduce((max, g) => Math.max(max, g.unitNumber), 0);
      const nextUnitNumber = maxUnitNumber + 1;

      // 5. Create new PhysicalGarment
      await tx.physicalGarment.create({
        data: {
          orderItemId: itemId,
          unitNumber: nextUnitNumber,
          isReady: false,
          isCancelled: false,
        },
      });

      // 6. Increment quantity and lineTotal
      const newQuantity = orderItem.quantity + 1;
      const newLineTotal = Number((orderItem.unitPrice * newQuantity).toFixed(2));

      // 7. Derive new itemStatus (new garment is not ready, so all active garments cannot be all ready)
      const activeGarments = existingGarments.filter((g) => !g.isCancelled);
      const anyReady = activeGarments.some((g) => g.isReady);
      const newItemStatus = anyReady ? ItemStatus.PROCESSING : ItemStatus.RECEIVED;

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: newQuantity,
          lineTotal: newLineTotal,
          itemStatus: newItemStatus,
        },
      });

      // 8. Recalculate order totals
      const store = await tx.store.findUnique({ where: { id: storeId } });
      const pricingInputs = order.items.map((i) => ({
        unitPrice: i.unitPrice,
        quantity: i.id === itemId ? newQuantity : i.quantity,
      }));
      const totals = calculateOrderTotals(pricingInputs, {
        isExpress: order.isExpress,
        expressSurchargePercent: store?.expressSurchargePercent ?? undefined,
      });

      const newAmountDue = Number((totals.totalAmount - order.amountPaid).toFixed(2));
      const newPaymentStatus = derivePaymentStatus(
        order.amountPaid,
        totals.totalAmount,
        order.paymentStatus as unknown as any,
      );

      // 9. Derive canonical order status
      const itemsForStatus = order.items.map((i: any) => ({
        status: (i.id === itemId ? newItemStatus : i.itemStatus) as ItemStatus,
      }));
      const newOrderStatus = deriveOrderStatus({
        items: itemsForStatus,
        currentOrderStatus: order.status as OrderStatus,
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
          amountDue: newAmountDue,
          paymentStatus: newPaymentStatus as unknown as any,
        },
      });
    });

    return await this.findOrderById(orderId, storeId);
  }

  async cancelPhysicalGarment(
    orderId: string,
    itemId: string,
    garmentId: string,
    storeId: string,
    employeeId?: string,
    employeeRole?: string,
    adjustmentDto?: CancelGarmentRequest['adjustment'],
  ) {
    let triggeredReady = false;
    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch order with store isolation and items with garments
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              physicalGarments: true,
            },
          },
          adjustments: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.storeId !== storeId) {
        throw new NotFoundException(`Order with ID "${orderId}" not found`);
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot cancel garment on a cancelled order');
      }
      if (order.status === OrderStatus.DELIVERED) {
        throw new BadRequestException('Cannot cancel garment on a delivered order');
      }

      // 2. Fetch order item
      const orderItem = order.items.find((i) => i.id === itemId);
      if (!orderItem) {
        throw new NotFoundException(
          `OrderItem with ID "${itemId}" not found in order "${orderId}"`,
        );
      }

      // 3. Delivered quantity check (Decision D)
      if (orderItem.deliveredQuantity > 0) {
        throw new BadRequestException(
          'Cannot cancel garment when delivered quantity is greater than 0.',
        );
      }

      // 4. Fetch garment
      const garment = orderItem.physicalGarments.find((g) => g.id === garmentId);
      if (!garment) {
        throw new NotFoundException(
          `Physical garment with ID "${garmentId}" not found in item "${itemId}"`,
        );
      }

      // 5. Already cancelled check (Decision B)
      if (garment.isCancelled) {
        throw new BadRequestException('Garment is already cancelled.');
      }

      // 6. READY garment check (Decision C)
      if (garment.isReady) {
        throw new BadRequestException('Cannot cancel a garment that is already marked ready.');
      }

      // 7. Last active garment check (Decision E)
      const activeGarments = orderItem.physicalGarments.filter((g) => !g.isCancelled);
      if (activeGarments.length <= 1) {
        throw new BadRequestException('Cannot cancel the last active garment of an item.');
      }

      // 8. Financial check (Phase 3E)
      const newQuantity = orderItem.quantity - 1;
      const newLineTotal = Number((orderItem.unitPrice * newQuantity).toFixed(2));

      const store = await tx.store.findUnique({ where: { id: storeId } });
      const pricingInputs = order.items.map((i) => ({
        unitPrice: i.unitPrice,
        quantity: i.id === itemId ? newQuantity : i.quantity,
      }));
      const totals = calculateOrderTotals(pricingInputs, {
        isExpress: order.isExpress,
        expressSurchargePercent: store?.expressSurchargePercent ?? undefined,
      });

      // Compute existing adjustments and current effective paid
      const existingRefunds = Number(
        (order.adjustments || [])
          .filter(
            (a: any) => a.status === AdjustmentStatus.COMPLETED && a.type === AdjustmentType.REFUND,
          )
          .reduce((sum: number, a: any) => sum + a.amount, 0)
          .toFixed(2),
      );
      const existingStoreCredits = Number(
        (order.adjustments || [])
          .filter(
            (a: any) =>
              a.status === AdjustmentStatus.COMPLETED && a.type === AdjustmentType.STORE_CREDIT,
          )
          .reduce((sum: number, a: any) => sum + a.amount, 0)
          .toFixed(2),
      );
      const existingAdjustmentsTotal = Number((existingRefunds + existingStoreCredits).toFixed(2));
      const currentEffectivePaid = Number((order.amountPaid - existingAdjustmentsTotal).toFixed(2));

      let newRefunds = existingRefunds;
      let newStoreCredits = existingStoreCredits;

      if (totals.totalAmount < currentEffectivePaid) {
        const excess = Number((currentEffectivePaid - totals.totalAmount).toFixed(2));

        if (!adjustmentDto) {
          throw new BadRequestException(
            `Cancellation requires a financial adjustment (refund or store credit) because the resulting order total (₹${totals.totalAmount}) is less than effective amount paid (₹${currentEffectivePaid}). Excess amount: ₹${excess}.`,
          );
        }

        // Only OWNER can authorize adjustments
        if (employeeRole !== Role.OWNER) {
          throw new ForbiddenException('Only store owners can authorize financial adjustments');
        }

        if (
          !adjustmentDto.amount ||
          adjustmentDto.amount <= 0 ||
          !Number.isFinite(adjustmentDto.amount)
        ) {
          throw new BadRequestException('Adjustment amount must be greater than zero');
        }

        if (Math.abs(adjustmentDto.amount - excess) > 0.01) {
          throw new BadRequestException(
            `Adjustment amount (₹${adjustmentDto.amount}) must match the required reduction amount (₹${excess})`,
          );
        }

        if (
          !adjustmentDto.reason ||
          typeof adjustmentDto.reason !== 'string' ||
          adjustmentDto.reason.trim().length === 0
        ) {
          throw new BadRequestException('Adjustment reason is required');
        }

        if (
          adjustmentDto.type !== AdjustmentType.REFUND &&
          adjustmentDto.type !== AdjustmentType.STORE_CREDIT
        ) {
          throw new BadRequestException(`Invalid adjustment type: ${adjustmentDto.type}`);
        }

        // Create adjustment atomically in same transaction
        await tx.financialAdjustment.create({
          data: {
            orderId,
            type: adjustmentDto.type,
            amount: Number(adjustmentDto.amount.toFixed(2)),
            reason: adjustmentDto.reason.trim(),
            reference: adjustmentDto.reference,
            status: AdjustmentStatus.COMPLETED,
            createdById: employeeId || order.createdById,
          },
        });

        if (adjustmentDto.type === AdjustmentType.REFUND) {
          newRefunds = Number((existingRefunds + adjustmentDto.amount).toFixed(2));
        } else {
          newStoreCredits = Number((existingStoreCredits + adjustmentDto.amount).toFixed(2));
        }
      }

      // 9. Soft-cancel the physical garment
      await tx.physicalGarment.update({
        where: { id: garmentId },
        data: { isCancelled: true },
      });

      // 10. Recompute itemStatus from remaining active garments
      const remainingActive = activeGarments.filter((g) => g.id !== garmentId);
      const allReady = remainingActive.length > 0 && remainingActive.every((g) => g.isReady);
      const anyReady = remainingActive.some((g) => g.isReady);

      let newItemStatus = orderItem.itemStatus;
      if (allReady) {
        newItemStatus = ItemStatus.READY;
      } else {
        newItemStatus = anyReady ? ItemStatus.PROCESSING : ItemStatus.RECEIVED;
      }

      if (newItemStatus === ItemStatus.READY && orderItem.itemStatus !== ItemStatus.READY) {
        triggeredReady = true;
      }

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: newQuantity,
          lineTotal: newLineTotal,
          itemStatus: newItemStatus,
        },
      });

      // 11. Recalculate order totals and derive canonical order status
      const newAdjustmentsTotal = Number((newRefunds + newStoreCredits).toFixed(2));
      const newEffectivePaid = Number((order.amountPaid - newAdjustmentsTotal).toFixed(2));
      const newAmountDue = Math.max(0, Number((totals.totalAmount - newEffectivePaid).toFixed(2)));

      let newPaymentStatus = derivePaymentStatus(
        newEffectivePaid,
        totals.totalAmount,
        order.paymentStatus as unknown as any,
      );

      if (
        totals.totalAmount === 0 ||
        (newEffectivePaid === 0 && order.amountPaid > 0 && newRefunds >= order.amountPaid)
      ) {
        newPaymentStatus = PaymentStatus.REFUNDED;
      }

      const itemsForStatus = order.items.map((i: any) => ({
        status: (i.id === itemId ? newItemStatus : i.itemStatus) as ItemStatus,
      }));
      const newOrderStatus = deriveOrderStatus({
        items: itemsForStatus,
        currentOrderStatus: order.status as OrderStatus,
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
          amountDue: newAmountDue,
          paymentStatus: newPaymentStatus as unknown as any,
        },
      });
    });

    const updatedOrder = await this.findOrderById(orderId, storeId);

    // If cancellation transitioned the order to READY, trigger canonical notification
    if (triggeredReady && updatedOrder.status === OrderStatus.READY && updatedOrder.customerPhone) {
      const readyItems = updatedOrder.items.filter((i: any) => i.itemStatus === ItemStatus.READY);
      const remainingItems = updatedOrder.items.filter(
        (i: any) =>
          i.itemStatus !== ItemStatus.READY &&
          i.itemStatus !== ItemStatus.DELIVERED &&
          i.itemStatus !== ItemStatus.CANCELLED,
      );

      const breakdown = calculateFulfillmentBreakdown(
        updatedOrder.totalAmount,
        updatedOrder.amountPaid,
        updatedOrder.items as any,
      );

      this.notificationService
        ?.createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_READY,
          NotificationChannel.SMS,
          updatedOrder.customerPhone,
          updatedOrder.id,
          updatedOrder.customerId,
          {
            orderNumber: updatedOrder.orderNumber,
            customerName: updatedOrder.customerName,
            totalAmount: updatedOrder.totalAmount,
            amountPaid: updatedOrder.amountPaid,
            amountDue: updatedOrder.amountDue,
            readyAmount: breakdown.readyAmount,
            remainingAmount: breakdown.remainingAmount,
            readyItems: readyItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity,
            })),
            remainingItems: remainingItems.map((i: any) => ({
              id: i.id,
              garmentName: i.garmentName,
              serviceType: i.serviceType,
              quantity: i.quantity,
            })),
          },
        )
        ?.catch?.(() => {});
    }

    return updatedOrder;
  }

  async notifyPartialReady(orderId: string, storeId: string) {
    const order = await this.findOrderById(orderId, storeId);

    if (!order.customerPhone) {
      throw new BadRequestException('Customer does not have a phone number');
    }

    // Duplicate protection / Rate limiting: 30s cooldown
    const recent = await this.prisma.notification.findFirst({
      where: {
        orderId,
        eventType: NotificationEventType.ORDER_READY,
        createdAt: { gte: new Date(Date.now() - 30000) },
      },
    });
    if (recent) {
      throw new BadRequestException(
        'A readiness notification was sent recently. Please wait before sending another.',
      );
    }

    // Build authoritative ready vs remaining items based on physical garments
    const readyItems: {
      id?: string;
      garmentName: string;
      serviceType?: string;
      quantity: number;
    }[] = [];
    const remainingItems: { id?: string; garmentName: string; quantity: number }[] = [];

    for (const item of order.items) {
      if (item.physicalGarments && item.physicalGarments.length > 0) {
        const activeGarments = item.physicalGarments.filter((pg: any) => !pg.isCancelled);
        const readyGarments = activeGarments.filter((pg: any) => pg.isReady);
        const remainingGarments = activeGarments.filter((pg: any) => !pg.isReady);

        if (readyGarments.length > 0) {
          readyItems.push({
            id: item.id,
            garmentName: item.garmentName,
            serviceType: item.serviceType,
            quantity: readyGarments.length,
          });
        }
        if (remainingGarments.length > 0) {
          remainingItems.push({
            id: item.id,
            garmentName: item.garmentName,
            quantity: remainingGarments.length,
          });
        }
      } else {
        // Legacy order item fallback without PhysicalGarment records
        if (item.itemStatus === ItemStatus.READY) {
          readyItems.push({
            id: item.id,
            garmentName: item.garmentName,
            serviceType: item.serviceType,
            quantity: item.quantity,
          });
        } else if (
          item.itemStatus !== ItemStatus.DELIVERED &&
          item.itemStatus !== ItemStatus.CANCELLED
        ) {
          remainingItems.push({
            id: item.id,
            garmentName: item.garmentName,
            quantity: item.quantity,
          });
        }
      }
    }

    if (readyItems.length === 0) {
      throw new BadRequestException('No garments are ready to notify');
    }

    // Reuse existing authoritative financial values
    const payload = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      amountDue: order.amountDue,
      readyItems,
      remainingItems,
    };

    const notification = await this.notificationService.createNotificationEvent(
      storeId,
      NotificationEventType.ORDER_READY,
      NotificationChannel.SMS,
      order.customerPhone,
      order.id,
      order.customerId,
      payload,
    );

    return {
      success: true,
      message: 'Readiness notification queued successfully',
      notificationId: notification?.id || null,
    };
  }

  /**
   * Phase 4C — Counter Pickup & Order Handover
   *
   * Atomically delivers physical garments and/or legacy items, records optional
   * payment, verifies financial settlement gates, synchronizes delivered quantities,
   * derives canonical OrderStatus, and updates delivery audit fields.
   */
  async recordPickup(orderId: string, dto: OrderPickupDto, employeeId: string, storeId: string) {
    const hasGarments = Array.isArray(dto.garmentIds) && dto.garmentIds.length > 0;
    const hasLegacy = Array.isArray(dto.legacyItems) && dto.legacyItems.length > 0;
    if (!hasGarments && !hasLegacy) {
      throw new BadRequestException(
        'At least one garment or legacy item must be selected for pickup',
      );
    }

    if (dto.payment) {
      if (dto.payment.amount <= 0 || !Number.isFinite(dto.payment.amount)) {
        throw new BadRequestException('Payment amount must be greater than zero');
      }
    }

    const { oldOrderStatus, wasDelivered, customerPhone, customerId, orderNumber, totalAmount } =
      await this.prisma.$transaction(async (tx) => {
        // 1. Fetch order with items and physical garments
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                physicalGarments: true,
              },
            },
            customer: true,
          },
        });

        if (!order) {
          throw new NotFoundException(`Order with ID "${orderId}" not found`);
        }
        if (order.storeId !== storeId) {
          throw new ForbiddenException('Cannot access orders from a different store');
        }
        if (order.status === OrderStatus.CANCELLED) {
          throw new BadRequestException('Cannot pickup items from a cancelled order');
        }

        const oldOrderStatus = order.status;

        // 2. Process payment within same transaction if provided
        if (dto.payment) {
          await this.paymentService.recordPayment(
            employeeId,
            storeId,
            {
              orderId,
              amount: dto.payment.amount,
              mode: dto.payment.mode,
              reference: dto.payment.reference,
            },
            tx,
          );
        }

        // 3. Process physical garments
        if (hasGarments) {
          const requestedIds = dto.garmentIds!;
          const uniqueRequestedIds = new Set(requestedIds);
          if (requestedIds.length !== uniqueRequestedIds.size) {
            throw new BadRequestException('Duplicate garment IDs in pickup request');
          }

          // Build map of physical garments belonging to this order
          const orderGarmentMap = new Map<string, { pg: any; item: any }>();
          for (const item of order.items) {
            for (const pg of item.physicalGarments) {
              orderGarmentMap.set(pg.id, { pg, item });
            }
          }

          // Validate every garment
          for (const gid of requestedIds) {
            const entry = orderGarmentMap.get(gid);
            if (!entry) {
              throw new BadRequestException(
                `Garment with ID "${gid}" does not belong to order "${orderId}"`,
              );
            }
            const { pg } = entry;
            if (pg.isCancelled) {
              throw new BadRequestException(`Cannot pick up cancelled garment with ID "${gid}"`);
            }
            if (!pg.isReady) {
              throw new BadRequestException(
                `Cannot pick up garment with ID "${gid}" because it is not ready`,
              );
            }
            if (pg.isDelivered) {
              throw new BadRequestException(`Garment with ID "${gid}" has already been delivered`);
            }
          }

          // Concurrency-safe atomic update
          const now = new Date();
          for (const gid of requestedIds) {
            const updateResult = await tx.physicalGarment.updateMany({
              where: {
                id: gid,
                isDelivered: false,
                isReady: true,
                isCancelled: false,
              },
              data: {
                isDelivered: true,
                deliveredAt: now,
              },
            });

            if (updateResult.count === 0) {
              throw new BadRequestException(
                `Garment "${gid}" was concurrently modified or already delivered`,
              );
            }
          }

          // Synchronize OrderItem.deliveredQuantity and itemStatus for affected items
          for (const item of order.items) {
            if (item.physicalGarments && item.physicalGarments.length > 0) {
              const updatedGarments = await tx.physicalGarment.findMany({
                where: { orderItemId: item.id },
              });
              const activeGarments = updatedGarments.filter((g) => !g.isCancelled);
              const deliveredCount = activeGarments.filter((g) => g.isDelivered).length;

              let newItemStatus = item.itemStatus;
              if (activeGarments.length > 0 && deliveredCount === activeGarments.length) {
                newItemStatus = ItemStatus.DELIVERED;
              }

              await tx.orderItem.update({
                where: { id: item.id },
                data: {
                  deliveredQuantity: deliveredCount,
                  itemStatus: newItemStatus,
                },
              });
            }
          }
        }

        // 4. Process legacy items
        if (hasLegacy) {
          for (const legacy of dto.legacyItems!) {
            const item = order.items.find((i) => i.id === legacy.itemId);
            if (!item) {
              throw new BadRequestException(
                `Legacy order item "${legacy.itemId}" does not belong to order "${orderId}"`,
              );
            }
            if (item.itemStatus === ItemStatus.CANCELLED) {
              throw new BadRequestException(`Cannot pick up cancelled item "${legacy.itemId}"`);
            }
            if (legacy.quantity <= 0) {
              throw new BadRequestException(
                `Pickup quantity for item "${legacy.itemId}" must be greater than zero`,
              );
            }
            const remaining = item.quantity - item.deliveredQuantity;
            if (legacy.quantity > remaining) {
              throw new BadRequestException(
                `Cannot deliver ${legacy.quantity} of item "${legacy.itemId}". Only ${remaining} remaining.`,
              );
            }

            const newDelivered = item.deliveredQuantity + legacy.quantity;
            const newItemStatus =
              newDelivered === item.quantity ? ItemStatus.DELIVERED : item.itemStatus;

            const updateRes = await tx.orderItem.updateMany({
              where: {
                id: item.id,
                deliveredQuantity: item.deliveredQuantity,
              },
              data: {
                deliveredQuantity: newDelivered,
                itemStatus: newItemStatus,
              },
            });

            if (updateRes.count === 0) {
              throw new BadRequestException(
                `Concurrent modification detected for order item "${item.id}"`,
              );
            }
          }
        }

        // 5. Check full order completion and financial settlement gate
        const currentOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            items: {
              include: {
                physicalGarments: true,
              },
            },
            adjustments: true,
          },
        });

        let allActiveItemsDelivered = true;
        for (const item of currentOrder!.items) {
          if (item.itemStatus === ItemStatus.CANCELLED) {
            continue;
          }
          const activeGarments = item.physicalGarments.filter((g) => !g.isCancelled);
          if (activeGarments.length > 0) {
            const allGarmentsDelivered = activeGarments.every((g) => g.isDelivered);
            if (!allGarmentsDelivered) {
              allActiveItemsDelivered = false;
              break;
            }
          } else {
            if (item.deliveredQuantity < item.quantity) {
              allActiveItemsDelivered = false;
              break;
            }
          }
        }

        const financialState = this.paymentService.calculateOrderFinancialState(currentOrder!);

        // Final settlement gate: If all active items delivered, amountDue must be 0
        if (allActiveItemsDelivered && financialState.amountDue > 0) {
          throw new BadRequestException(
            `Cannot complete final handover: Order #${currentOrder!.orderNumber} has an outstanding balance of ₹${financialState.amountDue}. Full payment must be settled before final delivery.`,
          );
        }

        // Derive canonical order status
        const itemsForStatus = currentOrder!.items.map((i) => ({
          status: i.itemStatus as ItemStatus,
        }));
        const derivedStatus = deriveOrderStatus({
          items: itemsForStatus,
          currentOrderStatus: currentOrder!.status as OrderStatus,
        });

        const orderUpdateData: any = {
          status: derivedStatus,
        };

        if (allActiveItemsDelivered && derivedStatus === OrderStatus.DELIVERED) {
          orderUpdateData.deliveredAt = new Date();
          orderUpdateData.deliveredById = employeeId;
        }

        await tx.order.update({
          where: { id: orderId },
          data: orderUpdateData,
        });

        return {
          oldOrderStatus,
          wasDelivered: allActiveItemsDelivered && derivedStatus === OrderStatus.DELIVERED,
          customerPhone: order.customer?.phone,
          customerId: order.customerId,
          orderNumber: currentOrder!.orderNumber,
          totalAmount: currentOrder!.totalAmount,
        };
      });

    // Outside transaction: Fetch updated order details
    const updatedOrder = await this.findOrderById(orderId, storeId);

    // Trigger ORDER_DELIVERED notification if full handover completed
    if (wasDelivered && oldOrderStatus !== OrderStatus.DELIVERED && customerPhone) {
      this.notificationService
        .createNotificationEvent(
          storeId,
          NotificationEventType.ORDER_DELIVERED,
          NotificationChannel.SMS,
          customerPhone,
          orderId,
          customerId,
          {
            orderNumber,
            totalAmount,
          },
        )
        ?.catch?.(() => {});
    }

    return updatedOrder;
  }

  // --- Helpers ---
  private mapToSummaryDto(order: any) {
    const financial = this.paymentService.calculateOrderFinancialState(order);

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
      refundAmount: financial.refundAmount,
      storeCreditAmount: financial.storeCreditAmount,
      effectivePaid: financial.effectivePaid,
      amountDue: financial.amountDue,
      paymentStatus: financial.paymentStatus,
      pickupType: order.pickupType,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
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
      storeName: order.store?.name || undefined,
      storeAddress: order.store?.address || null,
      storePhone: order.store?.phone || null,
      createdById: order.createdById,
      createdByName: order.createdBy?.name || 'Staff',
      deliveredById: order.deliveredById || null,
      deliveredByName: order.deliveredBy?.name || null,
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
        physicalGarments: item.physicalGarments?.map((pg: any) => ({
          id: pg.id,
          orderItemId: pg.orderItemId,
          unitNumber: pg.unitNumber,
          isReady: pg.isReady,
          isCancelled: pg.isCancelled ?? false,
          isDelivered: pg.isDelivered ?? false,
          deliveredAt: pg.deliveredAt ? pg.deliveredAt.toISOString() : null,
          createdAt: pg.createdAt.toISOString(),
          updatedAt: pg.updatedAt.toISOString(),
          photos: pg.photos?.map((photo: any) => ({
            id: photo.id,
            orderItemId: photo.orderItemId,
            physicalGarmentId: photo.physicalGarmentId,
            type: photo.type as any,
            url: photo.url,
            uploadedAt: photo.uploadedAt.toISOString(),
          })),
        })),
      })),
      payments:
        order.payments?.map((p: any) => ({
          id: p.id,
          orderId: p.orderId,
          amount: p.amount,
          mode: p.mode,
          reference: p.reference,
          receivedById: p.receivedById,
          receivedByName: p.receivedBy?.name || 'Staff',
          createdAt: p.createdAt.toISOString(),
        })) || [],
      adjustments:
        order.adjustments?.map((a: any) => ({
          id: a.id,
          orderId: a.orderId,
          type: a.type,
          amount: a.amount,
          reason: a.reason,
          status: a.status,
          reference: a.reference,
          createdById: a.createdById,
          createdByName: a.createdBy?.name || 'Unknown',
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })) || [],
    };
  }
}
