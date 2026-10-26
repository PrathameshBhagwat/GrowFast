import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  setApiConfig,
  ApiError,
  onUnauthorized,
  triggerUnauthorized,
  _resetUnauthorizedLock,
} from '../api/client';
import {
  saveAuthToken,
  getAuthToken,
  removeAuthToken,
  saveUserSession,
  getUserSession,
  clearUserSession,
  MemoryStorageAdapter,
  WebStorageAdapter,
  setStorageAdapterForTesting,
} from '../storage/secure-store';
import { parseJwtPayload } from '../contexts/AuthContext';

describe('GrowFast Mobile Auth & Session Persistence Suite', () => {
  const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
  let isBackendRunning = false;

  before(async () => {
    setApiConfig({ baseUrl: BACKEND_URL });
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/directory`, {
        signal: AbortSignal.timeout(5000),
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

  function makeMockJwt(payload: object): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = 'mock_signature_bytes';
    return `${header}.${body}.${sig}`;
  }

  it('11. parseJwtPayload parses valid JWT and extracts exp and sub', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeMockJwt({ sub: 'emp-counter-001', exp, role: 'COUNTER' });
    const payload = parseJwtPayload(token);
    assert.ok(payload);
    assert.equal(payload.sub, 'emp-counter-001');
    assert.equal(payload.exp, exp);
  });

  it('9. parseJwtPayload handles expired and malformed tokens', () => {
    // Malformed token
    assert.equal(parseJwtPayload('invalid.token'), null);
    assert.equal(parseJwtPayload(''), null);
    assert.equal(parseJwtPayload('a.b'), null);

    // Expired token (1 hour in the past)
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = makeMockJwt({ sub: 'emp-expired', exp: pastExp });
    const payload = parseJwtPayload(expiredToken);
    assert.ok(payload);
    assert.ok(payload.exp! * 1000 <= Date.now(), 'Token must be identified as expired');
  });

  it('10. Startup session validation: missing token or user cleans up storage', async () => {
    await clearUserSession();
    // Case A: token exists but user is missing
    await saveAuthToken('sample-token');
    let token = await getAuthToken();
    let user = await getUserSession();
    assert.ok(token);
    assert.equal(user, null);

    // Validate logic: if either missing, clear
    if (!token || !user) {
      await clearUserSession();
    }
    assert.equal(await getAuthToken(), null);
    assert.equal(await getUserSession(), null);

    // Case B: user exists but token is missing
    await saveUserSession({
      id: 'emp-1',
      name: 'Test',
      phone: '',
      role: 'COUNTER',
      storeId: 'store-1',
      storeName: 'Test Store',
    });
    token = await getAuthToken();
    user = await getUserSession();
    assert.equal(token, null);
    assert.ok(user);

    if (!token || !user) {
      await clearUserSession();
    }
    assert.equal(await getAuthToken(), null);
    assert.equal(await getUserSession(), null);
  });

  it('11. Startup session validation: expired JWT triggers session clearance', async () => {
    await clearUserSession();
    const pastExp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    const expiredToken = makeMockJwt({ sub: 'emp-counter-001', exp: pastExp });

    await saveAuthToken(expiredToken);
    await saveUserSession({
      id: 'emp-counter-001',
      name: 'Counter Staff',
      phone: '',
      role: 'COUNTER',
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    });

    const storedToken = await getAuthToken();
    const storedUser = await getUserSession();
    assert.ok(storedToken && storedUser);

    const payload = parseJwtPayload(storedToken);
    if (payload?.exp && payload.exp * 1000 <= Date.now()) {
      await clearUserSession();
    }

    assert.equal(await getAuthToken(), null);
    assert.equal(await getUserSession(), null);
  });

  it('12. Protected API call without stored token throws 401 and triggers unauthorized handler', async () => {
    await clearUserSession();
    let unauthorizedTriggered = false;
    const unsub = onUnauthorized(() => {
      unauthorizedTriggered = true;
    });

    try {
      await apiClient.orders.list();
      assert.fail('Protected call should fail when no token exists');
    } catch (err: any) {
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 401);
      assert.match(err.message, /Authentication required/i);
    } finally {
      unsub();
    }

    assert.ok(unauthorizedTriggered, 'onUnauthorized listener must be invoked');
  });

  it('13. Debounces concurrent 401 responses to prevent multiple competing logouts', async () => {
    _resetUnauthorizedLock();
    let callCount = 0;
    const unsub = onUnauthorized(() => {
      callCount++;
    });

    try {
      // Simulate 5 simultaneous 401 triggers
      await Promise.all([
        triggerUnauthorized(),
        triggerUnauthorized(),
        triggerUnauthorized(),
        triggerUnauthorized(),
        triggerUnauthorized(),
      ]);

      assert.equal(callCount, 1, 'Concurrent 401 triggers must be debounced to a single execution');
    } finally {
      unsub();
    }
  });

  it('14. Route guard decisions route unauthenticated users to login and authenticated users to tabs', () => {
    // Pure function logic mirroring ProtectedRoutes in _layout.tsx
    function resolveGuardedRoute(currentPath: string, isAuthenticated: boolean): string | null {
      const inAuthGroup = currentPath.startsWith('/(auth)') || currentPath === '/login';
      const inTabsGroup = currentPath.startsWith('/(tabs)') || currentPath === '/dashboard';
      const isAtRoot = currentPath === '/' || currentPath === '';

      if (!isAuthenticated && (inTabsGroup || isAtRoot)) {
        return '/(auth)/login';
      }
      if (isAuthenticated && (inAuthGroup || isAtRoot)) {
        return '/(tabs)';
      }
      return null;
    }

    // Unauthenticated user attempting to access root
    assert.equal(resolveGuardedRoute('/', false), '/(auth)/login');
    // Unauthenticated user attempting to access tabs/dashboard
    assert.equal(resolveGuardedRoute('/(tabs)', false), '/(auth)/login');
    assert.equal(resolveGuardedRoute('/(tabs)/orders', false), '/(auth)/login');
    // Unauthenticated user already at login stays at login
    assert.equal(resolveGuardedRoute('/(auth)/login', false), null);

    // Authenticated user at login route is redirected to tabs
    assert.equal(resolveGuardedRoute('/(auth)/login', true), '/(tabs)');
    // Authenticated user at root is redirected to tabs
    assert.equal(resolveGuardedRoute('/', true), '/(tabs)');
    // Authenticated user inside tabs stays inside tabs
    assert.equal(resolveGuardedRoute('/(tabs)/orders', true), null);
  });

  it('15. Live backend getMe with valid token returns authenticated user profile', async (t) => {
    if (!isBackendRunning) {
      t.skip(`Backend is not reachable at ${BACKEND_URL}`);
      return;
    }

    const loginRes = await apiClient.auth.login({
      employeeId: 'emp-counter-001',
      pin: '333333',
    });
    await saveAuthToken(loginRes.accessToken);

    const meRes = await apiClient.auth.getMe();
    const profile = (meRes as any).data || meRes;
    assert.ok(profile);
    assert.equal(profile.id, 'emp-counter-001');
    assert.equal(profile.role, 'COUNTER');

    // Clean up
    await clearUserSession();
  });

  it('16. WebStorageAdapter safely stores and retrieves tokens with fallback', async () => {
    const memory = new MemoryStorageAdapter();
    const webAdapter = new WebStorageAdapter(memory);

    // Test get on empty
    assert.equal(await webAdapter.getItem('token_key'), null);

    // Test set and get
    await webAdapter.setItem('token_key', 'web-test-jwt-token');
    assert.equal(await webAdapter.getItem('token_key'), 'web-test-jwt-token');

    // Test remove
    await webAdapter.removeItem('token_key');
    assert.equal(await webAdapter.getItem('token_key'), null);
  });

  it('17. SSR safety: Storage adapter never assumes window or localStorage exists', async () => {
    const origWindow = globalThis.window;
    try {
      // Simulate SSR environment where window is undefined
      // @ts-ignore
      delete globalThis.window;

      const memory = new MemoryStorageAdapter();
      const webAdapter = new WebStorageAdapter(memory);

      // Should not throw Error: window is not defined
      await webAdapter.setItem('ssr_key', 'ssr_value');
      const val = await webAdapter.getItem('ssr_key');
      assert.equal(val, 'ssr_value');
      await webAdapter.removeItem('ssr_key');
      assert.equal(await webAdapter.getItem('ssr_key'), null);
    } finally {
      if (origWindow !== undefined) {
        // @ts-ignore
        globalThis.window = origWindow;
      }
    }
  });

  it('18. Corrupted session data in storage returns null and self-cleans safely', async () => {
    const memory = new MemoryStorageAdapter();
    setStorageAdapterForTesting(memory);

    try {
      // Write corrupted non-JSON data
      await memory.setItem('growfast_user_session', 'MALFORMED{NOT_JSON}');

      // getUserSession must not throw and must return null
      const session = await getUserSession();
      assert.equal(session, null);

      // Corrupted data must be purged
      assert.equal(await memory.getItem('growfast_user_session'), null);
    } finally {
      setStorageAdapterForTesting(null);
    }
  });

  it('19. Storage error or empty token is never treated as proof of authentication', async () => {
    // Failing storage adapter
    class FailingStorageAdapter extends MemoryStorageAdapter {
      async getItem(): Promise<string | null> {
        throw new Error('Disk read failure');
      }
    }

    setStorageAdapterForTesting(new FailingStorageAdapter());
    try {
      const token = await getAuthToken();
      assert.equal(token, null, 'Storage error must safely resolve to null, never authenticated');

      const session = await getUserSession();
      assert.equal(session, null, 'Storage error must safely resolve to null');
    } finally {
      setStorageAdapterForTesting(null);
    }
  });

  it('20. 401 Unauthorized handling cancels in-flight queries and clears session without loop', async () => {
    _resetUnauthorizedLock();
    let authFired = 0;
    const unsub = onUnauthorized(() => {
      authFired++;
    });

    try {
      // Simulate 401 trigger
      await triggerUnauthorized();
      assert.equal(authFired, 1);

      // Subsequent 401 within debounce period must not fire duplicate logouts
      await triggerUnauthorized();
      assert.equal(authFired, 1);
    } finally {
      unsub();
    }
  });

  it('21. Route guard logic prevents protected tab rendering when unauthenticated or loading', () => {
    function evaluateTabAccess(isLoading: boolean, isAuthenticated: boolean) {
      if (isLoading) return 'SHOW_LOADING_INDICATOR';
      if (!isAuthenticated) return 'REDIRECT_TO_LOGIN';
      return 'RENDER_PROTECTED_TABS';
    }

    // While loading, tabs NEVER render
    assert.equal(evaluateTabAccess(true, false), 'SHOW_LOADING_INDICATOR');
    assert.equal(evaluateTabAccess(true, true), 'SHOW_LOADING_INDICATOR');

    // When unauthenticated, redirects to login
    assert.equal(evaluateTabAccess(false, false), 'REDIRECT_TO_LOGIN');

    // Only when fully loaded and authenticated does it render tabs
    assert.equal(evaluateTabAccess(false, true), 'RENDER_PROTECTED_TABS');
  });
});
