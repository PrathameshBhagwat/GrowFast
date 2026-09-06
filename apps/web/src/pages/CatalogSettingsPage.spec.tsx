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

    (global.fetch as any).mockImplementation(async (url: string, init?: any) => {
      if (url.includes('/services')) {
        return { ok: true, json: async () => ({ success: true, data: mockServices }) };
      }
      if (url.includes('/garments')) {
        if (init?.method === 'POST') {
          const body = JSON.parse(init.body || '{}');
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { id: 'g-new-123', name: body.name, category: body.category },
            }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: mockGarments }) };
      }
      if (url.includes('/pricing')) {
        if (init?.method === 'POST') {
          return { ok: true, json: async () => ({ success: true, data: { id: 'p-new' } }) };
        }
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
      expect(screen.getByText('No Price')).toBeInTheDocument();
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

  it('renders Add New Garment modal matching Stitch design layout with optional pricing for OWNER', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Add Garment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Garment'));

    await waitFor(() => {
      expect(screen.getByText('Add New Garment')).toBeInTheDocument();
      expect(screen.getByText('QUICK CREATE')).toBeInTheDocument();
      expect(screen.getByText('GARMENT DETAILS')).toBeInTheDocument();
      expect(screen.getByText('SERVICE PRICING (OPTIONAL)')).toBeInTheDocument();
      expect(
        screen.getByText(/You can set standard prices now or configure them later/i),
      ).toBeInTheDocument();
      expect(screen.getByText('Prices can be edited anytime from catalog')).toBeInTheDocument();
      expect(screen.getByText('Create Garment')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('successfully creates garment when all prices are empty', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Add Garment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Garment'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Silk Blazer/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/e\.g\. Silk Blazer/i);
    fireEvent.change(nameInput, { target: { value: 'Linen Kurta' } });

    const createBtn = screen.getByText('Create Garment');
    fireEvent.click(createBtn);

    await waitFor(() => {
      // Modal closes upon successful creation
      expect(screen.queryByText('Add New Garment')).not.toBeInTheDocument();
    });

    // Verify POST /garments was called with correct payload
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/garments'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"Linen Kurta"'),
      }),
    );
  });

  it('saves optional service prices when entered during garment creation', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Add Garment')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Garment'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Silk Blazer/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/e\.g\. Silk Blazer/i);
    fireEvent.change(nameInput, { target: { value: 'Sherwani Set' } });

    // Enter price for Dry Cleaning
    const priceInputs = screen.getAllByPlaceholderText('—');
    expect(priceInputs.length).toBeGreaterThan(0);
    fireEvent.change(priceInputs[0], { target: { value: '250' } });

    const createBtn = screen.getByText('Create Garment');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.queryByText('Add New Garment')).not.toBeInTheDocument();
    });

    // Verify POST /pricing was called for the entered price
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/pricing/g-new-123/'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ price: 250 }),
      }),
    );
  });
});
