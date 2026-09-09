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
    renderWithRouter('/orders/new?customerId=cust-003');

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
      expect(screen.getByText(/Photos: 0 \/ 1 pieces covered/i)).toBeInTheDocument();
      expect(screen.getByText(/Photos required for all pieces/i)).toBeInTheDocument();
    });

    // Proceed button should be disabled
    const proceedBtn = screen.getByRole('button', { name: /Proceed to Review/i });
    expect(proceedBtn).toBeDisabled();
  });
});
