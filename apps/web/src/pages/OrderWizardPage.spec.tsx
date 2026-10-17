import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrderWizardPage } from './OrderWizardPage';

// Mock dependencies
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
  }),
}));

const mockCustomer = {
  id: 'cust-003',
  name: 'Amit Shah',
  phone: '+919811122334',
  email: 'amit.shah@techcorp.in',
};

global.fetch = vi.fn();

describe('OrderWizardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/pricing')) {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  });

  const renderWithRouter = (initialRoute = '/orders/new') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/orders/new" element={<OrderWizardPage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders normal flow without customerId', async () => {
    renderWithRouter('/orders/new');

    // Wait for the pricing fetch to complete
    await waitFor(() => {
      expect(screen.getByText('Add Items')).toBeInTheDocument();
    });

    // Verify it fetched pricing
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pricing'),
      expect.any(Object),
    );
  });

  it('reads customerId from URL, fetches customer, and displays it', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/pricing')) {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    renderWithRouter('/orders/new?customerId=cust-003');

    // Verify fetch was called with right URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers/cust-003'),
      expect.any(Object),
    );

    // After fetch completes, the customer info should be rendered
    await waitFor(() => {
      expect(screen.getByText('Amit Shah')).toBeInTheDocument();
      expect(screen.getByText('(+919811122334)')).toBeInTheDocument();
    });
  });

  it('handles invalid customerId gracefully', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/pricing')) {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      if (url.includes('/customers/invalid-123')) {
        return { ok: false, status: 404, json: async () => ({ message: 'Customer not found' }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    renderWithRouter('/orders/new?customerId=invalid-123');

    // Should display the normal flow gracefully despite the error
    await waitFor(() => {
      expect(screen.getByText('Add Items')).toBeInTheDocument();
    });
  });

  it('enforces photos required when items are added to a walk-in order', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ garmentCatalogId: 'g1', serviceTypeId: 's1', price: 100 }],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 'g1', name: 'Shirt', category: 'MEN', isActive: true }],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 's1', name: 'Wash', category: 'WASH', isActive: true, estimatedDays: 2 }],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003&workflow=laundry');

    await waitFor(() => {
      expect(screen.getByText('Shirt')).toBeInTheDocument();
      expect(screen.getByText('Wash')).toBeInTheDocument();
    });

    // Select the service
    const serviceBtn = screen.getByText('Wash');
    fireEvent.click(serviceBtn);

    // Click "Add" on the item
    const addBtn = screen.getByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    // Photos progress and required banner should appear
    await waitFor(() => {
      expect(screen.getByText(/Photos: 0 \/ 1 pieces/i)).toBeInTheDocument();
      expect(screen.getByText(/Photos required for all pieces/i)).toBeInTheDocument();
    });

    // Proceed button should be disabled
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Review/i });
    expect(proceedBtn).toBeDisabled();
  });

  it('renders compact General Notes button that is optional, collapsible, and interactive', async () => {
    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003');

    // Initially collapsed with tiny button
    const addNoteBtn = await screen.findByRole('button', { name: /\+ Add order note/i });
    expect(addNoteBtn).toBeInTheDocument();

    // Click to expand note input
    fireEvent.click(addNoteBtn);

    await waitFor(() => {
      expect(screen.getByText(/General Notes/i)).toBeInTheDocument();
      expect(screen.getByText(/\(Optional\)/i)).toBeInTheDocument();
    });

    const notesTextarea = screen.getByPlaceholderText(/Optional — add any special instructions/i);
    expect(notesTextarea).toBeInTheDocument();
    expect(notesTextarea.tagName).toBe('TEXTAREA');

    fireEvent.change(notesTextarea, { target: { value: 'Handle with delicate care' } });
    expect(notesTextarea).toHaveValue('Handle with delicate care');
    expect(notesTextarea).toHaveClass('min-h-[44px]');

    // Click Done to collapse into compact preview
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    expect(screen.getByText('Handle with delicate care')).toBeInTheDocument();
  });

  it('satisfies compact visual footprint and touch target requirements for notes and photo progress', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ garmentCatalogId: 'g1', serviceTypeId: 's1', price: 100 }],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 'g1', name: 'Shirt', category: 'MEN', isActive: true }],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 's1', name: 'Wash', category: 'WASH', isActive: true, estimatedDays: 2 }],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003&workflow=laundry');

    await waitFor(() => {
      expect(screen.getByText('Shirt')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Wash'));
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    await waitFor(() => {
      const photoBadge = screen.getByText(/Photos: 0 \/ 1 pieces/i);
      expect(photoBadge).toBeInTheDocument();
      // Ensure photo badge is rendered with compact typography
      expect(photoBadge).toHaveClass('text-xs');
    });

    // Verify collapsible note button is present, and when opened textarea has >=44px touch target
    const addNoteBtn = screen.getByRole('button', { name: /\+ Add order note/i });
    expect(addNoteBtn).toBeInTheDocument();
    fireEvent.click(addNoteBtn);

    const notesTextarea = screen.getByPlaceholderText(/Optional — add any special instructions/i);
    expect(notesTextarea).toHaveClass('min-h-[44px]');
    expect(notesTextarea).toHaveClass('w-full');
  });

  it('renders both Laundry and Dry Cleaning workflow choices as visible, accessible, and selectable', async () => {
    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003');

    const laundryBtn = await screen.findByRole('tab', { name: /Laundry/i });
    const dryCleanBtn = await screen.findByRole('tab', { name: /Dry Cleaning/i });

    expect(laundryBtn).toBeInTheDocument();
    expect(dryCleanBtn).toBeInTheDocument();

    // Dry Cleaning is selected by default for per-piece orders
    expect(dryCleanBtn).toHaveAttribute('aria-selected', 'true');
    expect(laundryBtn).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Per-piece Dry Clean')).toBeInTheDocument();

    // Click Laundry button to switch
    fireEvent.click(laundryBtn);

    expect(laundryBtn).toHaveAttribute('aria-selected', 'true');
    expect(dryCleanBtn).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Per-piece Laundry')).toBeInTheDocument();
  });

  it('shows only Dry Cleaning services and excludes WEIGHT_BASED category when Dry Cleaning is selected', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { garmentCatalogId: 'g1', serviceTypeId: 's1', price: 120 },
              { garmentCatalogId: 'g1', serviceTypeId: 's2', price: 80 },
            ],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'g1', name: 'Suit', category: 'MEN', isActive: true },
              { id: 'g2', name: 'Bulk Laundry', category: 'WEIGHT_BASED', isActive: true },
            ],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 's1',
                name: 'Dry Clean',
                category: 'DRY_CLEAN',
                isActive: true,
                estimatedDays: 2,
              },
              {
                id: 's2',
                name: 'Wash and Fold',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003&workflow=dry_cleaning');

    await waitFor(() => {
      expect(screen.getByText('Dry Clean')).toBeInTheDocument();
    });

    // In Dry Cleaning workflow, Wash and Fold is not shown
    expect(screen.queryByText('Wash and Fold')).not.toBeInTheDocument();

    // In Dry Cleaning workflow, Weight Based category tab is not rendered
    expect(screen.queryByText('Weight Based')).not.toBeInTheDocument();
  });

  it('enforces minimum 2.00 kg weight in Laundry workflow weight modal', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ garmentCatalogId: 'g-wb', serviceTypeId: 's-wash', price: 90 }],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: 'g-wb', name: 'Bulk Laundry', category: 'WEIGHT_BASED', isActive: true }],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 's-wash',
                name: 'Wash and Fold',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003&workflow=laundry');

    // Switch to Weight Based category
    const wbTab = await screen.findByText('Weight Based');
    fireEvent.click(wbTab);

    // Click Add on Bulk Laundry
    const addBtn = await screen.findByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    // Modal appears
    await waitFor(() => {
      expect(screen.getByText('Measure Weight')).toBeInTheDocument();
      expect(screen.getByText('Quick Presets (Min 2.00 kg)')).toBeInTheDocument();
    });

    const weightInput = screen.getByLabelText(/Measured Weight/i);
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Add/i });

    // Try entering 1.50 kg (below 2.00 kg)
    fireEvent.change(weightInput, { target: { value: '1.50' } });
    fireEvent.click(confirmBtn);

    // Rejection message
    await waitFor(() => {
      expect(screen.getByText(/Minimum permitted weight is 2.00 kg/i)).toBeInTheDocument();
    });

    // Enter valid 2.50 kg
    fireEvent.change(weightInput, { target: { value: '2.50' } });
    fireEvent.click(confirmBtn);

    // Modal closes and item added to cart
    await waitFor(() => {
      expect(screen.queryByText('Measure Weight')).not.toBeInTheDocument();
      expect(screen.getAllByText('Bulk Laundry').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/2\.5 kg @/i)).toBeInTheDocument();
    });
  });

  it('safely handles workflow switching by confirming removal of incompatible items and preserving customer selection', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { garmentCatalogId: 'g-wb', serviceTypeId: 's-wash', price: 90 },
              { garmentCatalogId: 'g-suit', serviceTypeId: 's-dry', price: 250 },
            ],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'g-wb', name: 'Bulk Laundry', category: 'WEIGHT_BASED', isActive: true },
              { id: 'g-suit', name: 'Suit', category: 'MEN', isActive: true },
            ],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 's-wash',
                name: 'Wash and Fold',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
              {
                id: 's-dry',
                name: 'Dry Clean',
                category: 'DRY_CLEAN',
                isActive: true,
                estimatedDays: 2,
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003&workflow=laundry');

    // Add a weight-based laundry item
    const wbTab = await screen.findByText('Weight Based');
    fireEvent.click(wbTab);

    const addBtn = await screen.findByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    const weightInput = await screen.findByLabelText(/Measured Weight/i);
    fireEvent.change(weightInput, { target: { value: '3.00' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Add/i }));

    await waitFor(() => {
      expect(screen.getAllByText('Bulk Laundry').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/3 kg @/i)).toBeInTheDocument();
    });

    // Now operator tries to switch to Dry Cleaning workflow
    const dryCleanBtn = screen.getByRole('tab', { name: /Dry Cleaning/i });
    fireEvent.click(dryCleanBtn);

    // Confirmation modal appears explaining incompatibility
    await waitFor(() => {
      expect(screen.getByText(/Switch to Dry Cleaning Workflow\?/i)).toBeInTheDocument();
      expect(
        screen.getByText(/remove 1 item that is incompatible with Dry Cleaning/i),
      ).toBeInTheDocument();
    });

    // Confirm the switch
    const confirmSwitchBtn = screen.getByRole('button', { name: /Switch & Remove 1 Item/i });
    fireEvent.click(confirmSwitchBtn);

    // Modal closes, incompatible weight item is removed, and customer is preserved
    await waitFor(() => {
      expect(screen.queryByText(/Switch to Dry Cleaning Workflow\?/i)).not.toBeInTheDocument();
      expect(screen.getByText('Amit Shah')).toBeInTheDocument();
      expect(screen.getByText('No items added yet')).toBeInTheDocument();
    });
  });

  it('renders Decision B entry choices: CREATE ORDER PER PIECES and CREATE ORDER PER WEIGHT', async () => {
    renderWithRouter('/orders/new');

    await waitFor(() => {
      expect(screen.getByText('Add Items')).toBeInTheDocument();
    });

    const piecesBtn = screen.getByRole('button', { name: /Create Order Per Pieces/i });
    const weightBtn = screen.getByRole('button', { name: /Create Order Per Weight/i });

    expect(piecesBtn).toBeInTheDocument();
    expect(weightBtn).toBeInTheDocument();
    expect(piecesBtn).toHaveAttribute('aria-pressed', 'true');
    expect(weightBtn).not.toBeDisabled();
  });

  it('switches to Laundry workflow and weight entry when CREATE ORDER PER WEIGHT is clicked', async () => {
    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new');

    await waitFor(() => {
      expect(screen.getByText('Add Items')).toBeInTheDocument();
    });

    const weightBtn = screen.getByRole('button', { name: /Create Order Per Weight/i });
    expect(weightBtn).not.toBeDisabled();
    fireEvent.click(weightBtn);

    expect(weightBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders dedicated Laundry per-weight interface (Screenshot 1) when CREATE ORDER PER WEIGHT is clicked', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/pricing')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { garmentCatalogId: 'g-wb-10', serviceTypeId: 'svc-wash-iron', price: 95 },
              { garmentCatalogId: 'g-wb-10', serviceTypeId: 'svc-wash-fold', price: 80 },
              { garmentCatalogId: 'g-wb-10', serviceTypeId: 'svc-laundry-premium', price: 120 },
              { garmentCatalogId: 'g-wb-10', serviceTypeId: 'svc-laundry-woolen', price: 140 },
              { garmentCatalogId: 'g-wb-10', serviceTypeId: 'svc-laundry-white', price: 110 },
            ],
          }),
        };
      }
      if (url.includes('/garments')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              { id: 'g-wb-10', name: 'Bulk Laundry', category: 'WEIGHT_BASED', isActive: true },
            ],
          }),
        };
      }
      if (url.includes('/services')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'svc-wash-iron',
                name: 'Wash and Steam Iron',
                category: 'WASH_IRON',
                isActive: true,
                estimatedDays: 2,
              },
              {
                id: 'svc-wash-fold',
                name: 'Wash and Fold',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
              {
                id: 'svc-laundry-premium',
                name: 'Premium Laundry',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
              {
                id: 'svc-laundry-woolen',
                name: 'Woolen Laundry',
                category: 'WASH',
                isActive: true,
                estimatedDays: 3,
              },
              {
                id: 'svc-laundry-white',
                name: 'Laundry for White',
                category: 'WASH',
                isActive: true,
                estimatedDays: 2,
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { fireEvent } = await import('@testing-library/react');
    renderWithRouter('/orders/new?customerId=cust-003');

    await waitFor(() => {
      expect(screen.getByText('Add Items')).toBeInTheDocument();
    });

    // Switch to Weight entry mode
    const weightBtn = screen.getByRole('button', { name: /Create Order Per Weight/i });
    fireEvent.click(weightBtn);

    // Verify Screenshot 1 components are visible:
    // 1. Notification banner
    await waitFor(() => {
      expect(screen.getByText(/pending pick up requests/i)).toBeInTheDocument();
      expect(screen.getByText('164')).toBeInTheDocument();
    });

    // 2. Selectable service cards
    expect(screen.getByText('Wash and Steam Iron')).toBeInTheDocument();
    expect(screen.getByText('Wash and Fold')).toBeInTheDocument();
    expect(screen.getByText('Premium Laundry')).toBeInTheDocument();
    expect(screen.getByText('Woolen Laundry')).toBeInTheDocument();
    expect(screen.getByText(/Laundry For White/i)).toBeInTheDocument();

    // 3. Dual-cell input labels
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('Price/ KG')).toBeInTheDocument();
    expect(screen.getByText('No. of Garments')).toBeInTheDocument();

    // 4. Modals buttons: Add on and Garment Details
    expect(screen.getByRole('button', { name: /Add on/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Garment Details/i })).toBeInTheDocument();

    // 5. Add to Cart button
    const addToCartBtn = screen.getByRole('button', { name: /Add to Cart/i });
    expect(addToCartBtn).toBeInTheDocument();

    // 6. Selected Garments side panel with summary and Checkout button
    expect(screen.getByText('Selected Garments')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Checkout/i })).toBeInTheDocument();

    // Select Woolen Laundry card (rate 140 per kg, matching Screenshot 1)
    const woolenCard = screen.getByText('Woolen Laundry');
    fireEvent.click(woolenCard);

    // Price/KG updates to 140
    await waitFor(() => {
      expect(screen.getByText('140')).toBeInTheDocument();
    });

    // Enter weight below 2.00 kg
    const weightInput = screen.getByLabelText(/Measured Weight/i);
    fireEvent.change(weightInput, { target: { value: '1.20' } });
    fireEvent.click(addToCartBtn);

    // Validation rejection
    await waitFor(() => {
      expect(screen.getByText(/Minimum permitted weight is 2.00 kg/i)).toBeInTheDocument();
    });

    // Enter valid weight 2.50 kg
    fireEvent.change(weightInput, { target: { value: '2.50' } });
    fireEvent.click(addToCartBtn);

    // Item appears in Selected Garments panel with total calculated
    await waitFor(() => {
      expect(screen.getByText(/Weight \(KG\) :/i)).toBeInTheDocument();
      expect(screen.getByText('2.5')).toBeInTheDocument();
      // 2.5 kg * 140 = 350
      expect(screen.getByText(/INR 350/i)).toBeInTheDocument();
    });
  });
});
