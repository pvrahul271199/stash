import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { status: 'signedIn' as const, uid: 'uid-1', username: 'rahul' };
const refreshSession = vi.fn(async () => ({}));
let token = 'tok-1';
vi.mock('@/lib/auth', () => ({
  getAuth: () => auth,
  getAccessToken: async () => token,
  useAuth: () => auth,
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabaseEnv: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  getSupabase: () => ({ auth: { refreshSession } }),
}));

type Row = Record<string, unknown> & { id: string; client_updated_at: number };
const server = new Map<string, Map<string, Row & { updated_at: string }>>();
let clock = 1_000;
const calls: { method: string; table: string; rows?: Row[] }[] = [];
let inFlight = 0;
let maxInFlight = 0;
let failTable: string | null = null;
let unauthorizedOnce = false;

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return (async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    try {
      const u = new URL(String(input));
      const table = u.pathname.split('/').pop()!;
      const method = init?.method ?? 'GET';
      if (unauthorizedOnce) {
        unauthorizedOnce = false;
        return new Response('', { status: 401 });
      }
      if (table === failTable && method === 'POST') return new Response('boom', { status: 500 });
      const t = server.get(table) ?? new Map();
      server.set(table, t);
      if (method === 'POST') {
        const rows = JSON.parse(String(init!.body)) as Row[];
        calls.push({ method, table, rows });
        for (const r of rows) {
          const old = t.get(r.id);
          if (old && r.client_updated_at < old.client_updated_at) continue; // lww_guard
          t.set(r.id, { ...r, updated_at: new Date(clock++).toISOString() });
        }
        return new Response('', { status: 201 });
      }
      if (method === 'PATCH') return new Response('', { status: 204 });
      calls.push({ method, table });
      const or = u.searchParams.get('or');
      const m = or?.match(/updated_at\.gt\.([^,]+),/);
      const after = m ? decodeURIComponent(m[1]) : null;
      const rows = [...t.values()]
        .filter((r) => !after || r.updated_at > after)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      return new Response(JSON.stringify(rows), { status: 200 });
    } finally {
      inFlight--;
    }
  })();
}

import { addSpend, createPlanAndCycle, removeEntry, ensureSeed } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { applyRemote, requestSync, syncNow } from '@/lib/sync';
import { supabaseSync } from '@/lib/sync';

const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };
let n = 0;

async function freshUser() {
  n++;
  server.clear();
  calls.length = 0;
  maxInFlight = 0;
  await openUserDB(`sync-user-${n}`);
  await ensureSeed();
}

describe('sync engine', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      addEventListener: () => {},
    });
    token = 'tok-1';
    refreshSession.mockClear();
    failTable = null;
    await freshUser();
  });

  it('pushes only dirty rows, parents first, then nothing on a second sync', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycles.toArray())[0];
    await addSpend(cycle, { amount: 90, label: 'Tea', category: 'Food' });
    await syncNow();
    const posts = calls.filter((c) => c.method === 'POST').map((c) => c.table);
    expect(posts.indexOf('plans')).toBeLessThan(posts.indexOf('transactions'));
    expect(posts.indexOf('cycles')).toBeLessThan(posts.indexOf('transactions'));
    calls.length = 0;
    await syncNow();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await addSpend(cycle, { amount: 10, label: 'Tea', category: 'Food' });
    calls.length = 0;
    await syncNow();
    const again = calls.filter((c) => c.method === 'POST');
    expect(again.map((c) => c.table)).toEqual(['transactions']);
  });

  it('20 rapid writes give one sync with one request in flight', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    await syncNow();
    calls.length = 0;
    maxInFlight = 0;
    const cycle = (await getDB().cycles.toArray())[0];
    for (let i = 0; i < 20; i++) {
      await addSpend(cycle, { amount: i + 1, label: 'x', category: 'Food' });
      requestSync();
    }
    await new Promise((r) => setTimeout(r, 700));
    expect(maxInFlight).toBe(1);
    const txPosts = calls.filter((c) => c.method === 'POST' && c.table === 'transactions');
    expect(txPosts).toHaveLength(1);
    expect(txPosts[0].rows).toHaveLength(20);
  });

  it('a failing table gives an error and does not advance the push cursor', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycles.toArray())[0];
    await addSpend(cycle, { amount: 5, label: 'x', category: 'Food' });
    failTable = 'transactions';
    await expect(syncNow()).rejects.toThrow(/Sync failed/);
    expect((await getDB().meta.get('main'))?.lastPushedAt).toBeUndefined();
    failTable = null;
    await syncNow();
    expect(server.get('transactions')?.size).toBe(1);
    expect((await getDB().meta.get('main'))?.lastPushedAt).toBeGreaterThan(0);
  });

  it('tombstone round-trip: delete pushes deleted_at and a remote tombstone applies locally', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycles.toArray())[0];
    const e = await addSpend(cycle, { amount: 200, label: 'x', category: 'Food' });
    await syncNow();
    await removeEntry(e.id);
    await syncNow();
    expect(server.get('transactions')!.get(e.id)!.deleted_at).toBeTruthy();

    // another device deletes a second spend
    const e2 = await addSpend(cycle, { amount: 50, label: 'y', category: 'Food' });
    await syncNow();
    const row = server.get('transactions')!.get(e2.id)!;
    row.deleted_at = new Date().toISOString();
    row.client_updated_at += 10;
    row.updated_at = new Date(clock++).toISOString();
    await syncNow();
    expect((await getDB().transactions.get(e2.id))?.deletedAt).toBeTruthy();
  });

  it('LWW both ways: older remote loses, newer remote wins', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycles.toArray())[0];
    const e = await addSpend(cycle, { amount: 100, label: 'x', category: 'Food' });
    const local = (await getDB().transactions.get(e.id))!;
    const remote = (amount: number, at: number) =>
      ({
        id: e.id, client_updated_at: at, deleted_at: null, cycle_id: cycle.id, txn_date: local.txnDate, amount,
        type: 'Food', subtype: null, label: 'x', from_savings: false, adjusts_pool: true, is_estimate: false,
        hour: 0, created_at: local.createdAt,
      }) as never;
    await applyRemote(getDB(), { transactions: [remote(999, local.updatedAt - 1)] });
    expect((await getDB().transactions.get(e.id))!.amount).toBe(100);
    await applyRemote(getDB(), { transactions: [remote(777, local.updatedAt + 1)] });
    expect((await getDB().transactions.get(e.id))!.amount).toBe(777);
  });

  it('cycle currentDay merges as max, then the cycle is re-derived', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    const cycle = (await getDB().cycles.toArray())[0];
    const remote = {
      id: cycle.id, client_updated_at: cycle.updatedAt - 5, deleted_at: null, start_date: cycle.startDate,
      total_days: 30, plan_amount: cycle.planAmount, current_day: 4, leftover_moved: false, estimated_days: [],
    } as never;
    await applyRemote(getDB(), { cycles: [remote] }); // local is newer, but remote day is ahead
    const c = (await getDB().cycles.get(cycle.id))!;
    expect(c.currentDay).toBe(4);
    expect(await getDB().dayRows.count()).toBe(3);
  });

  it('pull never clears local rows when the server is empty', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    server.clear();
    const before = await getDB().cycles.count();
    await syncNow(); // pushes, then pulls its own data back
    expect(await getDB().cycles.count()).toBe(before);
  });

  it('401 refreshes the session once and retries', async () => {
    await createPlanAndCycle(plan, '2026-10-01');
    await new Promise((r) => setTimeout(r, 450)); // let the debounced background sync settle
    await getDB().cycles.toCollection().modify({ updatedAt: Date.now() });
    refreshSession.mockClear();
    unauthorizedOnce = true;
    await syncNow();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(server.get('plans')?.size).toBe(1);
  });

  it('is enabled while signed in', () => {
    expect(supabaseSync.isEnabled()).toBe(true);
  });
});
