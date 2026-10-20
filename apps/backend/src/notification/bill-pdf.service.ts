import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GARMENT_COLLECTION_NOTICE,
  STAIN_REMOVAL_NOTICE,
  PaymentStatus,
} from '@growfast/shared-types';

export interface BillOrderData {
  orderNumber: string;
  orderDate: Date | string;
  effectiveDueDate?: Date | string | null;
  pickupType?: string;
  isExpress?: boolean;
  expressDeliveryOption?: string | null;
  expressSurcharge?: number | null;
  customerName?: string;
  customerCode?: string | null;
  customerPhone?: string | null;
  createdByName?: string | null;
  deliveredByName?: string | null;
  items: Array<{
    id?: string;
    garmentName: string;
    serviceType: string;
    quantity: number;
    weight?: number | null;
    unitPrice: number;
    lineTotal: number;
    itemStatus?: string;
    deliveredQuantity?: number;
    physicalGarments?: Array<{ isCancelled?: boolean }>;
  }>;
  subtotal: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount: number;
  amountPaid: number;
  refundAmount?: number;
  storeCreditAmount?: number;
  amountDue: number;
  paymentStatus: string;
  paymentMode?: string | null;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

@Injectable()
export class BillPdfService {
  private readonly logger = new Logger(BillPdfService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a PDF buffer for a given orderId and storeId.
   */
  async generateBillPdf(orderId: string, storeId?: string): Promise<Buffer> {
    const orderData = await this.fetchOrderData(orderId, storeId);
    if (!orderData) {
      throw new Error(`Order ${orderId} not found`);
    }
    return this.renderPdfFromOrderData(orderData);
  }

  /**
   * Fetch complete order details needed for the bill from the database.
   */
  async fetchOrderData(orderId: string, storeId?: string): Promise<BillOrderData | null> {
    const where: any = { id: orderId };
    if (storeId) where.storeId = storeId;

    const order = await this.prisma.order.findUnique({
      where,
      include: {
        customer: true,
        createdBy: true,
        deliveredBy: true,
        store: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        items: {
          include: {
            garmentCatalog: true,
            serviceType: true,
            physicalGarments: true,
          },
        },
      },
    });

    if (!order) return null;

    const paymentModes =
      order.payments && order.payments.length > 0
        ? Array.from(new Set(order.payments.map((p) => p.mode))).join(', ')
        : null;

    return {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      effectiveDueDate: order.effectiveDueDate || order.systemDueDate,
      pickupType: order.pickupType,
      isExpress: order.isExpress,
      expressDeliveryOption: order.expressDeliveryOption,
      expressSurcharge: order.expressSurcharge,
      customerName: order.customer?.name || 'Customer',
      customerCode: order.customer?.customerCode || null,
      customerPhone: order.customer?.phone || null,
      createdByName: order.createdBy?.name || 'Staff',
      deliveredByName: order.deliveredBy?.name || null,
      items: order.items.map((i) => ({
        id: i.id,
        garmentName: i.garmentCatalog?.name || 'Garment',
        serviceType: i.serviceType?.name || 'Standard',
        quantity: i.quantity,
        weight: i.weight,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        itemStatus: i.itemStatus,
        deliveredQuantity: i.deliveredQuantity,
        physicalGarments: i.physicalGarments.map((pg) => ({ isCancelled: pg.isCancelled })),
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      refundAmount: (order as any).refundAmount || 0,
      storeCreditAmount: (order as any).storeCreditAmount || 0,
      amountDue: order.amountDue,
      paymentStatus: order.paymentStatus,
      paymentMode: paymentModes,
      storeName: order.store?.name || 'GrowFast Laundry',
      storeAddress: order.store?.address || '',
      storePhone: order.store?.phone || '',
    };
  }

  /**
   * Render an HTML bill matching the layout and typography of OrderReceipt.tsx
   */
  generateBillHtml(order: BillOrderData): string {
    const formatCurrency = (val: number | undefined) => `₹${(val || 0).toFixed(2)}`;

    const formatDate = (isoString?: Date | string | null) => {
      if (!isoString) return '—';
      try {
        const d = typeof isoString === 'string' ? new Date(isoString) : isoString;
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return String(isoString);
      }
    };

    let totalActivePieces = 0;
    for (const item of order.items) {
      if (item.itemStatus === 'CANCELLED') continue;
      if (item.physicalGarments && item.physicalGarments.length > 0) {
        totalActivePieces += item.physicalGarments.filter((g) => !g.isCancelled).length;
      } else {
        totalActivePieces += item.quantity;
      }
    }

    const itemsHtml = order.items
      .map((item) => {
        const isCancelled = item.itemStatus === 'CANCELLED';
        const cancelledCount = item.physicalGarments?.filter((g) => g.isCancelled).length || 0;
        const weightRow =
          item.weight != null && item.weight > 0
            ? `<div style="font-size: 11px; color: #4338ca;">Weight: ${item.weight} kg @ ₹${item.unitPrice.toFixed(2)}/kg</div>`
            : '';
        const cancelledTag = isCancelled
          ? `<span style="font-size: 10px; font-weight: bold; color: #dc2626; text-transform: uppercase;">(Cancelled)</span>`
          : cancelledCount > 0
            ? `<span style="font-size: 10px; color: #dc2626;">(${cancelledCount} cancelled)</span>`
            : '';

        return `
          <tr style="${isCancelled ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
            <td style="padding: 8px 10px; border-bottom: 1px solid #f1f5f9;">
              <div style="font-weight: 600; color: #0f172a;">${this.escapeHtml(item.garmentName)}</div>
              <div style="font-size: 11px; color: #64748b;">${this.escapeHtml(item.serviceType)}</div>
              ${weightRow}
              ${cancelledTag}
            </td>
            <td style="padding: 8px 10px; text-align: center; border-bottom: 1px solid #f1f5f9; font-weight: 500;">
              ${item.weight != null && item.weight > 0 ? `${item.weight} kg` : item.quantity}
            </td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: monospace; color: #475569;">
              ${formatCurrency(item.unitPrice)}${item.weight != null && item.weight > 0 ? '/kg' : ''}
            </td>
            <td style="padding: 8px 10px; text-align: right; border-bottom: 1px solid #f1f5f9; font-family: monospace; font-weight: 600; color: #0f172a;">
              ${formatCurrency(item.lineTotal)}
            </td>
          </tr>
        `;
      })
      .join('');

    const expressLabel =
      (order.expressSurcharge ?? 0) > 0
        ? `
        <div style="display: flex; justify-content: space-between; color: #c2410c; margin-bottom: 4px;">
          <span>Express Surcharge ${
            order.expressDeliveryOption === 'SAME_DAY'
              ? '(Same-Day 2×)'
              : order.expressDeliveryOption === 'NEXT_DAY_EVENING'
                ? '(Tomorrow 1.5×)'
                : ''
          }</span>
          <span style="font-family: monospace;">+${formatCurrency(order.expressSurcharge ?? 0)}</span>
        </div>`
        : '';

    const discountRow =
      (order.discountAmount ?? 0) > 0
        ? `
        <div style="display: flex; justify-content: space-between; color: #15803d; margin-bottom: 4px;">
          <span>Discount</span>
          <span style="font-family: monospace;">-${formatCurrency(order.discountAmount)}</span>
        </div>`
        : '';

    const taxRow =
      (order.taxAmount ?? 0) > 0
        ? `
        <div style="display: flex; justify-content: space-between; color: #475569; margin-bottom: 4px;">
          <span>Tax (GST)</span>
          <span style="font-family: monospace;">+${formatCurrency(order.taxAmount)}</span>
        </div>`
        : '';

    const statusBadgeColor =
      order.paymentStatus === PaymentStatus.PAID
        ? 'background: #dcfce7; color: #166534;'
        : order.paymentStatus === PaymentStatus.PARTIAL
          ? 'background: #fef9c3; color: #854d0e;'
          : order.paymentStatus === PaymentStatus.REFUNDED
            ? 'background: #f3e8ff; color: #6b21a8;'
            : 'background: #fee2e2; color: #991b1b;';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${order.orderNumber}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 0;
          }
          .invoice-container {
            max-width: 720px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .brand-title {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #0f172a;
            margin: 0 0 2px 0;
          }
          .brand-sub {
            font-size: 11px;
            color: #475569;
            font-weight: 500;
            margin: 0;
          }
          .store-name {
            font-size: 13px;
            font-weight: 600;
            color: #1e293b;
            margin-top: 4px;
          }
          .store-contact {
            font-size: 11px;
            color: #64748b;
          }
          .meta-grid {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .meta-col {
            width: 48%;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
          }
          .meta-label {
            color: #64748b;
          }
          .meta-val {
            font-weight: 600;
            color: #0f172a;
            text-align: right;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            text-align: left;
            padding: 6px 10px;
            border-bottom: 2px solid #e2e8f0;
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
          }
          .financial-summary {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px;
          }
          .financial-box {
            width: 260px;
          }
          .fin-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
            color: #475569;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #cbd5e1;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
          }
          .due-row {
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            margin-top: 6px;
            font-size: 13px;
            font-weight: 900;
            color: ${order.amountDue > 0 ? '#dc2626' : '#16a34a'};
          }
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .notices {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px 12px;
            margin-top: 14px;
            font-size: 10px;
            color: #475569;
            line-height: 1.4;
          }
          .footer {
            text-align: center;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h1 class="brand-title">GROWFAST</h1>
            <p class="brand-sub">Laundry &amp; Dry-Cleaning Services</p>
            ${order.storeName ? `<div class="store-name">${this.escapeHtml(order.storeName)}</div>` : ''}
            ${order.storeAddress ? `<div class="store-contact">${this.escapeHtml(order.storeAddress)}</div>` : ''}
            ${order.storePhone ? `<div class="store-contact">Ph: ${this.escapeHtml(order.storePhone)}</div>` : ''}
          </div>

          <div class="meta-grid">
            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-label">ORDER NUMBER</span>
                <span class="meta-val" style="font-family: monospace; font-size: 13px;">#${order.orderNumber}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Order Date:</span>
                <span class="meta-val">${formatDate(order.orderDate)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Due Date:</span>
                <span class="meta-val">${formatDate(order.effectiveDueDate)}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Pickup Type:</span>
                <span class="meta-val">${order.pickupType === 'STORE_PICKUP' ? 'Store Counter' : 'Home Delivery'}</span>
              </div>
              ${
                order.isExpress
                  ? `<div class="meta-row" style="color: #dc2626; font-weight: bold;">
                      <span>Priority:</span>
                      <span>${
                        order.expressDeliveryOption === 'SAME_DAY'
                          ? 'SAME-DAY EXPRESS (2×)'
                          : order.expressDeliveryOption === 'NEXT_DAY_EVENING'
                            ? 'NEXT-DAY EXPRESS (1.5×)'
                            : 'EXPRESS DELIVERY'
                      }</span>
                    </div>`
                  : ''
              }
            </div>

            <div class="meta-col">
              <div class="meta-row">
                <span class="meta-label">Customer:</span>
                <span class="meta-val">${this.escapeHtml(order.customerName || 'Customer')}</span>
              </div>
              ${
                order.customerCode
                  ? `<div class="meta-row">
                      <span class="meta-label">Customer ID:</span>
                      <span class="meta-val" style="font-family: monospace;">${this.escapeHtml(order.customerCode)}</span>
                    </div>`
                  : ''
              }
              ${
                order.customerPhone
                  ? `<div class="meta-row">
                      <span class="meta-label">Phone:</span>
                      <span class="meta-val">${this.escapeHtml(order.customerPhone)}</span>
                    </div>`
                  : ''
              }
              <div class="meta-row">
                <span class="meta-label">Created By:</span>
                <span class="meta-val">${this.escapeHtml(order.createdByName || 'Staff')}</span>
              </div>
              ${
                order.paymentMode
                  ? `<div class="meta-row">
                      <span class="meta-label">Payment Mode:</span>
                      <span class="meta-val">${this.escapeHtml(order.paymentMode)}</span>
                    </div>`
                  : ''
              }
            </div>
          </div>

          <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase;">
            Order Items (${totalActivePieces} Pieces)
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Item / Service</th>
                <th style="width: 14%; text-align: center;">Qty</th>
                <th style="width: 18%; text-align: right;">Rate</th>
                <th style="width: 18%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="financial-summary">
            <div class="financial-box">
              <div class="fin-row">
                <span>Subtotal</span>
                <span style="font-family: monospace;">${formatCurrency(order.subtotal)}</span>
              </div>
              ${discountRow}
              ${expressLabel}
              ${taxRow}
              <div class="total-row">
                <span>Total Amount</span>
                <span style="font-family: monospace;">${formatCurrency(order.totalAmount)}</span>
              </div>
              <div class="fin-row" style="margin-top: 4px;">
                <span>Amount Paid</span>
                <span style="font-family: monospace;">${formatCurrency(order.amountPaid)}</span>
              </div>
              ${
                (order.refundAmount ?? 0) > 0
                  ? `<div class="fin-row" style="color: #dc2626;"><span>Refunded</span><span style="font-family: monospace;">-${formatCurrency(order.refundAmount)}</span></div>`
                  : ''
              }
              ${
                (order.storeCreditAmount ?? 0) > 0
                  ? `<div class="fin-row" style="color: #7c3aed;"><span>Store Credit</span><span style="font-family: monospace;">-${formatCurrency(order.storeCreditAmount)}</span></div>`
                  : ''
              }
              <div class="due-row">
                <span>Balance Due</span>
                <span style="font-family: monospace;">${formatCurrency(order.amountDue)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                <span style="font-size: 11px; color: #64748b;">Payment Status:</span>
                <span class="badge" style="${statusBadgeColor}">${order.paymentStatus}</span>
              </div>
            </div>
          </div>

          <div class="notices">
            <div style="margin-bottom: 4px;">
              <strong>Garment collection notice:</strong> ${GARMENT_COLLECTION_NOTICE}
            </div>
            <div>
              <strong>Stain removal notice:</strong> ${STAIN_REMOVAL_NOTICE}
            </div>
          </div>

          <div class="footer">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">Thank you for choosing GrowFast!</div>
            <div>Please retain this receipt for collection.</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render HTML to PDF buffer using Playwright Chromium with fallback.
   */
  async renderPdfFromOrderData(orderData: BillOrderData): Promise<Buffer> {
    const html = this.generateBillHtml(orderData);

    try {
      // Dynamic import so tests or non-playwright environments do not break on import
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
      });
      await browser.close();
      return pdfBuffer;
    } catch (err: any) {
      this.logger.warn(
        `Playwright PDF generation unavailable (${err.message}). Using compliant fallback PDF generator.`,
      );
      return this.generateFallbackPdf(orderData);
    }
  }

  /**
   * Compliant minimal fallback PDF generator in pure TypeScript/Buffer without external dependencies.
   * Ensures that PDF generation never throws a fatal crash even if Chromium is not present in the runtime.
   */
  private generateFallbackPdf(order: BillOrderData): Buffer {
    const escapePdf = (text: string) =>
      text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

    const lines: string[] = [
      'GROWFAST LAUNDRY & DRY-CLEANING',
      `Store: ${order.storeName || 'GrowFast'}`,
      `Order Number: #${order.orderNumber}`,
      `Customer: ${order.customerName || 'Customer'} (Ph: ${order.customerPhone || 'N/A'})`,
      `Date: ${new Date(order.orderDate).toLocaleDateString('en-IN')}`,
      `Due Date: ${order.effectiveDueDate ? new Date(order.effectiveDueDate).toLocaleDateString('en-IN') : 'N/A'}`,
      '------------------------------------------------------------',
      'ITEMS:',
    ];

    for (const item of order.items) {
      lines.push(
        `• ${item.quantity}x ${item.garmentName} (${item.serviceType}) - Rs. ${item.lineTotal.toFixed(2)}`,
      );
    }

    lines.push('------------------------------------------------------------');
    lines.push(`Subtotal: Rs. ${order.subtotal.toFixed(2)}`);
    if ((order.discountAmount ?? 0) > 0) {
      lines.push(`Discount: -Rs. ${(order.discountAmount ?? 0).toFixed(2)}`);
    }
    if ((order.expressSurcharge ?? 0) > 0) {
      lines.push(`Express Surcharge: +Rs. ${(order.expressSurcharge ?? 0).toFixed(2)}`);
    }
    if ((order.taxAmount ?? 0) > 0) {
      lines.push(`GST: +Rs. ${(order.taxAmount ?? 0).toFixed(2)}`);
    }
    lines.push(`TOTAL AMOUNT: Rs. ${order.totalAmount.toFixed(2)}`);
    lines.push(`AMOUNT PAID: Rs. ${order.amountPaid.toFixed(2)}`);
    lines.push(`BALANCE DUE: Rs. ${order.amountDue.toFixed(2)}`);
    lines.push(`Payment Status: ${order.paymentStatus}`);
    lines.push('------------------------------------------------------------');
    lines.push('Thank you for choosing GrowFast!');

    let stream = 'BT /F1 10 Tf 50 780 Td 14 TL\n';
    for (const line of lines) {
      stream += `(${escapePdf(line)}) '\n`;
    }
    stream += 'ET';

    const streamLength = Buffer.byteLength(stream);

    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamLength} >>
stream
${stream}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000305 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
385
%%EOF`;

    return Buffer.from(pdfContent, 'utf-8');
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
