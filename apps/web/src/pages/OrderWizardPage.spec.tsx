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

  it('renders Dry Cleaning as default workflow in per-piece without secondary laundry toggle, and exposes Weight Based exception category', async () => {
    renderWithRouter('/orders/new?customerId=cust-003');

    // Secondary laundry sub-selector toggle is removed from per-piece
    expect(screen.queryByRole('tab', { name: /Laundry \(Per Piece\)/i })).not.toBeInTheDocument();
    expect(screen.getByText('Per-Piece Garments (Dry Cleaning)')).toBeInTheDocument();

    // Weight Based exception category is visible with the categories
    const wbCategoryBtn = await screen.findByRole('button', { name: /Weight Based/i });
    expect(wbCategoryBtn).toBeInTheDocument();
  });

  it('shows Dry Clean service and includes Weight Based (Exception) category when per-piece is active', async () => {
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
              { garmentCatalogId: 'g2', serviceTypeId: 's2', price: 80 },
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

    // In Dry Cleaning workflow on Men, Wash and Fold is not shown
    expect(screen.queryByText('Wash and Fold')).not.toBeInTheDocument();

    // In Dry Cleaning workflow, Weight Based exception category is present with the categories
    const wbTab = await screen.findByRole('button', { name: /Weight Based/i });
    expect(wbTab).toBeInTheDocument();

    // Clicking Weight Based exception category reveals exactly ONE Weight Based exception card
    fireEvent.click(wbTab);
    await waitFor(() => {
      expect(screen.getByText('Per Piece Exception')).toBeInTheDocument();
      expect(screen.getByText('WEI-01')).toBeInTheDocument();
    });

    // Clicking Add opens the piece exception modal with 3 x 40 = 120
    const addBtn = screen.getByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Weight Based — Per Piece Entry')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Strictly per-piece pricing exception. No kilograms will be measured or billed.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('₹120')).toBeInTheDocument();
    });

    // Confirm and add to order
    const confirmBtn = screen.getByRole('button', { name: /Add to Order/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getAllByText('₹120.00').length).toBeGreaterThan(0);
    });
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
    const wbTab = await screen.findByRole('button', { name: /Weight Based/i });
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
    const wbTab = await screen.findByRole('button', { name: /Weight Based/i });
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

    // Now operator tries to switch to Dry Cleaning workflow via top "Create Order Per Piece" button
    const piecesBtn = screen.getByRole('button', { name: /Create Order Per Piece/i });
    fireEvent.click(piecesBtn);

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

    // 1. Notification banner is completely removed from the page
    expect(screen.queryByText(/pending pick up requests/i)).not.toBeInTheDocument();

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

  it('makes the Add-on option visible and usable in Per-Piece mode, supports multiple add-ons, price recalculation, and chip removal', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/store/config')) {
        return {
          ok: true,
          json: async () => ({
            id: 'store1',
            topUpServices: [
              { id: 'addon-starch', name: 'Starching', price: 30, description: 'Crisp finish' },
              {
                id: 'addon-stain',
                name: 'Stain Treatment',
                price: 50,
                description: 'Spot removal',
              },
            ],
          }),
        };
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
            data: [
              {
                id: 's1',
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
    renderWithRouter('/orders/new?customerId=cust-003&workflow=dry_cleaning');

    // Wait for catalog to load Shirt and Dry Clean
    await waitFor(() => {
      expect(screen.getByText('Shirt')).toBeInTheDocument();
      expect(screen.getAllByText('Dry Clean').length).toBeGreaterThan(0);
    });

    // 1. Add Shirt to the cart
    const addBtn = screen.getByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    // Current order displays Shirt with initial price ₹100.00
    await waitFor(() => {
      expect(screen.getByText('Current Order')).toBeInTheDocument();
      expect(screen.getAllByText('₹100.00').length).toBeGreaterThan(0);
    });

    // 2. Add-on button is visible on the item card with >= 44px min-height
    const addonBtn = screen.getByRole('button', { name: /Add-on/i });
    expect(addonBtn).toBeInTheDocument();
    expect(addonBtn).toHaveClass('min-h-[44px]');

    // 3. Click Add-on button -> Opens Select Supported Add-ons dialog
    fireEvent.click(addonBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Select Add-ons/i })).toBeInTheDocument();
      expect(screen.getByText('Select Supported Add-ons')).toBeInTheDocument();
      expect(screen.getByText('Starching')).toBeInTheDocument();
      expect(screen.getByText('+₹30')).toBeInTheDocument();
      expect(screen.getByText('Stain Treatment')).toBeInTheDocument();
      expect(screen.getByText('+₹50')).toBeInTheDocument();
    });

    // 4. Select multiple add-ons: Starching and Stain Treatment
    const starchingCheckbox = screen.getByLabelText(/Starching/i);
    const stainCheckbox = screen.getByLabelText(/Stain Treatment/i);
    fireEvent.click(starchingCheckbox);
    fireEvent.click(stainCheckbox);

    // Done button inside dialog closes modal
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    expect(doneBtn).toHaveClass('min-h-[44px]');
    fireEvent.click(doneBtn);

    // Modal closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Select Add-ons/i })).not.toBeInTheDocument();
    });

    // 5. Item card displays add-on badges and updated item price: 100 + 30 + 50 = ₹180.00
    await waitFor(() => {
      expect(screen.getByText('Starching (+₹30)')).toBeInTheDocument();
      expect(screen.getByText('Stain Treatment (+₹50)')).toBeInTheDocument();
      expect(screen.getAllByText('₹180.00').length).toBeGreaterThan(0);
      expect(screen.getByText('(+₹80.00 add-ons)')).toBeInTheDocument();
    });

    // 6. Test removing one add-on via badge delete button (remove Stain Treatment)
    const removeStainBtn = screen.getByRole('button', { name: /Remove Stain Treatment/i });
    fireEvent.click(removeStainBtn);

    // Price updates to: 100 + 30 = ₹130.00
    await waitFor(() => {
      expect(screen.queryByText('Stain Treatment (+₹50)')).not.toBeInTheDocument();
      expect(screen.getByText('Starching (+₹30)')).toBeInTheDocument();
      expect(screen.getAllByText('₹130.00').length).toBeGreaterThan(0);
    });

    // 7. Verify quantity multiplication: increase quantity to 2
    const plusBtn = screen.getByRole('button', { name: /Increase quantity/i });
    fireEvent.click(plusBtn);

    // Quantity becomes 2, line total is (100 + 30) * 2 = ₹260.00
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getAllByText('₹260.00').length).toBeGreaterThan(0);
    });
  });

  it('removes selected add-ons cleanly when garment is removed without leaving invalid add-ons', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/customers/cust-003')) {
        return { ok: true, json: async () => ({ data: mockCustomer }) };
      }
      if (url.includes('/store/config')) {
        return {
          ok: true,
          json: async () => ({
            id: 'store1',
            topUpServices: [{ id: 'addon-starch', name: 'Starching', price: 30 }],
          }),
        };
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
            data: [
              {
                id: 's1',
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
    renderWithRouter('/orders/new?customerId=cust-003&workflow=dry_cleaning');

    await waitFor(() => {
      expect(screen.getByText('Shirt')).toBeInTheDocument();
    });

    // Add Shirt
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    // Open Add-on modal and add Starching
    const addonBtn = await screen.findByRole('button', { name: /Add-on/i });
    fireEvent.click(addonBtn);

    const starchingCheckbox = await screen.findByLabelText(/Starching/i);
    fireEvent.click(starchingCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /Done/i }));

    await waitFor(() => {
      expect(screen.getByText('Starching (+₹30)')).toBeInTheDocument();
    });

    // Delete item from cart
    const deleteBtn = screen.getByRole('button', { name: /Delete item/i });
    fireEvent.click(deleteBtn);

    // Item and its add-on are completely removed
    await waitFor(() => {
      expect(screen.queryByText('Starching (+₹30)')).not.toBeInTheDocument();
      expect(screen.getByText('No items added yet')).toBeInTheDocument();
    });
  });
});
