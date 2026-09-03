import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CatalogSettingsPage } from './CatalogSettingsPage';
import { Role, GarmentCategory } from '@growfast/shared-types';

let mockEmployee = {
  id: 'emp-owner-001',
  name: 'Prathamesh',
  role: Role.OWNER,
  storeId: 'store-kp-001',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'valid-jwt-token',
    employee: mockEmployee,
  }),
}));

const mockServices = [
  { id: 'svc-dc', name: 'Dry Cleaning', isActive: true },
  { id: 'svc-sp', name: 'Steam Pressing', isActive: true },
];

const mockGarments = [
  { id: 'g1', name: 'Formal Shirt', category: GarmentCategory.MEN, isActive: true },
  { id: 'g2', name: 'Jeans', category: GarmentCategory.MEN, isActive: true },
  { id: 'g3', name: 'Silk Saree', category: GarmentCategory.WOMEN, isActive: true },
];

const mockPrices = [
  { garmentCatalogId: 'g1', serviceTypeId: 'svc-dc', price: 105 },
  { garmentCatalogId: 'g1', serviceTypeId: 'svc-sp', price: 30 },
  { garmentCatalogId: 'g2', serviceTypeId: 'svc-dc', price: 110 },
];

global.fetch = vi.fn();

describe('CatalogSettingsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEmployee = {
      id: 'emp-owner-001',
      name: 'Prathamesh',
      role: Role.OWNER,
      storeId: 'store-kp-001',
    };

    (global.fetch as any).mockImplementation(async (url: string) => {
      if (url.includes('/services')) {
        return { ok: true, json: async () => ({ success: true, data: mockServices }) };
      }
      if (url.includes('/garments')) {
        return { ok: true, json: async () => ({ success: true, data: mockGarments }) };
      }
      if (url.includes('/pricing')) {
        return { ok: true, json: async () => ({ success: true, data: mockPrices }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <CatalogSettingsPage />
      </MemoryRouter>,
    );
  };

  it('renders service bar, category bar, search, and garment tiles for OWNER', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Dry Cleaning').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Steam Pressing')).toBeInTheDocument();
      expect(screen.getByText('Men')).toBeInTheDocument();
      expect(screen.getByText('Women')).toBeInTheDocument();
      expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
      expect(screen.getByText('Jeans')).toBeInTheDocument();
      expect(screen.getByText('₹105')).toBeInTheDocument();
      expect(screen.getByText('₹110')).toBeInTheDocument();
    });

    // Verify Owner has Add Garment button and tabs
    expect(screen.getByText('Add Garment')).toBeInTheDocument();
    expect(screen.getByText('Catalog View')).toBeInTheDocument();
    expect(screen.getByText('Service Pricing')).toBeInTheDocument();
  });

  it('updates price badge when switching active service', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
      expect(screen.getByText('₹105')).toBeInTheDocument();
    });

    // Click "Steam Pressing" service
    fireEvent.click(screen.getByText('Steam Pressing'));

    await waitFor(() => {
      // Formal Shirt price for Steam Pressing is 30
      expect(screen.getByText('₹30')).toBeInTheDocument();
      // Jeans has no Steam Pressing price configured
      expect(screen.getByText('Not Configured')).toBeInTheDocument();
    });
  });

  it('filters garments when switching category tab', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
    });

    // Switch to Women category
    fireEvent.click(screen.getByText('Women'));

    await waitFor(() => {
      expect(screen.getByText('Silk Saree')).toBeInTheDocument();
      expect(screen.queryByText('Formal Shirt')).not.toBeInTheDocument();
    });
  });

  it('filters garments via search input', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
      expect(screen.getByText('Jeans')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search in Men/i);
    fireEvent.change(searchInput, { target: { value: 'Jeans' } });

    await waitFor(() => {
      expect(screen.getByText('Jeans')).toBeInTheDocument();
      expect(screen.queryByText('Formal Shirt')).not.toBeInTheDocument();
    });
  });

  it('allows COUNTER role to add garments but NOT configure pricing matrix', async () => {
    mockEmployee = {
      id: 'emp-counter-001',
      name: 'Swapnil',
      role: Role.COUNTER,
      storeId: 'store-kp-001',
    };

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText('Dry Cleaning').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Formal Shirt')).toBeInTheDocument();
    });

    // Counter sees Add Garment button but NO Service Pricing tab
    expect(screen.getByText('Add Garment')).toBeInTheDocument();
    expect(screen.queryByText('Service Pricing')).not.toBeInTheDocument();
    expect(screen.queryByText(/View Only \(Counter\)/i)).not.toBeInTheDocument();
  });
});
