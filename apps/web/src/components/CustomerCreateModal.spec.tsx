import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerCreateModal } from './CustomerCreateModal';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-jwt-token',
    employee: { id: 'emp-1', name: 'Counter Staff', role: 'COUNTER', storeId: 'store-1' },
    logout: vi.fn(),
  }),
}));

global.fetch = vi.fn();

describe('CustomerCreateModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders Customer Name, WhatsApp Number, Address, and Pincode fields', () => {
    render(<CustomerCreateModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Required and active fields
    expect(screen.getByLabelText(/customer name \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/whatsapp number \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pincode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create customer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Confirm removed fields are NOT present
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/registration source/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/garment processing preferences/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fragrance/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/starch/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/fold/i)).not.toBeInTheDocument();
  });

  it('2. validates required Customer Name and WhatsApp Number', async () => {
    render(<CustomerCreateModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const submitBtn = screen.getByRole('button', { name: /create customer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/customer name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/whatsapp number is required/i)).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('3. validates invalid WhatsApp number format (<10 digits)', async () => {
    render(<CustomerCreateModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByLabelText(/customer name \*/i), {
      target: { value: 'Suresh Raina' },
    });
    fireEvent.change(screen.getByLabelText(/whatsapp number \*/i), {
      target: { value: '98765' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid 10 to 15-digit whatsapp number/i)).toBeInTheDocument();
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('4. submits successfully with Name, WhatsApp Number, Address, and Pincode', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: 'cust-999',
          name: 'Suresh Raina',
          phone: '9876543210',
          email: null,
          address: '402 Sunrise Heights, Pune',
          pincode: '411001',
          membership: 'NONE',
          discountPercent: 0,
          preferences: null,
          registrationSource: 'WALK_IN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });

    render(<CustomerCreateModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByLabelText(/customer name \*/i), {
      target: { value: 'Suresh Raina' },
    });
    fireEvent.change(screen.getByLabelText(/whatsapp number \*/i), {
      target: { value: '9876543210' },
    });
    fireEvent.change(screen.getByLabelText(/^address$/i), {
      target: { value: '402 Sunrise Heights, Pune' },
    });
    fireEvent.change(screen.getByLabelText(/pincode/i), {
      target: { value: '411001' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-jwt-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            name: 'Suresh Raina',
            phone: '9876543210',
            address: '402 Sunrise Heights, Pune',
            pincode: '411001',
          }),
        }),
      );
      expect(mockOnSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'cust-999',
          name: 'Suresh Raina',
          phone: '9876543210',
          pincode: '411001',
        }),
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('5. handles 409 conflict when customer with WhatsApp number already exists', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        message: 'A customer with WhatsApp number 9876543210 already exists.',
      }),
    });

    render(<CustomerCreateModal open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    fireEvent.change(screen.getByLabelText(/customer name \*/i), {
      target: { value: 'Existing User' },
    });
    fireEvent.change(screen.getByLabelText(/whatsapp number \*/i), {
      target: { value: '9876543210' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create customer/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText(/a customer with whatsapp number 9876543210 already exists/i).length,
      ).toBeGreaterThanOrEqual(1);
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
