import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrderReceipt } from './OrderReceipt';
import { OrderReceiptModal } from './OrderReceiptModal';
import {
  OrderDetailDTO,
  OrderStatus,
  PaymentStatus,
  PickupType,
  OrderPriority,
  GarmentCategory,
  ServiceCategory,
  ItemStatus,
  PaymentMode,
  AdjustmentType,
  AdjustmentStatus,
} from '@growfast/shared-types';

describe('OrderReceipt Component & Modal (Phase 4E)', () => {
  const baseOrder: OrderDetailDTO = {
    id: 'ord-test-101',
    orderNumber: 'ORD-101',
    customerId: 'cust-1',
    customerName: 'Amit Shah',
    customerPhone: '9876543210',
    orderDate: '2026-09-07T10:00:00.000Z',
    systemDueDate: '2026-09-09T18:00:00.000Z',
    effectiveDueDate: '2026-09-09T18:00:00.000Z',
    dueDateOverrideReason: null,
    dueDateOverriddenBy: null,
    isExpress: false,
    priority: OrderPriority.STANDARD,
    status: OrderStatus.RECEIVED,
    subtotal: 650,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 650,
    amountPaid: 500,
    amountDue: 150,
    refundAmount: 0,
    storeCreditAmount: 0,
    effectivePaid: 500,
    paymentStatus: PaymentStatus.PARTIAL,
    pickupType: PickupType.STORE_PICKUP,
    serviceSummary: 'Dry Clean & Ironing',
    storeId: 'store-kp-001',
    storeName: 'GrowFast Koramangala',
    storeAddress: '123 Main Road, 4th Block, Bengaluru',
    storePhone: '+91 80 2345 6789',
    createdById: 'emp-1',
    createdByName: 'Kiran Rao',
    itemCount: 3,
    readyAmount: 0,
    remainingAmount: 650,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 650,
    items: [
      {
        id: 'item-1',
        garmentName: 'Formal Shirt',
        garmentCategory: GarmentCategory.MEN,
        serviceType: ServiceCategory.DRY_CLEAN,
        quantity: 2,
        unitPrice: 200,
        lineTotal: 400,
        colorTags: ['Blue', 'White'],
        defectNotes: null,
        itemStatus: ItemStatus.PROCESSING,
        deliveredQuantity: 0,
        itemDueDate: null,
        physicalGarments: [
          {
            id: 'pg-1',
            orderItemId: 'item-1',
            unitNumber: 1,
            isReady: false,
            isCancelled: false,
            isDelivered: false,
            createdAt: '2026-09-07T10:00:00.000Z',
            updatedAt: '2026-09-07T10:00:00.000Z',
          },
          {
            id: 'pg-2',
            orderItemId: 'item-1',
            unitNumber: 2,
            isReady: false,
            isCancelled: false,
            isDelivered: false,
            createdAt: '2026-09-07T10:00:00.000Z',
            updatedAt: '2026-09-07T10:00:00.000Z',
          },
        ],
      },
      {
        id: 'item-2',
        garmentName: 'Trouser',
        garmentCategory: GarmentCategory.MEN,
        serviceType: ServiceCategory.STEAM_PRESS,
        quantity: 1,
        unitPrice: 250,
        lineTotal: 250,
        colorTags: null,
        defectNotes: null,
        itemStatus: ItemStatus.PROCESSING,
        deliveredQuantity: 0,
        itemDueDate: null,
      },
    ],
    payments: [
      {
        id: 'pay-1',
        orderId: 'ord-test-101',
        amount: 500,
        mode: PaymentMode.UPI,
        reference: 'UPI-98765',
        receivedById: 'emp-1',
        receivedByName: 'Kiran Rao',
        createdAt: '2026-09-07T10:05:00.000Z',
      },
    ],
    adjustments: [],
  };

  it('1. Receipt renders correct order number and store info', () => {
    render(<OrderReceipt order={baseOrder} />);
    expect(screen.getByText(/#ORD-101/)).toBeInTheDocument();
    expect(screen.getByText('GrowFast Koramangala')).toBeInTheDocument();
    expect(screen.getByText(/123 Main Road/)).toBeInTheDocument();
  });

  it('2. Receipt renders customer information', () => {
    render(<OrderReceipt order={baseOrder} />);
    expect(screen.getByText('Amit Shah')).toBeInTheDocument();
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('Store Counter')).toBeInTheDocument();
  });

  it('3. Receipt renders item rows with services and quantities', () => {
    render(<OrderReceipt order={baseOrder} />);
    expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
    expect(screen.getByText('DRY_CLEAN')).toBeInTheDocument();
    expect(screen.getByText('Trouser')).toBeInTheDocument();
    expect(screen.getByText('STEAM_PRESS')).toBeInTheDocument();
    expect(screen.getByText('₹400.00')).toBeInTheDocument();
    expect(screen.getAllByText('₹250.00').length).toBeGreaterThanOrEqual(1);
  });

  it('4, 5, 6, 7. Receipt renders authoritative financial values and payment status', () => {
    render(<OrderReceipt order={baseOrder} />);
    const totalElements = screen.getAllByText('₹650.00');
    expect(totalElements.length).toBeGreaterThanOrEqual(1);
    const paidElements = screen.getAllByText('₹500.00');
    expect(paidElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('₹150.00')).toBeInTheDocument(); // balance due
    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
  });

  it('8 & 17. Receipt renders refund and store credit adjustments when present and maintains consistency', () => {
    const adjustedOrder: OrderDetailDTO = {
      ...baseOrder,
      amountPaid: 650,
      refundAmount: 100,
      storeCreditAmount: 50,
      effectivePaid: 500,
      amountDue: 150,
      adjustments: [
        {
          id: 'adj-1',
          orderId: baseOrder.id,
          type: AdjustmentType.REFUND,
          amount: 100,
          reason: 'Piece cancellation',
          status: AdjustmentStatus.COMPLETED,
          reference: 'REF-123',
          createdById: 'emp-1',
          createdByName: 'Owner',
          createdAt: '2026-09-07T11:00:00.000Z',
          updatedAt: '2026-09-07T11:00:00.000Z',
        },
        {
          id: 'adj-2',
          orderId: baseOrder.id,
          type: AdjustmentType.STORE_CREDIT,
          amount: 50,
          reason: 'Goodwill gesture',
          status: AdjustmentStatus.COMPLETED,
          reference: 'SC-456',
          createdById: 'emp-1',
          createdByName: 'Owner',
          createdAt: '2026-09-07T11:05:00.000Z',
          updatedAt: '2026-09-07T11:05:00.000Z',
        },
      ],
    };

    render(<OrderReceipt order={adjustedOrder} />);
    expect(screen.getAllByText('-₹100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('-₹50.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Piece cancellation/)).toBeInTheDocument();
  });

  it('9 & 14. Fully delivered order receipt shows completion data', () => {
    const deliveredOrder: OrderDetailDTO = {
      ...baseOrder,
      status: OrderStatus.DELIVERED,
      deliveredAt: '2026-09-07T14:30:00.000Z',
      deliveredByName: 'Prathamesh Bhagwat',
      amountDue: 0,
      amountPaid: 650,
      paymentStatus: PaymentStatus.PAID,
    };

    render(<OrderReceipt order={deliveredOrder} />);
    expect(screen.getByText(/ORDER COMPLETELY DELIVERED/)).toBeInTheDocument();
    expect(screen.getByText(/Delivered by: Prathamesh Bhagwat/)).toBeInTheDocument();
  });

  it('13. Partial order receipt displays partial handover in progress, NOT fully delivered', () => {
    const partialOrder: OrderDetailDTO = {
      ...baseOrder,
      status: OrderStatus.PROCESSING,
      items: [
        {
          ...baseOrder.items[0],
          deliveredQuantity: 1,
          physicalGarments: [
            {
              ...baseOrder.items[0].physicalGarments![0],
              isDelivered: true,
              isReady: true,
            },
            {
              ...baseOrder.items[0].physicalGarments![1],
              isDelivered: false,
              isReady: true,
            },
          ],
        },
        baseOrder.items[1],
      ],
    };

    render(<OrderReceipt order={partialOrder} />);
    expect(screen.getByText(/PARTIAL HANDOVER IN PROGRESS/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 pieces collected/)).toBeInTheDocument();
    expect(screen.getByText(/2 piece\(s\) remaining for collection/)).toBeInTheDocument();
    expect(screen.queryByText(/ORDER COMPLETELY DELIVERED/)).not.toBeInTheDocument();
  });

  it('15 & 16. Cancelled physical garments are excluded from active delivery count in mixed order', () => {
    const mixedCancelledOrder: OrderDetailDTO = {
      ...baseOrder,
      items: [
        {
          ...baseOrder.items[0],
          deliveredQuantity: 1,
          physicalGarments: [
            {
              ...baseOrder.items[0].physicalGarments![0],
              isDelivered: true,
              isReady: true,
            },
            {
              ...baseOrder.items[0].physicalGarments![1],
              isCancelled: true,
            },
          ],
        },
        {
          ...baseOrder.items[1],
          deliveredQuantity: 1, // legacy delivered
        },
      ],
      status: OrderStatus.DELIVERED,
      amountDue: 0,
      amountPaid: 650,
      deliveredAt: '2026-09-07T15:00:00.000Z',
      deliveredByName: 'Prathamesh Bhagwat',
    };

    render(<OrderReceipt order={mixedCancelledOrder} />);
    expect(screen.getByText(/ORDER COMPLETELY DELIVERED/)).toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
  });

  it('10, 11 & 18. OrderReceiptModal: format toggle changes layout, print button triggers window.print, double click is safe', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const onClose = vi.fn();

    render(<OrderReceiptModal open={true} onClose={onClose} order={baseOrder} />);

    // Standard button active by default
    const standardBtn = screen.getByRole('button', { name: /standard \(a4\)/i });
    const thermalBtn = screen.getByRole('button', { name: /thermal \(80mm\)/i });
    expect(standardBtn).toBeInTheDocument();
    expect(thermalBtn).toBeInTheDocument();

    // Switch to thermal format
    fireEvent.click(thermalBtn);
    const receiptElem = document.getElementById('printable-receipt');
    expect(receiptElem?.className).toContain('receipt-thermal');

    // Switch back to standard format
    fireEvent.click(standardBtn);
    expect(receiptElem?.className).toContain('receipt-standard');

    // Trigger Print
    const printBtn = screen.getByRole('button', { name: /print receipt/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Repeated click
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(2);

    printSpy.mockRestore();
  });

  it('19, 20, 21, 22. All modal controls satisfy >=44px touch targets', () => {
    render(<OrderReceiptModal open={true} onClose={vi.fn()} order={baseOrder} />);

    const standardBtn = screen.getByRole('button', { name: /standard \(a4\)/i });
    const thermalBtn = screen.getByRole('button', { name: /thermal \(80mm\)/i });
    const closeBtn = document.getElementById('close-receipt-modal-btn');
    const printBtn = screen.getByRole('button', { name: /print receipt/i });

    expect(standardBtn.className).toContain('min-h-[44px]');
    expect(thermalBtn.className).toContain('min-h-[44px]');
    expect(closeBtn?.style.minHeight).toBe('44px');
    expect(printBtn.style.minHeight).toBe('44px');
  });
});
