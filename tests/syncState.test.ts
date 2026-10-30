import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSyncStatusSnapshot, reportSyncProgress } from '@/lib/syncState';
import { getSupabaseConfig } from '@/lib/sync';

vi.mock('@/lib/sync', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/sync')>();
  return {
    ...orig,
    getSupabaseConfig: vi.fn(),
    supabaseSync: {
      isEnabled: vi.fn(),
      push: vi.fn(),
      pull: vi.fn(),
    },
  };
});

describe('Sync State Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      onLine: true,
    });
  });

  it('reports offline when navigator is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    const snap = getSyncStatusSnapshot();
    expect(snap.state).toBe('offline');
  });

  it('reports local_only when no Supabase config exists', () => {
    vi.mocked(getSupabaseConfig).mockReturnValue(null);
    vi.stubGlobal('navigator', { onLine: true });
    const snap = getSyncStatusSnapshot();
    expect(snap.state).toBe('local_only');
  });

  it('updates state and error via reportSyncProgress', () => {
    vi.mocked(getSupabaseConfig).mockReturnValue({
      url: 'https://test.supabase.co',
      anonKey: 'key',
      workspaceId: 'ws',
      userId: 'ws',
    });

    reportSyncProgress('syncing');
    expect(getSyncStatusSnapshot().state).toBe('syncing');

    reportSyncProgress('error', 'Network failure');
    const errSnap = getSyncStatusSnapshot();
    expect(errSnap.state).toBe('error');
    expect(errSnap.errorMessage).toBe('Network failure');

    reportSyncProgress('synced', null);
    expect(getSyncStatusSnapshot().state).toBe('synced');
  });
});
