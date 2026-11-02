import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { apiFetch, ApiError } from '../services/api';

vi.mock('../services/api', () => {
  return {
    apiFetch: vi.fn(),
    ApiError: class ApiError extends Error {
      code: string;
      status: number | null;
      details?: unknown;
      constructor(message: string, code: string, status: number | null = null, details?: unknown) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
      }
    },
    friendlyErrorMessage: vi.fn((err: Error) => err.message),
  };
});

const mockEmployee = {
  id: 'emp-1',
  employeeId: 'EMP001',
  name: 'Test Owner',
  role: 'OWNER',
  storeId: 'store-1',
};

const TestConsumer: React.FC = () => {
  const { isAuthenticated, isLoading, employee, token, login, logout, error } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="auth">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="employee">{employee ? employee.name : 'none'}</div>
      <div data-testid="token">{token || 'none'}</div>
      <div data-testid="error">{error || 'none'}</div>
      <button onClick={() => login('EMP001', '1234')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with unauthenticated state when localStorage is empty', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('auth').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('employee').textContent).toBe('none');
    expect(screen.getByTestId('token').textContent).toBe('none');
  });

  it('restores and verifies session from localStorage when valid token exists', async () => {
    localStorage.setItem('growfast_token', 'valid-jwt-token');
    localStorage.setItem('growfast_employee', JSON.stringify(mockEmployee));

    vi.mocked(apiFetch).mockResolvedValueOnce({ employee: mockEmployee });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('auth').textContent).toBe('authenticated');
    expect(screen.getByTestId('employee').textContent).toBe('Test Owner');
    expect(screen.getByTestId('token').textContent).toBe('valid-jwt-token');
    expect(apiFetch).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ token: 'valid-jwt-token', retries: 0 }));
  });

  it('deduplicates concurrent /auth/me verification calls for the same token (e.g. React StrictMode)', async () => {
    localStorage.setItem('growfast_token', 'strict-token');
    localStorage.setItem('growfast_employee', JSON.stringify(mockEmployee));

    let resolveApi: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveApi = resolve;
    });

    vi.mocked(apiFetch).mockImplementation(() => pendingPromise as unknown as Promise<unknown>);

    // Render twice simultaneously as React StrictMode does
    const { unmount } = render(
      <React.StrictMode>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </React.StrictMode>
    );

    // Only one /auth/me call should have been dispatched to apiFetch
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveApi!({ employee: mockEmployee });
    });

    unmount();
  });

  it('clears localStorage and unauthenticates state on 401 Unauthorized from backend', async () => {
    localStorage.setItem('growfast_token', 'expired-token');
    localStorage.setItem('growfast_employee', JSON.stringify(mockEmployee));

    const unauthorizedError = new ApiError('Unauthorized', 'UNAUTHORIZED', 401);
    vi.mocked(apiFetch).mockRejectedValueOnce(unauthorizedError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('auth').textContent).toBe('unauthenticated');
    expect(screen.getByTestId('employee').textContent).toBe('none');
    expect(localStorage.getItem('growfast_token')).toBeNull();
    expect(localStorage.getItem('growfast_employee')).toBeNull();
  });

  it('optimistically preserves session if backend returns 500 network/server error', async () => {
    localStorage.setItem('growfast_token', 'valid-token');
    localStorage.setItem('growfast_employee', JSON.stringify(mockEmployee));

    const serverError = new ApiError('Database offline', 'SERVER_ERROR', 500);
    vi.mocked(apiFetch).mockRejectedValueOnce(serverError);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('ready');
    });

    expect(screen.getByTestId('auth').textContent).toBe('authenticated');
    expect(screen.getByTestId('employee').textContent).toBe('Test Owner');
    expect(localStorage.getItem('growfast_token')).toBe('valid-token');
  });

  it('logs out and clears storage when logout is called', async () => {
    localStorage.setItem('growfast_token', 'token-to-logout');
    localStorage.setItem('growfast_employee', JSON.stringify(mockEmployee));

    vi.mocked(apiFetch).mockResolvedValueOnce({ employee: mockEmployee });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('authenticated');
    });

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('auth').textContent).toBe('unauthenticated');
    expect(localStorage.getItem('growfast_token')).toBeNull();
    expect(localStorage.getItem('growfast_employee')).toBeNull();
  });
});
