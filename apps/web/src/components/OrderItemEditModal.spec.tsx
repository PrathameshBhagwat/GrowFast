import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderItemEditModal } from './OrderItemEditModal';
import { ItemStatus, GarmentCategory, ServiceCategory } from '@growfast/shared-types';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-jwt-token',
  }),
}));

global.fetch = vi.fn();

describe('OrderItemEditModal', () => {
  const baseItem = {
    id: 'item-101',
    garmentName: 'Silk Shirt',
    garmentCategory: GarmentCategory.MEN,
    serviceType: ServiceCategory.DRY_CLEAN,
    quantity: 2,
    unitPrice: 150,
    lineTotal: 300,
    colorTags: ['Blue', 'White Collar'],
    defectNotes: 'Loose cuff button',
    itemStatus: ItemStatus.READY,
    deliveredQuantity: 0,
    itemDueDate: null,
  };

  const physicalGarmentItem = {
    ...baseItem,
    physicalGarments: [
      {
        id: 'pg-1',
        orderItemId: 'item-101',
        unitNumber: 1,
        isReady: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'pg-2',
        orderItemId: 'item-101',
        unitNumber: 2,
        isReady: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };

  const legacyItem = {
    ...baseItem,
    itemStatus: ItemStatus.PROCESSING,
    physicalGarments: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('PhysicalGarment item: Item Status select is NOT rendered', () => {
    render(
      <OrderItemEditModal
        open={true}
        onClose={vi.fn()}
        orderId="order-1"
        item={physicalGarmentItem as any}
        onSuccess={vi.fn()}
      />,
    );

    // Status dropdown should NOT be present
    expect(screen.queryByLabelText(/Item Status/i)).not.toBeInTheDocument();
  });

  it('PhysicalGarment item: read-only derived status is displayed and quantity input is disabled', () => {
    render(
      <OrderItemEditModal
        open={true}
        onClose={vi.fn()}
        orderId="order-1"
        item={physicalGarmentItem as any}
        onSuccess={vi.fn()}
      />,
    );

    const derivedStatus = screen.getByText('Derived from garments');
    expect(derivedStatus).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();

    // Quantity input should be disabled
    const quantityInput = screen.getByLabelText(/^Quantity$/i);
    expect(quantityInput).toBeDisabled();
    expect(screen.getByText('Fixed by physical garments')).toBeInTheDocument();
  });

  it('PhysicalGarment item: saving defect notes does NOT submit itemStatus in PATCH payload', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <OrderItemEditModal
        open={true}
        onClose={onClose}
        orderId="order-1"
        item={physicalGarmentItem as any}
        onSuccess={onSuccess}
      />,
    );

    const defectNotesTextarea = screen.getByPlaceholderText(/Missing button, torn collar/i);
    fireEvent.change(defectNotesTextarea, {
      target: { value: 'Updated: Small coffee stain on back' },
    });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('/orders/order-1/items/item-101');
    expect(callArgs[1].method).toBe('PATCH');

    const sentPayload = JSON.parse(callArgs[1].body);
    expect(sentPayload.defectNotes).toBe('Updated: Small coffee stain on back');
    expect(sentPayload.itemStatus).toBeUndefined();
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Legacy item: Item Status select IS rendered', () => {
    render(
      <OrderItemEditModal
        open={true}
        onClose={vi.fn()}
        orderId="order-1"
        item={legacyItem as any}
        onSuccess={vi.fn()}
      />,
    );

    // Item Status dropdown must be rendered for legacy items
    const statusSelect = screen.getByLabelText(/Item Status/i);
    expect(statusSelect).toBeInTheDocument();
    expect(screen.queryByText('Derived from garments')).not.toBeInTheDocument();

    // Quantity should be editable for legacy items
    const quantityInput = screen.getByLabelText(/^Quantity$/i);
    expect(quantityInput).not.toBeDisabled();
  });

  it('Legacy item: selected ItemStatus is submitted normally in PATCH payload', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <OrderItemEditModal
        open={true}
        onClose={onClose}
        orderId="order-1"
        item={legacyItem as any}
        onSuccess={onSuccess}
      />,
    );

    const statusSelect = screen.getByLabelText(/Item Status/i);
    fireEvent.change(statusSelect, { target: { value: ItemStatus.READY } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const sentPayload = JSON.parse(callArgs[1].body);
    expect(sentPayload.itemStatus).toBe(ItemStatus.READY);
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Weight-based item: renders Weight input with rate/kg, live line total preview, and submits payload.weight', async () => {
    const weightItem = {
      ...baseItem,
      id: 'weight-item-1',
      garmentName: 'Bulk Laundry (Weight)',
      garmentCategory: GarmentCategory.WEIGHT_BASED,
      serviceType: ServiceCategory.WASH_IRON,
      unitPrice: 80,
      weight: 5.5,
      lineTotal: 440,
      physicalGarments: [],
    };

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <OrderItemEditModal
        open={true}
        onClose={onClose}
        orderId="order-1"
        item={weightItem as any}
        onSuccess={onSuccess}
      />,
    );

    // Quantity input should NOT be present; Weight (kg) input should be present
    expect(screen.queryByLabelText(/^Quantity$/i)).not.toBeInTheDocument();
    const weightInput = screen.getByLabelText(/Weight \(kg\)/i);
    expect(weightInput).toBeInTheDocument();
    expect(weightInput).toHaveValue(5.5);
    expect(screen.getByText(/Rate: ₹80\/kg/i)).toBeInTheDocument();
    expect(screen.getByText(/New Total: ₹440.00/i)).toBeInTheDocument();

    // Change weight to 6.25
    fireEvent.change(weightInput, { target: { value: '6.25' } });
    expect(screen.getByText(/New Total: ₹500.00/i)).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const callArgs = (global.fetch as any).mock.calls[0];
    const sentPayload = JSON.parse(callArgs[1].body);
    expect(sentPayload.weight).toBe(6.25);
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Weight-based item: rejects 0 or negative weight with validation message', async () => {
    const weightItem = {
      ...baseItem,
      id: 'weight-item-1',
      garmentName: 'Bulk Laundry (Weight)',
      garmentCategory: GarmentCategory.WEIGHT_BASED,
      serviceType: ServiceCategory.WASH_IRON,
      unitPrice: 80,
      weight: 5.5,
      lineTotal: 440,
      physicalGarments: [],
    };

    render(
      <OrderItemEditModal
        open={true}
        onClose={vi.fn()}
        orderId="order-1"
        item={weightItem as any}
        onSuccess={vi.fn()}
      />,
    );

    const weightInput = screen.getByLabelText(/Weight \(kg\)/i);
    fireEvent.change(weightInput, { target: { value: '0' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Weight must be greater than 0 kg')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('Weight-based item: displays backend safety error when weight reduction is rejected', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: 'Cannot reduce item weight: new total ₹320 is less than amount already paid ₹440',
      }),
    });

    const weightItem = {
      ...baseItem,
      id: 'weight-item-1',
      garmentName: 'Bulk Laundry (Weight)',
      garmentCategory: GarmentCategory.WEIGHT_BASED,
      serviceType: ServiceCategory.WASH_IRON,
      unitPrice: 80,
      weight: 5.5,
      lineTotal: 440,
      physicalGarments: [],
    };

    render(
      <OrderItemEditModal
        open={true}
        onClose={vi.fn()}
        orderId="order-1"
        item={weightItem as any}
        onSuccess={vi.fn()}
      />,
    );

    const weightInput = screen.getByLabelText(/Weight \(kg\)/i);
    fireEvent.change(weightInput, { target: { value: '4' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText(
        'Cannot reduce item weight: new total ₹320 is less than amount already paid ₹440',
      ),
    ).toBeInTheDocument();
  });
});
