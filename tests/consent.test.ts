import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({ getSupabase: () => ({ rpc }) }));

import {
  CONSENT_VERSION,
  acceptSyncConsent,
  clearSyncConsent,
  flushConsentRecord,
  hasSyncConsent,
  noticeHash,
} from '@/lib/consent';

/** Hash of the current (version-2) notice, also listed in docs/PRIVACY_NOTICES.md. If this fails you changed the notice text:
 *  bump CONSENT_VERSION, archive the new text in the docs, and add the new hash here. */
const V1_HASH = '6f3edf89a31e4c618615c6ce00ea5779693794edbca0e565409f73c5d07c695b'; // name kept; this is the current version's hash

const store = new Map<string, string>();

describe('privacy consent record', () => {
  beforeEach(() => {
    store.clear();
    rpc.mockReset();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });

  it('the notice text matches the archived version', async () => {
    expect(CONSENT_VERSION).toBe(2);
    expect(await noticeHash()).toBe(V1_HASH);
  });

  it('accepting sets the local flag, and the server record is sent once', async () => {
    rpc.mockResolvedValue({ error: null });
    expect(hasSyncConsent()).toBe(false);
    acceptSyncConsent('signup');
    expect(hasSyncConsent()).toBe(true);
    expect(await flushConsentRecord()).toBe(true);
    expect(rpc).toHaveBeenCalledWith('record_consent', { p_version: 2, p_hash: V1_HASH, p_method: 'signup' });
    expect(await flushConsentRecord()).toBe(false); // already recorded: nothing more to send
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('stays pending when the server cannot be reached, and is retried later', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'offline' } });
    acceptSyncConsent('google');
    expect(await flushConsentRecord()).toBe(false);
    rpc.mockResolvedValueOnce({ error: null });
    expect(await flushConsentRecord()).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith('record_consent', { p_version: 2, p_hash: V1_HASH, p_method: 'google' });
  });

  it('does nothing without a local acceptance, and an old notice version asks again', async () => {
    expect(await flushConsentRecord()).toBe(false);
    store.set('stash:consent', JSON.stringify({ v: 0, at: 1 }));
    expect(hasSyncConsent()).toBe(false);
    clearSyncConsent();
    expect(rpc).not.toHaveBeenCalled();
  });
});
