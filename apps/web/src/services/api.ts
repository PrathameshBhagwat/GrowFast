/**
 * Shared API utilities for the GrowFast frontend.
 *
 * Provides:
 * - Backend-offline detection with user-friendly messages
 * - Centralised error classification
 * - Typed, reusable `apiFetch` wrapper around native `fetch`
 * - Auto-retry for GET requests with exponential back-off
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ── Error Classification ────────────────────────────────────────────────

export type ApiErrorCode =
  | 'BACKEND_OFFLINE'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number | null;
  public readonly isRetryable: boolean;

  constructor(message: string, code: ApiErrorCode, status: number | null = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.isRetryable =
      code === 'BACKEND_OFFLINE' || code === 'NETWORK_ERROR' || code === 'SERVER_ERROR';
  }
}

/**
 * Returns a user-friendly error message for the given error.
 * Falls back to the raw message if it's not a recognised ApiError.
 */
export function friendlyErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'BACKEND_OFFLINE':
        return 'The server is currently unreachable. Please make sure the backend is running and try again.';
      case 'NETWORK_ERROR':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'UNAUTHORIZED':
        return 'Your session has expired. Please log in again.';
      case 'FORBIDDEN':
        return 'You do not have permission to perform this action.';
      case 'NOT_FOUND':
        return 'The requested resource was not found.';
      case 'VALIDATION':
        return err.message || 'Please check the form inputs and try again.';
      case 'SERVER_ERROR':
        return 'The server encountered an error. Please try again in a moment.';
      default:
        return err.message || 'An unexpected error occurred.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

/**
 * Detect whether an error represents a completely offline backend
 * (TCP refused, DNS failure, proxy 503, etc.).
 */
export function isBackendOffline(err: unknown): boolean {
  if (err instanceof ApiError) return err.code === 'BACKEND_OFFLINE';
  return false;
}

// ── Core Fetch Wrapper ──────────────────────────────────────────────────

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  /** Extra headers to merge (auth, content-type, etc.) */
  headers?: Record<string, string>;
  /** Token for Authorization header. Pulled from localStorage if omitted. */
  token?: string | null;
  /** If true, skip adding the Authorization header entirely. */
  noAuth?: boolean;
  /** Number of automatic retries for retryable errors (default: 0 for mutations, 2 for GET). */
  retries?: number;
  /** Base delay in ms between retries (doubled each attempt). Default 1000. */
  retryDelay?: number;
}

/**
 * Centralised API fetch wrapper.
 *
 * - Automatically adds `Authorization: Bearer <token>` from localStorage
 * - Detects backend-offline / network errors
 * - Classifies HTTP status codes into `ApiErrorCode`
 * - Optional exponential-backoff retry for GET requests
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    token,
    noAuth = false,
    retries,
    retryDelay = 1000,
    headers: extraHeaders = {},
    ...fetchInit
  } = options;

  const method = (fetchInit.method || 'GET').toUpperCase();
  const maxRetries = retries ?? (method === 'GET' ? 2 : 0);

  // Build URL — support both absolute paths (/api/...) and relative (auth/me)
  const url = path.startsWith('http')
    ? path
    : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  // Build headers
  const resolvedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (!noAuth) {
    const authToken = token ?? localStorage.getItem('growfast_token');
    if (authToken) {
      resolvedHeaders['Authorization'] = `Bearer ${authToken}`;
    }
  }

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Exponential backoff delay (skip on first attempt)
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
    }

    try {
      const res = await fetch(url, {
        ...fetchInit,
        headers: resolvedHeaders,
      });

      // Vite proxy returns 503 with { error: 'Backend offline', code: 'ECONNREFUSED' }
      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'ECONNREFUSED' || body.error === 'Backend offline') {
          lastError = new ApiError('Backend server is not running', 'BACKEND_OFFLINE', 503);
          if (attempt < maxRetries) continue; // retry
          throw lastError;
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        const msg = body.message || `Request failed (HTTP ${res.status})`;

        if (res.status === 401) throw new ApiError(msg, 'UNAUTHORIZED', 401);
        if (res.status === 403) throw new ApiError(msg, 'FORBIDDEN', 403);
        if (res.status === 404) throw new ApiError(msg, 'NOT_FOUND', 404);
        if (res.status === 400 || res.status === 422)
          throw new ApiError(msg, 'VALIDATION', res.status);

        // 5xx → retryable
        if (res.status >= 500) {
          lastError = new ApiError(msg, 'SERVER_ERROR', res.status);
          if (attempt < maxRetries) continue;
          throw lastError;
        }

        throw new ApiError(msg, 'UNKNOWN', res.status);
      }

      // Success — parse JSON
      const json = await res.json();
      return json as T;
    } catch (err) {
      if (err instanceof ApiError) {
        if (!err.isRetryable || attempt >= maxRetries) throw err;
        lastError = err;
        continue;
      }

      // TypeError: Failed to fetch → network / CORS / DNS / backend unreachable
      if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
        lastError = new ApiError('Cannot connect to the server', 'BACKEND_OFFLINE', null);
        if (attempt < maxRetries) continue;
        throw lastError;
      }

      // Unknown error — don't retry
      throw new ApiError(err instanceof Error ? err.message : 'Unknown error', 'UNKNOWN');
    }
  }

  // Should not reach here, but just in case
  throw lastError || new ApiError('Request failed', 'UNKNOWN');
}
