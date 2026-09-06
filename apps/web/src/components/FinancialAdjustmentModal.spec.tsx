import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialAdjustmentModal } from './FinancialAdjustmentModal';
import { OrderStatus, PaymentStatus, AdjustmentType, OrderDetailDTO } from '@growfast/shared-types';

const mockOrder: OrderDetailDTO = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  storeId: 'store-1',
  customerId: 'cust-1',
  customerName: 'Bob Builder',
  customerPhone: '9876543210',
  orderDate: '2026-09-01T09:00:00Z',
  effectiveDueDate: '2026-09-05T09:00:00Z',
  systemDueDate: '2026-09-05T09:00:00Z',
  dueDateOverrideReason: null,
  dueDateOverriddenBy: null,
  serviceSummary: null,
  createdById: 'emp-1',
  createdByName: 'Alice',
  isExpress: false,
  priority: 'NORMAL' as any,
  pickupType: 'STORE_PICKUP' as any,
  itemCount: 0,
  discountAmount: 0,
  cancelledAmount: 0,
  status: OrderStatus.PROCESSING,
  paymentStatus: PaymentStatus.PAID,
  subtotal: 500,
  taxAmount: 0,
  totalAmount: 500,
  amountPaid: 800,
  amountDue: 0,
  payableAmount: 0,
  readyAmount: 500,
  remainingAmount: 0,
  collectedAmount: 800,
  refundAmount: 100,
  storeCreditAmount: 50,
  effectivePaid: 650,
  items: [],
  payments: [],
  adjustments: [
    {
      id: 'adj-1',
      orderId: 'order-1',
      type: AdjustmentType.REFUND,
      amount: 100,
      reason: 'Piece cancellation',
      status: 'COMPLETED' as any,
      reference: 'REF-001',
      createdById: 'emp-1',
      createdByName: 'Alice',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z',
    },
    {
      id: 'adj-2',
      orderId: 'order-1',
      type: AdjustmentType.STORE_CREDIT,
      amount: 50,
      reason: 'Overpayment credit',
      status: 'COMPLETED' as any,
      reference: null,
      createdById: 'emp-1',
      createdByName: 'Alice',
      createdAt: '2026-09-01T11:00:00Z',
      updatedAt: '2026-09-01T11:00:00Z',
    },
  ],
};

describe('FinancialAdjustmentModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.setItem('growfast_token', 'mock-token');
  });

  it('renders order financial breakdown and calculates maximum eligible adjustment', () => {
    // totalAmount: 500, amountPaid: 800, existing adjustments: 150 -> maxEligible = 800 - 500 - 150 = 150
    render(
      <FinancialAdjustmentModal
        open={true}
        onClose={vi.fn()}
        order={mockOrder}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Financial Adjustment')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('₹800')).toBeInTheDocument();
    expect(screen.getByText('-₹100')).toBeInTheDocument();
    expect(screen.getByText('₹50')).toBeInTheDocument();
    expect(screen.getByText('₹150')).toBeInTheDocument(); // Max Eligible
  });

  it('disables submit button when reason is empty and enables when valid', () => {
    render(
      <FinancialAdjustmentModal
        open={true}
        onClose={vi.fn()}
        order={mockOrder}
        onSuccess={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Issue Refund' });
    expect(submitBtn).toBeDisabled();

    const reasonInput = document.getElementById('adjustment-reason-input') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: 'Valid cancellation reason' } });

    expect(submitBtn).not.toBeDisabled();
  });

  it('disables submit button when amount exceeds max eligible adjustment', () => {
    render(
      <FinancialAdjustmentModal
        open={true}
        onClose={vi.fn()}
        order={mockOrder}
        onSuccess={vi.fn()}
      />,
    );

    const reasonInput = document.getElementById('adjustment-reason-input') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: 'Excessive refund test' } });

    const amountInput = document.getElementById('adjustment-amount-input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '250' } });

    const submitBtn = screen.getByRole('button', { name: 'Issue Refund' });
    expect(submitBtn).toBeDisabled();
  });

  it('switches between Refund and Store Credit types and submits successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'adj-new' } }),
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <FinancialAdjustmentModal
        open={true}
        onClose={handleClose}
        order={mockOrder}
        onSuccess={handleSuccess}
      />,
    );

    // Switch to STORE_CREDIT
    const storeCreditBtn = screen.getByRole('button', { name: 'Store Credit' });
    fireEvent.click(storeCreditBtn);

    expect(screen.getByRole('button', { name: 'Grant Store Credit' })).toBeInTheDocument();

    const amountInput = document.getElementById('adjustment-amount-input') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '100' } });

    const reasonInput = document.getElementById('adjustment-reason-input') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: 'Customer store credit' } });

    const submitBtn = screen.getByRole('button', { name: 'Grant Store Credit' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/order-1/adjustments'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-token',
          }),
          body: JSON.stringify({
            type: AdjustmentType.STORE_CREDIT,
            amount: 100,
            reason: 'Customer store credit',
          }),
        }),
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('has accessible buttons with >= 44px touch targets', () => {
    render(
      <FinancialAdjustmentModal
        open={true}
        onClose={vi.fn()}
        order={mockOrder}
        onSuccess={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Issue Refund' });
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const refundTypeBtn = screen.getByRole('button', { name: 'Refund (Cash / Bank)' });
    const creditTypeBtn = screen.getByRole('button', { name: 'Store Credit' });

    expect(submitBtn.style.minHeight).toBe('44px');
    expect(cancelBtn.style.minHeight).toBe('44px');
    expect(refundTypeBtn.className).toContain('min-h-[44px]');
    expect(creditTypeBtn.className).toContain('min-h-[44px]');
  });
});
