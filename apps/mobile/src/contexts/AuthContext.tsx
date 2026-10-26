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
import { apiClient, setOnUnauthorized } from '../api/client';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: MobileUserSession | null;
  login: (credentials: { employeeId: string; pin: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

  useEffect(() => {
    setOnUnauthorized(logout);
    return () => {
      setOnUnauthorized(null);
    };
  }, [logout]);

  useEffect(() => {
    let isMounted = true;
    async function loadStoredAuth() {
      try {
        const storedToken = await getAuthToken();
        const storedUser = await getUserSession();
        if (isMounted) {
          if (storedToken) {
            setToken(storedToken);
            setUser(storedUser);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.warn('Failed to load stored auth session:', err);
        if (isMounted) setIsAuthenticated(false);
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

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
