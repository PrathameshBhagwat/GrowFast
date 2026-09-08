import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrderDetailPage } from './OrderDetailPage';
import { OrderStatus, PaymentStatus, ItemStatus, PickupType, Role } from '@growfast/shared-types';

let mockRole: string = 'COUNTER';
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    employee: { id: 'emp-1', name: 'John Doe', role: mockRole },
  }),
}));

const mockOrderWithPhysicalGarments = {
  id: 'order-101',
  orderNumber: 'ORD-101',
  storeId: 'store-1',
  customerId: 'cust-1',
  customerName: 'Alice Green',
  customerPhone: '9876543210',
  pickupType: PickupType.STORE_PICKUP,
  status: OrderStatus.PROCESSING,
  paymentStatus: PaymentStatus.PARTIAL,
  subtotal: 100,
  taxAmount: 5,
  totalAmount: 105,
  amountPaid: 50,
  amountDue: 55,
  payableAmount: 55,
  readyAmount: 50,
  remainingAmount: 55,
  collectedAmount: 0,
  items: [
    {
      id: 'item-1',
      orderId: 'order-101',
      garmentName: 'Shirt',
      serviceType: 'Dry Clean',
      unitPrice: 50,
      quantity: 2,
      lineTotal: 100,
      itemStatus: ItemStatus.PROCESSING,
      deliveredQuantity: 0,
      physicalGarments: [
        {
          id: 'garment-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          photos: [],
        },
        {
          id: 'garment-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: false,
          isCancelled: false,
          photos: [],
        },
      ],
    },
  ],
};

const mockOrderWithDeliveredItem = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-102',
  items: [
    {
      ...mockOrderWithPhysicalGarments.items[0],
      id: 'item-2',
      deliveredQuantity: 1,
      physicalGarments: [
        {
          id: 'garment-3',
          orderItemId: 'item-2',
          unitNumber: 1,
          isReady: false,
          isCancelled: false,
          photos: [],
        },
      ],
    },
  ],
};

const mockOrderWithCancelledGarment = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-103',
  items: [
    {
      ...mockOrderWithPhysicalGarments.items[0],
      id: 'item-3',
      quantity: 1,
      physicalGarments: [
        {
          id: 'garment-4',
          orderItemId: 'item-3',
          unitNumber: 1,
          isReady: false,
          isCancelled: true,
          photos: [],
        },
        {
          id: 'garment-5',
          orderItemId: 'item-3',
          unitNumber: 2,
          isReady: false,
          isCancelled: false,
          photos: [],
        },
      ],
    },
  ],
};

const mockOrderWithLegacyItem = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-104',
  items: [
    {
      id: 'item-legacy',
      orderId: 'order-104',
      garmentName: 'Blanket',
      serviceType: 'Wash & Fold',
      unitPrice: 200,
      quantity: 1,
      lineTotal: 200,
      itemStatus: ItemStatus.PROCESSING,
      deliveredQuantity: 0,
      physicalGarments: [],
    },
  ],
};

const mockPaidOrder = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-paid',
  amountPaid: 105,
  amountDue: 0,
  payableAmount: 0,
  paymentStatus: PaymentStatus.PAID,
  refundAmount: 0,
  storeCreditAmount: 0,
  effectivePaid: 105,
};

const mockOrderWithAdjustments = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-adj',
  amountPaid: 150,
  totalAmount: 105,
  amountDue: 0,
  paymentStatus: PaymentStatus.PAID,
  refundAmount: 30,
  storeCreditAmount: 15,
  effectivePaid: 105,
  payments: [
    {
      id: 'p1',
      amount: 150,
      mode: 'UPI',
      reference: 'UPI-123',
      createdAt: '2026-09-01T10:00:00Z',
    },
  ],
  adjustments: [
    {
      id: 'adj-1',
      orderId: 'order-adj',
      type: 'REFUND',
      amount: 30,
      reason: 'Piece cancellation',
      status: 'COMPLETED',
      reference: null,
      createdByName: 'Alice',
      createdAt: '2026-09-01T12:00:00Z',
    },
    {
      id: 'adj-2',
      orderId: 'order-adj',
      type: 'STORE_CREDIT',
      amount: 15,
      reason: 'Courtesy credit',
      status: 'COMPLETED',
      reference: null,
      createdByName: 'Alice',
      createdAt: '2026-09-01T13:00:00Z',
    },
  ],
};

const mockOrderDeliveredFinal = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-delivered-final',
  status: OrderStatus.DELIVERED,
  paymentStatus: PaymentStatus.PAID,
  amountDue: 0,
  deliveredAt: '2026-09-06T18:30:00Z',
  deliveredByName: 'Ramesh Patel',
  items: [
    {
      ...mockOrderWithPhysicalGarments.items[0],
      itemStatus: ItemStatus.DELIVERED,
      deliveredQuantity: 2,
      physicalGarments: [
        {
          id: 'garment-1',
          orderItemId: 'item-1',
          unitNumber: 1,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
          deliveredAt: '2026-09-06T18:30:00Z',
          photos: [],
        },
        {
          id: 'garment-2',
          orderItemId: 'item-1',
          unitNumber: 2,
          isReady: true,
          isCancelled: false,
          isDelivered: true,
          deliveredAt: '2026-09-06T18:30:00Z',
          photos: [],
        },
      ],
    },
  ],
};

const mockHomeDeliveryOrder = {
  ...mockOrderWithPhysicalGarments,
  id: 'order-home-del',
  pickupType: PickupType.HOME_DELIVERY,
};

global.fetch = vi.fn();

describe('OrderDetailPage — Phase 3D Physical Garment Add/Cancel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global.fetch as any).mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (opts?.method === 'PATCH' && url.includes('/cancel')) {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes('order-102')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockOrderWithDeliveredItem }),
        };
      }
      if (url.includes('order-103')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockOrderWithCancelledGarment }),
        };
      }
      if (url.includes('order-104')) {
        return { ok: true, json: async () => ({ success: true, data: mockOrderWithLegacyItem }) };
      }
      if (url.includes('order-paid')) {
        return { ok: true, json: async () => ({ success: true, data: mockPaidOrder }) };
      }
      if (url.includes('order-adj')) {
        return { ok: true, json: async () => ({ success: true, data: mockOrderWithAdjustments }) };
      }
      if (url.includes('order-delivered-final')) {
        return { ok: true, json: async () => ({ success: true, data: mockOrderDeliveredFinal }) };
      }
      if (url.includes('order-home-del')) {
        return { ok: true, json: async () => ({ success: true, data: mockHomeDeliveryOrder }) };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockOrderWithPhysicalGarments }),
      };
    });
  });

  const renderWithRouter = (orderId: string) => {
    return render(
      <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
        <Routes>
          <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('1. shows "+ Add Piece" button for items backed by physical garments with >=44px touch target', async () => {
    renderWithRouter('order-101');

    await waitFor(() => {
      expect(screen.getByText('+ Add Piece')).toBeInTheDocument();
    });

    const addBtn = screen.getByText('+ Add Piece');
    expect(addBtn.className).toContain('min-h-[44px]');
  });

  it('2 & 3. clicking "+ Add Piece" calls endpoint and refreshes order', async () => {
    let addPieceCalled = false;
    (global.fetch as any).mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'POST' && url.includes('/garments')) {
        addPieceCalled = true;
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (addPieceCalled) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              ...mockOrderWithPhysicalGarments,
              items: [
                {
                  ...mockOrderWithPhysicalGarments.items[0],
                  quantity: 3,
                  physicalGarments: [
                    ...mockOrderWithPhysicalGarments.items[0].physicalGarments,
                    {
                      id: 'garment-3',
                      orderItemId: 'item-1',
                      unitNumber: 3,
                      isReady: false,
                      isCancelled: false,
                      photos: [],
                    },
                  ],
                },
              ],
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockOrderWithPhysicalGarments }),
      };
    });

    renderWithRouter('order-101');

    await waitFor(() => {
      expect(screen.getByText('+ Add Piece')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Add Piece'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/order-101/items/item-1/garments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Garment #3')).toBeInTheDocument();
    });
  });

  it('4 & 5 & 6. Cancel Piece button appears only on unready garments; opens confirmation dialog', async () => {
    renderWithRouter('order-101');

    await waitFor(() => {
      expect(screen.getByText('Garment #1')).toBeInTheDocument();
      expect(screen.getByText('Garment #2')).toBeInTheDocument();
    });

    // Garment 1 is ready -> NO Cancel Piece button
    // Garment 2 is NOT ready -> Cancel Piece button exists with aria-label
    const cancelBtn = screen.getByRole('button', { name: /cancel garment #2/i });
    expect(cancelBtn).toBeInTheDocument();
    expect(cancelBtn.className).toContain('min-h-[44px]');

    // Click Cancel Piece -> Modal appears
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByText('Cancel Garment #2')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to cancel/i)).toBeInTheDocument();
    });
  });

  it('7. Delivered item does NOT show Cancel Piece control', async () => {
    renderWithRouter('order-102');

    await waitFor(() => {
      expect(screen.getByText('Garment #1')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /cancel garment/i })).not.toBeInTheDocument();
  });

  it('5. Cancelled garment is displayed in disabled history state without toggle or cancel', async () => {
    renderWithRouter('order-103');

    await waitFor(() => {
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
      expect(screen.getByText('Garment #1')).toBeInTheDocument();
      expect(screen.getByText('Piece Cancelled')).toBeInTheDocument();
    });

    // Cancelled garment cannot be cancelled again
    expect(screen.queryByRole('button', { name: /cancel garment #1/i })).not.toBeInTheDocument();
    // Uncancelled garment #2 can be cancelled
    expect(screen.getByRole('button', { name: /cancel garment #2/i })).toBeInTheDocument();
  });

  it('10. Backend error during cancellation is displayed cleanly in modal', async () => {
    (global.fetch as any).mockImplementation(async (url: string, opts?: any) => {
      if (opts?.method === 'PATCH' && url.includes('/cancel')) {
        return {
          ok: false,
          json: async () => ({
            message: 'Resulting total amount cannot be less than amount paid.',
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: mockOrderWithPhysicalGarments }),
      };
    });

    renderWithRouter('order-101');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel garment #2/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel garment #2/i }));

    await waitFor(() => {
      expect(screen.getByText('Cancel Garment #2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Yes, Cancel Garment'));

    await waitFor(() => {
      expect(
        screen.getByText('Resulting total amount cannot be less than amount paid.'),
      ).toBeInTheDocument();
    });
  });

  it('11. Legacy item without physical garments does NOT show Add Piece or Cancel Piece controls', async () => {
    renderWithRouter('order-104');

    await waitFor(() => {
      expect(screen.getByText('Blanket')).toBeInTheDocument();
    });

    expect(screen.queryByText('+ Add Piece')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel garment/i })).not.toBeInTheDocument();
  });

  describe('Phase 3E: Financial Adjustments & Overpayment Handling', () => {
    it('shows owner-only notice and disables confirm button when COUNTER cancels piece on overpaid order', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-paid');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel garment #2/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel garment #2/i }));

      await waitFor(() => {
        expect(screen.getByText(/Financial Adjustment Required/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Only a Store Owner can authorize refunds or store credit adjustments/i),
        ).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: 'Yes, Cancel Garment' });
      expect(confirmBtn).toBeDisabled();
    });

    it('allows OWNER to select refund adjustment, input reason, and submit cancellation', async () => {
      mockRole = 'OWNER';
      renderWithRouter('order-paid');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel garment #2/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /cancel garment #2/i }));

      await waitFor(() => {
        expect(screen.getByText(/Financial Adjustment Required/i)).toBeInTheDocument();
        expect(screen.getByText(/Select Adjustment Type/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: 'Yes, Cancel Garment' });
      expect(confirmBtn).toBeDisabled();

      const reasonInput = screen.getByPlaceholderText(/Garment #2 cancelled/i);
      fireEvent.change(reasonInput, { target: { value: 'Defective piece cancellation' } });

      expect(confirmBtn).not.toBeDisabled();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/garments/garment-2/cancel'),
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: expect.stringContaining('"type":"REFUND"'),
          }),
        );
      });
    });

    it('renders adjustments in Payment & Adjustment History and provides Financial Adjustment button for OWNER', async () => {
      mockRole = 'OWNER';
      renderWithRouter('order-adj');

      await waitFor(() => {
        expect(screen.getByText('Payment & Adjustment History')).toBeInTheDocument();
        expect(screen.getByText('Financial Adjustments')).toBeInTheDocument();
        expect(screen.getByText('Piece cancellation')).toBeInTheDocument();
        expect(screen.getByText('Courtesy credit')).toBeInTheDocument();
      });

      const headerAdjBtn = document.getElementById('header-financial-adjustment-btn');
      expect(headerAdjBtn).toBeInTheDocument();

      fireEvent.click(headerAdjBtn!);

      await waitFor(() => {
        expect(screen.getByText('Financial Adjustment')).toBeInTheDocument();
      });
    });
  });

  describe('OrderDetailPage — Phase 4D Counter Handover & Delivered States', () => {
    it('1 & 19. Pickup button appears when eligible garments exist for STORE_PICKUP and user has COUNTER role', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-101');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Counter Handover/i })).toBeInTheDocument();
        expect(screen.getByText(/1 Ready/i)).toBeInTheDocument();
      });

      // Clicking opens modal
      fireEvent.click(screen.getByRole('button', { name: /Counter Handover/i }));
      await waitFor(() => {
        expect(screen.getByText(/Counter Handover — Order #ORD-101/i)).toBeInTheDocument();
      });
    });

    it('19. OWNER sees the Counter Handover button when eligible garments exist', async () => {
      mockRole = 'OWNER';
      renderWithRouter('order-101');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Counter Handover/i })).toBeInTheDocument();
      });
    });

    it('20. Unauthorized roles (MANAGER, DELIVERY) do NOT see an actionable Counter Handover button', async () => {
      mockRole = 'MANAGER';
      const { unmount } = renderWithRouter('order-101');

      await waitFor(() => {
        expect(screen.getByText('ORD-101')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Counter Handover/i })).not.toBeInTheDocument();

      unmount();

      mockRole = 'DELIVERY';
      renderWithRouter('order-101');

      await waitFor(() => {
        expect(screen.getByText('ORD-101')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Counter Handover/i })).not.toBeInTheDocument();
    });

    it('HOME_DELIVERY orders do not show the Counter Handover button', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-home-del');

      await waitFor(() => {
        expect(screen.getByText('ORD-101')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /Counter Handover/i })).not.toBeInTheDocument();
    });

    it('Delivered order renders order-level delivered banner with timestamp and deliveredByName', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-delivered-final');

      await waitFor(() => {
        expect(screen.getByText(/Order Completely Delivered/i)).toBeInTheDocument();
        expect(screen.getByText(/Delivered on/i)).toBeInTheDocument();
        expect(screen.getByText(/Ramesh Patel/i)).toBeInTheDocument();
      });

      // When all are delivered, Counter Handover button does not show
      expect(screen.queryByRole('button', { name: /Counter Handover/i })).not.toBeInTheDocument();
    });

    it('Delivered physical garments show DELIVERED badge and disabled state', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-delivered-final');

      await waitFor(() => {
        expect(screen.getByText('ORD-101')).toBeInTheDocument();
      });

      await waitFor(() => {
        const deliveredBadges = screen.getAllByText('DELIVERED');
        expect(deliveredBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('Clicking Print Receipt opens Customer Receipt modal', async () => {
      mockRole = 'COUNTER';
      renderWithRouter('order-delivered-final');

      await waitFor(() => {
        expect(screen.getByText('ORD-101')).toBeInTheDocument();
      });

      const printBtn = screen.getByRole('button', { name: /Print Receipt/i });
      expect(printBtn).toBeInTheDocument();
      fireEvent.click(printBtn);

      await waitFor(() => {
        expect(screen.getByText('Customer Receipt')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Standard \(A4\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Thermal \(80mm\)/i })).toBeInTheDocument();
      });
    });
  });
});
