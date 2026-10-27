import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlanAndCycle, deleteAllData } from '@/db/queries';
import {
  decodeBase64Username,
  encodeUsernameToBase64,
  featureDataRepo,
  getStoredUsername,
  getSupabaseConfig,
  saveSupabaseConfig,
  saveUsername,
  supabaseSync,
} from '@/lib/sync';

describe('Supabase Sync & Scalable Feature Store', () => {
  beforeEach(async () => {
    await deleteAllData();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  it('stays disabled when no Supabase config is set', () => {
    expect(getSupabaseConfig()).toBeNull();
    expect(supabaseSync.isEnabled()).toBe(false);
  });

  it('pushes local Dexie tables and upserts featureDataRepo items when configured', async () => {
    const requests: { url: string; method: string; body: unknown }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response('', { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);

    // Simulate browser localStorage
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
    });

    saveSupabaseConfig({
      url: 'https://demo.supabase.co',
      anonKey: 'test-anon-key',
      workspaceId: 'rahul-personal',
    });

    expect(supabaseSync.isEnabled()).toBe(true);

    await createPlanAndCycle({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, '2026-10-01');
    await supabaseSync.push();

    const urls = requests.map((r) => r.url);
    expect(urls.some((u) => u.includes('/rest/v1/stash_plans'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_cycles'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_categories'))).toBe(true);

    // Test extensible feature store
    await featureDataRepo.upsert('savings_goals', 'goal-1', {
      name: 'Emergency Fund',
      target: 100000,
    });
    expect(requests.some((r) => r.url.includes('/rest/v1/stash_feature_data'))).toBe(true);

    vi.unstubAllGlobals();
  });

  it('encodes username to Base64 for workspace_id and decodes it back', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      },
    });

    expect(encodeUsernameToBase64('Rahul')).toBe('cmFodWw=');
    expect(decodeBase64Username('cmFodWw=')).toBe('rahul');

    saveSupabaseConfig({
      url: 'https://demo.supabase.co',
      anonKey: 'test-anon-key',
      workspaceId: 'default',
    });
    const b64 = saveUsername('Rahul');
    expect(b64).toBe('cmFodWw=');
    expect(getStoredUsername()).toBe('rahul');
    expect(getSupabaseConfig()?.workspaceId).toBe('cmFodWw=');

    vi.unstubAllGlobals();
  });
});
