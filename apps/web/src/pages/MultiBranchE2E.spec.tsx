import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BranchProvider, useBranch, ALL_BRANCHES_ID } from '../contexts/BranchContext';
import { BranchSelector } from '../components/BranchSelector';
import {
  Role,
  type BranchDTO,
  type CustomerDTO,
  type OrderSummaryDTO,
} from '@growfast/shared-types';
import * as AuthContextModule from '../contexts/AuthContext';
import * as ApiModule from '../services/api';

vi.mock('../services/api', () => ({
  apiFetch: vi.fn(),
  getActiveBranchId: vi.fn(),
  setActiveBranchId: vi.fn(),
}));

const mockBranches: BranchDTO[] = [
  {
    id: 'store-kp-001',
    name: 'Charholi Branch',
    code: 'CHARHOLI',
    address: 'Shop 4, Lane 7, Charholi, Pune 412105',
    phone: '+91 20 2615 0000',
    email: 'charholi@growfast.in',
    isActive: true,
    expressSurchargePercent: 25,
  },
  {
    id: 'store-kp-002',
    name: 'Alephata Branch',
    code: 'ALEPHATA',
    address: 'Shop 10, Pune-Nashik Highway, Alephata 412411',
    phone: '+91 20 2615 9999',
    email: 'alephata@growfast.in',
    isActive: true,
    expressSurchargePercent: 25,
  },
];

const WebBranchIntegrationDashboard: React.FC = () => {
  const { activeBranchId, activeBranch, isAllBranches, canSwitchBranch, setActiveBranchId } =
    useBranch();

  const handleStartOrder = () => {
    if (isAllBranches) {
      alert('Order creation requires selecting a specific physical branch.');
      return;
    }
  };

  return (
    <div>
      <BranchSelector />
      <div data-testid="dashboard-branch-id">{activeBranchId}</div>
      <div data-testid="dashboard-branch-name">
        {isAllBranches ? 'All Branches' : activeBranch?.name}
      </div>
      <div data-testid="can-switch">{canSwitchBranch ? 'true' : 'false'}</div>
      <button data-testid="btn-create-order" onClick={handleStartOrder}>
        + Create Order
      </button>
    </div>
  );
};

describe('Phase 5 — Web Multi-Branch End-to-End Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. OWNER Workflow & Multi-Store Control', () => {
    it('1.1 allows OWNER to switch branches from Charholi to Alephata and All Branches', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        employee: {
          id: 'emp-owner-001',
          name: 'Amit Jangam',
          role: Role.OWNER,
          storeId: 'store-kp-001',
          storeName: 'Charholi Branch',
        } as any,
        token: 'mock-jwt-token',
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      vi.mocked(ApiModule.apiFetch).mockResolvedValue({
        success: true,
        data: mockBranches,
      });

      vi.mocked(ApiModule.getActiveBranchId).mockReturnValue('store-kp-001');

      render(
        <BranchProvider>
          <WebBranchIntegrationDashboard />
        </BranchProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-branch-id').textContent).toBe('store-kp-001');
      });
      expect(screen.getByTestId('can-switch').textContent).toBe('true');

      // Click dropdown trigger to open
      const trigger = screen.getByRole('button', { name: /switch active branch/i });
      fireEvent.click(trigger);

      // Select Alephata
      const alephataOption = screen.getByRole('option', {
        name: /select branch: alephata branch/i,
      });
      fireEvent.click(alephataOption);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-branch-id').textContent).toBe('store-kp-002');
        expect(screen.getByTestId('dashboard-branch-name').textContent).toBe('Alephata Branch');
      });

      // Click dropdown trigger again and select All Branches
      fireEvent.click(screen.getByRole('button', { name: /switch active branch/i }));
      const allBranchesOption = screen.getByRole('option', {
        name: /select all branches/i,
      });
      fireEvent.click(allBranchesOption);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-branch-id').textContent).toBe('all');
        expect(screen.getByTestId('dashboard-branch-name').textContent).toBe('All Branches');
      });
    });

    it('1.2 prevents order creation when active branch is All Branches', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        employee: {
          id: 'emp-owner-001',
          name: 'Amit Jangam',
          role: Role.OWNER,
          storeId: 'store-kp-001',
        } as any,
        token: 'mock-jwt-token',
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      vi.mocked(ApiModule.apiFetch).mockResolvedValue({
        success: true,
        data: mockBranches,
      });

      vi.mocked(ApiModule.getActiveBranchId).mockReturnValue('all');
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <BranchProvider>
          <WebBranchIntegrationDashboard />
        </BranchProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-branch-id').textContent).toBe('all');
      });

      const createOrderBtn = screen.getByTestId('btn-create-order');
      fireEvent.click(createOrderBtn);

      expect(alertSpy).toHaveBeenCalledWith(
        'Order creation requires selecting a specific physical branch.',
      );
    });
  });

  describe('2. Staff Restrictions & Security Enforcement', () => {
    it('2.1 restricts COUNTER staff to assigned branch without branch switching capability', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        employee: {
          id: 'emp-counter-001',
          name: 'Swapnil Shinde',
          role: Role.COUNTER,
          storeId: 'store-kp-001',
          storeName: 'Charholi Branch',
        } as any,
        token: 'mock-jwt-token',
        login: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      vi.mocked(ApiModule.apiFetch).mockResolvedValue({
        success: true,
        data: mockBranches,
      });

      vi.mocked(ApiModule.getActiveBranchId).mockReturnValue('store-kp-001');

      render(
        <BranchProvider>
          <WebBranchIntegrationDashboard />
        </BranchProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-branch-id').textContent).toBe('store-kp-001');
      });

      expect(screen.getByTestId('can-switch').textContent).toBe('false');

      // Dropdown trigger should NOT exist for non-owners
      expect(screen.queryByRole('button', { name: /switch active branch/i })).toBeNull();

      // Read-only branch pill should be displayed
      expect(screen.getAllByText('Charholi Branch').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('CHARHOLI')).toBeTruthy();
    });
  });
});
