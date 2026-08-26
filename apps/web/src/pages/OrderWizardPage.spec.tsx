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
      expect(screen.getByText('Select Mock Customer')).toBeInTheDocument();
    });

    expect(screen.getByText('Customer search component will go here.')).toBeInTheDocument();

    // Verify it fetched pricing, but did NOT fetch customer
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pricing'),
      expect.any(Object),
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/customers'),
      expect.any(Object),
    );
  });

  it('reads customerId from URL, fetches customer, and pre-selects it', async () => {
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

    // Should display error state
    await waitFor(() => {
      expect(screen.getByText('Failed to load customer (404)')).toBeInTheDocument();
    });
  });
});
