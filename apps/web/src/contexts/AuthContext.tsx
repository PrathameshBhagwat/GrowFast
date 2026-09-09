import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { type EmployeeSummary } from '@growfast/shared-types';
import { apiFetch, ApiError, friendlyErrorMessage } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  employee: EmployeeSummary | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (employeeId: string, pin: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'growfast_token';
const EMPLOYEE_KEY = 'growfast_employee';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    employee: null,
    isLoading: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount and verify token validity
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const employeeStr = localStorage.getItem(EMPLOYEE_KEY);

    if (token && employeeStr) {
      try {
        const employee = JSON.parse(employeeStr) as EmployeeSummary;

        // Verify token with backend
        apiFetch('/auth/me', { token, retries: 1 })
          .then(() => {
            setState({
              isAuthenticated: true,
              token,
              employee,
              isLoading: false,
            });
          })
          .catch((err) => {
            if (
              err instanceof ApiError &&
              (err.code === 'UNAUTHORIZED' || err.code === 'FORBIDDEN')
            ) {
              // Token actually invalid or expired — clear storage
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(EMPLOYEE_KEY);
              setState({
                isAuthenticated: false,
                token: null,
                employee: null,
                isLoading: false,
              });
            } else {
              // Server returned 500, or backend is offline/unreachable.
              // Do NOT aggressively destroy the session here, otherwise a hard
              // refresh while backend is booting will log them out!
              setState({
                isAuthenticated: true, // Optimistically keep them logged in
                token,
                employee,
                isLoading: false,
              });
            }
          });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EMPLOYEE_KEY);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (employeeId: string, pin: string) => {
    setError(null);
    try {
      const data = await apiFetch<{ accessToken: string; employee: EmployeeSummary }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ employeeId, pin }),
          noAuth: true,
          retries: 1,
          retryDelay: 500,
        },
      );

      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));

      setState({
        isAuthenticated: true,
        token: data.accessToken,
        employee: data.employee,
        isLoading: false,
      });
    } catch (err) {
      const msg = friendlyErrorMessage(err);
      setError(msg);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    setState({
      isAuthenticated: false,
      token: null,
      employee: null,
      isLoading: false,
    });
    setError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
