import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto';
import { OrderPriority, PaymentStatus } from '@growfast/shared-types';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: CatalogService,
  ) {}

  async createOrder(dto: CreateOrderDto, employeeId: string, storeId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate customer
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer with ID "${dto.customerId}" not found`);
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

      // Validate items
      const orderItemsData = [];
      const serviceCounts = new Map<string, number>();

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

        // For summary
        serviceCounts.set(service.name, (serviceCounts.get(service.name) || 0) + item.quantity);

        orderItemsData.push({
          garmentCatalogId: garment.id,
          serviceTypeId: service.id,
          quantity: item.quantity,
          unitPrice: 0, // Deferred to B5
          lineTotal: 0, // Deferred to B5
          colorTags: item.colorTags || [],
          defectNotes: item.defectNotes,
        });
      }

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

      // 7. Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: dto.customerId,
          orderDate,
          systemDueDate: orderDate, // Deferred to B6
          effectiveDueDate: orderDate, // Deferred to B6
          isExpress: dto.isExpress,
          serviceSummary,
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
  }

  async findOrderById(id: string) {
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

    return this.mapToDetailDto(order);
  }

  async findAllOrders(query: GetOrdersQueryDto) {
    const { status, paymentStatus, page = 1, pageSize = 10 } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};
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
    return this.prisma.$transaction(async (tx) => {
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

      // 5. Update OrderItem
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          garmentCatalogId: dto.garmentCatalogId,
          serviceTypeId: dto.serviceTypeId,
          quantity: dto.quantity,
          colorTags: dto.colorTags,
          defectNotes: dto.defectNotes,
          itemStatus: dto.itemStatus,
          deliveredQuantity: dto.deliveredQuantity,
        },
      });

      // 6. Return updated order detail
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
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      amountDue: order.amountDue,
      paymentStatus: order.paymentStatus,
      pickupType: order.pickupType,
      itemCount: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
    };
  }

  private mapToDetailDto(order: any) {
    const summary = this.mapToSummaryDto(order);
    return {
      ...summary,
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
