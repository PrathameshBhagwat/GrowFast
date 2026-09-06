import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderPickupModal } from './OrderPickupModal';
import {
  OrderDetailDTO,
  OrderStatus,
  PaymentStatus,
  ItemStatus,
  PaymentMode,
  PickupType,
  OrderPriority,
} from '@growfast/shared-types';

const baseOrder: OrderDetailDTO = {
  id: 'order-pickup-1',
  orderNumber: 'ORD-PICKUP-1',
  customerId: 'cust-1',
  customerName: 'Rahul Sharma',
  customerPhone: '9876543210',
  orderDate: '2026-09-01T10:00:00Z',
  effectiveDueDate: '2026-09-05T18:00:00Z',
  systemDueDate: '2026-09-05T18:00:00Z',
  dueDateOverrideReason: null,
  dueDateOverriddenBy: null,
  serviceSummary: null,
  isExpress: false,
  priority: OrderPriority.STANDARD,
  status: OrderStatus.PROCESSING,
  subtotal: 300,
  discountAmount: 0,
  taxAmount: 15,
  totalAmount: 315,
  amountPaid: 315,
  amountDue: 0,
  payableAmount: 0,
  readyAmount: 315,
  remainingAmount: 0,
  collectedAmount: 0,
  cancelledAmount: 0,
  paymentStatus: PaymentStatus.PAID,
  pickupType: PickupType.STORE_PICKUP,
  itemCount: 1,
  storeId: 'store-1',
  createdById: 'emp-1',
  createdByName: 'Counter Staff',
  payments: [],
  items: [
    {
      id: 'item-1',
      garmentName: 'Shirt',
      garmentCategory: 'TOPS' as any,
      serviceType: 'DRY_CLEAN' as any,
      quantity: 4,
      unitPrice: 75,
      lineTotal: 300,
      colorTags: null,
      defectNotes: null,
      itemStatus: ItemStatus.PROCESSING,
      deliveredQuantity: 0,
      itemDueDate: null,
      physicalGarments: [
        {
          id: 'pg-ready-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pg-ready-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pg-unready-3',
          orderItemId: 'item-1',
          unitNumber: 3,
          isReady: false,
          isCancelled: false,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'pg-cancelled-4',
          orderItemId: 'item-1',
          unitNumber: 4,
          isReady: false,
          isCancelled: true,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
      ],
    },
  ],
};

const mixedOrder: OrderDetailDTO = {
  ...baseOrder,
  id: 'order-mixed-2',
  orderNumber: 'ORD-MIXED-2',
  amountPaid: 100,
  amountDue: 215,
  payableAmount: 215,
  paymentStatus: PaymentStatus.PARTIAL,
  items: [
    {
      id: 'item-phys',
      garmentName: 'Silk Saree',
      garmentCategory: 'TRADITIONAL' as any,
      serviceType: 'DRY_CLEAN' as any,
      quantity: 1,
      unitPrice: 150,
      lineTotal: 150,
      colorTags: null,
      defectNotes: null,
      itemStatus: ItemStatus.PROCESSING,
      deliveredQuantity: 0,
      itemDueDate: null,
      physicalGarments: [
        {
          id: 'pg-saree-1',
          orderItemId: 'item-phys',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
      ],
    },
    {
      id: 'item-legacy',
      garmentName: 'Bed Sheet',
      garmentCategory: 'HOUSEHOLD' as any,
      serviceType: 'WASH_AND_IRON' as any,
      quantity: 3,
      unitPrice: 50,
      lineTotal: 150,
      colorTags: null,
      defectNotes: null,
      itemStatus: ItemStatus.PROCESSING,
      deliveredQuantity: 1,
      itemDueDate: null,
      physicalGarments: [],
    },
  ],
};

const orderWithDeliveredGarment: OrderDetailDTO = {
  ...baseOrder,
  id: 'order-delivered-3',
  items: [
    {
      ...baseOrder.items[0],
      physicalGarments: [
        {
          id: 'pg-delivered-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
          deliveredAt: '2026-09-05T14:30:00Z',
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-05T14:30:00Z',
        },
        {
          id: 'pg-avail-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: false,
          createdAt: '2026-09-01T10:00:00Z',
          updatedAt: '2026-09-01T10:00:00Z',
        },
      ],
    },
  ],
};

global.fetch = vi.fn();

describe('OrderPickupModal Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem('growfast_token', 'test-token');
  });

  it('2. Unready garments cannot be selected', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const unreadyCard = screen.getByText('Garment #3').closest('[role="checkbox"]');
    expect(unreadyCard).toBeInTheDocument();
    expect(unreadyCard).toHaveAttribute('aria-disabled', 'true');
    expect(unreadyCard).toHaveAttribute('aria-checked', 'false');

    // Click should not select
    fireEvent.click(unreadyCard!);
    expect(unreadyCard).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('NOT READY')).toBeInTheDocument();
  });

  it('3. Cancelled garments cannot be selected', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const cancelledCard = screen.getByText('Garment #4').closest('[role="checkbox"]');
    expect(cancelledCard).toBeInTheDocument();
    expect(cancelledCard).toHaveAttribute('aria-disabled', 'true');
    expect(cancelledCard).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(cancelledCard!);
    expect(cancelledCard).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
  });

  it('4. Delivered garments cannot be selected', () => {
    render(
      <OrderPickupModal
        open={true}
        onClose={vi.fn()}
        order={orderWithDeliveredGarment}
        onSuccess={vi.fn()}
      />,
    );

    const deliveredCard = screen.getByText('Garment #1').closest('[role="checkbox"]');
    expect(deliveredCard).toBeInTheDocument();
    expect(deliveredCard).toHaveAttribute('aria-disabled', 'true');
    expect(deliveredCard).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(deliveredCard!);
    expect(deliveredCard).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
  });

  it('5. Ready garments can be selected and unselected', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const readyCard = screen.getByText('Garment #1').closest('[role="checkbox"]');
    expect(readyCard).toBeInTheDocument();
    expect(readyCard).toHaveAttribute('aria-disabled', 'false');
    expect(readyCard).toHaveAttribute('aria-checked', 'false');

    // Select
    fireEvent.click(readyCard!);
    expect(readyCard).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    fireEvent.click(readyCard!);
    expect(readyCard).toHaveAttribute('aria-checked', 'false');
  });

  it('6. Selection count is correct for partial selection', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    // Initial state: 0 selected / 3 remaining (active undelivered = units 1, 2, 3)
    expect(screen.getByText(/0 selected/i)).toBeInTheDocument();
    expect(screen.getByText(/3 remaining/i)).toBeInTheDocument();

    // Select unit 1
    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByText(/2 remaining/i)).toBeInTheDocument();

    // Select unit 2
    const readyCard2 = screen.getByText('Garment #2').closest('[role="checkbox"]');
    fireEvent.click(readyCard2!);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    expect(screen.getByText(/1 remaining/i)).toBeInTheDocument();
  });

  it('7. Partial handover request sends correct garmentIds and succeeds', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <OrderPickupModal open={true} onClose={onClose} order={baseOrder} onSuccess={onSuccess} />,
    );

    // Select only Garment #1
    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(1 Pieces\)/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('/orders/order-pickup-1/pickup');
    expect(options.method).toBe('POST');
    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.garmentIds).toEqual(['pg-ready-1']);
    expect(parsedBody.legacyItems).toBeUndefined();

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('8. Legacy quantity selection works within bounds [0, remaining]', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={mixedOrder} onSuccess={vi.fn()} />,
    );

    // Bed sheet has quantity 3, delivered 1 => remaining 2
    expect(screen.getByText(/Remaining to deliver: 2/i)).toBeInTheDocument();
    const minusBtn = screen.getByLabelText(/Decrease handover quantity for Bed Sheet/i);
    const plusBtn = screen.getByLabelText(/Increase handover quantity for Bed Sheet/i);

    // Initially 0
    expect(minusBtn).toBeDisabled();

    // Increment to 1
    fireEvent.click(plusBtn);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(minusBtn).not.toBeDisabled();

    // Increment to 2 (max remaining)
    fireEvent.click(plusBtn);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(plusBtn).toBeDisabled(); // Cannot exceed remaining 2

    // Decrement back to 1
    fireEvent.click(minusBtn);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('9. Mixed physical + legacy request is constructed correctly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={mixedOrder} onSuccess={vi.fn()} />,
    );

    // Select physical saree
    const sareeCard = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(sareeCard!);

    // Increment legacy bed sheet to 1
    const plusBtn = screen.getByLabelText(/Increase handover quantity for Bed Sheet/i);
    fireEvent.click(plusBtn);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(2 Pieces\)/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [, options] = (global.fetch as any).mock.calls[0];
    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.garmentIds).toEqual(['pg-saree-1']);
    expect(parsedBody.legacyItems).toEqual([{ itemId: 'item-legacy', quantity: 1 }]);
  });

  it('10 & 11. Payment fields appear when needed and allow selecting PaymentMode', () => {
    render(
      <OrderPickupModal
        open={true}
        onClose={vi.fn()}
        order={mixedOrder} // amountDue = 215
        onSuccess={vi.fn()}
      />,
    );

    const paymentCheckbox = screen.getByLabelText(/Record Settlement Payment Now/i);
    expect(paymentCheckbox).toBeInTheDocument();
    expect(paymentCheckbox).not.toBeChecked();

    // Check payment
    fireEvent.click(paymentCheckbox);
    expect(paymentCheckbox).toBeChecked();

    // Fields should appear
    const amountInput = screen.getByLabelText(/Payment Amount \(₹\)/i);
    const modeSelect = screen.getByLabelText(/Payment Mode/i);
    const refInput = screen.getByLabelText(/Payment Reference \/ Transaction ID/i);

    expect(amountInput).toBeInTheDocument();
    expect(modeSelect).toBeInTheDocument();
    expect(refInput).toBeInTheDocument();

    // Verify canonical payment modes
    fireEvent.change(modeSelect, { target: { value: PaymentMode.CASH } });
    expect(modeSelect).toHaveValue(PaymentMode.CASH);

    fireEvent.change(modeSelect, { target: { value: PaymentMode.CARD } });
    expect(modeSelect).toHaveValue(PaymentMode.CARD);

    fireEvent.change(modeSelect, { target: { value: PaymentMode.STORE_CREDIT } });
    expect(modeSelect).toHaveValue(PaymentMode.STORE_CREDIT);
  });

  it('12 & 13. Submitting disables submit button and prevents duplicate requests', async () => {
    let resolvePromise: (val: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    (global.fetch as any).mockReturnValue(fetchPromise);

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(1 Pieces\)/i });
    fireEvent.click(confirmBtn);

    // While submitting, button text changes and is disabled
    expect(screen.getByText('Processing Handover...')).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();

    // Try clicking again
    fireEvent.click(confirmBtn);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Still exactly 1 call

    // Resolve
    resolvePromise!({
      ok: true,
      json: async () => ({ success: true }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('15. Displays 400 backend error message clearly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Garment is not ready for handover.' }),
    });

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(1 Pieces\)/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Garment is not ready for handover.')).toBeInTheDocument();
    });
  });

  it('16. Displays 403 authorization error clearly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
    });

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(1 Pieces\)/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Access denied: Cannot process handover/i)).toBeInTheDocument();
    });
  });

  it('17. Displays 409 concurrency conflict error clearly', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({}),
    });

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={baseOrder} onSuccess={vi.fn()} />,
    );

    const readyCard1 = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(readyCard1!);

    const confirmBtn = screen.getByRole('button', { name: /Confirm Handover \(1 Pieces\)/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conflict: Order was modified concurrently/i)).toBeInTheDocument();
    });
  });

  it('18. Final handover with outstanding balance requires payment and notifies staff', () => {
    // Single-item order with 1 physical garment ready, but outstanding balance 215
    const finalDueOrder: OrderDetailDTO = {
      ...mixedOrder,
      items: [mixedOrder.items[0]], // only the saree (1 piece total)
    };

    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={finalDueOrder} onSuccess={vi.fn()} />,
    );

    // Select saree (delivers 100% of the order)
    const sareeCard = screen.getByText('Garment #1').closest('[role="checkbox"]');
    fireEvent.click(sareeCard!);

    // Banner indicates final handover
    expect(screen.getByText('Final Order Handover Selected')).toBeInTheDocument();
    expect(screen.getByText(/Full settlement is mandatory/i)).toBeInTheDocument();

    // Payment checkbox is automatically locked active
    const paymentCheckbox = screen.getByLabelText(/Record Settlement Payment Now/i);
    expect(paymentCheckbox).toBeChecked();
    expect(paymentCheckbox).toBeDisabled();

    // Payment amount is auto-populated with due amount (215)
    const amountInput = screen.getByLabelText(/Payment Amount \(₹\)/i);
    expect(amountInput).toHaveValue(215);

    // Confirm button reflects final handover
    const confirmBtn = screen.getByRole('button', {
      name: /Complete Final Handover \(1 Pieces\)/i,
    });
    expect(confirmBtn).not.toBeDisabled();

    // Clear payment amount to test disablement
    fireEvent.change(amountInput, { target: { value: '' } });
    expect(confirmBtn).toBeDisabled();
  });

  it('22. Interactive controls have >=44px touch targets', () => {
    render(
      <OrderPickupModal open={true} onClose={vi.fn()} order={mixedOrder} onSuccess={vi.fn()} />,
    );

    const selectAllBtn = screen.getByRole('button', { name: /Select All Ready/i });
    expect(selectAllBtn.className).toContain('min-h-[44px]');

    const minusBtn = screen.getByLabelText(/Decrease handover quantity for Bed Sheet/i);
    expect(minusBtn.className).toContain('h-11'); // 44px
    expect(minusBtn.className).toContain('w-11'); // 44px

    const plusBtn = screen.getByLabelText(/Increase handover quantity for Bed Sheet/i);
    expect(plusBtn.className).toContain('h-11'); // 44px
    expect(plusBtn.className).toContain('w-11'); // 44px
  });
});
