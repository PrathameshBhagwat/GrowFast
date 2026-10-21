/**
 * Photo API client — upload and retrieval endpoints.
 *
 * Follows existing AuthContext conventions:
 * - Uses VITE_API_URL env var (falls back to '/api' for Vite proxy)
 * - JWT token passed via Authorization: Bearer header
 * - Returns typed DTOs from @growfast/shared-types
 *
 * Developer C ownership — apps/web/src/services/photo.api.ts
 */

import type { OrderPhotoDTO, PhotoType, ApiResponse } from '@growfast/shared-types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Upload a photo for an order.
 *
 * @param token  JWT access token
 * @param file   Image file from PhotoCapture or file picker
 * @param orderId  Order to attach the photo to
 * @param type   PhotoType (FRONT, BACK, DAMAGE, STAIN, TAG)
 * @param orderItemId  Optional — attach to specific order item
 * @returns Persisted OrderPhotoDTO with id, url, type, uploadedAt
 * @throws Error with user-friendly message on failure
 */
export async function uploadPhoto(
  token: string,
  file: File,
  orderId: string,
  type: PhotoType,
  orderItemId?: string,
  physicalGarmentId?: string,
): Promise<OrderPhotoDTO> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('orderId', orderId);
  formData.append('type', type);

  if (orderItemId) {
    formData.append('orderItemId', orderItemId);
  }
  if (physicalGarmentId) {
    formData.append('physicalGarmentId', physicalGarmentId);
  }

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }

    try {
      const res = await fetch(`${API_URL}/photos/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type — browser sets multipart boundary automatically
        },
        body: formData,
      });

      if (res.status === 503 && attempt < maxRetries) {
        continue;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Upload failed (${res.status})`);
      }

      const json: ApiResponse<OrderPhotoDTO> = await res.json();
      return json.data;
    } catch (err: any) {
      lastError = err;
      if (
        attempt < maxRetries &&
        (err?.message?.includes('503') ||
          err?.message?.includes('Failed to fetch') ||
          err?.name === 'TypeError')
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Upload failed');
}

/**
 * Retrieve all photos for an order.
 *
 * @param token   JWT access token
 * @param orderId Order ID to fetch photos for
 * @returns Array of OrderPhotoDTO (may be empty)
 * @throws Error with user-friendly message on failure
 */
export async function getOrderPhotos(token: string, orderId: string): Promise<OrderPhotoDTO[]> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }

    try {
      const res = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}/photos`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 503 && attempt < maxRetries) {
        continue;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to load photos (${res.status})`);
      }

      const json: ApiResponse<OrderPhotoDTO[]> = await res.json();
      return json.data;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Failed to load photos');
}
