import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DashboardSummaryDTO,
  OrderStatus as SharedOrderStatus,
  DashboardActionOrder,
  DashboardTrendPoint,
  DashboardTrendsDTO,
  DashboardComparisonDTO,
  DashboardServiceBreakdown,
  DashboardCategoryBreakdown,
  DashboardActionQueuesDTO,
  MetricComparison,
} from '@growfast/shared-types';
import {
  OrderStatus,
  DeliveryStatus,
  PaymentStatus,
  ItemStatus,
  AdjustmentType,
  AdjustmentStatus,
} from '@prisma/client';

function formatKolkataDate(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

function createComparison(current: number, previous: number): MetricComparison {
  const absoluteChange = Number((current - previous).toFixed(2));
  let percentageChange: number | null = null;
  if (previous === 0) {
    percentageChange = current === 0 ? 0 : null;
  } else {
    percentageChange = Number((((current - previous) / previous) * 100).toFixed(2));
  }
  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    absoluteChange,
    percentageChange,
  };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the dashboard summary for a store within a date range.
   *
   * All queries use database-side aggregation (count, aggregate, groupBy) or bounded queries.
   * Uses persisted Order.status (canonical, maintained by B8/C5).
   * Financial analytics:
   *  - Collections: sum of successful Payment transactions by createdAt in period.
   *  - Refunds: sum of completed FinancialAdjustment (REFUND) by createdAt in period.
   *  - Net Collections: collections - refunds.
   *  - Booked Order Value: sum of Order.totalAmount by orderDate in period.
   *  - Outstanding Balance: store-wide positive amountDue across non-cancelled orders (period-independent).
   * Operational analytics:
   *  - Overdue, Due-Today, Due-Tomorrow: effectiveDueDate evaluated with Asia/Kolkata boundaries.
   * STRICTLY READ-ONLY — zero mutations.
   */
  async getSummary(storeId: string, startDate: Date, endDate: Date): Promise<DashboardSummaryDTO> {
    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

    // ─── Asia/Kolkata Calendar Boundaries ─────────────────────────
    const now = new Date();
    const todayStr = formatKolkataDate(now);
    const todayStart = new Date(`${todayStr}T00:00:00.000+05:30`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

    const tomorrowDate = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = formatKolkataDate(tomorrowDate);
    const tomorrowStart = new Date(`${tomorrowStr}T00:00:00.000+05:30`);
    const tomorrowEnd = new Date(`${tomorrowStr}T23:59:59.999+05:30`);

    // ─── Order KPIs (database-side groupBy) ───────────────────────
    const ordersByStatus = await this.prisma.order.groupBy({
      by: ['status'],
      where: {
        storeId,
        orderDate: dateFilter,
      },
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    for (const row of ordersByStatus) {
      statusMap[row.status] = row._count.id;
    }

    const totalOrders = Object.values(statusMap).reduce((s, v) => s + v, 0);

    // ─── Operational Counts (Live Store-wide by effectiveDueDate) ─
    const overdueOrders = await this.prisma.order.count({
      where: {
        storeId,
        effectiveDueDate: { lt: now },
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        },
      },
    });

    const dueTodayOrders = await this.prisma.order.count({
      where: {
        storeId,
        effectiveDueDate: { gte: todayStart, lte: todayEnd },
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        },
      },
    });

    const dueTomorrowOrders = await this.prisma.order.count({
      where: {
        storeId,
        effectiveDueDate: { gte: tomorrowStart, lte: tomorrowEnd },
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        },
      },
    });

    // ─── Total Items ──────────────────────────────────────────────
    const totalItems = await this.prisma.orderItem.count({
      where: {
        order: {
          storeId,
          orderDate: dateFilter,
        },
      },
    });

    // ─── Financial KPIs (Authoritative Collections, Refunds, Balance) ─
    // 1. Booked Order Value in period
    const bookedAgg = await this.prisma.order.aggregate({
      where: {
        storeId,
        orderDate: dateFilter,
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });
    const bookedOrderValue = Number((bookedAgg._sum.totalAmount || 0).toFixed(2));

    // 2. Collections received in period by Payment.createdAt
    const paymentsAgg = await this.prisma.payment.aggregate({
      where: {
        order: { storeId },
        createdAt: dateFilter,
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });
    const collections = Number((paymentsAgg._sum.amount || 0).toFixed(2));
    const collectionCount = paymentsAgg._count.id || 0;

    // 3. Completed Refunds in period by FinancialAdjustment.createdAt
    const refundsAgg = await this.prisma.financialAdjustment.aggregate({
      where: {
        order: { storeId },
        type: AdjustmentType.REFUND,
        status: AdjustmentStatus.COMPLETED,
        createdAt: dateFilter,
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });
    const refunds = Number((refundsAgg._sum.amount || 0).toFixed(2));
    const refundCount = refundsAgg._count.id || 0;

    // 4. Net Collections
    const netCollections = Number((collections - refunds).toFixed(2));

    // 5. Live Store-wide Outstanding Balance (non-cancelled orders with amountDue > 0)
    const outstandingAgg = await this.prisma.order.aggregate({
      where: {
        storeId,
        status: { not: OrderStatus.CANCELLED },
        amountDue: { gt: 0 },
      },
      _sum: {
        amountDue: true,
      },
    });
    const outstandingBalance = Number((outstandingAgg._sum.amountDue || 0).toFixed(2));

    // ─── Payment Status Counts for orders booked in period ────────
    const paymentsByStatus = await this.prisma.order.groupBy({
      by: ['paymentStatus'],
      where: {
        storeId,
        orderDate: dateFilter,
      },
      _count: { id: true },
    });

    const paymentMap: Record<string, number> = {};
    for (const row of paymentsByStatus) {
      paymentMap[row.paymentStatus] = row._count.id;
    }

    // ─── Delivery KPIs ────────────────────────────────────────────
    const deliveriesByStatus = await this.prisma.deliveryRecord.groupBy({
      by: ['status'],
      where: {
        order: { storeId },
        createdAt: dateFilter,
      },
      _count: { id: true },
    });

    const deliveryMap: Record<string, number> = {};
    for (const row of deliveriesByStatus) {
      deliveryMap[row.status] = row._count.id;
    }

    // ─── Customer KPIs ────────────────────────────────────────────
    const totalCustomers = await this.prisma.customer.count({
      where: {
        orders: { some: { storeId } },
      },
    });

    const newCustomers = await this.prisma.customer.count({
      where: {
        createdAt: dateFilter,
        orders: { some: { storeId } },
      },
    });

    // ─── Previous-Period Comparison ───────────────────────────────
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs);
    const prevDateFilter = { gte: prevStartDate, lte: prevEndDate };

    const [prevBookedAgg, prevPaymentsAgg, prevRefundsAgg] = await Promise.all([
      this.prisma.order.aggregate({
        where: { storeId, orderDate: prevDateFilter },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { order: { storeId }, createdAt: prevDateFilter },
        _sum: { amount: true },
      }),
      this.prisma.financialAdjustment.aggregate({
        where: {
          order: { storeId },
          type: AdjustmentType.REFUND,
          status: AdjustmentStatus.COMPLETED,
          createdAt: prevDateFilter,
        },
        _sum: { amount: true },
      }),
    ]);

    const prevBooked = Number((prevBookedAgg._sum.totalAmount || 0).toFixed(2));
    const prevOrdersCount = prevBookedAgg._count.id || 0;
    const prevCollections = Number((prevPaymentsAgg._sum.amount || 0).toFixed(2));
    const prevRefunds = Number((prevRefundsAgg._sum.amount || 0).toFixed(2));
    const prevNetCollections = Number((prevCollections - prevRefunds).toFixed(2));

    const comparison: DashboardComparisonDTO = {
      previousPeriod: {
        startDate: prevStartDate.toISOString(),
        endDate: prevEndDate.toISOString(),
      },
      bookedOrderValue: createComparison(bookedOrderValue, prevBooked),
      collections: createComparison(collections, prevCollections),
      netCollections: createComparison(netCollections, prevNetCollections),
      totalOrders: createComparison(totalOrders, prevOrdersCount),
    };

    // ─── Trends (Daily Buckets) ───────────────────────────────────
    const [trendOrders, trendPayments, trendRefunds] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId, orderDate: dateFilter },
        select: { orderDate: true, totalAmount: true },
      }),
      this.prisma.payment.findMany({
        where: { order: { storeId }, createdAt: dateFilter },
        select: { createdAt: true, amount: true },
      }),
      this.prisma.financialAdjustment.findMany({
        where: {
          order: { storeId },
          type: AdjustmentType.REFUND,
          status: AdjustmentStatus.COMPLETED,
          createdAt: dateFilter,
        },
        select: { createdAt: true, amount: true },
      }),
    ]);

    // Build day buckets spanning startDate to endDate in Asia/Kolkata
    const startDayStr = formatKolkataDate(startDate);
    const endDayStr = formatKolkataDate(endDate);
    const curDate = new Date(`${startDayStr}T00:00:00.000+05:30`);
    const endLimitDate = new Date(`${endDayStr}T00:00:00.000+05:30`);

    const trendMap = new Map<string, DashboardTrendPoint>();
    while (curDate.getTime() <= endLimitDate.getTime()) {
      const bucketKey = formatKolkataDate(curDate);
      if (!trendMap.has(bucketKey)) {
        trendMap.set(bucketKey, {
          date: bucketKey,
          bookedOrderValue: 0,
          orderCount: 0,
          collections: 0,
          refunds: 0,
          netCollections: 0,
        });
      }
      curDate.setDate(curDate.getDate() + 1);
    }

    for (const o of trendOrders) {
      const key = formatKolkataDate(o.orderDate);
      const point = trendMap.get(key);
      if (point) {
        point.bookedOrderValue = Number((point.bookedOrderValue + o.totalAmount).toFixed(2));
        point.orderCount += 1;
      }
    }

    for (const p of trendPayments) {
      const key = formatKolkataDate(p.createdAt);
      const point = trendMap.get(key);
      if (point) {
        point.collections = Number((point.collections + p.amount).toFixed(2));
      }
    }

    for (const r of trendRefunds) {
      const key = formatKolkataDate(r.createdAt);
      const point = trendMap.get(key);
      if (point) {
        point.refunds = Number((point.refunds + r.amount).toFixed(2));
      }
    }

    for (const point of trendMap.values()) {
      point.netCollections = Number((point.collections - point.refunds).toFixed(2));
    }

    const trends: DashboardTrendsDTO = {
      interval: 'daily',
      points: Array.from(trendMap.values()),
    };

    // ─── Service & Category Breakdowns ────────────────────────────
    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: {
          storeId,
          orderDate: dateFilter,
        },
      },
      select: {
        quantity: true,
        lineTotal: true,
        serviceType: {
          select: { name: true, category: true },
        },
        garmentCatalog: {
          select: { category: true },
        },
      },
    });

    const serviceMap = new Map<string, DashboardServiceBreakdown>();
    const categoryMap = new Map<string, DashboardCategoryBreakdown>();

    for (const item of orderItems) {
      const sKey = item.serviceType?.name || 'Unknown';
      const sEntry = serviceMap.get(sKey) || {
        serviceName: item.serviceType?.name || 'Unknown',
        serviceCategory: item.serviceType?.category || 'OTHERS',
        itemCount: 0,
        totalAmount: 0,
      };
      sEntry.itemCount += item.quantity;
      sEntry.totalAmount = Number((sEntry.totalAmount + item.lineTotal).toFixed(2));
      serviceMap.set(sKey, sEntry);

      const cKey = item.garmentCatalog?.category || 'OTHERS';
      const cEntry = categoryMap.get(cKey) || {
        category: cKey,
        itemCount: 0,
        totalAmount: 0,
      };
      cEntry.itemCount += item.quantity;
      cEntry.totalAmount = Number((cEntry.totalAmount + item.lineTotal).toFixed(2));
      categoryMap.set(cKey, cEntry);
    }

    const serviceBreakdown = Array.from(serviceMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
    const categoryBreakdown = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );

    // ─── Action Queues (Bounded findMany) ─────────────────────────
    const mapToActionOrder = (o: any): DashboardActionOrder => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      customerPhone: o.customer.phone,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      amountDue: o.amountDue,
      status: o.status as unknown as SharedOrderStatus,
      effectiveDueDate: o.effectiveDueDate.toISOString(),
      orderDate: o.orderDate.toISOString(),
      itemCount: o._count.items,
    });

    const [
      overdueOrdersRaw,
      dueTodayOrdersRaw,
      dueTomorrowOrdersRaw,
      pendingPaymentOrdersRaw,
      pendingPaymentCount,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          storeId,
          effectiveDueDate: { lt: now },
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          status: true,
          effectiveDueDate: true,
          orderDate: true,
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { effectiveDueDate: 'asc' },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: {
          storeId,
          effectiveDueDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          status: true,
          effectiveDueDate: true,
          orderDate: true,
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { effectiveDueDate: 'asc' },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: {
          storeId,
          effectiveDueDate: { gte: tomorrowStart, lte: tomorrowEnd },
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          status: true,
          effectiveDueDate: true,
          orderDate: true,
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { effectiveDueDate: 'asc' },
        take: 20,
      }),
      this.prisma.order.findMany({
        where: {
          storeId,
          amountDue: { gt: 0 },
          status: { not: OrderStatus.CANCELLED },
        },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          status: true,
          effectiveDueDate: true,
          orderDate: true,
          customer: { select: { name: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { amountDue: 'desc' },
        take: 20,
      }),
      this.prisma.order.count({
        where: {
          storeId,
          amountDue: { gt: 0 },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ]);

    const actionQueues: DashboardActionQueuesDTO = {
      overdue: {
        count: overdueOrders,
        items: overdueOrdersRaw.map(mapToActionOrder),
      },
      dueToday: {
        count: dueTodayOrders,
        items: dueTodayOrdersRaw.map(mapToActionOrder),
      },
      dueTomorrow: {
        count: dueTomorrowOrders,
        items: dueTomorrowOrdersRaw.map(mapToActionOrder),
      },
      pendingPayment: {
        count: pendingPaymentCount,
        totalAmountDue: outstandingBalance,
        items: pendingPaymentOrdersRaw.map(mapToActionOrder),
      },
    };

    // ─── Ready Orders (orders with at least one READY item) ───────
    const readyOrdersRaw = await this.prisma.order.findMany({
      where: {
        storeId,
        orderDate: dateFilter,
        status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        items: { some: { itemStatus: ItemStatus.READY } },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        items: {
          select: {
            itemStatus: true,
            quantity: true,
            garmentCatalog: { select: { name: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 20,
    });

    const readyOrders = readyOrdersRaw.map((o) => {
      const readyItems = o.items
        .filter((i) => i.itemStatus === ItemStatus.READY)
        .map((i) => ({ garmentName: i.garmentCatalog.name, quantity: i.quantity }));
      const remainingItems = o.items
        .filter(
          (i) =>
            i.itemStatus !== ItemStatus.READY &&
            i.itemStatus !== ItemStatus.DELIVERED &&
            i.itemStatus !== ItemStatus.CANCELLED,
        )
        .map((i) => ({ garmentName: i.garmentCatalog.name, quantity: i.quantity }));

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer.name,
        customerPhone: o.customer.phone,
        totalAmount: o.totalAmount,
        amountPaid: o.amountPaid,
        amountDue: o.amountDue,
        readyItems,
        remainingItems,
      };
    });

    // ─── Recent Orders ────────────────────────────────────────────
    const recentOrdersRaw = await this.prisma.order.findMany({
      where: {
        storeId,
        orderDate: dateFilter,
      },
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { orderDate: 'desc' },
      take: 15,
    });

    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      itemCount: o._count.items,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      amountDue: o.amountDue,
      status: o.status as unknown as SharedOrderStatus,
      paymentStatus: o.paymentStatus,
      orderDate: o.orderDate.toISOString(),
    }));

    // ─── Recent Activity (from notifications) ─────────────────────
    const recentNotifications = await this.prisma.notification.findMany({
      where: {
        storeId,
        createdAt: dateFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        eventType: true,
        orderId: true,
        createdAt: true,
      },
    });

    // Look up order numbers for activities that have orderId
    const orderIds = recentNotifications.filter((n) => n.orderId).map((n) => n.orderId as string);
    const orderNumberMap: Record<string, string> = {};
    if (orderIds.length > 0) {
      const orders = await this.prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderNumber: true },
      });
      for (const o of orders) {
        orderNumberMap[o.id] = o.orderNumber;
      }
    }

    const eventMessages: Record<string, string> = {
      ORDER_CREATED: 'Order created',
      ORDER_READY: 'Order is ready',
      PAYMENT_RECEIVED: 'Payment received',
      ORDER_OUT_FOR_DELIVERY: 'Order out for delivery',
      ORDER_DELIVERED: 'Order delivered',
    };

    const recentActivity = recentNotifications.map((n) => ({
      id: n.id,
      eventType: n.eventType,
      orderNumber: n.orderId ? orderNumberMap[n.orderId] || null : null,
      message: eventMessages[n.eventType] || n.eventType,
      createdAt: n.createdAt.toISOString(),
    }));

    // ─── Assemble Response ────────────────────────────────────────
    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      overview: {
        totalOrders,
        totalItems,
        totalCustomers,
      },
      orders: {
        received: statusMap[OrderStatus.RECEIVED] || 0,
        sorting: statusMap[OrderStatus.SORTING] || 0,
        processing: statusMap[OrderStatus.PROCESSING] || 0,
        drying: statusMap[OrderStatus.DRYING] || 0,
        ironing: statusMap[OrderStatus.IRONING] || 0,
        qualityCheck: statusMap[OrderStatus.QUALITY_CHECK] || 0,
        packed: statusMap[OrderStatus.PACKED] || 0,
        ready: statusMap[OrderStatus.READY] || 0,
        outForDelivery: statusMap[OrderStatus.OUT_FOR_DELIVERY] || 0,
        delivered: statusMap[OrderStatus.DELIVERED] || 0,
        cancelled: statusMap[OrderStatus.CANCELLED] || 0,
        overdue: overdueOrders,
        dueToday: dueTodayOrders,
        dueTomorrow: dueTomorrowOrders,
      },
      financial: {
        // Preserved backward-compatible fields
        totalOrderValue: bookedOrderValue,
        amountPaid: collections,
        amountDue: outstandingBalance,
        paidOrders: paymentMap[PaymentStatus.PAID] || 0,
        partialOrders: paymentMap[PaymentStatus.PARTIAL] || 0,
        pendingOrders: paymentMap[PaymentStatus.PENDING] || 0,
        // Explicit Step 1 additions
        bookedOrderValue,
        collections,
        refunds,
        netCollections,
        outstandingBalance,
        collectionCount,
        refundCount,
      },
      delivery: {
        scheduled: deliveryMap[DeliveryStatus.SCHEDULED] || 0,
        assigned: deliveryMap[DeliveryStatus.ASSIGNED] || 0,
        inTransit: deliveryMap[DeliveryStatus.IN_TRANSIT] || 0,
        completed: deliveryMap[DeliveryStatus.COMPLETED] || 0,
        failed: deliveryMap[DeliveryStatus.FAILED] || 0,
      },
      customers: {
        total: totalCustomers,
        newInPeriod: newCustomers,
      },
      readyOrders,
      recentOrders,
      recentActivity,
      // Step 1 analytics aggregates
      trends,
      comparison,
      serviceBreakdown,
      categoryBreakdown,
      actionQueues,
    };
  }
}
