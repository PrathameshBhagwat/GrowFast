import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BranchProvider, useBranch, ALL_BRANCHES_ID } from './BranchContext';
import { Role, type BranchDTO } from '@growfast/shared-types';
import * as AuthContextModule from './AuthContext';
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

const TestBranchConsumer: React.FC = () => {
  const {
    branches,
    activeBranchId,
    activeBranch,
    isAllBranches,
    canSwitchBranch,
    isLoading,
    error,
    setActiveBranchId,
  } = useBranch();

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="error">{error || 'none'}</div>
      <div data-testid="active-branch-id">{activeBranchId}</div>
      <div data-testid="active-branch-name">{activeBranch ? activeBranch.name : 'none'}</div>
      <div data-testid="is-all-branches">{isAllBranches ? 'true' : 'false'}</div>
      <div data-testid="can-switch">{canSwitchBranch ? 'true' : 'false'}</div>
      <div data-testid="branch-count">{branches.length}</div>
      <button onClick={() => setActiveBranchId('store-kp-002')}>Switch to Alephata</button>
      <button onClick={() => setActiveBranchId(ALL_BRANCHES_ID)}>Switch to All</button>
      <button onClick={() => setActiveBranchId('store-kp-001')}>Switch to Charholi</button>
    </div>
  );
};

describe('BranchContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads branches and allows OWNER to switch branches and select All Branches', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      employee: {
        id: 'emp-1',
        name: 'Vikram Owner',
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
        <TestBranchConsumer />
      </BranchProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('active-branch-id').textContent).toBe('store-kp-001');
    expect(screen.getByTestId('active-branch-name').textContent).toBe('Charholi Branch');
    expect(screen.getByTestId('is-all-branches').textContent).toBe('false');
    expect(screen.getByTestId('can-switch').textContent).toBe('true');
    expect(screen.getByTestId('branch-count').textContent).toBe('2');

    // OWNER switches to Alephata
    act(() => {
      screen.getByText('Switch to Alephata').click();
    });

    expect(screen.getByTestId('active-branch-id').textContent).toBe('store-kp-002');
    expect(screen.getByTestId('active-branch-name').textContent).toBe('Alephata Branch');
    expect(screen.getByTestId('is-all-branches').textContent).toBe('false');
    expect(ApiModule.setActiveBranchId).toHaveBeenCalledWith('store-kp-002');

    // OWNER switches to All Branches
    act(() => {
      screen.getByText('Switch to All').click();
    });

    expect(screen.getByTestId('active-branch-id').textContent).toBe(ALL_BRANCHES_ID);
    expect(screen.getByTestId('active-branch-name').textContent).toBe('none');
    expect(screen.getByTestId('is-all-branches').textContent).toBe('true');
    expect(ApiModule.setActiveBranchId).toHaveBeenCalledWith(ALL_BRANCHES_ID);
  });

  it('restricts COUNTER staff strictly to their assigned branch and rejects switching', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      employee: {
        id: 'emp-2',
        name: 'Pooja Counter',
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

    render(
      <BranchProvider>
        <TestBranchConsumer />
      </BranchProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('active-branch-id').textContent).toBe('store-kp-001');
    expect(screen.getByTestId('can-switch').textContent).toBe('false');

    // Attempting to switch to Alephata must be rejected for non-owner
    act(() => {
      screen.getByText('Switch to Alephata').click();
    });

    // Active branch MUST remain store-kp-001
    expect(screen.getByTestId('active-branch-id').textContent).toBe('store-kp-001');
  });

  it('handles API error gracefully and falls back to assigned employee store', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      employee: {
        id: 'emp-3',
        name: 'Alephata Staff',
        role: Role.COUNTER,
        storeId: 'store-kp-002',
        storeName: 'Alephata Branch',
      } as any,
      token: 'mock-jwt-token',
      login: vi.fn(),
      logout: vi.fn(),
      error: null,
    });

    vi.mocked(ApiModule.apiFetch).mockRejectedValue(new Error('Network error'));

    render(
      <BranchProvider>
        <TestBranchConsumer />
      </BranchProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('error').textContent).toBe('Network error');
    expect(screen.getByTestId('active-branch-id').textContent).toBe('store-kp-002');
  });
});
