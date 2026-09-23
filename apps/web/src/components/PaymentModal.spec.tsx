import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentModal } from './PaymentModal';
import {
  OrderDetailDTO,
  OrderStatus,
  PaymentStatus,
  PickupType,
  OrderPriority,
  GarmentCategory,
  ServiceCategory,
  ItemStatus,
} from '@growfast/shared-types';

describe('PaymentModal Component — Payment Completion & Post-Payment UX', () => {
  const baseOrder: OrderDetailDTO = {
    id: 'ord-test-pay-1',
    orderNumber: 'ORD-PAY-1',
    customerId: 'cust-1',
    customerName: 'Rahul Sharma',
    customerPhone: '9876543210',
    orderDate: '2026-09-11T10:00:00.000Z',
    systemDueDate: '2026-09-13T18:00:00.000Z',
    effectiveDueDate: '2026-09-13T18:00:00.000Z',
    dueDateOverrideReason: null,
    dueDateOverriddenBy: null,
    isExpress: false,
    priority: OrderPriority.STANDARD,
    status: OrderStatus.RECEIVED,
    subtotal: 700,
    discountAmount: 0,
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 700,
    amountPaid: 0,
    amountDue: 700,
    refundAmount: 0,
    storeCreditAmount: 0,
    effectivePaid: 0,
    paymentStatus: PaymentStatus.PENDING,
    pickupType: PickupType.STORE_PICKUP,
    serviceSummary: 'Dry Clean',
    storeId: 'store-1',
    createdById: 'emp-1',
    createdByName: 'Staff',
    itemCount: 1,
    readyAmount: 0,
    remainingAmount: 700,
    collectedAmount: 0,
    cancelledAmount: 0,
    payableAmount: 700,
    items: [
      {
        id: 'item-1',
        garmentName: 'Coat',
        garmentCategory: GarmentCategory.MEN,
        serviceType: ServiceCategory.DRY_CLEAN,
        quantity: 1,
        unitPrice: 700,
        lineTotal: 700,
        colorTags: null,
        defectNotes: null,
        itemStatus: ItemStatus.PROCESSING,
        deliveredQuantity: 0,
        itemDueDate: null,
      },
    ],
    payments: [],
    adjustments: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('growfast_token', 'mock-valid-jwt');
  });

  it('1. Form disables submit button when payment amount is invalid or zero', () => {
    render(<PaymentModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    expect(submitBtn).toBeDisabled();

    const input = screen.getByLabelText(/Payment Amount/i);
    fireEvent.change(input, { target: { value: '0' } });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '800' } }); // Exceeds balance
    expect(submitBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: '500' } });
    expect(submitBtn).not.toBeDisabled();
  });

  it('2. Full payment transitions to verified success screen without falsely closing', async () => {
    const onSuccessMock = vi.fn().mockImplementation(async () => {
      // simulate order refresh to fully paid
      baseOrder.amountPaid = 700;
      baseOrder.amountDue = 0;
      baseOrder.paymentStatus = PaymentStatus.PAID;
    });
    const onOpenReceiptMock = vi.fn();
    const onOpenReceiptAndPrintMock = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pay-new', amount: 700 }),
    } as Response);

    render(
      <PaymentModal
        open={true}
        onClose={vi.fn()}
        order={baseOrder}
        onSuccess={onSuccessMock}
        onOpenReceipt={onOpenReceiptMock}
        onOpenReceiptAndPrint={onOpenReceiptAndPrintMock}
      />,
    );

    const input = screen.getByLabelText(/Payment Amount/i);
    fireEvent.change(input, { target: { value: '700' } });

    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Payment Confirmed')).toBeInTheDocument();
      expect(screen.getByText(/₹700.00 received/)).toBeInTheDocument();
      expect(screen.getByText('Order Fully Paid')).toBeInTheDocument();
    });

    // View Receipt action
    const viewReceiptBtn = screen.getByRole('button', { name: /View Receipt/i });
    expect(viewReceiptBtn).toBeInTheDocument();
    fireEvent.click(viewReceiptBtn);
    expect(onOpenReceiptMock).toHaveBeenCalledTimes(1);
  });

  it('3. Partial payment renders exact received and remaining balance, does NOT say fully paid', async () => {
    const partialOrder: OrderDetailDTO = {
      ...baseOrder,
      amountPaid: 0,
      amountDue: 700,
      paymentStatus: PaymentStatus.PENDING,
    };

    const onSuccessMock = vi.fn().mockImplementation(async () => {
      partialOrder.amountPaid = 500;
      partialOrder.amountDue = 200;
      partialOrder.paymentStatus = PaymentStatus.PARTIAL;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pay-part', amount: 500 }),
    } as Response);

    render(
      <PaymentModal open={true} onClose={vi.fn()} order={partialOrder} onSuccess={onSuccessMock} />,
    );

    const input = screen.getByLabelText(/Payment Amount/i);
    fireEvent.change(input, { target: { value: '500' } });

    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Payment Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Paid:')).toBeInTheDocument();
      expect(screen.getByText('₹500.00')).toBeInTheDocument();
      expect(screen.getByText('Remaining:')).toBeInTheDocument();
      expect(screen.getByText('₹200.00')).toBeInTheDocument();
      expect(screen.getByText('PARTIAL')).toBeInTheDocument();
      // Must NOT say "Order Fully Paid"
      expect(screen.queryByText(/Order Fully Paid/i)).not.toBeInTheDocument();
    });
  });

  it('4. Print Receipt button on post-payment screen triggers onOpenReceiptAndPrint', async () => {
    const onOpenReceiptAndPrintMock = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pay-new', amount: 700 }),
    } as Response);

    render(
      <PaymentModal
        open={true}
        onClose={vi.fn()}
        order={{ ...baseOrder, amountDue: 700 }}
        onSuccess={vi.fn()}
        onOpenReceiptAndPrint={onOpenReceiptAndPrintMock}
      />,
    );

    const input = screen.getByLabelText(/Payment Amount/i);
    fireEvent.change(input, { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: /Record Payment/i }));

    await waitFor(() => {
      expect(screen.getByText('Payment Confirmed')).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /Print Receipt/i });
    fireEvent.click(printBtn);
    expect(onOpenReceiptAndPrintMock).toHaveBeenCalledTimes(1);
  });
});
