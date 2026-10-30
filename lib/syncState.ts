'use client';
import { useEffect, useState } from 'react';
import { getLastSyncedAt, getSupabaseConfig, supabaseSync } from './sync';

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error' | 'local_only';

export interface SyncStatusInfo {
  state: SyncState;
  lastSyncedAt: number | null;
  errorMessage: string | null;
}

let currentSyncState: SyncState = 'synced';
let currentError: string | null = null;
const listeners = new Set<(info: SyncStatusInfo) => void>();

function notifyListeners() {
  const info = getSyncStatusSnapshot();
  listeners.forEach((fn) => fn(info));
}

export function getSyncStatusSnapshot(): SyncStatusInfo {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return {
      state: 'offline',
      lastSyncedAt: getLastSyncedAt(),
      errorMessage: currentError,
    };
  }

  const config = getSupabaseConfig();
  if (!config) {
    return {
      state: 'local_only',
      lastSyncedAt: null,
      errorMessage: null,
    };
  }

  return {
    state: currentSyncState,
    lastSyncedAt: getLastSyncedAt(),
    errorMessage: currentError,
  };
}

export function reportSyncProgress(state: SyncState, error: string | null = null): void {
  currentSyncState = state;
  currentError = error;
  notifyListeners();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    reportSyncProgress('synced', null);
  });
  window.addEventListener('offline', () => {
    reportSyncProgress('offline', null);
  });
}

/**
 * Hook to reactively subscribe to the sync engine's real-time status.
 */
export function useSyncStatus(): {
  status: SyncStatusInfo;
  triggerSync: () => Promise<void>;
} {
  const [status, setStatus] = useState<SyncStatusInfo>(getSyncStatusSnapshot);

  useEffect(() => {
    setStatus(getSyncStatusSnapshot());
    const handler = (info: SyncStatusInfo) => setStatus(info);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const triggerSync = async () => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      reportSyncProgress('offline', null);
      return;
    }
    if (!supabaseSync.isEnabled()) {
      reportSyncProgress('local_only', null);
      return;
    }
    reportSyncProgress('syncing', null);
    try {
      await supabaseSync.push();
      reportSyncProgress('synced', null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      reportSyncProgress('error', msg);
    }
  };

  return {
    status,
    triggerSync,
  };
}
