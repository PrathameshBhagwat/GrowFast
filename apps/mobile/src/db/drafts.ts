import { CreateOrderRequest } from '@growfast/shared-types';
import { getDatabase } from './sqlite';

export type DraftSyncStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'SYNCING'
  | 'SYNCED'
  | 'FAILED_RETRYABLE'
  | 'CONFLICT';

export interface OrderDraft {
  id: string;
  clientDraftId: string;
  storeId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  payload: CreateOrderRequest;
  syncStatus: DraftSyncStatus;
  serverOrderId?: string | null;
  serverOrderNumber?: string | null;
  retryCount: number;
  lastSyncAttemptAt?: string | null;
  lastError?: string | null;
  conflictDetails?: string | null;
  workflowType?: string | null;
  pickupType?: string | null;
  isExpress: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveDraftInput {
  id?: string;
  clientDraftId?: string;
  storeId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  payload: CreateOrderRequest;
  workflowType?: string | null;
  pickupType?: string | null;
  isExpress?: boolean;
  notes?: string | null;
}

interface RawDraftRow {
  id: string;
  client_draft_id: string;
  store_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  payload_json: string;
  sync_status: string;
  server_order_id: string | null;
  server_order_number: string | null;
  retry_count: number;
  last_sync_attempt_at: string | null;
  last_error: string | null;
  conflict_details: string | null;
  workflow_type: string | null;
  pickup_type: string | null;
  is_express: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToDraft(row: RawDraftRow): OrderDraft {
  let parsedPayload: CreateOrderRequest;
  try {
    parsedPayload = JSON.parse(row.payload_json);
  } catch {
    parsedPayload = {
      customerId: row.customer_id || '',
      isExpress: Boolean(row.is_express),
      pickupType: 'STORE_PICKUP' as any,
      items: [],
    };
  }

  return {
    id: row.id,
    clientDraftId: row.client_draft_id,
    storeId: row.store_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    payload: parsedPayload,
    syncStatus: row.sync_status as DraftSyncStatus,
    serverOrderId: row.server_order_id ?? null,
    serverOrderNumber: row.server_order_number ?? null,
    retryCount: row.retry_count || 0,
    lastSyncAttemptAt: row.last_sync_attempt_at,
    lastError: row.last_error,
    conflictDetails: row.conflict_details,
    workflowType: row.workflow_type,
    pickupType: row.pickup_type,
    isExpress: Boolean(row.is_express),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Generate a random UUID v4 string
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Save or update an order draft.
 * Ensures stable clientDraftId across retries and preserves payload integrity.
 */
export async function saveDraft(input: SaveDraftInput): Promise<OrderDraft> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const clientDraftId = input.clientDraftId || generateUUID();
  const id = input.id || generateUUID();

  // 1. Check existing draft
  const existing = await getDraft(clientDraftId);
  if (existing) {
    if (existing.syncStatus === 'SYNCED') {
      throw new Error(
        'Cannot modify an order draft that has already been confirmed and synced to the server.',
      );
    }
    if (existing.syncStatus === 'SYNCING') {
      throw new Error('Draft is currently synchronizing with the server. Please wait.');
    }
  }

  // Ensure payload embeds clientDraftId
  const finalPayload: CreateOrderRequest = {
    ...input.payload,
    clientDraftId,
  };

  const payloadJson = JSON.stringify(finalPayload);
  const isExpressNum = input.isExpress ? 1 : 0;

  if (existing) {
    // Update existing draft
    await db.runAsync(
      `UPDATE order_drafts
       SET customer_id = ?, customer_name = ?, customer_phone = ?, payload_json = ?,
           workflow_type = ?, pickup_type = ?, is_express = ?, notes = ?, updated_at = ?
       WHERE client_draft_id = ?`,
      [
        input.customerId || null,
        input.customerName || null,
        input.customerPhone || null,
        payloadJson,
        input.workflowType || null,
        input.pickupType || 'STORE_PICKUP',
        isExpressNum,
        input.notes || null,
        now,
        clientDraftId,
      ],
    );
  } else {
    // Insert new draft in DRAFT state
    await db.runAsync(
      `INSERT INTO order_drafts (
        id, client_draft_id, store_id, customer_id, customer_name, customer_phone,
        payload_json, sync_status, retry_count, workflow_type, pickup_type, is_express,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        clientDraftId,
        input.storeId,
        input.customerId || null,
        input.customerName || null,
        input.customerPhone || null,
        payloadJson,
        input.workflowType || null,
        input.pickupType || 'STORE_PICKUP',
        isExpressNum,
        input.notes || null,
        now,
        now,
      ],
    );
  }

  const saved = await getDraft(clientDraftId);
  if (!saved) {
    throw new Error(`Failed to retrieve saved draft with clientDraftId ${clientDraftId}`);
  }
  return saved;
}

/**
 * Fetch a single draft by clientDraftId
 */
export async function getDraft(clientDraftId: string): Promise<OrderDraft | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<RawDraftRow>(
    'SELECT * FROM order_drafts WHERE client_draft_id = ?',
    [clientDraftId],
  );
  if (!row) return null;
  return mapRowToDraft(row);
}

/**
 * List drafts with optional store and status filtering
 */
export async function listDrafts(options?: {
  storeId?: string;
  status?: DraftSyncStatus;
}): Promise<OrderDraft[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM order_drafts';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.storeId) {
    conditions.push('store_id = ?');
    params.push(options.storeId);
  }
  if (options?.status) {
    conditions.push('sync_status = ?');
    params.push(options.status);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  query += ' ORDER BY updated_at DESC';

  const rows = await db.getAllAsync<RawDraftRow>(query, params);
  return rows.map(mapRowToDraft);
}

/**
 * Queue a draft for synchronization.
 * Only drafts in DRAFT, FAILED_RETRYABLE, or CONFLICT state can be queued.
 */
export async function queueDraftForSync(clientDraftId: string): Promise<OrderDraft> {
  const draft = await getDraft(clientDraftId);
  if (!draft) {
    throw new Error(`Draft ${clientDraftId} not found`);
  }
  if (draft.syncStatus === 'SYNCED') {
    throw new Error('Draft is already synced to the server.');
  }
  if (draft.syncStatus === 'SYNCING') {
    throw new Error('Draft is already in progress of synchronization.');
  }

  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE order_drafts
     SET sync_status = 'QUEUED', conflict_details = NULL, updated_at = ?
     WHERE client_draft_id = ?`,
    [now, clientDraftId],
  );

  const updated = await getDraft(clientDraftId);
  return updated!;
}

/**
 * Update sync status and metadata (e.g. server confirmation or failure reason)
 */
export async function updateDraftSyncStatus(
  clientDraftId: string,
  status: DraftSyncStatus,
  meta?: {
    serverOrderId?: string;
    serverOrderNumber?: string;
    customerId?: string;
    payload?: CreateOrderRequest;
    error?: string;
    conflict?: string;
    incrementRetry?: boolean;
  },
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  let setClauses = 'sync_status = ?, updated_at = ?';
  const params: any[] = [status, now];

  if (meta?.customerId) {
    setClauses += ', customer_id = ?';
    params.push(meta.customerId);
  }
  if (meta?.payload) {
    setClauses += ', payload_json = ?';
    params.push(JSON.stringify(meta.payload));
  }
  if (meta?.serverOrderId) {
    setClauses += ', server_order_id = ?';
    params.push(meta.serverOrderId);
  }
  if (meta?.serverOrderNumber) {
    setClauses += ', server_order_number = ?';
    params.push(meta.serverOrderNumber);
  }
  if (meta?.error !== undefined) {
    setClauses += ', last_error = ?';
    params.push(meta.error);
  }
  if (meta?.conflict !== undefined) {
    setClauses += ', conflict_details = ?';
    params.push(meta.conflict);
  }
  if (meta?.incrementRetry) {
    setClauses += ', retry_count = retry_count + 1';
  }
  setClauses += ', last_sync_attempt_at = ?';
  params.push(now);

  params.push(clientDraftId);

  await db.runAsync(`UPDATE order_drafts SET ${setClauses} WHERE client_draft_id = ?`, params);
}

/**
 * Safely delete an unconfirmed local draft.
 * Prevents accidental deletion of official server-confirmed orders.
 */
export async function deleteDraft(clientDraftId: string): Promise<boolean> {
  const draft = await getDraft(clientDraftId);
  if (!draft) return false;

  if (draft.syncStatus === 'SYNCED' && draft.serverOrderId) {
    throw new Error(
      'Cannot delete a server-confirmed order from draft management. Official orders must be cancelled via server order operations.',
    );
  }
  if (draft.syncStatus === 'SYNCING') {
    throw new Error('Cannot delete a draft while it is actively synchronizing.');
  }

  const db = await getDatabase();
  await db.runAsync('DELETE FROM order_drafts WHERE client_draft_id = ?', [clientDraftId]);
  return true;
}

/**
 * Clear local synced draft history record (for cleanup of synced drafts).
 * Explicitly distinguishes local record clearing from order deletion.
 */
export async function clearLocalSyncedRecord(clientDraftId: string): Promise<boolean> {
  const draft = await getDraft(clientDraftId);
  if (!draft || draft.syncStatus !== 'SYNCED') {
    return false;
  }
  const db = await getDatabase();
  await db.runAsync('DELETE FROM order_drafts WHERE client_draft_id = ?', [clientDraftId]);
  return true;
}
