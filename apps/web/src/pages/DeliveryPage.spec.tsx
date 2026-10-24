import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DeliveryPage } from './DeliveryPage';
import { Role } from '@growfast/shared-types';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    employee: {
      id: 'emp-1',
      name: 'Test Staff',
      role: Role.COUNTER,
      storeId: 'store-1',
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../services/delivery.api', () => ({
  fetchDeliveries: vi.fn().mockResolvedValue([]),
  updateDeliveryStatus: vi.fn().mockResolvedValue({}),
  completeDelivery: vi.fn().mockResolvedValue({}),
}));

describe('DeliveryPage Back Button & Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders consistent back button matching Owner Settings styling', async () => {
    render(
      <MemoryRouter initialEntries={['/deliveries']}>
        <DeliveryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    expect(backBtn).toBeInTheDocument();
    expect(backBtn).toHaveAttribute('id', 'delivery-back-btn');

    // Matches exact styling of Owner Settings back button
    expect(backBtn).toHaveStyle({
      width: '36px',
      height: '36px',
      borderRadius: '10px',
    });

    // Contains ArrowLeft icon and touch target classes
    expect(backBtn.className).toContain('hover:text-[var(--text-primary)]');
    expect(backBtn.className).toContain('before:absolute');
  });

  it('navigates to Dashboard ("/") when clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/deliveries']}>
        <DeliveryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('positions the back button to the left of the Delivery Management heading', async () => {
    render(
      <MemoryRouter initialEntries={['/deliveries']}>
        <DeliveryPage />
      </MemoryRouter>,
    );

    const backBtn = screen.getByRole('button', { name: /back to dashboard/i });
    const heading = screen.getByRole('heading', { level: 1, name: /delivery management/i });

    expect(backBtn).toBeInTheDocument();
    expect(heading).toBeInTheDocument();

    // Verify ordering in DOM: backBtn comes before heading inside header
    expect(backBtn.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
