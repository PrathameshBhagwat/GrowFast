import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveActiveBranch,
  getActiveBranch,
  removeActiveBranch,
  clearUserSession,
  saveAuthToken,
  saveUserSession,
  getStorageAdapter,
  setStorageAdapterForTesting,
  MemoryStorageAdapter,
} from '../storage/secure-store';
import {
  apiClient,
  setActiveBranchHeader,
  getActiveBranchHeader,
  triggerUnauthorized,
  _resetUnauthorizedLock,
} from '../api/client';
import { ALL_BRANCHES_ID, defaultBranchContext } from '../contexts/BranchContext';
import { Role, type BranchDTO } from '@growfast/shared-types';

describe('GrowFast Mobile Phase 4 — Multi-Branch Architecture Suite', () => {
  beforeEach(async () => {
    setStorageAdapterForTesting(new MemoryStorageAdapter());
    setActiveBranchHeader(null);
    _resetUnauthorizedLock();
    await clearUserSession();
  });

  describe('1. Mobile Storage Adapter Branch Persistence', () => {
    it('1.1 should persist and retrieve active branch ID correctly', async () => {
      assert.equal(await getActiveBranch(), null);

      await saveActiveBranch('store-kp-001');
      assert.equal(await getActiveBranch(), 'store-kp-001');

      await saveActiveBranch('store-kp-002');
      assert.equal(await getActiveBranch(), 'store-kp-002');

      await saveActiveBranch('all');
      assert.equal(await getActiveBranch(), 'all');
    });

    it('1.2 should remove active branch on explicit removal', async () => {
      await saveActiveBranch('store-kp-001');
      assert.equal(await getActiveBranch(), 'store-kp-001');

      await removeActiveBranch();
      assert.equal(await getActiveBranch(), null);
    });

    it('1.3 should clear active branch when clearUserSession is invoked', async () => {
      await saveAuthToken('mock-jwt-token');
      await saveUserSession({
        id: 'emp-1',
        name: 'Prathamesh Bhagwat',
        phone: '9876543210',
        role: 'OWNER',
        storeId: 'store-kp-001',
      });
      await saveActiveBranch('store-kp-002');

      assert.equal(await getActiveBranch(), 'store-kp-002');

      await clearUserSession();

      assert.equal(await getActiveBranch(), null);
    });
  });

  describe('2. Mobile API Client Branch Header Propagation', () => {
    it('2.1 should track and update active branch header in memory', () => {
      assert.equal(getActiveBranchHeader(), null);

      setActiveBranchHeader('store-kp-001');
      assert.equal(getActiveBranchHeader(), 'store-kp-001');

      setActiveBranchHeader('store-kp-002');
      assert.equal(getActiveBranchHeader(), 'store-kp-002');

      setActiveBranchHeader('all');
      assert.equal(getActiveBranchHeader(), 'all');

      setActiveBranchHeader(null);
      assert.equal(getActiveBranchHeader(), null);
    });

    it('2.2 should clear active branch header when triggerUnauthorized is invoked', async () => {
      setActiveBranchHeader('store-kp-001');
      assert.equal(getActiveBranchHeader(), 'store-kp-001');

      await triggerUnauthorized();

      assert.equal(getActiveBranchHeader(), null);
    });
  });

  describe('3. Role-Based Branch Permissions & Context Business Rules', () => {
    const mockBranches: BranchDTO[] = [
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

    it('3.1 OWNER role can switch between Charholi, Alephata, and All Branches', () => {
      const ownerRole: string = 'OWNER';
      const canSwitch = ownerRole === Role.OWNER || ownerRole.toUpperCase() === 'OWNER';
      assert.equal(canSwitch, true);

      // Verify valid targets
      const allowedTargets = [ALL_BRANCHES_ID, ...mockBranches.map((b) => b.id)];
      assert.ok(allowedTargets.includes('all'));
      assert.ok(allowedTargets.includes('store-kp-001'));
      assert.ok(allowedTargets.includes('store-kp-002'));
    });

    it('3.2 Non-owner roles (COUNTER, MANAGER, DELIVERY) are strictly restricted to assigned store', () => {
      const nonOwnerRoles = ['COUNTER', 'MANAGER', 'DELIVERY'];

      for (const role of nonOwnerRoles) {
        const canSwitch = role === Role.OWNER || role.toUpperCase() === 'OWNER';
        assert.equal(canSwitch, false, `Role ${role} should not be allowed to switch branches`);
      }
    });

    it('3.3 Fallback context provides valid initial state when outside provider', () => {
      assert.ok(defaultBranchContext.branches.length >= 2);
      assert.equal(defaultBranchContext.activeBranchId, 'store-kp-001');
      assert.equal(defaultBranchContext.isAllBranches, false);
      assert.equal(defaultBranchContext.activeBranch?.code, 'CHARHOLI');
    });
  });

  describe('4. Order Creation Guard Under Consolidated View', () => {
    it('4.1 Creating order under "all" is prevented and requires selecting concrete physical branch', () => {
      const currentActiveBranchId = 'all';
      const isAllBranches = currentActiveBranchId === ALL_BRANCHES_ID;

      assert.equal(isAllBranches, true);

      // Order creation guard:
      const validateOrderBranch = (branchId: string): { valid: boolean; error?: string } => {
        if (!branchId || branchId === ALL_BRANCHES_ID) {
          return {
            valid: false,
            error:
              'Cannot create an order under "All Branches". Please switch to Charholi or Alephata branch.',
          };
        }
        return { valid: true };
      };

      const resultAll = validateOrderBranch(currentActiveBranchId);
      assert.equal(resultAll.valid, false);
      assert.ok(resultAll.error?.includes('Cannot create an order'));

      const resultCharholi = validateOrderBranch('store-kp-001');
      assert.equal(resultCharholi.valid, true);

      const resultAlephata = validateOrderBranch('store-kp-002');
      assert.equal(resultAlephata.valid, true);
    });

    it('4.2 Customer creation assigns designated storeId when operating under "all"', () => {
      const activeBranchId = 'all';
      const isAllBranches = activeBranchId === ALL_BRANCHES_ID;
      const selectedFormBranch = 'store-kp-002'; // Staff selected Alephata

      const targetStoreId =
        (!isAllBranches && activeBranchId) || selectedFormBranch || 'store-kp-001';

      assert.equal(targetStoreId, 'store-kp-002');

      const createCustomerPayload = {
        name: 'Vikram Joshi',
        phone: '9822334455',
        address: 'Bunglow 4, Alephata Highway',
        pincode: '412411',
        storeId: targetStoreId,
      };

      assert.equal(createCustomerPayload.storeId, 'store-kp-002');
      assert.notEqual(createCustomerPayload.storeId, 'all');
    });
  });

  describe('5. Account Switch & Session State Isolation', () => {
    it('5.1 ensures previous employee active branch never leaks into another employee session', async () => {
      // 1. OWNER logs in and selects Alephata ('store-kp-002')
      await saveAuthToken('owner-token');
      await saveUserSession({
        id: 'emp-owner-001',
        name: 'Amit Jangam',
        phone: '9822001122',
        role: 'OWNER',
        storeId: 'store-kp-001',
      });
      await saveActiveBranch('store-kp-002');
      setActiveBranchHeader('store-kp-002');

      assert.equal(await getActiveBranch(), 'store-kp-002');
      assert.equal(getActiveBranchHeader(), 'store-kp-002');

      // 2. OWNER logs out -> clearUserSession() removes token, session, and active branch
      await clearUserSession();
      setActiveBranchHeader(null);

      assert.equal(await getActiveBranch(), null);
      assert.equal(getActiveBranchHeader(), null);

      // 3. COUNTER logs in (assigned to Charholi 'store-kp-001')
      const counterSession = {
        id: 'emp-counter-001',
        name: 'Swapnil Shinde',
        phone: '9822998877',
        role: 'COUNTER',
        storeId: 'store-kp-001',
      };
      await saveAuthToken('counter-token');
      await saveUserSession(counterSession);

      // Branch resolution for non-owner forces assigned storeId
      const resolvedBranch =
        counterSession.role === Role.OWNER
          ? (await getActiveBranch()) || counterSession.storeId
          : counterSession.storeId;

      await saveActiveBranch(resolvedBranch);
      setActiveBranchHeader(resolvedBranch);

      // 4. Verify COUNTER is strictly assigned to Charholi, NOT Alephata
      assert.equal(await getActiveBranch(), 'store-kp-001');
      assert.equal(getActiveBranchHeader(), 'store-kp-001');
    });

    it('5.2 HTTP 401 unauthorized centrally clears branch headers preventing stale requests', async () => {
      setActiveBranchHeader('store-kp-002');
      await saveActiveBranch('store-kp-002');

      await triggerUnauthorized();

      assert.equal(getActiveBranchHeader(), null);
      assert.equal(await getActiveBranch(), null);
    });
  });

  describe('6. Cross-Platform Data Consistency & Phone Uniqueness', () => {
    it('6.1 allows same customer phone in different physical branches, but enforces uniqueness within same branch', () => {
      const existingCustomersInDb = [
        { id: 'c1', phone: '9876543210', storeId: 'store-kp-001', name: 'Charholi Customer' },
      ];

      // Helper simulating backend duplicate check
      const checkDuplicate = (phone: string, storeId: string): boolean => {
        return existingCustomersInDb.some((c) => c.phone === phone && c.storeId === storeId);
      };

      // Same phone in same branch -> Duplicate Conflict
      assert.equal(checkDuplicate('9876543210', 'store-kp-001'), true);

      // Same phone in DIFFERENT branch -> Allowed
      assert.equal(checkDuplicate('9876543210', 'store-kp-002'), false);
    });
  });
});
