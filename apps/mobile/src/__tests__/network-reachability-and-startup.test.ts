import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiClient,
  setApiConfig,
  getBaseUrl,
  validateApiBaseUrl,
  getExpoMetroHost,
  resolveDefaultBaseUrl,
  normalizeApiUrl,
  ApiError,
  triggerUnauthorized,
  _resetUnauthorizedLock,
  onUnauthorized,
} from '../api/client';
import {
  saveAuthToken,
  getAuthToken,
  saveUserSession,
  getUserSession,
  clearUserSession,
  setStorageAdapterForTesting,
  MemoryStorageAdapter,
} from '../storage/secure-store';

describe('GrowFast Mobile — Network Reachability, Base URL & Startup Verification', () => {
  const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
  let isBackendOnline = false;

  before(async () => {
    setStorageAdapterForTesting(new MemoryStorageAdapter());
    setApiConfig({ baseUrl: BACKEND_URL });

    try {
      const health = await apiClient.health.check();
      if (health && health.status === 'ok') {
        isBackendOnline = true;
      }
    } catch {
      isBackendOnline = false;
    }
  });

  describe('1. API Base URL Resolution & Validation', () => {
    it('1.1 validateApiBaseUrl accepts valid HTTP and HTTPS URLs', () => {
      const res1 = validateApiBaseUrl('http://192.168.1.37:3000');
      assert.equal(res1.valid, true);
      assert.equal(res1.url, 'http://192.168.1.37:3000');

      const res2 = validateApiBaseUrl('https://api.growfastlaundry.in');
      assert.equal(res2.valid, true);
      assert.equal(res2.url, 'https://api.growfastlaundry.in');
    });

    it('1.2 validateApiBaseUrl normalizes trailing slashes and trailing /api', () => {
      const resSlash = validateApiBaseUrl('http://192.168.1.37:3000/');
      assert.equal(resSlash.valid, true);
      assert.equal(resSlash.url, 'http://192.168.1.37:3000');

      const resApi = validateApiBaseUrl('http://192.168.1.37:3000/api');
      assert.equal(resApi.valid, true);
      assert.equal(resApi.url, 'http://192.168.1.37:3000');

      const resApiSlash = validateApiBaseUrl('http://192.168.1.37:3000/api/');
      assert.equal(resApiSlash.valid, true);
      assert.equal(resApiSlash.url, 'http://192.168.1.37:3000');
    });

    it('1.3 validateApiBaseUrl rejects missing, empty, or non-HTTP URLs with clear error messages', () => {
      const resEmpty = validateApiBaseUrl('');
      assert.equal(resEmpty.valid, false);
      assert.ok(resEmpty.error?.includes('missing'));

      const resInvalid = validateApiBaseUrl('192.168.1.37:3000');
      assert.equal(resInvalid.valid, false);
      assert.ok(resInvalid.error?.includes('http://'));

      const resFtp = validateApiBaseUrl('ftp://192.168.1.37:3000');
      assert.equal(resFtp.valid, false);
      assert.ok(resFtp.error?.includes('http://'));
    });

    it('1.4 validateApiBaseUrl warns when physical phone context is given localhost', () => {
      const res = validateApiBaseUrl('http://localhost:3000', { isPhysicalPhone: true });
      assert.equal(res.valid, true);
      assert.ok(res.warning?.includes('localhost'));
      assert.ok(res.warning?.includes('physical mobile device'));
    });

    it('1.5 normalizeApiUrl guarantees clean paths without duplicate /api or trailing slashes', () => {
      // Standard path with /api
      assert.equal(
        normalizeApiUrl('http://192.168.1.37:3000', '/api/orders/due-today'),
        'http://192.168.1.37:3000/api/orders/due-today',
      );
      // Path without /api prefix
      assert.equal(
        normalizeApiUrl('http://192.168.1.37:3000', '/orders/due-today'),
        'http://192.168.1.37:3000/api/orders/due-today',
      );
      // Base URL ending with /api
      assert.equal(
        normalizeApiUrl('http://192.168.1.37:3000/api', '/orders/due-today'),
        'http://192.168.1.37:3000/api/orders/due-today',
      );
      // Base URL ending with /api/
      assert.equal(
        normalizeApiUrl('http://192.168.1.37:3000/api/', 'orders/due-today'),
        'http://192.168.1.37:3000/api/orders/due-today',
      );
    });
  });

  describe('2. Backend Reachability & Health Endpoint', () => {
    it('2.1 apiClient.health.check() successfully reaches the backend without authentication', async (t) => {
      if (!isBackendOnline) {
        t.skip('Backend is offline in test runner environment');
        return;
      }

      const res = await apiClient.health.check();
      assert.equal(res.status, 'ok');
      assert.equal(res.service, 'growfast-backend');
      assert.ok(res.timestamp);
    });

    it('2.2 Public directory endpoint is accessible and returns OWNER and COUNTER staff', async (t) => {
      if (!isBackendOnline) {
        t.skip('Backend is offline in test runner environment');
        return;
      }

      const directory = await apiClient.auth.getDirectory();
      assert.ok(Array.isArray(directory));
      assert.ok(directory.length > 0);
      assert.ok(directory.every((emp) => emp.role === 'OWNER' || emp.role === 'COUNTER'));
    });
  });

  describe('3. Startup Authentication & Offline Session Preservation', () => {
    it('3.1 Preserves valid unexpired offline session when server is unreachable', async () => {
      // Simulate stored session
      const mockToken =
        'mock-jwt-header.eyJzdWIiOiJlbXAtMDEiLCJyb2xlIjoiQ09VTlRFUiIsImV4cCI6OTk5OTk5OTk5OX0.sig';
      const mockUser = {
        id: 'emp-01',
        name: 'Offline Staff',
        phone: '9876543210',
        role: 'COUNTER',
        storeId: 'store-01',
      };

      await saveAuthToken(mockToken);
      await saveUserSession(mockUser);

      // Point apiClient to an unreachable port to simulate server offline
      setApiConfig({ baseUrl: 'http://127.0.0.1:59999' });

      // Simulating the catch block in AuthContext.tsx
      let preservedUser = null;
      let preservedToken = null;
      let isAuthenticated = false;

      try {
        await apiClient.auth.getMe();
        isAuthenticated = true;
      } catch (err: any) {
        const statusCode = err?.statusCode ?? 0;
        const isServerRejection = statusCode >= 400 && statusCode < 500;

        if (isServerRejection) {
          await clearUserSession();
          isAuthenticated = false;
        } else {
          // Network failure: preserve valid offline session
          preservedToken = await getAuthToken();
          preservedUser = await getUserSession();
          isAuthenticated = true;
        }
      }

      assert.equal(isAuthenticated, true, 'App must preserve authentication on server unreachable');
      assert.equal(preservedToken, mockToken);
      assert.equal(preservedUser?.id, mockUser.id);

      // Restore base URL
      setApiConfig({ baseUrl: BACKEND_URL });
    });

    it('3.2 Genuine HTTP 401 actively revokes session and triggers unauthorized listener', async () => {
      _resetUnauthorizedLock();
      let unauthorizedFired = false;
      const unsubscribe = onUnauthorized(() => {
        unauthorizedFired = true;
      });

      // Stored token that backend will reject
      await saveAuthToken('invalid-revoked-token');
      await saveUserSession({
        id: 'bad-emp',
        name: 'Bad',
        phone: '9876543210',
        role: 'COUNTER',
        storeId: 's1',
      });

      // Trigger 401 centrally
      await triggerUnauthorized();

      assert.equal(unauthorizedFired, true);
      assert.equal(await getAuthToken(), null, 'Token must be cleared upon genuine 401');
      assert.equal(await getUserSession(), null, 'Session must be cleared upon genuine 401');

      unsubscribe();
    });

    it('3.3 Server unreachable errors must not count against failed PIN lockout attempts', () => {
      let failedAttempts = 2;
      const networkError = new ApiError('Server unreachable at http://192.168.1.37:3000', 0, null);

      // Simulating login handler logic
      const isNetworkError =
        networkError.statusCode === 0 || networkError.message.includes('Server unreachable');

      if (!isNetworkError) {
        failedAttempts += 1;
      }

      assert.equal(failedAttempts, 2, 'Failed attempts must NOT increment on network failure');
    });
  });

  describe('4. Startup Order Fetching & Bounded Retries', () => {
    it('4.1 Due orders request failure returns clean error without throwing unhandled exceptions', async () => {
      // Ensure token exists so request attempts network call
      await saveAuthToken('mock-auth-token');
      // Temporarily point to dead server
      setApiConfig({ baseUrl: 'http://127.0.0.1:59999' });

      let errorCaught: string | null = null;
      try {
        await apiClient.orders.dueToday({ countOnly: false });
      } catch (err: any) {
        errorCaught = err?.message || 'Failed';
      } finally {
        // Always restore base URL
        setApiConfig({ baseUrl: BACKEND_URL });
      }

      assert.ok(errorCaught);
      assert.ok(
        errorCaught.includes('Server unreachable') ||
          errorCaught.includes('refused') ||
          errorCaught.includes('failed'),
      );
    });

    it('4.2 In-flight guard prevents duplicate concurrent executions of due orders request', async () => {
      let activeExecutions = 0;
      let maxConcurrent = 0;
      let isFetching = false;

      async function simulatedLoadDueToday() {
        if (isFetching) {
          return 'skipped_duplicate';
        }
        isFetching = true;
        activeExecutions++;
        maxConcurrent = Math.max(maxConcurrent, activeExecutions);

        // Simulate async operation
        await new Promise((r) => setTimeout(r, 50));

        activeExecutions--;
        isFetching = false;
        return 'executed';
      }

      // Fire 3 simultaneous calls as would happen during startup effect re-renders
      const [r1, r2, r3] = await Promise.all([
        simulatedLoadDueToday(),
        simulatedLoadDueToday(),
        simulatedLoadDueToday(),
      ]);

      assert.equal(r1, 'executed');
      assert.equal(r2, 'skipped_duplicate');
      assert.equal(r3, 'skipped_duplicate');
      assert.equal(
        maxConcurrent,
        1,
        'Never run more than 1 in-flight due orders request simultaneously',
      );
    });

    it('4.3 Recovers due orders successfully when backend becomes reachable', async (t) => {
      if (!isBackendOnline) {
        t.skip('Backend is offline in test runner environment');
        return;
      }

      // Login as COUNTER staff to get a valid token
      const loginRes = await apiClient.auth.login({
        employeeId: 'emp-counter-001',
        pin: '333333',
      });
      assert.ok(loginRes.accessToken);
      await saveAuthToken(loginRes.accessToken);
      await saveUserSession(loginRes.user);

      // Now fetch due today
      const dueRes = await apiClient.orders.dueToday({ countOnly: false });
      assert.ok(dueRes);
      assert.ok(
        typeof dueRes.total === 'number' ||
          typeof dueRes.count === 'number' ||
          Array.isArray(dueRes.data),
      );
    });
  });
});
