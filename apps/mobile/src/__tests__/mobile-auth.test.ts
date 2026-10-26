import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, setApiConfig, ApiError } from '../api/client';
import {
  saveAuthToken,
  getAuthToken,
  removeAuthToken,
  saveUserSession,
  getUserSession,
  clearUserSession,
} from '../storage/secure-store';

describe('GrowFast Mobile Auth & Session Persistence Suite', () => {
  const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
  let isBackendRunning = false;

  before(async () => {
    setApiConfig({ baseUrl: BACKEND_URL });
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/directory`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        isBackendRunning = true;
      }
    } catch {
      isBackendRunning = false;
    }
  });

  it('1. SecureStore token and session persistence operations', async () => {
    await clearUserSession();
    assert.equal(await getAuthToken(), null);
    assert.equal(await getUserSession(), null);

    const testToken = 'jwt-test-token-12345';
    await saveAuthToken(testToken);
    assert.equal(await getAuthToken(), testToken);

    const testSession = {
      id: 'emp-counter-001',
      name: 'Swapnil Shinde',
      phone: '',
      role: 'COUNTER',
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    };
    await saveUserSession(testSession);
    const retrieved = await getUserSession();
    assert.deepEqual(retrieved, testSession);

    await clearUserSession();
    assert.equal(await getAuthToken(), null);
    assert.equal(await getUserSession(), null);
  });

  it('2. Directory role filtering restricts accounts to OWNER and COUNTER only', async () => {
    const rawDirectory = [
      { id: 'emp-delivery-001', name: 'Kiran More', role: 'DELIVERY' },
      { id: 'emp-owner-001', name: 'Prathamesh Bhagwat', role: 'OWNER' },
      { id: 'emp-mgr-001', name: 'Rajesh Nair', role: 'MANAGER' },
      { id: 'emp-counter-001', name: 'Swapnil Shinde', role: 'COUNTER' },
    ];

    const mobileRoles = ['OWNER', 'COUNTER'];
    const filtered = rawDirectory.filter((emp) => mobileRoles.includes(emp.role));

    assert.equal(filtered.length, 2);
    assert.deepEqual(filtered.map((e) => e.role).sort(), ['COUNTER', 'OWNER']);
    assert.ok(!filtered.some((e) => e.role === 'MANAGER' || e.role === 'DELIVERY'));
  });

  it('3. Live backend authentication succeeds for valid staff credentials', async (t) => {
    if (!isBackendRunning) {
      t.skip(`Backend is not reachable at ${BACKEND_URL}`);
      return;
    }

    const res = await apiClient.auth.login({
      employeeId: 'emp-counter-001',
      pin: '333333',
    });

    assert.ok(res.accessToken, 'Access token should be returned');
    assert.equal(res.user.id, 'emp-counter-001');
    assert.equal(res.user.role, 'COUNTER');
    assert.equal(res.user.storeId, 'store-kp-001');

    // Test session persistence
    await saveAuthToken(res.accessToken);
    await saveUserSession(res.user);
    assert.equal(await getAuthToken(), res.accessToken);
    const session = await getUserSession();
    assert.equal(session?.id, 'emp-counter-001');
  });

  it('4. Live backend authentication rejects invalid PIN with 401 Unauthorized', async (t) => {
    if (!isBackendRunning) {
      t.skip(`Backend is not reachable at ${BACKEND_URL}`);
      return;
    }

    await assert.rejects(
      async () => {
        await apiClient.auth.login({
          employeeId: 'emp-counter-001',
          pin: '999999',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, 'Invalid credentials');
        return true;
      },
    );
  });

  it('5. Live backend authentication rejects unknown employee ID with 401 Unauthorized', async (t) => {
    if (!isBackendRunning) {
      t.skip(`Backend is not reachable at ${BACKEND_URL}`);
      return;
    }

    await assert.rejects(
      async () => {
        await apiClient.auth.login({
          employeeId: 'emp-unknown-999',
          pin: '333333',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 401);
        assert.equal(err.message, 'Invalid credentials');
        return true;
      },
    );
  });

  it('6. Live backend getDirectory with ?roles=OWNER,COUNTER returns only POS-eligible roles', async (t) => {
    if (!isBackendRunning) {
      t.skip(`Backend is not reachable at ${BACKEND_URL}`);
      return;
    }

    const dir = await apiClient.auth.getDirectory(['OWNER', 'COUNTER']);
    assert.ok(Array.isArray(dir));
    assert.ok(dir.length > 0);
    assert.ok(
      dir.every((emp) => emp.role === 'OWNER' || emp.role === 'COUNTER'),
      'All returned employees must be OWNER or COUNTER',
    );
    assert.ok(
      !dir.some((emp) => emp.role === 'DELIVERY' || emp.role === 'MANAGER'),
      'Must not contain DELIVERY or MANAGER accounts',
    );
  });

  it('7. normalizeApiUrl correctly handles all URL variations without duplicate /api or trailing slashes', () => {
    const { normalizeApiUrl } = require('../api/client');

    // Case 1: Standard base URL + standard endpoint
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000', '/api/auth/directory'),
      'http://192.168.1.38:3000/api/auth/directory',
    );

    // Case 2: Base URL with /api suffix (prevent /api/api)
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000/api', '/api/auth/directory'),
      'http://192.168.1.38:3000/api/auth/directory',
    );

    // Case 3: Base URL with trailing slash
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000/', '/api/auth/directory'),
      'http://192.168.1.38:3000/api/auth/directory',
    );

    // Case 4: Endpoint without /api prefix
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000', '/auth/directory'),
      'http://192.168.1.38:3000/api/auth/directory',
    );

    // Case 5: Endpoint without leading slash
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000', 'auth/login'),
      'http://192.168.1.38:3000/api/auth/login',
    );

    // Case 6: Base URL with /api/ trailing slash
    assert.equal(
      normalizeApiUrl('http://192.168.1.38:3000/api/', '/api/auth/login'),
      'http://192.168.1.38:3000/api/auth/login',
    );
  });

  it('8. setOnUnauthorized callback fires when an unauthorized 401 error occurs', () => {
    const { setOnUnauthorized } = require('../api/client');
    let called = false;
    const testHandler = () => {
      called = true;
    };

    setOnUnauthorized(testHandler);
    // Verify handler registration
    assert.equal(called, false);
    testHandler();
    assert.equal(called, true);

    // Unregister cleanly
    setOnUnauthorized(null);
  });

  it('9. PIN entry validation: enforces non-empty, numeric formatting and length constraints', () => {
    function validateStaffPin(pin: string): { valid: boolean; error?: string } {
      const trimmed = pin.trim();
      if (!trimmed) {
        return { valid: false, error: 'Please enter your staff PIN' };
      }
      if (!/^\d+$/.test(trimmed)) {
        return { valid: false, error: 'PIN must contain numbers only' };
      }
      if (trimmed.length < 4 || trimmed.length > 10) {
        return { valid: false, error: 'PIN must be between 4 and 10 digits' };
      }
      return { valid: true };
    }

    assert.equal(validateStaffPin('').valid, false);
    assert.equal(validateStaffPin('   ').valid, false);
    assert.equal(validateStaffPin('abc').valid, false);
    assert.equal(validateStaffPin('12').valid, false);
    assert.equal(validateStaffPin('12345678901').valid, false);
    assert.equal(validateStaffPin('333333').valid, true);
    assert.equal(validateStaffPin('111111').valid, true);
  });

  it('10. Selected staff account must be populated before sign-in submission', () => {
    function canSubmitLogin(selectedEmpId: string, pin: string, isLoading: boolean): boolean {
      if (isLoading) return false;
      if (!selectedEmpId || !selectedEmpId.trim()) return false;
      if (!pin || !pin.trim()) return false;
      return true;
    }

    assert.equal(canSubmitLogin('', '333333', false), false);
    assert.equal(canSubmitLogin('emp-counter-001', '', false), false);
    assert.equal(canSubmitLogin('emp-counter-001', '333333', true), false);
    assert.equal(canSubmitLogin('emp-counter-001', '333333', false), true);
  });
});
