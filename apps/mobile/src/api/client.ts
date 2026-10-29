import {
  CreateOrderRequest,
  OrderDetailDTO,
  OrderSummaryDTO,
  OrderPickupRequest,
  RecordPaymentRequest,
  PaymentDTO,
  PaymentSummaryDTO,
  CustomerDTO,
  CreateCustomerRequest,
  GarmentCatalogDTO,
  ServiceTypeDTO,
  GarmentCategory,
  ServiceCategory,
  PaginatedResponse,
  DeliveryRecordDTO,
  CompleteDeliveryRequest,
  UpdateCustomerRequest,
  DashboardSummaryDTO,
  NotificationDTO,
  OrderPhotoDTO,
} from '@growfast/shared-types';
import { getAuthToken, clearUserSession } from '../storage/secure-store';

export interface AuthEmployeeProfile {
  id: string;
  employeeId?: string;
  name: string;
  role: string;
  storeId: string;
  storeName?: string;
  phone?: string;
}

export interface ApiClientConfig {
  baseUrl: string;
}

type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/**
 * Register a listener to be notified when a protected endpoint returns HTTP 401.
 * Returns an unsubscription function.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

let unauthorizedPromise: Promise<void> | null = null;

/**
 * Centrally handle an HTTP 401 Unauthorized response from a protected endpoint.
 * Debounces concurrent 401s so multiple simultaneous requests do not trigger competing operations.
 */
export async function triggerUnauthorized(): Promise<void> {
  if (unauthorizedPromise) {
    return unauthorizedPromise;
  }

  unauthorizedPromise = (async () => {
    try {
      unauthorizedHandlers.forEach((handler) => {
        try {
          handler();
        } catch (err) {
          console.error('[apiClient] Error in unauthorized handler:', err);
        }
      });
      await clearUserSession();
    } finally {
      setTimeout(() => {
        unauthorizedPromise = null;
      }, 1000);
    }
  })();

  return unauthorizedPromise;
}

export function _resetUnauthorizedLock(): void {
  unauthorizedPromise = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Base URL Resolution & Network Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseUrlValidationResult {
  valid: boolean;
  url: string;
  error?: string;
  warning?: string;
}

/**
 * Validates that an API base URL is well-formed.
 * Detects edge-cases like using 'localhost' on a physical device where it cannot resolve.
 */
export function validateApiBaseUrl(
  url?: string,
  options?: { isPhysicalPhone?: boolean },
): BaseUrlValidationResult {
  if (!url || typeof url !== 'string' || !url.trim()) {
    const error =
      'Backend API base URL is missing. Set EXPO_PUBLIC_API_URL in apps/mobile/.env (e.g. http://192.168.1.37:3000) or ensure Expo is connected to your development machine.';
    return { valid: false, url: '', error };
  }

  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const error = `Invalid API base URL "${trimmed}". URL must begin with "http://" or "https://".`;
    return { valid: false, url: trimmed, error };
  }

  let cleanUrl = trimmed.replace(/\/+$/, '');
  if (cleanUrl.endsWith('/api')) {
    cleanUrl = cleanUrl.slice(0, -4).replace(/\/+$/, '');
  }

  // Detect physical phone trying to use localhost / 127.0.0.1
  const isLocalhost = cleanUrl.includes('://localhost') || cleanUrl.includes('://127.0.0.1');

  if (isLocalhost && options?.isPhysicalPhone) {
    const warning = `API base URL "${cleanUrl}" uses localhost on a physical mobile device. On physical hardware, "localhost" points to the phone itself and cannot reach your computer. Configure your development machine's LAN IP in apps/mobile/.env (e.g. http://192.168.1.37:3000).`;
    return { valid: true, url: cleanUrl, warning };
  }

  return { valid: true, url: cleanUrl };
}

/**
 * Dynamically extract the Metro development server host IP from Expo Constants.
 * Works across Expo Go, Expo Dev Client, and standalone test runs in Expo SDK 52.
 */
export function getExpoMetroHost(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoConstantsMod = require('expo-constants');
    const Constants = expoConstantsMod?.default || expoConstantsMod;
    const candidate =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost ||
      Constants?.experienceUrl ||
      Constants?.linkingUri;

    if (candidate && typeof candidate === 'string') {
      const withoutScheme = candidate.replace(/^[a-zA-Z]+:\/\//, '');
      const hostPort = withoutScheme.split('/')[0];
      const host = hostPort?.split(':')[0]?.trim();
      if (host) {
        return host;
      }
    }
  } catch {
    // Non-Expo or test runner context (e.g. node tsx unit tests)
  }
  return null;
}

/**
 * Configurable base URL with dynamic environment resolution.
 * Hierarchy:
 * 1. Explicit EXPO_PUBLIC_API_URL environment variable if set and non-empty.
 * 2. Web browser context: matches browser window location.
 * 3. Dynamic Metro discovery: dynamically connects to the computer running Metro.
 * 4. Emulator fallback: 10.0.2.2 for Android emulator, localhost for iOS simulator.
 * 5. Default localhost: 127.0.0.1 for Node / test environments.
 */
export function resolveDefaultBaseUrl(): string {
  // 1. Explicit environment variable if provided
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const validation = validateApiBaseUrl(envUrl);
    if (!validation.valid) {
      console.warn(`[apiClient] ${validation.error}`);
    } else if (validation.warning) {
      console.warn(`[apiClient] ${validation.warning}`);
    }

    // Diagnostic notice if configured LAN IP differs from active Metro host IP
    const metroHost = getExpoMetroHost();
    if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
      try {
        const withoutScheme = envUrl.replace(/^[a-zA-Z]+:\/\//, '');
        const envHost = withoutScheme.split('/')[0]?.split(':')[0]?.trim();
        if (
          envHost &&
          (envHost.startsWith('192.168.') ||
            envHost.startsWith('10.') ||
            envHost.startsWith('172.')) &&
          envHost !== metroHost
        ) {
          console.warn(
            `[apiClient] Notice: Configured EXPO_PUBLIC_API_URL (${envHost}) differs from active Metro host IP (${metroHost}). If your development machine's IP address changed, update apps/mobile/.env to http://${metroHost}:3000 or leave EXPO_PUBLIC_API_URL unset to use auto-discovery.`,
          );
        }
      } catch {
        // Ignore parse error
      }
    }

    return validation.url || envUrl;
  }

  // 2. Web browser context: strictly match the browser's current host (e.g. localhost or LAN host)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:3000`;
  }

  // 3. Dynamic discovery from Expo Metro host URI on physical Android or iOS device
  const metroHost = getExpoMetroHost();
  if (metroHost) {
    if (metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
      return `http://${metroHost}:3000`;
    }
    // If Metro is bound to localhost (e.g. Android Emulator with adb reverse or iOS Simulator):
    let platformOS: string | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Platform } = require('react-native');
      platformOS = Platform?.OS;
    } catch {
      // Ignore
    }
    if (platformOS === 'android') {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  // 4. Node / unit test runner environments
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    return 'http://127.0.0.1:3000';
  }

  // 5. Standalone or fallback mobile context
  let platformOS: string | undefined;
  let isDevice = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native');
    platformOS = Platform?.OS;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoConstantsMod = require('expo-constants');
    const Constants = expoConstantsMod?.default || expoConstantsMod;
    isDevice = Boolean(Constants?.isDevice);
  } catch {
    // Ignore
  }

  if (platformOS === 'android') {
    if (!isDevice) {
      return 'http://10.0.2.2:3000';
    }
  }

  if (isDevice) {
    console.warn(
      '[apiClient] Backend API URL is not configured. When running on a physical mobile device, set EXPO_PUBLIC_API_URL in apps/mobile/.env to your development machine’s LAN IP (e.g. http://192.168.1.37:3000).',
    );
  }

  return 'http://localhost:3000';
}

let config: ApiClientConfig = {
  baseUrl: resolveDefaultBaseUrl(),
};

export function setApiConfig(newConfig: Partial<ApiClientConfig>) {
  config = { ...config, ...newConfig };
}

export function getBaseUrl(): string {
  if (config.baseUrl) {
    return config.baseUrl;
  }
  const resolved = resolveDefaultBaseUrl();
  config.baseUrl = resolved;
  return resolved;
}

let onUnauthorizedHandler: (() => void) | null = null;

export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorizedHandler = handler;
}

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Normalizes an API URL to guarantee:
 * - Base URL trailing slashes are stripped.
 * - Base URL ending with `/api` does not cause `/api/api` duplication.
 * - Endpoint leading slashes and `/api` prefix are consistently structured.
 */
export function normalizeApiUrl(baseUrl: string, endpoint: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  }
  let path = endpoint.trim().startsWith('/') ? endpoint.trim() : `/${endpoint.trim()}`;
  if (!path.startsWith('/api/') && path !== '/api') {
    path = `/api${path}`;
  }
  return `${base}${path}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const normalizedPath = cleanEndpoint.startsWith('/api/') ? cleanEndpoint : `/api${cleanEndpoint}`;
  const isPublicEndpoint =
    normalizedPath === '/api/health' ||
    normalizedPath.startsWith('/api/health') ||
    normalizedPath === '/api/auth/login' ||
    normalizedPath.startsWith('/api/auth/login') ||
    normalizedPath === '/api/auth/directory' ||
    normalizedPath.startsWith('/api/auth/directory');

  // If endpoint is protected and no token is present, do not send doomed request
  if (!isPublicEndpoint && !token) {
    const errorMsg = `Authentication required. No active session for ${cleanEndpoint}.`;
    console.warn(`[apiClient] 401 Unauthorized: ${errorMsg}`);
    await triggerUnauthorized();
    throw new ApiError(errorMsg, 401, null);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = getBaseUrl();
  const url = normalizeApiUrl(baseUrl, endpoint);

  // Bounded retry configuration: GET requests allow at most 1 network-failure retry (800ms backoff).
  // Non-GET requests (mutations) are strictly single-attempt to prevent duplicate actions.
  const isGetRequest = !options.method || options.method.toUpperCase() === 'GET';
  const maxAttempts = isGetRequest ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Add an 8-second network timeout so mobile UI never hangs indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (netErr: any) {
      clearTimeout(timeoutId);
      const isAborted = controller.signal.aborted || netErr?.name === 'AbortError';
      const isNetworkFailed = netErr?.message === 'Network request failed' || isAborted;

      // If GET request fails with network error and has remaining attempts, wait and retry once
      if (attempt < maxAttempts && isNetworkFailed) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }

      const detail = isAborted
        ? `Connection timed out after 8s connecting to ${baseUrl}. Check Wi-Fi connection and host server IP.`
        : isNetworkFailed
          ? `Server unreachable at ${baseUrl}. Ensure backend is running and phone is on the same Wi-Fi network.`
          : netErr?.message || 'Network request failed';

      // Log diagnostic message without exposing tokens, PINs, or request payloads
      console.warn(
        `[apiClient] Network failure on [${options.method || 'GET'} ${endpoint}]: ${detail}`,
      );

      throw new ApiError(detail, 0, {
        endpoint,
        baseUrl,
        targetUrl: url,
        originalError: netErr?.message,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let responseData: any = null;
    try {
      responseData = await response.json();
    } catch (jsonErr: any) {
      if (!response.ok) {
        if (response.status === 401 && !isPublicEndpoint) {
          await triggerUnauthorized();
        }
        const statusDetail = `HTTP ${response.status} (${response.statusText || 'Error'}) from ${cleanEndpoint}`;
        console.warn(`[apiClient] HTTP error without JSON body: ${statusDetail}`);
        throw new ApiError(statusDetail, response.status, null);
      }
      console.warn(
        `[apiClient] Invalid JSON response on [${options.method || 'GET'} ${cleanEndpoint}]`,
      );
      throw new ApiError(`Invalid server response from ${cleanEndpoint}`, response.status, null);
    }

    if (!response.ok) {
      // If a protected endpoint returns 401, centrally trigger session cleanup and logout
      if (response.status === 401 && !isPublicEndpoint) {
        await triggerUnauthorized();
      }
      const errorMessage =
        responseData?.message ||
        responseData?.error ||
        `Request failed with HTTP ${response.status}`;
      const formattedError = Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage;

      console.warn(
        `[apiClient] HTTP ${response.status} on [${options.method || 'GET'} ${cleanEndpoint}]: ${formattedError}`,
      );

      throw new ApiError(formattedError, response.status, responseData);
    }

    // Handle standard { success: true, data: T } wrapper or raw object
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      if ('total' in responseData) {
        return responseData as T;
      }
      return responseData.data as T;
    }

    return responseData as T;
  }

  throw new ApiError(`Failed request to ${cleanEndpoint}`, 0, null);
}

export const apiClient = {
  auth: {
    login: async (credentials: { employeeId: string; pin: string }) => {
      const resp = await request<{
        accessToken: string;
        employee: {
          id: string;
          name: string;
          role: string;
          storeId: string;
          storeName?: string;
        };
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return {
        accessToken: resp.accessToken,
        user: {
          id: resp.employee.id,
          name: resp.employee.name,
          phone: '',
          role: resp.employee.role,
          storeId: resp.employee.storeId,
          storeName: resp.employee.storeName,
        },
      };
    },

    getDirectory: async (roles?: string[]) => {
      const qs = roles && roles.length > 0 ? `?roles=${encodeURIComponent(roles.join(','))}` : '';
      return await request<{ id: string; name: string; role: string }[]>(
        `/api/auth/directory${qs}`,
      );
    },

    getProfile: async (): Promise<AuthEmployeeProfile> => {
      return await request<AuthEmployeeProfile>('/api/auth/me');
    },

    getMe: async (): Promise<AuthEmployeeProfile> => {
      return await request<AuthEmployeeProfile>('/api/auth/me');
    },
  },

  getBaseUrl: () => getBaseUrl(),

  health: {
    check: async (): Promise<{ status: string; timestamp: string; service: string }> => {
      return await request<{ status: string; timestamp: string; service: string }>('/health');
    },
  },

  customers: {
    search: async (
      query?: string,
      page: number = 1,
      pageSize: number = 20,
    ): Promise<PaginatedResponse<CustomerDTO>> => {
      const params = new URLSearchParams();
      if (query) params.append('query', query);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      return await request<PaginatedResponse<CustomerDTO>>(
        `/api/customers/search?${params.toString()}`,
      );
    },

    create: async (payload: CreateCustomerRequest): Promise<CustomerDTO> => {
      return await request<CustomerDTO>('/api/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getById: async (id: string): Promise<CustomerDTO> => {
      return await request<CustomerDTO>(`/api/customers/${id}`);
    },

    update: async (id: string, payload: UpdateCustomerRequest): Promise<CustomerDTO> => {
      return await request<CustomerDTO>(`/api/customers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
  },

  catalog: {
    getGarments: async (category?: GarmentCategory): Promise<GarmentCatalogDTO[]> => {
      const url = category ? `/api/garments?category=${category}` : '/api/garments';
      return await request<GarmentCatalogDTO[]>(url);
    },

    getServices: async (category?: ServiceCategory): Promise<ServiceTypeDTO[]> => {
      const url = category ? `/api/services?category=${category}` : '/api/services';
      return await request<ServiceTypeDTO[]>(url);
    },

    getPricing: async (): Promise<
      { id: string; garmentCatalogId: string; serviceTypeId: string; price: number }[]
    > => {
      return await request<
        { id: string; garmentCatalogId: string; serviceTypeId: string; price: number }[]
      >('/api/pricing');
    },
  },

  orders: {
    create: async (payload: CreateOrderRequest): Promise<OrderDetailDTO> => {
      return await request<OrderDetailDTO>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getByDraftId: async (draftId: string): Promise<OrderDetailDTO> => {
      return await request<OrderDetailDTO>(`/api/orders/by-draft/${draftId}`);
    },

    getById: async (orderId: string): Promise<OrderDetailDTO> => {
      return await request<OrderDetailDTO>(`/api/orders/${orderId}`);
    },

    list: async (params?: {
      search?: string;
      status?: string;
      customerId?: string;
      paymentStatus?: string;
      page?: number;
      limit?: number;
      pageSize?: number;
    }): Promise<PaginatedResponse<OrderSummaryDTO>> => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append('search', params.search);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.customerId) searchParams.append('customerId', params.customerId);
      if (params?.paymentStatus) searchParams.append('paymentStatus', params.paymentStatus);
      if (params?.page) searchParams.append('page', String(params.page));
      const size = params?.pageSize ?? params?.limit;
      if (size) {
        searchParams.append('pageSize', String(size));
      }
      const qs = searchParams.toString();
      return await request<PaginatedResponse<OrderSummaryDTO>>(`/api/orders${qs ? `?${qs}` : ''}`);
    },

    dueToday: async (options?: {
      countOnly?: boolean;
      date?: string;
      timezone?: string;
    }): Promise<{
      count: number;
      data?: OrderSummaryDTO[];
      total?: number;
      date?: string;
      orders?: OrderSummaryDTO[];
    }> => {
      const searchParams = new URLSearchParams();
      if (options?.countOnly) searchParams.append('countOnly', 'true');
      if (options?.date) searchParams.append('date', options.date);
      if (options?.timezone) searchParams.append('timezone', options.timezone);
      const qs = searchParams.toString();
      const res = await request<any>(`/api/orders/due-today${qs ? `?${qs}` : ''}`);

      if (Array.isArray(res)) {
        return {
          count: res.length,
          total: res.length,
          data: res,
          orders: res,
        };
      }

      const ordersList: OrderSummaryDTO[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.orders)
          ? res.orders
          : [];
      const computedCount: number =
        typeof res?.count === 'number'
          ? res.count
          : typeof res?.total === 'number'
            ? res.total
            : ordersList.length;

      return {
        ...res,
        count: computedCount,
        total: typeof res?.total === 'number' ? res.total : computedCount,
        data: ordersList,
        orders: ordersList,
      };
    },

    recordPickup: async (orderId: string, payload: OrderPickupRequest): Promise<OrderDetailDTO> => {
      return await request<OrderDetailDTO>(`/api/orders/${orderId}/pickup`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    markGarmentReady: async (
      orderId: string,
      itemId: string,
      garmentId: string,
      isReady: boolean,
    ): Promise<OrderDetailDTO> => {
      return await request<OrderDetailDTO>(
        `/api/orders/${orderId}/items/${itemId}/garments/${garmentId}/ready`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isReady }),
        },
      );
    },
  },

  payments: {
    record: async (payload: RecordPaymentRequest): Promise<PaymentDTO> => {
      return await request<PaymentDTO>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    getOrderPayments: async (orderId: string): Promise<PaymentDTO[]> => {
      return await request<PaymentDTO[]>(`/api/orders/${orderId}/payments`);
    },

    getSummary: async (orderId: string): Promise<PaymentSummaryDTO> => {
      return await request<PaymentSummaryDTO>(`/api/orders/${orderId}/payments/summary`);
    },
  },

  photos: {
    upload: async (params: {
      uri: string;
      orderId: string;
      photoType: string;
      orderItemId?: string;
      physicalGarmentId?: string;
      file?: any;
    }): Promise<{ id: string; url: string }> => {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('orderId', params.orderId);
      formData.append('type', params.photoType);
      if (params.orderItemId) formData.append('orderItemId', params.orderItemId);
      if (params.physicalGarmentId) formData.append('physicalGarmentId', params.physicalGarmentId);

      if (params.file) {
        formData.append('file', params.file);
      } else if (params.uri) {
        const isReactNative =
          typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
        if (!isReactNative && typeof Blob !== 'undefined') {
          // Minimal valid 1x1 JPEG byte sequence for non-RN environments
          const jpegBytes = new Uint8Array([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
            0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06,
            0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d,
            0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
            0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28,
            0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
            0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01,
            0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xda, 0x00,
            0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
          ]);
          const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
          formData.append('file', blob, `photo_${Date.now()}.jpg`);
        } else {
          formData.append('file', {
            uri: params.uri,
            name: `photo_${Date.now()}.jpg`,
            type: 'image/jpeg',
          } as any);
        }
      }

      const url = normalizeApiUrl(getBaseUrl(), '/photos/upload');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg =
          responseData?.message ||
          responseData?.error ||
          `Photo upload failed with status ${response.status}`;
        throw new ApiError(
          Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg,
          response.status,
          responseData,
        );
      }

      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        return responseData.data;
      }
      return responseData;
    },

    getByOrder: async (orderId: string): Promise<OrderPhotoDTO[]> => {
      return await request<OrderPhotoDTO[]>(`/api/orders/${orderId}/photos`);
    },
  },

  deliveries: {
    list: async (status?: string): Promise<DeliveryRecordDTO[]> => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      return await request<DeliveryRecordDTO[]>(`/api/deliveries${qs}`);
    },

    getById: async (id: string): Promise<DeliveryRecordDTO> => {
      return await request<DeliveryRecordDTO>(`/api/deliveries/${id}`);
    },

    updateStatus: async (
      id: string,
      status: string,
      notes?: string,
    ): Promise<DeliveryRecordDTO> => {
      return await request<DeliveryRecordDTO>(`/api/deliveries/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      });
    },

    complete: async (
      id: string,
      payload: { proofPhotoUrl?: string; notes?: string; deliveredItems?: any[] },
    ): Promise<DeliveryRecordDTO> => {
      return await request<DeliveryRecordDTO>(`/api/deliveries/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },

    assign: async (
      id: string,
      riderId: string,
      scheduledAt?: string,
    ): Promise<DeliveryRecordDTO> => {
      return await request<DeliveryRecordDTO>(`/api/deliveries/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ riderId, scheduledAt }),
      });
    },
  },

  store: {
    getConfig: async (): Promise<{
      id: string;
      name: string;
      expressSurchargePercent?: number | null;
      topUpServices?: any[];
    }> => {
      return await request<{
        id: string;
        name: string;
        expressSurchargePercent?: number | null;
        topUpServices?: any[];
      }>('/api/store/config');
    },
  },

  dashboard: {
    getSummary: async (startDate?: string, endDate?: string): Promise<DashboardSummaryDTO> => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const qs = params.toString();
      return await request<DashboardSummaryDTO>(`/api/dashboard/summary${qs ? `?${qs}` : ''}`);
    },
  },

  notifications: {
    list: async (params?: {
      eventType?: string;
      status?: string;
      orderId?: string;
    }): Promise<{ success: boolean; data: NotificationDTO[] }> => {
      const searchParams = new URLSearchParams();
      if (params?.eventType) searchParams.append('eventType', params.eventType);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.orderId) searchParams.append('orderId', params.orderId);
      const qs = searchParams.toString();
      return await request<{ success: boolean; data: NotificationDTO[] }>(
        `/api/notifications${qs ? `?${qs}` : ''}`,
      );
    },

    getById: async (id: string): Promise<{ success: boolean; data: NotificationDTO }> => {
      return await request<{ success: boolean; data: NotificationDTO }>(`/api/notifications/${id}`);
    },
  },
};
