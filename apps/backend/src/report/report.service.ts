import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import {
  DailyOrdersReportQueryDTO,
  DailyOrdersReportResponseDTO,
  DailyOrderReportRowDTO,
  DailyOrdersReportSummaryDTO,
  roundCurrency,
  OrderStatus,
  PaymentStatus,
} from '@growfast/shared-types';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Generates the Daily Orders Report for the authenticated user's store.
   * Strictly enforces store isolation.
   */
  async getDailyOrdersReport(
    storeId: string,
    query: DailyOrdersReportQueryDTO,
  ): Promise<DailyOrdersReportResponseDTO> {
    const timeZone = query.timezone || 'Asia/Kolkata';
    const { startDate, endDate } = this.parseDateRange(query.startDate, query.endDate, timeZone);

    const where: any = {
      storeId,
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Filter: Customer
    if (query.customerId && query.customerId.trim() && query.customerId !== 'all') {
      where.customerId = query.customerId.trim();
    }

    // Filter: Order Number
    if (query.orderNumber && query.orderNumber.trim()) {
      where.orderNumber = {
        contains: query.orderNumber.trim(),
        mode: 'insensitive',
      };
    }

    // Filter: User (Created By)
    if (query.userId && query.userId.trim() && query.userId !== 'all') {
      where.createdById = query.userId.trim();
    }

    // Filter: Discount
    if (query.hasDiscount === 'with') {
      where.discountAmount = { gt: 0 };
    } else if (query.hasDiscount === 'without') {
      where.discountAmount = 0;
    }

    // Filter: Status / Payment Status
    if (query.filterBy && query.filterBy.trim() && query.filterBy !== 'all') {
      const fb = query.filterBy.trim().toUpperCase();
      if (['PAID', 'PARTIAL', 'PENDING', 'REFUNDED'].includes(fb)) {
        where.paymentStatus = fb as PaymentStatus;
      } else if (
        [
          'RECEIVED',
          'SORTING',
          'PROCESSING',
          'DRYING',
          'IRONING',
          'QUALITY_CHECK',
          'PACKED',
          'READY',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'CANCELLED',
        ].includes(fb)
      ) {
        where.status = fb as OrderStatus;
      }
    }

    // Filter: Order Type
    if (query.orderType && query.orderType.trim() && query.orderType.toLowerCase() !== 'all') {
      const ot = query.orderType.trim().toLowerCase();
      if (ot === 'weight_based' || ot === 'weight based') {
        where.items = {
          some: {
            OR: [
              { weight: { gt: 0 } },
              { garmentCatalog: { category: 'WEIGHT_BASED' } },
            ],
          },
        };
      } else if (ot === 'dry_cleaning' || ot === 'dry cleaning') {
        where.items = {
          some: {
            serviceType: {
              name: { contains: 'dry clean', mode: 'insensitive' },
            },
          },
        };
      } else if (ot === 'laundry') {
        where.items = {
          some: {
            serviceType: {
              name: {
                in: ['Standard Wash', 'Steam Iron', 'Wash + Steam Iron', 'Starching', 'Starching Dc'],
                mode: 'insensitive',
              },
            },
          },
        };
      } else if (ot === 'shoe_cleaning' || ot === 'shoe cleaning') {
        where.items = {
          some: {
            serviceType: {
              name: { contains: 'shoe', mode: 'insensitive' },
            },
          },
        };
      } else if (ot === 'laundry_dry_cleaning' || ot === 'laundry & dry cleaning') {
        where.items = {
          some: {
            serviceType: {
              name: {
                contains: 'clean',
                mode: 'insensitive',
              },
            },
          },
        };
      }
    }

    const isExport = Boolean(query.export);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = isExport ? 5000 : Math.max(1, Number(query.pageSize) || 10);
    const skip = isExport ? 0 : (page - 1) * pageSize;

    // Fetch orders and total count
    const [orders, totalCount, allMatchingForSummary] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          createdBy: { select: { id: true, name: true, role: true } },
          items: {
            include: {
              serviceType: true,
              garmentCatalog: true,
            },
          },
          adjustments: true,
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
      // To compute exact summary metrics for all matching orders (lightweight query)
      this.prisma.order.findMany({
        where,
        select: {
          subtotal: true,
          discountAmount: true,
          totalAmount: true,
          amountPaid: true,
          amountDue: true,
          paymentStatus: true,
          items: {
            select: {
              quantity: true,
              weight: true,
            },
          },
          adjustments: {
            select: {
              amount: true,
              type: true,
              status: true,
            },
          },
        },
      }),
    ]);

    // Format rows
    const data: DailyOrderReportRowDTO[] = orders.map((order) => {
      const financial = this.paymentService.calculateOrderFinancialState(order);

      const pieces = order.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
      const totalItemWeight = order.items.reduce((sum, it) => sum + (it.weight || 0), 0);
      const weight = totalItemWeight > 0 ? Number(totalItemWeight.toFixed(2)) : null;

      const grossAmount = roundCurrency(order.subtotal);
      const discount = roundCurrency(order.discountAmount);
      // Net Amount = order.totalAmount (or subtotal - discount)
      const netAmount = roundCurrency(order.totalAmount);
      const advance = roundCurrency(financial.effectivePaid);
      const balance = roundCurrency(financial.amountDue);

      const formattedOrderDate = this.formatDateTime(order.orderDate, timeZone);
      const formattedDueDate = this.formatDateOnly(order.effectiveDueDate, timeZone);

      // Order type summary
      let orderTypeSummary = 'Laundry';
      const hasDryClean = order.items.some((i) =>
        i.serviceType?.name?.toLowerCase().includes('dry clean'),
      );
      const hasLaundry = order.items.some(
        (i) =>
          i.serviceType?.name?.toLowerCase().includes('wash') ||
          i.serviceType?.name?.toLowerCase().includes('iron'),
      );
      if (hasDryClean && hasLaundry) {
        orderTypeSummary = 'Laundry & Dry Cleaning';
      } else if (hasDryClean) {
        orderTypeSummary = 'Dry Cleaning';
      } else if (order.items.some((i) => (i.weight || 0) > 0)) {
        orderTypeSummary = 'Weight Based';
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate.toISOString(),
        formattedOrderDate,
        customerCode: order.customer?.customerCode || `CUST-${order.customer?.phone?.slice(-4) || '0000'}`,
        customerName: order.customer?.name || 'Walk-in Customer',
        customerAddress: order.customer?.address || 'Store Walk-in',
        customerPhone: order.customer?.phone || '',
        dueDate: order.effectiveDueDate.toISOString(),
        formattedDueDate,
        pieces,
        weight,
        grossAmount,
        discount,
        netAmount,
        advance,
        balance,
        status: order.status as OrderStatus,
        paymentStatus: financial.paymentStatus as PaymentStatus,
        orderTypeSummary,
        createdByName: order.createdBy?.name || 'Staff',
        createdById: order.createdById,
      };
    });

    // Compute Summary across all matching orders
    let totalPieces = 0;
    let totalWeight = 0;
    let totalGrossAmount = 0;
    let totalDiscount = 0;
    let totalNetAmount = 0;
    let totalAdvance = 0;
    let totalBalance = 0;

    for (const ord of allMatchingForSummary) {
      const fin = this.paymentService.calculateOrderFinancialState(ord as any);
      const ordPieces = ord.items.reduce((sum, it) => sum + (it.quantity || 0), 0);
      const ordWeight = ord.items.reduce((sum, it) => sum + (it.weight || 0), 0);

      totalPieces += ordPieces;
      totalWeight += ordWeight;
      totalGrossAmount += ord.subtotal || 0;
      totalDiscount += ord.discountAmount || 0;
      totalNetAmount += ord.totalAmount || 0;
      totalAdvance += fin.effectivePaid || 0;
      totalBalance += fin.amountDue || 0;
    }

    const summary: DailyOrdersReportSummaryDTO = {
      totalOrders: totalCount,
      totalPieces,
      totalWeight: Number(totalWeight.toFixed(2)),
      totalGrossAmount: roundCurrency(totalGrossAmount),
      totalDiscount: roundCurrency(totalDiscount),
      totalNetAmount: roundCurrency(totalNetAmount),
      totalAdvance: roundCurrency(totalAdvance),
      totalBalance: roundCurrency(totalBalance),
    };

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    return {
      success: true,
      data,
      total: totalCount,
      page,
      pageSize,
      totalPages,
      summary,
    };
  }

  /**
   * Helper to parse dates into boundary Date objects in a specific timezone
   */
  private parseDateRange(
    startDateStr?: string,
    endDateStr?: string,
    timeZone: string = 'Asia/Kolkata',
  ): { startDate: Date; endDate: Date } {
    const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    let startDate: Date;
    let endDate: Date;

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(new Date());

    if (startDateStr && startDateStr.trim()) {
      const s = startDateStr.trim();
      if (DATE_ONLY_REGEX.test(s)) {
        startDate = new Date(`${s}T00:00:00.000+05:30`);
      } else {
        startDate = new Date(s);
      }
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException(`Invalid startDate: "${startDateStr}"`);
      }
    } else {
      startDate = new Date(`${todayStr}T00:00:00.000+05:30`);
    }

    if (endDateStr && endDateStr.trim()) {
      const e = endDateStr.trim();
      if (DATE_ONLY_REGEX.test(e)) {
        endDate = new Date(`${e}T23:59:59.999+05:30`);
      } else {
        endDate = new Date(e);
      }
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException(`Invalid endDate: "${endDateStr}"`);
      }
    } else {
      endDate = new Date(`${todayStr}T23:59:59.999+05:30`);
    }

    if (startDate > endDate) {
      throw new BadRequestException('startDate must be before or equal to endDate');
    }

    return { startDate, endDate };
  }

  /**
   * Format: "19 Oct 2026, 09:41"
   */
  private formatDateTime(date: Date, timeZone: string): string {
    const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone }).format(date);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone }).format(date);
    const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone }).format(date);
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(date);

    return `${day} ${month} ${year}, ${time}`;
  }

  /**
   * Format: "25 Oct 2026"
   */
  private formatDateOnly(date: Date, timeZone: string): string {
    const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone }).format(date);
    const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone }).format(date);
    const year = new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone }).format(date);

    return `${day} ${month} ${year}`;
  }
}
