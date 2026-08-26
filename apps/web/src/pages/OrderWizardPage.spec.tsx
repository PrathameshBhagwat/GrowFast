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

  it('renders normal flow without customerId', () => {
    renderWithRouter('/orders/new');
    expect(screen.getByText('Customer search component will go here.')).toBeInTheDocument();
    expect(screen.getByText('Select Mock Customer')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reads customerId from URL, fetches customer, and pre-selects it', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCustomer }),
    });

    renderWithRouter('/orders/new?customerId=cust-003');

    // Loading state should appear first
    expect(screen.getByText('Loading customer details...')).toBeInTheDocument();

    // Verify fetch was called with right URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/customers/cust-003'),
      expect.any(Object),
    );

    // After fetch completes, the customer info should be rendered
    await waitFor(() => {
      expect(screen.getByText('Amit Shah')).toBeInTheDocument();
      expect(screen.getByText('+919811122334')).toBeInTheDocument();
    });

    // Verify no manual selection required
    expect(screen.queryByText('Select Mock Customer')).not.toBeInTheDocument();
  });

  it('handles invalid customerId gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Customer not found' }),
    });

    renderWithRouter('/orders/new?customerId=invalid-123');

    // Should display error state
    await waitFor(() => {
      expect(screen.getByText('Failed to load customer (404)')).toBeInTheDocument();
    });
  });
});
