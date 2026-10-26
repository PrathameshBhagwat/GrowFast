import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import {
  saveAuthToken,
  getAuthToken,
  saveUserSession,
  getUserSession,
  clearUserSession,
  MobileUserSession,
} from '../storage/secure-store';
import {
  apiClient,
  onUnauthorized,
  setOnUnauthorized,
  AuthEmployeeProfile,
  ApiError,
} from '../api/client';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: MobileUserSession | null;
  login: (credentials: { employeeId: string; pin: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function parseJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const decoded =
      typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<MobileUserSession | null>(null);

  const logout = useCallback(async () => {
    try {
      await clearUserSession();
    } finally {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Subscribe to centralized HTTP 401 unauthorized events from apiClient
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    });
    setOnUnauthorized(logout);
    return () => {
      unsubscribe();
      setOnUnauthorized(null);
    };
  }, [logout]);
  useEffect(() => {
    let isMounted = true;
    async function loadStoredAuth() {
      try {
        const storedToken = await getAuthToken();
        const storedUser = await getUserSession();

        // 1. If either token or session is missing, clear and set unauthenticated
        if (!storedToken || !storedUser) {
          await clearUserSession();
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
          return;
        }

        // 2. Validate JWT expiration locally
        const payload = parseJwtPayload(storedToken);
        if (payload?.exp && payload.exp * 1000 <= Date.now()) {
          console.warn('[AuthProvider] Persisted JWT has expired locally. Clearing session.');
          await clearUserSession();
          if (isMounted) {
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
          return;
        }

        // 3. Validate session against the backend if connected
        try {
          const profile: AuthEmployeeProfile = await apiClient.auth.getMe();
          if (profile && profile.id) {
            const updatedUser: MobileUserSession = {
              id: profile.id,
              name: profile.name,
              phone: profile.phone || storedUser.phone || '',
              role: profile.role,
              storeId: profile.storeId,
              storeName: profile.storeName || storedUser.storeName,
            };
            await saveUserSession(updatedUser);
            if (isMounted) {
              setToken(storedToken);
              setUser(updatedUser);
              setIsAuthenticated(true);
            }
          } else {
            await clearUserSession();
            if (isMounted) {
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
            }
          }
        } catch (apiErr: unknown) {
          const is401 = apiErr instanceof ApiError && apiErr.statusCode === 401;
          if (is401) {
            console.warn(
              '[AuthProvider] Stored session rejected by backend (401). Clearing session.',
            );
            await clearUserSession();
            if (isMounted) {
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
            }
          } else {
            // Network failure: preserve valid, non-expired offline session on mobile hardware
            console.log(
              '[AuthProvider] Server unreachable on startup; preserving valid offline session.',
            );
            if (isMounted) {
              setToken(storedToken);
              setUser(storedUser);
              setIsAuthenticated(true);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load stored auth session:', err);
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadStoredAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: { employeeId: string; pin: string }) => {
    const response = await apiClient.auth.login(credentials);
    if (!response?.accessToken) {
      throw new Error('Authentication failed: Missing access token');
    }

    await saveAuthToken(response.accessToken);
    if (response.user) {
      await saveUserSession(response.user);
      setUser(response.user);
    }
    setToken(response.accessToken);
    setIsAuthenticated(true);
  }, []);

  const authValue = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      token,
      user,
      login,
      logout,
    }),
    [isAuthenticated, isLoading, token, user, login, logout],
  );

  return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
