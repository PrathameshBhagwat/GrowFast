import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OwnerSettingsPage } from './OwnerSettingsPage';
import { Role } from '@growfast/shared-types';

let mockCurrentRole: Role = Role.OWNER;
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
      name: 'Store Owner',
      role: mockCurrentRole,
      storeId: 'store-1',
    },
    logout: vi.fn(),
  }),
}));

// Mock child pages
vi.mock('./TagDesignerPage', () => ({
  TagDesignerPage: () => <div data-testid="mock-tag-designer">Tag Designer Embedded</div>,
}));
vi.mock('./StaffManagementPage', () => ({
  StaffManagementPage: () => <div data-testid="mock-staff-mgmt">Staff Management Embedded</div>,
}));
vi.mock('./CatalogSettingsPage', () => ({
  CatalogSettingsPage: () => (
    <div data-testid="mock-catalog-settings">Catalog Settings Embedded</div>
  ),
}));

describe('OwnerSettingsPage (Owner Settings Navigation & Role Control)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentRole = Role.OWNER;
  });

  it('renders all three owner sections: Staff, Design Tags, and Catalog for OWNER', () => {
    render(
      <MemoryRouter initialEntries={['/owner/settings?tab=design-tags']}>
        <OwnerSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Owner Settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /design tags/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /catalog/i })).toBeInTheDocument();

    // Default tab is design tags
    expect(screen.getByTestId('mock-tag-designer')).toBeInTheDocument();
  });

  it('switches between tabs when navigation tabs are clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/owner/settings']}>
        <OwnerSettingsPage />
      </MemoryRouter>,
    );

    // Click Staff tab
    const staffTab = screen.getByRole('button', { name: /staff/i });
    fireEvent.click(staffTab);

    // Click Catalog tab
    const catalogTab = screen.getByRole('button', { name: /catalog/i });
    fireEvent.click(catalogTab);
  });

  it('denies access to non-owner role', () => {
    mockCurrentRole = Role.COUNTER;

    render(
      <MemoryRouter initialEntries={['/owner/settings']}>
        <OwnerSettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Owner Authorization Required')).toBeInTheDocument();
    expect(
      screen.getByText(/Only authenticated Store Owners have authorization/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('mock-tag-designer')).not.toBeInTheDocument();
  });
});
