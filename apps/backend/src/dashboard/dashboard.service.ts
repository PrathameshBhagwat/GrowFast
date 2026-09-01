import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardSummaryDTO } from '@growfast/shared-types';
import { OrderStatus, DeliveryStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the dashboard summary for a store within a date range.
   *
   * All queries use database-side aggregation (count, aggregate, groupBy).
   * Uses persisted Order.status (canonical, maintained by B8/C5).
   * Uses persisted Order.amountPaid/amountDue (canonical, maintained by C4).
   * Uses DeliveryRecord.status (authoritative, maintained by C5).
   * Dashboard is STRICTLY READ-ONLY — zero mutations.
   */
  async getSummary(storeId: string, startDate: Date, endDate: Date): Promise<DashboardSummaryDTO> {
    const dateFilter = {
      gte: startDate,
      lte: endDate,
    };

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

    // ─── Overdue Orders ───────────────────────────────────────────
    const now = new Date();
    const overdueOrders = await this.prisma.order.count({
      where: {
        storeId,
        orderDate: dateFilter,
        effectiveDueDate: { lt: now },
        status: {
          notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
        },
      },
    });

    // ─── Due Today ────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dueTodayOrders = await this.prisma.order.count({
      where: {
        storeId,
        orderDate: dateFilter,
        effectiveDueDate: { gte: todayStart, lte: todayEnd },
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

    // ─── Financial KPIs (database-side aggregate) ─────────────────
    const financialAgg = await this.prisma.order.aggregate({
      where: {
        storeId,
        orderDate: dateFilter,
      },
      _sum: {
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
      },
    });

    // ─── Payment Status Counts (database-side groupBy) ────────────
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

    // ─── Delivery KPIs (database-side groupBy) ────────────────────
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
      },
      financial: {
        totalOrderValue: financialAgg._sum.totalAmount || 0,
        amountPaid: financialAgg._sum.amountPaid || 0,
        amountDue: financialAgg._sum.amountDue || 0,
        paidOrders: paymentMap[PaymentStatus.PAID] || 0,
        partialOrders: paymentMap[PaymentStatus.PARTIAL] || 0,
        pendingOrders: paymentMap[PaymentStatus.PENDING] || 0,
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
    };
  }
}
