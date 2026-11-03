import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { type BranchDTO, Role } from '@growfast/shared-types';
import { useAuth } from './AuthContext';
import { apiClient, setActiveBranchHeader } from '../api/client';
import { getActiveBranch, saveActiveBranch, removeActiveBranch } from '../storage/secure-store';

export const ALL_BRANCHES_ID = 'all';

export interface BranchContextType {
  branches: BranchDTO[];
  activeBranchId: string;
  activeBranch: BranchDTO | null;
  isAllBranches: boolean;
  canSwitchBranch: boolean;
  isLoading: boolean;
  error: string | null;
  setActiveBranchId: (branchId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
}

export const defaultBranchContext: BranchContextType = {
  branches: [
    {
      id: 'store-kp-001',
      code: 'CHARHOLI',
      name: 'Charholi Branch',
      address: 'Shop 4, Lane 7, Charholi, Pune 412105',
      phone: null,
      email: null,
      isActive: true,
      expressSurchargePercent: 25,
    },
    {
      id: 'store-kp-002',
      code: 'ALEPHATA',
      name: 'Alephata Branch',
      address: 'Shop 10, Pune-Nashik Highway, Alephata 412411',
      phone: null,
      email: null,
      isActive: true,
      expressSurchargePercent: 25,
    },
  ],
  activeBranchId: 'store-kp-001',
  activeBranch: {
    id: 'store-kp-001',
    code: 'CHARHOLI',
    name: 'Charholi Branch',
    address: 'Shop 4, Lane 7, Charholi, Pune 412105',
    phone: null,
    email: null,
    isActive: true,
    expressSurchargePercent: 25,
  },
  isAllBranches: false,
  canSwitchBranch: true,
  isLoading: false,
  error: null,
  setActiveBranchId: async () => {},
  refreshBranches: async () => {},
};

const BranchContext = createContext<BranchContextType | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, token } = useAuth();

  const [branches, setBranches] = useState<BranchDTO[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(user?.storeId || '');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canSwitchBranch = useMemo(() => {
    return user?.role?.toUpperCase() === Role.OWNER || user?.role?.toUpperCase() === 'OWNER';
  }, [user]);

  // Load and refresh branches from API or fallback
  const refreshBranches = useCallback(async () => {
    if (!isAuthenticated || !token || !user) {
      setBranches([]);
      setActiveBranchIdState('');
      setActiveBranchHeader(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedBranches = await apiClient.store.getBranches();
      const validBranches =
        Array.isArray(fetchedBranches) && fetchedBranches.length > 0
          ? fetchedBranches
          : [
              {
                id: 'store-kp-001',
                code: 'CHARHOLI',
                name: 'Charholi Branch',
                address: 'Shop 4, Lane 7, Charholi, Pune 412105',
                phone: null,
                email: null,
                isActive: true,
                expressSurchargePercent: 25,
              },
              {
                id: 'store-kp-002',
                code: 'ALEPHATA',
                name: 'Alephata Branch',
                address: 'Shop 10, Pune-Nashik Highway, Alephata 412411',
                phone: null,
                email: null,
                isActive: true,
                expressSurchargePercent: 25,
              },
            ];

      setBranches(validBranches);

      if (canSwitchBranch) {
        // OWNER can retain saved branch, 'all', or default to assigned/first store
        const storedBranch = await getActiveBranch();
        const isValidStored =
          storedBranch === ALL_BRANCHES_ID || validBranches.some((b) => b.id === storedBranch);

        if (isValidStored && storedBranch) {
          setActiveBranchIdState(storedBranch);
          setActiveBranchHeader(storedBranch);
          await saveActiveBranch(storedBranch);
        } else {
          const fallbackId = user.storeId || validBranches[0]?.id || ALL_BRANCHES_ID;
          setActiveBranchIdState(fallbackId);
          setActiveBranchHeader(fallbackId);
          await saveActiveBranch(fallbackId);
        }
      } else {
        // Non-owner roles (COUNTER, MANAGER, DELIVERY) are strictly restricted to assigned store
        const homeBranchId = user.storeId || validBranches[0]?.id || 'store-kp-001';
        setActiveBranchIdState(homeBranchId);
        setActiveBranchHeader(homeBranchId);
        await saveActiveBranch(homeBranchId);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load branch list');
      // Graceful offline/network fallback to user's assigned store
      const fallbackId = user.storeId || 'store-kp-001';
      setActiveBranchIdState(fallbackId);
      setActiveBranchHeader(fallbackId);
      setBranches([
        {
          id: fallbackId,
          code: fallbackId === 'store-kp-002' ? 'ALEPHATA' : 'CHARHOLI',
          name:
            user.storeName ||
            (fallbackId === 'store-kp-002' ? 'Alephata Branch' : 'Charholi Branch'),
          address: null,
          phone: null,
          email: null,
          isActive: true,
          expressSurchargePercent: 25,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token, user, canSwitchBranch]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  // User-invoked branch switch
  const setActiveBranchId = useCallback(
    async (newBranchId: string) => {
      if (!user) return;

      // Security check: non-owner roles cannot switch branch
      if (!canSwitchBranch) {
        console.warn(
          'Branch switching rejected: only OWNER role is authorized to switch branches.',
        );
        setActiveBranchIdState(user.storeId);
        setActiveBranchHeader(user.storeId);
        await saveActiveBranch(user.storeId);
        return;
      }

      // Validate new branch ID is either 'all' or in branches list
      if (
        newBranchId !== ALL_BRANCHES_ID &&
        branches.length > 0 &&
        !branches.some((b) => b.id === newBranchId)
      ) {
        console.warn(`Branch "${newBranchId}" is not in available branch list.`);
        return;
      }

      setActiveBranchIdState(newBranchId);
      setActiveBranchHeader(newBranchId);
      await saveActiveBranch(newBranchId);
    },
    [user, canSwitchBranch, branches],
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
}

export function useBranch(): BranchContextType {
  const context = useContext(BranchContext);
  return context || defaultBranchContext;
}
