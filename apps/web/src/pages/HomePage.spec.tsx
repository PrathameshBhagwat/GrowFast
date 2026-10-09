import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './HomePage';
import { OrderStatus, PickupType, MembershipTier } from '@growfast/shared-types';

let mockEmployee = {
  id: 'emp-counter-001',
  name: 'Anita Desai',
  role: 'COUNTER',
  storeId: 'store-pune-001',
  storeName: 'Pune Main Store',
};

const mockLogout = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-jwt-token',
    employee: mockEmployee,
    logout: mockLogout,
  }),
}));

global.fetch = vi.fn();

const mockDueOrders = [
  {
    id: 'ord-1024',
    orderNumber: 'ORD-1024',
    customerId: 'cust-001',
    customerName: 'Rahul Patil',
    customerPhone: '+919876543210',
    orderDate: '2026-10-07T10:00:00.000Z',
    effectiveDueDate: '2026-10-07T17:30:00.000Z',
    isExpress: false,
    priority: 'STANDARD',
    status: OrderStatus.READY,
    subtotal: 500,
    discountAmount: 0,
    taxAmount: 90,
    totalAmount: 590,
    amountPaid: 240,
    amountDue: 350,
    paymentStatus: 'PARTIAL',
    pickupType: PickupType.HOME_DELIVERY,
    itemCount: 4,
    readyAmount: 590,
    remainingAmount: 0,
  },
  {
    id: 'ord-1025',
    orderNumber: 'ORD-1025',
    customerId: 'cust-002',
    customerName: 'Amit Sharma',
    customerPhone: '+919811122334',
    orderDate: '2026-10-07T11:00:00.000Z',
    effectiveDueDate: '2026-10-07T19:00:00.000Z',
    isExpress: true,
    priority: 'EXPRESS',
    status: OrderStatus.PROCESSING,
    subtotal: 300,
    discountAmount: 0,
    taxAmount: 54,
    totalAmount: 354,
    amountPaid: 354,
    amountDue: 0,
    paymentStatus: 'PAID',
    pickupType: PickupType.STORE_PICKUP,
    itemCount: 2,
    readyAmount: 0,
    remainingAmount: 354,
  },
];

const mockCustomers = [
  {
    id: 'cust-001',
    name: 'Rahul Patil',
    phone: '+919876543210',
    email: 'rahul.patil@example.com',
    address: 'Flat 402, Baner Road, Pune',
    pincode: '411045',
    membership: MembershipTier.GOLD,
    discountPercent: 10,
  },
];

const renderHomePage = () => {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/orders/:id"
          element={<div data-testid="order-detail-page">Order Detail Target</div>}
        />
        <Route
          path="/orders/new"
          element={<div data-testid="new-order-page">New Order Target</div>}
        />
        <Route
          path="/customers/:id"
          element={<div data-testid="customer-profile-page">Customer Profile Target</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
};

describe('HomePage Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('countOnly=true')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, count: 2 }),
        };
      }
      if (url.includes('/orders/due-today')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockDueOrders,
            total: 2,
          }),
        };
      }
      if (url.includes('/customers/search')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockCustomers,
            total: 1,
            page: 1,
            pageSize: 10,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });
  });

  it('1. Initial Load: does NOT automatically display customer list or due orders list', async () => {
    renderHomePage();

    // Initial heading and structure are present
    expect(screen.getByText('Search Customer / Invoice')).toBeInTheDocument();
    expect(screen.getByText("Today's Due Orders")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add new customer/i })).toBeInTheDocument();

    // Customer search results must NOT be in the document initially
    expect(screen.queryByText('Rahul Patil')).not.toBeInTheDocument();
    expect(screen.queryByText('GOLD TIER')).not.toBeInTheDocument();

    // Due orders list must NOT be rendered initially
    expect(screen.queryByText('#ORD-1024')).not.toBeInTheDocument();
    expect(screen.queryByText('#ORD-1025')).not.toBeInTheDocument();
    expect(screen.queryByText("Loading today's due orders...")).not.toBeInTheDocument();

    // The primary action button is clearly visible
    const viewDueOrdersBtn = screen.getByRole('button', { name: /view today's due orders/i });
    expect(viewDueOrdersBtn).toBeInTheDocument();
  });

  it('2. Clicking "View Today\'s Due Orders" loads orders and displays them cleanly', async () => {
    renderHomePage();

    const viewDueOrdersBtn = screen.getByRole('button', { name: /view today's due orders/i });
    fireEvent.click(viewDueOrdersBtn);

    // Order items become visible after fetch
    await waitFor(() => {
      expect(screen.getByText('#ORD-1024')).toBeInTheDocument();
      expect(screen.getByText('#ORD-1025')).toBeInTheDocument();
    });

    // Check operational details
    expect(screen.getByText('Home Delivery')).toBeInTheDocument();
    expect(screen.getByText('Store Pickup')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('Processing · Not Ready')).toBeInTheDocument();
    expect(screen.getByText('Balance: ₹350')).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('3. Clicking "View Order" on a due order navigates to /orders/:id', async () => {
    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: /view today's due orders/i }));

    await waitFor(() => {
      expect(screen.getByText('#ORD-1024')).toBeInTheDocument();
    });

    const viewOrderBtn = screen.getByRole('button', { name: /view order ord-1024/i });
    fireEvent.click(viewOrderBtn);

    await waitFor(() => {
      expect(screen.getByTestId('order-detail-page')).toBeInTheDocument();
    });
  });

  it('4. Empty State: displays friendly caught-up message when no orders are due', async () => {
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/orders/due-today')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [], total: 0 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });

    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: /view today's due orders/i }));

    await waitFor(() => {
      expect(screen.getByText('No orders are due today.')).toBeInTheDocument();
      expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    });
  });

  it('5. Error State: displays error and allows retry when fetch fails', async () => {
    let shouldFail = true;
    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('countOnly=true')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, count: 0 }),
        };
      }
      if (url.includes('/orders/due-today')) {
        if (shouldFail) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ message: 'Unable to connect to database' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockDueOrders, total: 2 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: [] }),
      };
    });

    renderHomePage();

    fireEvent.click(screen.getByRole('button', { name: /view today's due orders/i }));

    await waitFor(() => {
      expect(screen.getByText("Unable to load today's due orders.")).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to database')).toBeInTheDocument();
    });

    // Retry
    shouldFail = false;
    const retryBtn = screen.getByText(/try again/i);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('#ORD-1024')).toBeInTheDocument();
    });
  });

  it('6. Customer Search: typing a query searches and displays customer results', async () => {
    renderHomePage();

    const searchInput = screen.getByLabelText(/search customer or invoice/i);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });

    await waitFor(
      () => {
        expect(screen.getByText('Rahul Patil')).toBeInTheDocument();
        expect(screen.getByText('GOLD TIER')).toBeInTheDocument();
        expect(screen.getByText('+919876543210')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('7. Selecting a searched customer displays order intake action seam', async () => {
    renderHomePage();

    const searchInput = screen.getByLabelText(/search customer or invoice/i);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });

    await waitFor(
      () => {
        expect(screen.getByText('Rahul Patil')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByText('Rahul Patil'));

    expect(screen.getByText(/active customer/i)).toBeInTheDocument();
    const newOrderBtn = screen.getByRole('button', { name: /create order for customer/i });
    expect(newOrderBtn).toBeInTheDocument();

    fireEvent.click(newOrderBtn);
    await waitFor(() => {
      expect(screen.getByTestId('new-order-page')).toBeInTheDocument();
    });
  });

  it('8. Add New Customer button opens creation modal', async () => {
    renderHomePage();

    const addCustomerBtn = screen.getByRole('button', { name: /add new customer/i });
    fireEvent.click(addCustomerBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Create New Customer')).toBeInTheDocument();
    });
  });

  it('9. All primary action controls satisfy >= 44px touch targets', () => {
    renderHomePage();

    const addCustomerBtn = screen.getByRole('button', { name: /add new customer/i });
    const viewDueOrdersBtn = screen.getByRole('button', { name: /view today's due orders/i });

    expect(addCustomerBtn).toHaveStyle({ minHeight: '44px' });
    expect(viewDueOrdersBtn).toHaveStyle({ minHeight: '44px' });
  });
});
