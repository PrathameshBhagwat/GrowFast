import { QueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../api/client';
import {
  getDraft,
  saveDraft,
  listDrafts,
  updateDraftSyncStatus,
  OrderDraft,
} from '../db/drafts';
import {
  getPhotosForDraft,
  linkPhotosToOrder,
  updatePhotoSyncStatus,
  checkFileExists,
  PendingPhoto,
} from '../db/photos';
import { getAuthToken } from '../storage/secure-store';

export interface SyncEngineOptions {
  queryClient?: QueryClient;
  onAuthExpired?: () => void;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class SyncEngine {
  private activeLocks = new Set<string>();
  private activePhotoLocks = new Set<string>();
  private queryClient?: QueryClient;
  private onAuthExpired?: () => void;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(options?: SyncEngineOptions) {
    this.queryClient = options?.queryClient;
    this.onAuthExpired = options?.onAuthExpired;
    this.baseDelayMs = options?.baseDelayMs ?? 1000;
    this.maxDelayMs = options?.maxDelayMs ?? 60000;
  }

  /**
   * Calculate bounded exponential backoff with jitter
   */
  public calculateBackoff(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, Math.max(0, attempt));
    const capped = Math.min(this.maxDelayMs, exponential);
    const jitter = Math.floor(Math.random() * 500);
    return capped + jitter;
  }

  /**
   * Check if a draft is currently locked in an active sync process
   */
  public isLocked(clientDraftId: string): boolean {
    return this.activeLocks.has(clientDraftId);
  }

  /**
   * Synchronize a specific draft by clientDraftId
   */
  public async syncDraft(clientDraftId: string): Promise<{
    success: boolean;
    orderId?: string;
    orderNumber?: string;
    error?: string;
    isConflict?: boolean;
    recovered?: boolean;
  }> {
    // 1. Concurrency control: atomically acquire lock
    if (this.activeLocks.has(clientDraftId)) {
      return { success: false, error: 'Draft is already being synchronized' };
    }
    this.activeLocks.add(clientDraftId);

    try {
      const draft = await getDraft(clientDraftId);
      if (!draft) {
        return { success: false, error: 'Draft not found' };
      }

      if (draft.syncStatus === 'SYNCED') {
        return {
          success: true,
          orderId: draft.serverOrderId || undefined,
          orderNumber: draft.serverOrderNumber || undefined,
        };
      }
      // 2. Mark SYNCING state in SQLite
      await updateDraftSyncStatus(clientDraftId, 'SYNCING');

      // 3. Verify authentication token
      const token = await getAuthToken();
      if (!token) {
        await updateDraftSyncStatus(clientDraftId, 'FAILED_RETRYABLE', {
          error: 'Authentication required. Please log in.',
          incrementRetry: true,
        });
        this.onAuthExpired?.();
        return { success: false, error: 'Authentication required' };
      }

      // 4. Pre-check idempotency recovery: check if backend already committed this draft
      let serverOrder: any = null;
      try {
        const existing = await apiClient.orders.getByDraftId(clientDraftId);
        if (existing && existing.id) {
          serverOrder = existing;
        }
      } catch (checkErr: any) {
        // If 404 or not found, proceed to normal creation
        if (checkErr instanceof ApiError && checkErr.statusCode === 404) {
          // Expected: order does not exist on server yet
        } else if (checkErr instanceof ApiError && checkErr.statusCode === 401) {
          await updateDraftSyncStatus(clientDraftId, 'FAILED_RETRYABLE', {
            error: 'Session expired. Please log in again.',
            incrementRetry: true,
          });
          this.onAuthExpired?.();
          return { success: false, error: 'Session expired' };
        }
      }

      // 4.5 Resolve customer if created offline with temporary ID
      const needsCustomerResolution =
        !draft.payload.customerId ||
        draft.payload.customerId === 'cust-offline-temp' ||
        draft.payload.customerId.startsWith('temp-');

      if (needsCustomerResolution && draft.customerPhone) {
        try {
          const cleanPhone = draft.customerPhone.trim();
          const searchRes = await apiClient.customers.search(cleanPhone, 1, 5);
          const matched = searchRes.data?.find(
            (c) => c.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''),
          );
          if (matched && matched.id) {
            draft.payload.customerId = matched.id;
            draft.customerId = matched.id;
            await updateDraftSyncStatus(clientDraftId, 'SYNCING', {
              customerId: matched.id,
              payload: draft.payload,
            });
          } else if (draft.customerName) {
            const created = await apiClient.customers.create({
              name: draft.customerName.trim(),
              phone: cleanPhone,
            });
            if (created && created.id) {
              draft.payload.customerId = created.id;
              draft.customerId = created.id;
              await updateDraftSyncStatus(clientDraftId, 'SYNCING', {
                customerId: created.id,
                payload: draft.payload,
              });
            }
          }
        } catch (custErr: any) {
          console.warn('Customer auto-resolution notice during sync:', custErr.message);
        }
      }

      // 5. If not already recovered, submit order payload
      let isRecovered = false;
      if (!serverOrder) {
        try {
          serverOrder = await apiClient.orders.create({
            ...draft.payload,
            clientDraftId,
          });
        } catch (createErr: any) {
          if (createErr instanceof ApiError) {
            // 409 Conflict: payload hash mismatch or duplicate draft conflict
            if (createErr.statusCode === 409) {
              await updateDraftSyncStatus(clientDraftId, 'CONFLICT', {
                conflict: createErr.message || 'Server reported conflict on draft submission.',
              });
              return { success: false, error: createErr.message, isConflict: true };
            }

            // 401 Unauthorized
            if (createErr.statusCode === 401) {
              await updateDraftSyncStatus(clientDraftId, 'FAILED_RETRYABLE', {
                error: 'Authentication expired.',
                incrementRetry: true,
              });
              this.onAuthExpired?.();
              return { success: false, error: 'Authentication expired' };
            }
          }

          // In case of timeout or network glitch during POST, attempt recovery lookup!
          try {
            const recovered = await apiClient.orders.getByDraftId(clientDraftId);
            if (recovered && recovered.id) {
              serverOrder = recovered;
              isRecovered = true;
            }
          } catch {
            // Recovery failed; genuine network failure
          }

          if (!serverOrder) {
            const errorMsg = createErr.message || 'Network request failed';
            await updateDraftSyncStatus(clientDraftId, 'FAILED_RETRYABLE', {
              error: errorMsg,
              incrementRetry: true,
            });
            return { success: false, error: errorMsg };
          }
        }
      } else {
        isRecovered = true;
      }

      // 6. Order successfully committed or recovered
      await updateDraftSyncStatus(clientDraftId, 'SYNCED', {
        serverOrderId: serverOrder.id,
        serverOrderNumber: serverOrder.orderNumber,
        customerId: draft.customerId || undefined,
        payload: draft.payload,
      });

      // Link any pending photos to this server order ID
      await linkPhotosToOrder(clientDraftId, serverOrder.id);

      // Invalidate queries in TanStack Query
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['orders'] });
        this.queryClient.invalidateQueries({ queryKey: ['drafts'] });
      }

      // 7. Trigger photo queue for this order in the background
      this.syncPhotosForDraft(clientDraftId, serverOrder.id).catch((photoErr) => {
        console.warn('Background photo upload warning:', photoErr.message);
      });

      return {
        success: true,
        orderId: serverOrder.id,
        orderNumber: serverOrder.orderNumber,
        recovered: isRecovered,
      };
    } finally {
      this.activeLocks.delete(clientDraftId);
    }
  }

  /**
   * Synchronize all queued and eligible failed drafts
   */
  public async syncAllPending(storeId?: string): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const drafts = await listDrafts({ storeId });
    const eligible = drafts.filter(
      (d) => d.syncStatus === 'QUEUED' || d.syncStatus === 'FAILED_RETRYABLE',
    );

    let succeeded = 0;
    let failed = 0;

    for (const draft of eligible) {
      const result = await this.syncDraft(draft.clientDraftId);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: eligible.length,
      succeeded,
      failed,
    };
  }

  /**
   * Upload pending photos for a synced draft
   */
  public async syncPhotosForDraft(
    clientDraftId: string,
    serverOrderId: string,
  ): Promise<{ uploaded: number; failed: number }> {
    const photos = await getPhotosForDraft(clientDraftId);
    const pendingPhotos = photos.filter(
      (p) => p.syncStatus === 'PENDING' || p.syncStatus === 'FAILED',
    );

    let uploaded = 0;
    let failed = 0;

    for (const photo of pendingPhotos) {
      if (this.activePhotoLocks.has(photo.id)) continue;
      this.activePhotoLocks.add(photo.id);

      try {
        // Verify local file exists before attempting upload
        const exists = await checkFileExists(photo.localFileUri);
        if (!exists) {
          await updatePhotoSyncStatus(photo.id, 'FILE_MISSING', {
            error: 'Local photo file is missing on device storage.',
          });
          failed++;
          continue;
        }

        await updatePhotoSyncStatus(photo.id, 'UPLOADING');

        const uploadResult = await apiClient.photos.upload({
          uri: photo.localFileUri,
          orderId: serverOrderId,
          photoType: photo.photoType,
          physicalGarmentId: photo.garmentId || undefined,
        });

        await updatePhotoSyncStatus(photo.id, 'UPLOADED', {
          serverPhotoId: uploadResult?.id,
        });
        uploaded++;
      } catch (err: any) {
        await updatePhotoSyncStatus(photo.id, 'FAILED', {
          error: err.message || 'Photo upload failed',
          incrementRetry: true,
        });
        failed++;
      } finally {
        this.activePhotoLocks.delete(photo.id);
      }
    }

    return { uploaded, failed };
  }
}

export const syncEngine = new SyncEngine();
