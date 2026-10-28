import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSpend, createPlanAndCycle, deleteAllData } from '@/db/queries';
import { getDB } from '@/db/schema';
import {
  decodeBase64Username,
  encodeUsernameToBase64,
  featureDataRepo,
  getActiveUserId,
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

  it('pushes local Dexie tables with user_id and upserts stash_users + featureDataRepo items when configured', async () => {
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
      workspaceId: 'cmFodWw=',
    });
    saveUsername('Rahul', 'Emerald');

    expect(supabaseSync.isEnabled()).toBe(true);
    expect(getActiveUserId()).toBe('cmFodWw=');

    await createPlanAndCycle({ income: 80000, bills: 25000, savings: 15000, monthLength: 30 }, '2026-10-01');
    const cycle = await getDB().cycle.orderBy('id').last();
    expect(cycle?.userId).toBe('cmFodWw=');

    const entry = await addSpend(cycle!, { amount: 250, label: 'Lunch', category: 'Food', subcategory: 'Lunch' });
    expect(entry.userId).toBe('cmFodWw=');

    await supabaseSync.push();

    const urls = requests.map((r) => r.url);
    expect(urls.some((u) => u.includes('/rest/v1/stash_users'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_plans'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_cycles'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_entries'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/stash_categories'))).toBe(true);

    // Every transaction row pushed to stash_entries must carry user_id: 'cmFodWw='
    const entryReq = requests.find((r) => r.url.includes('/rest/v1/stash_entries'));
    expect(Array.isArray(entryReq?.body)).toBe(true);
    const firstRow = (entryReq?.body as Array<Record<string, unknown>>)[0];
    expect(firstRow.user_id).toBe('cmFodWw=');

    // stash_users table receives the normalized user record
    const userReq = requests.find((r) => r.url.includes('/rest/v1/stash_users'));
    const userRow = (userReq?.body as Array<Record<string, unknown>>)[0];
    expect(userRow.user_id).toBe('cmFodWw=');
    expect(userRow.username).toBe('rahul');

    // Test extensible feature store
    await featureDataRepo.upsert('savings_goals', 'goal-1', {
      name: 'Emergency Fund',
      target: 100000,
    });
    expect(requests.some((r) => r.url.includes('/rest/v1/stash_feature_data'))).toBe(true);

    vi.unstubAllGlobals();
  });

  it('encodes username to Base64 for user_id and decodes it back', () => {
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
    expect(getActiveUserId()).toBe('cmFodWw=');
    expect(getSupabaseConfig()?.userId).toBe('cmFodWw=');

    vi.unstubAllGlobals();
  });
});
