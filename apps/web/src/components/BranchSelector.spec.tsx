import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BranchSelector } from './BranchSelector';
import * as BranchContextModule from '../contexts/BranchContext';
import { type BranchDTO } from '@growfast/shared-types';

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

describe('BranchSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders interactive dropdown for OWNER with All Branches and individual branches', () => {
    const setActiveBranchIdMock = vi.fn();

    vi.spyOn(BranchContextModule, 'useBranch').mockReturnValue({
      branches: mockBranches,
      activeBranchId: 'store-kp-001',
      activeBranch: mockBranches[0],
      isAllBranches: false,
      canSwitchBranch: true,
      isLoading: false,
      error: null,
      setActiveBranchId: setActiveBranchIdMock,
      refreshBranches: vi.fn(),
    });

    render(<BranchSelector />);

    // Trigger button should display active branch name
    const trigger = screen.getByRole('button', { name: /switch active branch/i });
    expect(trigger).toBeTruthy();
    expect(screen.getByText('Charholi Branch')).toBeTruthy();

    // Click trigger to open dropdown
    fireEvent.click(trigger);

    // Should display options: All Branches, Charholi Branch, Alephata Branch
    expect(screen.getByText('All Branches')).toBeTruthy();
    expect(screen.getByText('Consolidated multi-store view')).toBeTruthy();
    expect(screen.getByText('Alephata Branch')).toBeTruthy();

    // Select Alephata Branch
    const alephataOption = screen.getByRole('option', { name: /select branch: alephata branch/i });
    fireEvent.click(alephataOption);

    expect(setActiveBranchIdMock).toHaveBeenCalledWith('store-kp-002');
  });

  it('allows OWNER to select All Branches option', () => {
    const setActiveBranchIdMock = vi.fn();

    vi.spyOn(BranchContextModule, 'useBranch').mockReturnValue({
      branches: mockBranches,
      activeBranchId: 'store-kp-001',
      activeBranch: mockBranches[0],
      isAllBranches: false,
      canSwitchBranch: true,
      isLoading: false,
      error: null,
      setActiveBranchId: setActiveBranchIdMock,
      refreshBranches: vi.fn(),
    });

    render(<BranchSelector />);

    const trigger = screen.getByRole('button', { name: /switch active branch/i });
    fireEvent.click(trigger);

    const allBranchesOption = screen.getByRole('option', { name: /select all branches/i });
    fireEvent.click(allBranchesOption);

    expect(setActiveBranchIdMock).toHaveBeenCalledWith('all');
  });

  it('renders a read-only pill for non-owner staff without dropdown capability', () => {
    vi.spyOn(BranchContextModule, 'useBranch').mockReturnValue({
      branches: mockBranches,
      activeBranchId: 'store-kp-001',
      activeBranch: mockBranches[0],
      isAllBranches: false,
      canSwitchBranch: false,
      isLoading: false,
      error: null,
      setActiveBranchId: vi.fn(),
      refreshBranches: vi.fn(),
    });

    render(<BranchSelector />);

    // Should render read-only container with branch name and code
    expect(screen.getByText('Charholi Branch')).toBeTruthy();
    expect(screen.getByText('CHARHOLI')).toBeTruthy();

    // Should NOT have interactive switch trigger
    expect(screen.queryByRole('button', { name: /switch active branch/i })).toBeNull();
  });
});
