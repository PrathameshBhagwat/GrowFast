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
} from '@growfast/shared-types';
import { getAuthToken } from '../storage/secure-store';

export interface ApiClientConfig {
  baseUrl: string;
}

// Configurable base URL with dynamic environment resolution
// On physical devices, dynamically detects the development server IP from Expo Constants,
// falling back to EXPO_PUBLIC_API_URL or the LAN host (http://192.168.1.38:3000).
// Never defaults to Android-emulator-only 10.0.2.2 on physical hardware.
function resolveDefaultBaseUrl(): string {
  // 1. Explicit environment variable if valid and not a local emulator loopback
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (
    envUrl &&
    !envUrl.includes('10.0.2.2') &&
    !envUrl.includes('localhost') &&
    !envUrl.includes('127.0.0.1')
  ) {
    return envUrl;
  }

  // 2. Dynamic discovery from Expo Metro host URI if available at runtime
  try {
    const Constants = require('expo-constants').default;
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest2?.extra?.expoClient?.hostUri ||
      Constants?.manifest?.debuggerHost;

    if (hostUri && typeof hostUri === 'string') {
      const hostIp = hostUri.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return `http://${hostIp}:3000`;
      }
    }
  } catch {
    // Non-Expo or test runner context (e.g. tsx unit tests)
  }

  // 3. If explicit env URL was provided, use it even if loopback in test environments
  if (envUrl) {
    return envUrl;
  }

  // 4. Fallback for physical device on local development Wi-Fi
  return 'http://192.168.1.38:3000';
}

let config: ApiClientConfig = {
  baseUrl: resolveDefaultBaseUrl(),
};

export function setApiConfig(newConfig: Partial<ApiClientConfig>) {
  config = { ...config, ...newConfig };
}

export function getBaseUrl(): string {
  if (
    config.baseUrl &&
    !config.baseUrl.includes('10.0.2.2') &&
    !config.baseUrl.includes('localhost')
  ) {
    return config.baseUrl;
  }
  const resolved = resolveDefaultBaseUrl();
  config.baseUrl = resolved;
  return resolved;
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = getBaseUrl();
  const url = normalizeApiUrl(baseUrl, endpoint);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    const isNetworkFailed = netErr?.message === 'Network request failed';
    const detail = isNetworkFailed
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
  }

  let responseData: any = null;
  try {
    responseData = await response.json();
  } catch (jsonErr: any) {
    if (!response.ok) {
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
    const errorMessage =
      responseData?.message ||
      responseData?.error ||
      `Request failed with HTTP ${response.status}`;
    const formattedError = Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage;

    console.warn(
      `[apiClient] HTTP ${response.status} on [${options.method || 'GET'} ${cleanEndpoint}]: ${formattedError}`,
    );

    throw new ApiError(
      formattedError,
      response.status,
      responseData,
    );
  }

  // Handle standard { success: true, data: T } wrapper or raw object
  if (responseData && typeof responseData === 'object' && 'data' in responseData) {
    if ('total' in responseData && 'page' in responseData) {
      return responseData as T;
    }
    return responseData.data as T;
  }

  return responseData as T;
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
      return await request<{ id: string; name: string; role: string }[]>(`/api/auth/directory${qs}`);
    },
  },

  getBaseUrl: () => getBaseUrl(),

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
      return await request<PaginatedResponse<CustomerDTO>>(`/api/customers/search?${params.toString()}`);
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

    getPricing: async (): Promise<{ id: string; garmentCatalogId: string; serviceTypeId: string; price: number }[]> => {
      return await request<{ id: string; garmentCatalogId: string; serviceTypeId: string; price: number }[]>('/api/pricing');
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
      page?: number;
      limit?: number;
    }): Promise<PaginatedResponse<OrderSummaryDTO>> => {
      const searchParams = new URLSearchParams();
      if (params?.search) searchParams.append('search', params.search);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.page) searchParams.append('page', String(params.page));
      if (params?.limit) searchParams.append('limit', String(params.limit));
      const qs = searchParams.toString();
      return await request<PaginatedResponse<OrderSummaryDTO>>(`/api/orders${qs ? `?${qs}` : ''}`);
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
      if (params.physicalGarmentId)
        formData.append('physicalGarmentId', params.physicalGarmentId);

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
};
