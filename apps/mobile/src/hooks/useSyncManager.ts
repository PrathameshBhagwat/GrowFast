import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SyncEngine } from '../services/sync-engine';
import { useNetworkStatus } from './useNetworkStatus';
import { getUserSession } from '../storage/secure-store';

let globalSyncEngine: SyncEngine | null = null;

export function getSyncEngine(queryClient?: any, onAuthExpired?: () => void): SyncEngine {
  if (!globalSyncEngine) {
    globalSyncEngine = new SyncEngine({ queryClient, onAuthExpired });
  }
  return globalSyncEngine;
}

export function useSyncManager(options?: { onAuthExpired?: () => void }) {
  const queryClient = useQueryClient();
  const { isConnected } = useNetworkStatus();
  const prevConnectedRef = useRef(isConnected);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncResults, setSyncResults] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  const engine = getSyncEngine(queryClient, options?.onAuthExpired);

  const syncAll = useCallback(async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    try {
      const session = await getUserSession();
      const results = await engine.syncAllPending(session?.storeId);
      setSyncResults(results);
    } catch (err) {
      console.warn('Sync all error:', err);
    } finally {
      setIsSyncingAll(false);
    }
  }, [engine, isSyncingAll]);

  const syncDraft = useCallback(
    async (clientDraftId: string) => {
      return await engine.syncDraft(clientDraftId);
    },
    [engine],
  );

  // Auto-sync when reconnecting to network
  useEffect(() => {
    const wasOffline = prevConnectedRef.current === false;
    const nowOnline = isConnected === true;
    prevConnectedRef.current = isConnected;

    if (wasOffline && nowOnline) {
      console.log('Network reconnected: auto-syncing pending drafts...');
      syncAll();
    }
  }, [isConnected, syncAll]);

  return {
    syncDraft,
    syncAll,
    isSyncingAll,
    syncResults,
    isDraftLocked: (clientDraftId: string) => engine.isLocked(clientDraftId),
  };
}
