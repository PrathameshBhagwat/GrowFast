import type {
  DeliveryRecordDTO,
  CreateDeliveryRequest,
  AssignDriverRequest,
  UpdateDeliveryStatusRequest,
  CompleteDeliveryRequest,
} from '@growfast/shared-types';

const API_BASE = '/api/deliveries';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('growfast_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed with status ${res.status}`);
  }
  const json = await res.json();
  return json.data ?? json;
}

export async function fetchDeliveries(status?: string): Promise<DeliveryRecordDTO[]> {
  const url = status ? `${API_BASE}?status=${encodeURIComponent(status)}` : API_BASE;
  const res = await fetch(url, { headers: getAuthHeaders() });
  return handleResponse<DeliveryRecordDTO[]>(res);
}

export async function fetchDeliveryById(id: string): Promise<DeliveryRecordDTO> {
  const res = await fetch(`${API_BASE}/${id}`, { headers: getAuthHeaders() });
  return handleResponse<DeliveryRecordDTO>(res);
}

export async function createDelivery(data: CreateDeliveryRequest): Promise<DeliveryRecordDTO> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<DeliveryRecordDTO>(res);
}

export async function assignDriver(
  deliveryId: string,
  data: AssignDriverRequest,
): Promise<DeliveryRecordDTO> {
  const res = await fetch(`${API_BASE}/${deliveryId}/assign`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<DeliveryRecordDTO>(res);
}

export async function updateDeliveryStatus(
  deliveryId: string,
  data: UpdateDeliveryStatusRequest,
): Promise<DeliveryRecordDTO> {
  const res = await fetch(`${API_BASE}/${deliveryId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<DeliveryRecordDTO>(res);
}

export async function completeDelivery(
  deliveryId: string,
  data: CompleteDeliveryRequest,
): Promise<DeliveryRecordDTO> {
  const res = await fetch(`${API_BASE}/${deliveryId}/complete`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<DeliveryRecordDTO>(res);
}
