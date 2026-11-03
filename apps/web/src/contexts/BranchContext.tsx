import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { type BranchDTO, Role } from '@growfast/shared-types';
import { useAuth } from './AuthContext';
import {
  apiFetch,
  getActiveBranchId,
  setActiveBranchId as setStorageBranchId,
} from '../services/api';

export const ALL_BRANCHES_ID = 'all';

export interface BranchContextType {
  branches: BranchDTO[];
  activeBranchId: string;
  activeBranch: BranchDTO | null;
  isAllBranches: boolean;
  canSwitchBranch: boolean;
  isLoading: boolean;
  error: string | null;
  setActiveBranchId: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | null>(null);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { employee, isAuthenticated, token } = useAuth();

  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => {
    return getActiveBranchId() || employee?.storeId || '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canSwitchBranch = useMemo(() => {
    return employee?.role === Role.OWNER;
  }, [employee]);

  // Fetch branches from backend API
  const refreshBranches = useCallback(async () => {
    if (!isAuthenticated || !token || !employee) {
      setBranches([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{ success: boolean; data: BranchDTO[] }>('/store/branches', {
        token,
        retries: 1,
      });

      const fetchedBranches = res.data || [];
      setBranches(fetchedBranches);

      // Branch resolution logic:
      if (employee.role === Role.OWNER) {
        // OWNER can retain existing saved branch if valid, or 'all', or default to assigned/first store
        const storedBranchId = getActiveBranchId();
        const isValidStored =
          storedBranchId === ALL_BRANCHES_ID ||
          fetchedBranches.some((b) => b.id === storedBranchId);

        if (isValidStored && storedBranchId) {
          setActiveBranchIdState(storedBranchId);
          setStorageBranchId(storedBranchId);
        } else {
          // Default to assigned store or first branch
          const fallbackId = employee.storeId || fetchedBranches[0]?.id || ALL_BRANCHES_ID;
          setActiveBranchIdState(fallbackId);
          setStorageBranchId(fallbackId);
        }
      } else {
        // Non-owner roles (COUNTER, MANAGER, DELIVERY) are STRICTLY confined to their assigned store
        const homeBranchId = employee.storeId;
        setActiveBranchIdState(homeBranchId);
        setStorageBranchId(homeBranchId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load branch list');
      // Graceful fallback to user's assigned store from JWT
      if (employee?.storeId) {
        setActiveBranchIdState(employee.storeId);
        setStorageBranchId(employee.storeId);
        setBranches([
          {
            id: employee.storeId,
            name: employee.storeName || 'Assigned Branch',
            code: null,
            address: null,
            phone: null,
            email: null,
            isActive: true,
            expressSurchargePercent: 25,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, employee]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  // User-invoked branch switcher
  const setActiveBranchId = useCallback(
    (newBranchId: string) => {
      if (!employee) return;

      // Security check: non-owner roles cannot switch branches
      if (employee.role !== Role.OWNER) {
        console.warn(
          'Branch switching rejected: only OWNER role is authorized to switch branches.',
        );
        setActiveBranchIdState(employee.storeId);
        setStorageBranchId(employee.storeId);
        return;
      }

      // Validate new branch ID is either 'all' or in branches list
      if (newBranchId !== ALL_BRANCHES_ID && !branches.some((b) => b.id === newBranchId)) {
        console.warn(`Branch "${newBranchId}" is not in available branch list.`);
        return;
      }

      setActiveBranchIdState(newBranchId);
      setStorageBranchId(newBranchId);

      // Dispatch custom event for subscribers
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('growfast:branch-changed', {
            detail: { branchId: newBranchId },
          }),
        );
      }
    },
    [employee, branches],
  );

  const isAllBranches = activeBranchId === ALL_BRANCHES_ID;

  const activeBranch = useMemo(() => {
    if (isAllBranches) return null;
    return branches.find((b) => b.id === activeBranchId) || null;
  }, [branches, activeBranchId, isAllBranches]);

  const value = useMemo<BranchContextType>(
    () => ({
      branches,
      activeBranchId,
      activeBranch,
      isAllBranches,
      canSwitchBranch,
      isLoading,
      error,
      setActiveBranchId,
      refreshBranches,
    }),
    [
      branches,
      activeBranchId,
      activeBranch,
      isAllBranches,
      canSwitchBranch,
      isLoading,
      error,
      setActiveBranchId,
      refreshBranches,
    ],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
};

export const defaultBranchContext: BranchContextType = {
  branches: [
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
  ],
  activeBranchId: 'store-kp-001',
  activeBranch: {
    id: 'store-kp-001',
    name: 'Charholi Branch',
    code: 'CHARHOLI',
    address: 'Shop 4, Lane 7, Charholi, Pune 412105',
    phone: '+91 20 2615 0000',
    email: 'charholi@growfast.in',
    isActive: true,
    expressSurchargePercent: 25,
  },
  isAllBranches: false,
  canSwitchBranch: true,
  isLoading: false,
  error: null,
  setActiveBranchId: () => {},
  refreshBranches: async () => {},
};

export const useBranch = (): BranchContextType => {
  const context = useContext(BranchContext);
  return context || defaultBranchContext;
};
