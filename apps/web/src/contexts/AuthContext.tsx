import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Role, type EmployeeSummary } from '@growfast/shared-types';

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

const API_URL = import.meta.env.VITE_API_URL || '/api';

const DEV_CREDENTIALS: Record<string, { pin: string; employee: EmployeeSummary }> = {
  'emp-owner-001': {
    pin: '111111',
    employee: {
      id: 'emp-owner-001',
      name: 'Prathamesh Bhagwat',
      role: Role.OWNER,
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    },
  },
  'emp-mgr-001': {
    pin: '222222',
    employee: {
      id: 'emp-mgr-001',
      name: 'Rajesh Nair',
      role: Role.MANAGER,
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    },
  },
  'emp-counter-001': {
    pin: '333333',
    employee: {
      id: 'emp-counter-001',
      name: 'Swapnil Shinde',
      role: Role.COUNTER,
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    },
  },
  'emp-delivery-001': {
    pin: '444444',
    employee: {
      id: 'emp-delivery-001',
      name: 'Kiran More',
      role: Role.DELIVERY,
      storeId: 'store-kp-001',
      storeName: 'Koregaon Park Branch',
    },
  },
};

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

        // If it's a dev mock token, attempt live login if backend is online
        if (token.startsWith('dev-mock-jwt-')) {
          const devCred = DEV_CREDENTIALS[employee.id];
          if (devCred) {
            fetch(`${API_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ employeeId: employee.id, pin: devCred.pin }),
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data && data.accessToken) {
                  localStorage.setItem(TOKEN_KEY, data.accessToken);
                  localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));
                  setState({
                    isAuthenticated: true,
                    token: data.accessToken,
                    employee: data.employee,
                    isLoading: false,
                  });
                }
              })
              .catch(() => {});
          }

          setState({
            isAuthenticated: true,
            token,
            employee,
            isLoading: false,
          });
          return;
        }

        // Verify token with backend
        fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            if (res.ok) {
              setState({
                isAuthenticated: true,
                token,
                employee,
                isLoading: false,
              });
            } else {
              // Token invalid or expired — clear storage
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(EMPLOYEE_KEY);
              setState({
                isAuthenticated: false,
                token: null,
                employee: null,
                isLoading: false,
              });
            }
          })
          .catch(() => {
            // Network or server unreachable — keep existing local session in development
            setState({
              isAuthenticated: true,
              token,
              employee,
              isLoading: false,
            });
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
      let data: { accessToken: string; employee: EmployeeSummary };

      try {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, pin }),
          });
        } catch {
          res = null;
        }

        if (res && res.ok) {
          data = await res.json();
        } else if (res && res.status >= 400 && res.status < 500) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Invalid credentials');
        } else {
          // Server offline, HTTP 500 (DB offline), or network unreachable
          const devCred = DEV_CREDENTIALS[employeeId];
          if (devCred) {
            if (devCred.pin !== pin) {
              throw new Error('Invalid PIN. Check dev credentials below.');
            }
            data = {
              accessToken: `dev-mock-jwt-${employeeId}`,
              employee: devCred.employee,
            };
            console.info(
              `[Auth] Local dev session for ${devCred.employee.name} (${devCred.employee.role})`,
            );
          } else {
            throw new Error('Server unreachable. Please check backend connection.');
          }
        }
      } catch (fetchErr: any) {
        throw fetchErr;
      }

      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data.employee));

      setState({
        isAuthenticated: true,
        token: data.accessToken,
        employee: data.employee,
        isLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
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
