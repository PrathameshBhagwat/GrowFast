import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure route guard decision logic matching ProtectedRoutes in apps/mobile/app/_layout.tsx
 */
function evaluateRouteGuard({
  isDbReady,
  isLoading,
  navigationKey,
  isAuthenticated,
  segments,
}: {
  isDbReady: boolean;
  isLoading: boolean;
  navigationKey: string | undefined | null;
  isAuthenticated: boolean;
  segments: string[];
}): { shouldRedirect: boolean; targetRoute: string | null } {
  const isNavigationReady = Boolean(navigationKey);
  const isAppReady = isDbReady && !isLoading && isNavigationReady;

  if (!isAppReady) {
    return { shouldRedirect: false, targetRoute: null };
  }

  const inAuthGroup = segments[0] === '(auth)';

  if (!isAuthenticated && !inAuthGroup) {
    return { shouldRedirect: true, targetRoute: '/(auth)/login' };
  } else if (isAuthenticated && inAuthGroup) {
    return { shouldRedirect: true, targetRoute: '/(tabs)' };
  }

  return { shouldRedirect: false, targetRoute: null };
}

describe('Expo Router Navigation Guard & Authentication Protection Suite', () => {
  it('1. Suppresses redirects when Root Navigation is not yet mounted (navigationKey undefined)', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: undefined,
      isAuthenticated: false,
      segments: ['(tabs)'],
    });

    assert.equal(result.shouldRedirect, false);
    assert.equal(result.targetRoute, null);
  });

  it('2. Suppresses redirects while authentication is actively restoring (isLoading: true)', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: true,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(tabs)'],
    });

    assert.equal(result.shouldRedirect, false);
    assert.equal(result.targetRoute, null);
  });

  it('3. Suppresses redirects while local database foundation is initializing (isDbReady: false)', () => {
    const result = evaluateRouteGuard({
      isDbReady: false,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(tabs)'],
    });

    assert.equal(result.shouldRedirect, false);
    assert.equal(result.targetRoute, null);
  });

  it('4. Redirects unauthenticated user to /(auth)/login once navigation and foundation are ready', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(tabs)', 'index'],
    });

    assert.equal(result.shouldRedirect, true);
    assert.equal(result.targetRoute, '/(auth)/login');
  });

  it('5. Avoids redirect loop when unauthenticated user is already on /(auth)/login', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(auth)', 'login'],
    });

    assert.equal(result.shouldRedirect, false);
    assert.equal(result.targetRoute, null);
  });

  it('6. Redirects authenticated user away from /(auth)/login to /(tabs)', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: true,
      segments: ['(auth)', 'login'],
    });

    assert.equal(result.shouldRedirect, true);
    assert.equal(result.targetRoute, '/(tabs)');
  });

  it('7. Avoids redirect loop when authenticated user is already on /(tabs)', () => {
    const result = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: true,
      segments: ['(tabs)', 'orders'],
    });

    assert.equal(result.shouldRedirect, false);
    assert.equal(result.targetRoute, null);
  });

  it('8. Logout transition immediately triggers redirect to /(auth)/login from protected screens', () => {
    // Before logout: authenticated on (tabs)
    const beforeLogout = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: true,
      segments: ['(tabs)', 'settings'],
    });
    assert.equal(beforeLogout.shouldRedirect, false);

    // After logout: isAuthenticated flips to false on (tabs)
    const afterLogout = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(tabs)', 'settings'],
    });
    assert.equal(afterLogout.shouldRedirect, true);
    assert.equal(afterLogout.targetRoute, '/(auth)/login');
  });

  it('9. Login transition immediately triggers redirect to /(tabs) from auth screen', () => {
    // Before login: unauthenticated on (auth)
    const beforeLogin = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: false,
      segments: ['(auth)', 'login'],
    });
    assert.equal(beforeLogin.shouldRedirect, false);

    // After login: isAuthenticated flips to true on (auth)
    const afterLogin = evaluateRouteGuard({
      isDbReady: true,
      isLoading: false,
      navigationKey: 'root-stack-key-001',
      isAuthenticated: true,
      segments: ['(auth)', 'login'],
    });
    assert.equal(afterLogin.shouldRedirect, true);
    assert.equal(afterLogin.targetRoute, '/(tabs)');
  });
});
