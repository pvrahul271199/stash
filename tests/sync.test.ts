import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { status: 'signedIn' as const, uid: 'uid-1', username: 'rahul' };
/** Simulates a database whose RLS is broken: GETs return every user's rows and ignore the user_id filter. */
let ignoreUserFilter = false;
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
const server = new Map<string, Map<string, Row & { updated_at: string; version: number }>>();
let clock = 1_000;
const calls: { method: string; table: string; rows?: Row[] }[] = [];
let inFlight = 0;
let maxInFlight = 0;
let failTable: string | null = null;
let uniqueNames = false;
let loseResponseOnce = false;
const mutations = new Map<string, unknown>();
const rpcCalls: { id: string; tables: string[] }[] = [];
let unauthorizedOnce = false;
const rejectIds = new Set<string>();
let patchCount = 0;
let pushRequests = 0;

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
      if (table === 'push_changes') {
        // mirrors public.push_changes: idempotent, all-or-nothing, version-checked
        const { p_mutation_id, p_changes } = JSON.parse(String(init!.body)) as {
          p_mutation_id: string;
          p_changes: Record<string, (Row & { _base_version: number | null })[]>;
        };
        rpcCalls.push({ id: p_mutation_id, tables: Object.keys(p_changes) });
        pushRequests++;
        if (Object.values(p_changes).some((rows) => rows.some((r) => rejectIds.has(r.id)))) return new Response('{"code":"23514"}', { status: 400 });
        if (failTable && p_changes[failTable]?.length) return new Response('boom', { status: 500 });
        if (mutations.has(p_mutation_id)) return new Response(JSON.stringify(mutations.get(p_mutation_id)), { status: 200 });
        const order = ['plans', 'cycles', 'categories', 'events', 'transactions'];
        const conflicts: Record<string, unknown[]> = {};
        for (const name of order) {
          for (const r of p_changes[name] ?? []) {
            const cur = server.get(name)?.get(r.id);
            if (cur && (r._base_version == null || r._base_version !== cur.version)) (conflicts[name] ??= []).push(cur);
          }
        }
        if (Object.keys(conflicts).length) return new Response(JSON.stringify({ status: 'conflict', conflicts }), { status: 200 });
        if (uniqueNames) {
          for (const name of ['categories', 'events']) {
            for (const r of p_changes[name] ?? []) {
              const clash = [...(server.get(name)?.values() ?? [])].some(
                (o) => o.id !== r.id && o.deleted_at == null && String(o.name).toLowerCase() === String(r.name).toLowerCase(),
              );
              if (clash) return new Response('{"code":"23505"}', { status: 409 });
            }
          }
        }
        const versions: Record<string, Record<string, number>> = {};
        for (const name of order) {
          const rows = p_changes[name];
          if (!rows?.length) continue;
          const t = server.get(name) ?? new Map();
          server.set(name, t);
          calls.push({ method: 'POST', table: name, rows });
          for (const { _base_version, ...r } of rows) {
            void _base_version;
            const version = (t.get(r.id)?.version ?? 0) + 1;
            t.set(r.id, { ...r, user_id: auth.uid, version, updated_at: new Date(clock++).toISOString() });
            (versions[name] ??= {})[r.id] = version;
          }
        }
        const result = { status: 'ok', versions };
        mutations.set(p_mutation_id, result);
        if (loseResponseOnce) {
          loseResponseOnce = false;
          return new Response('gateway timeout', { status: 504 });
        }
        return new Response(JSON.stringify(result), { status: 200 });
      }
      const t = server.get(table) ?? new Map();
      server.set(table, t);
      if (method === 'PATCH') {
        patchCount++;
        return new Response(null, { status: 204 });
      }
      calls.push({ method, table });
      const or = u.searchParams.get('or');
      const m = or?.match(/updated_at\.gt\.([^,]+),/);
      const plain = u.searchParams.get('updated_at')?.match(/^gt\.(.+)$/);
      const after = m ? decodeURIComponent(m[1]) : plain ? plain[1] : null;
      const owner = u.searchParams.get('user_id')?.match(/^eq\.(.+)$/)?.[1];
      const rows = [...t.values()]
        .filter((r) => ignoreUserFilter || (owner != null && r.user_id === owner))
        .filter((r) => !after || r.updated_at > after)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      return new Response(JSON.stringify(rows), { status: 200 });
    } finally {
      inFlight--;
    }
  })();
}

import { addCategory, addSpend, updateEntry, createPlan, removeEntry, ensureSeed } from '@/db/queries';
import { getDB, openUserDB } from '@/db/schema';
import { applyRemote, mergeRows, requestSync, syncNow } from '@/lib/sync';
import { supabaseSync } from '@/lib/sync';
import { cycleFor } from '@/db/queries';

const settle = async () => {
  await new Promise((r) => setTimeout(r, 4)); // writes in the same ms as the push cutoff wait for the next sync
  return syncNow();
};
const plan = { income: 80000, bills: 25000, savings: 15000, monthLength: 30 };
let n = 0;

async function freshUser() {
  n++;
  server.clear();
  mutations.clear();
  rpcCalls.length = 0;
  calls.length = 0;
  maxInFlight = 0;
  auth.uid = `sync-user-${n}`; // the open DB always belongs to the signed-in user
  await openUserDB(auth.uid);
  await ensureSeed();
}

describe('sync engine', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => (k === 'stash:consent' ? JSON.stringify({ v: 1 }) : null), setItem: () => {}, removeItem: () => {} },
      addEventListener: () => {},
    });
    token = 'tok-1';
    refreshSession.mockClear();
    failTable = null;
    rejectIds.clear();
    patchCount = 0;
    pushRequests = 0;
    uniqueNames = false;
    loseResponseOnce = false;
    ignoreUserFilter = false;
    await freshUser();
  });

  it('pushes only dirty rows, parents first, then nothing on a second sync', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 90, label: 'Tea', category: 'Food' });
    await settle();
    const posts = calls.filter((c) => c.method === 'POST').map((c) => c.table);
    expect(posts.indexOf('plans')).toBeLessThan(posts.indexOf('transactions'));
    expect(posts).not.toContain('cycles'); // months are derived, never synced (E-4)
    calls.length = 0;
    await settle();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await addSpend(cycle, { amount: 10, label: 'Tea', category: 'Food' });
    calls.length = 0;
    await settle();
    const again = calls.filter((c) => c.method === 'POST');
    expect(again.map((c) => c.table)).toEqual(['transactions']);
  });

  it('20 rapid writes give one sync with one request in flight', async () => {
    await createPlan(plan, '2026-10-01');
    await settle();
    calls.length = 0;
    maxInFlight = 0;
    const cycle = (await cycleFor(getDB()))!;
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
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 5, label: 'x', category: 'Food' });
    failTable = 'transactions';
    await expect(settle()).rejects.toThrow(/Sync failed/);
    expect((await getDB().meta.get('main'))?.lastPushedAt).toBeUndefined();
    expect(server.get('plans')).toBeUndefined(); // atomic: the plan in the same batch was not written either
    failTable = null;
    await settle();
    expect(server.get('transactions')?.size).toBe(1);
    expect((await getDB().meta.get('main'))?.lastPushedAt).toBeGreaterThan(0);
  });

  it('tombstone round-trip: delete pushes deleted_at and a remote tombstone applies locally', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    const e = await addSpend(cycle, { amount: 200, label: 'x', category: 'Food' });
    await settle();
    await removeEntry(e.id);
    await settle();
    expect(server.get('transactions')!.get(e.id)!.deleted_at).toBeTruthy();

    // another device deletes a second spend
    const e2 = await addSpend(cycle, { amount: 50, label: 'y', category: 'Food' });
    await settle();
    const row = server.get('transactions')!.get(e2.id)!;
    row.deleted_at = new Date().toISOString();
    row.client_updated_at += 10;
    row.version += 1;
    row.updated_at = new Date(clock++).toISOString();
    await settle();
    expect((await getDB().transactions.get(e2.id))?.deletedAt).toBeTruthy();
  });

  it('same field changed on both sides with no common ancestor: the newer client time is the tiebreaker', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    const e = await addSpend(cycle, { amount: 100, label: 'x', category: 'Food' });
    const local = (await getDB().transactions.get(e.id))!;
    const remote = (amount: number, at: number) =>
      ({
        id: e.id, user_id: auth.uid, client_updated_at: at, deleted_at: null, cycle_id: cycle.id, txn_date: local.txnDate, amount,
        type: 'Food', subtype: null, label: 'x', from_savings: false, adjusts_pool: true, is_estimate: false,
        hour: 0, created_at: local.createdAt,
      }) as never;
    await applyRemote(getDB(), { transactions: [remote(999, local.updatedAt - 1)] });
    expect((await getDB().transactions.get(e.id))!.amount).toBe(100);
    await applyRemote(getDB(), { transactions: [remote(777, Date.now() + 60_000)] });
    expect((await getDB().transactions.get(e.id))!.amount).toBe(777);
  });

  it('a plan from an older device (no start day / effective date) is completed locally and pushed back', async () => {
    const remote = {
      id: 'old-plan', user_id: auth.uid, client_updated_at: 1, version: 1, deleted_at: null, income: 50000, bills: 20000,
      savings: 0, month_length: 30, currency: null, bill_items: null, savings_items: null, created_at: new Date(2026, 9, 30, 12).getTime(),
    } as never;
    await applyRemote(getDB(), { plans: [remote] });
    const p = (await getDB().plans.get('old-plan'))!;
    expect(p.effectiveFrom).toBe('2026-10-30');
    expect(p.periodStartDay).toBe(1); // calendar months unless the user picked another day
    expect(p.localRev).toBeDefined(); // dirty: the next push sends the completed plan
  });

  it('pull never clears local rows when the server is empty', async () => {
    await createPlan(plan, '2026-10-01');
    server.clear();
    const before = await getDB().plans.count();
    await settle(); // pushes, then pulls its own data back
    expect(await getDB().plans.count()).toBe(before);
  });

  it('401 refreshes the session once and retries', async () => {
    await createPlan(plan, '2026-10-01');
    await new Promise((r) => setTimeout(r, 450)); // let the debounced background sync settle
    await getDB().plans.toCollection().modify({ income: 81000, updatedAt: Date.now() });
    refreshSession.mockClear();
    unauthorizedOnce = true;
    await settle();
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(server.get('plans')?.size).toBe(1);
  });

  it('is enabled while signed in', () => {
    expect(supabaseSync.isEnabled()).toBe(true);
  });

  it('a name already taken by another device is renamed locally and the push succeeds', async () => {
    uniqueNames = true;
    server.set('categories', new Map([['other-device', { id: 'other-device', user_id: auth.uid, client_updated_at: 1, version: 1, updated_at: new Date(1).toISOString(), deleted_at: null, name: 'Pets' }]]));
    await createPlan(plan, '2026-10-01');
    await addCategory('pets');
    await addCategory('Books');
    await settle();
    const cats = (await getDB().cats.toArray()).map((c) => c.name).sort();
    expect(cats).toEqual(['Books', 'Pets', 'pets (2)']); // 'Pets' arrived by pull from the other device
    const remote = [...server.get('categories')!.values()].map((r) => r.name).sort();
    expect(remote).toEqual(['Books', 'Pets', 'pets (2)']);
  });

  it('phone edits the note, laptop edits the amount: both survive', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    const e = await addSpend(cycle, { amount: 100, label: 'Lunch', category: 'Food' });
    await settle(); // both devices start from version 1

    // laptop (another device) changes the amount on the server
    const row = server.get('transactions')!.get(e.id)!;
    row.amount = 250;
    row.version += 1;
    row.client_updated_at += 5;
    row.updated_at = new Date(clock++).toISOString();

    // phone (this device), offline, changes the note
    await updateEntry(e.id, { note: 'with Asha' });
    await settle(); // push conflicts (stale version), merges field by field, retries

    const local = (await getDB().transactions.get(e.id))!;
    expect(local.amount).toBe(250);
    expect(local.note).toBe('with Asha');
    const remote = server.get('transactions')!.get(e.id)!;
    expect(remote.amount).toBe(250);
    expect(remote.note).toBe('with Asha');
    expect(remote.version).toBe(3);
  });

  it('only the rows that changed are sent, and they carry the version they were based on', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    const e = await addSpend(cycle, { amount: 100, label: 'Lunch', category: 'Food' });
    await settle();
    await updateEntry(e.id, { note: 'x' });
    calls.length = 0;
    await settle();
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts.map((c) => c.table)).toEqual(['transactions']);
    expect(server.get('transactions')!.get(e.id)!.version).toBe(2);
  });

  it('a push whose response was lost is resent with the same mutation id and applied once', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 7, label: 'Tea', category: 'Food' });
    loseResponseOnce = true; // server applies the batch, the client never hears back
    await expect(settle()).rejects.toThrow();
    const first = rpcCalls[rpcCalls.length - 1];
    const id = [...server.get('transactions')!.keys()][0];
    expect(server.get('transactions')!.get(id)!.version).toBe(1);
    expect((await getDB().meta.get('main'))!.pendingPush?.id).toBe(first.id);

    await settle();
    expect(rpcCalls.some((c, i) => i > rpcCalls.indexOf(first) && c.id === first.id)).toBe(true);
    expect(server.get('transactions')!.get(id)!.version).toBe(1); // not applied twice
    expect((await getDB().meta.get('main'))!.pendingPush).toBeNull();
    await settle();
    expect(server.get('transactions')!.get(id)!.version).toBe(1);
  });
});

describe('pull cursor', () => {
  it('re-reads a row that committed late with an older updated_at, and pages past 1000 rows', async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'stash:consent' ? JSON.stringify({ v: 1 }) : null), setItem: () => {}, removeItem: () => {} }, addEventListener: () => {} });
    await freshUser();
    const t = new Map<string, Row & { updated_at: string; version: number }>();
    server.set('categories', t);
    const base = Date.now();
    const cat = (i: number, at: number) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`, user_id: auth.uid, client_updated_at: 1, version: 1,
      updated_at: new Date(at).toISOString(), deleted_at: null, name: `C${i}`, sort_order: i, is_system: false,
      subcategories: [], base_id: null, sub_added: [], sub_removed: [],
    });
    for (let i = 1; i <= 1200; i++) t.set(cat(i, 0).id, cat(i, base + i)); // more than one PostgREST page
    await syncNow();
    expect((await getDB().cats.toArray()).length).toBe(1200);

    // a slow transaction took its timestamp before the last row we saw, but committed after our pull
    const late = cat(5000, base + 600);
    t.set(late.id, late);
    await syncNow();
    expect((await getDB().cats.get(late.id))?.name).toBe('C5000');
  });
});

describe('mergeRows', () => {
  const base = { id: 'a', client_updated_at: 1, amount: 100, note: null, label: 'x', deleted_at: null };

  it('keeps one-sided changes from each side', () => {
    const local = { ...base, client_updated_at: 5, note: 'mine' };
    const server = { ...base, client_updated_at: 3, amount: 250, version: 2 };
    const m = mergeRows('transactions', local, base, server);
    expect(m).toMatchObject({ amount: 250, note: 'mine', client_updated_at: 5 });
  });

  it('breaks a same-field tie by client time, never by who pushed last', () => {
    const local = { ...base, client_updated_at: 9, amount: 1 };
    const server = { ...base, client_updated_at: 4, amount: 2 };
    expect(mergeRows('transactions', local, base, server).amount).toBe(1);
    expect(mergeRows('transactions', { ...local, client_updated_at: 2 }, base, server).amount).toBe(2);
  });

  it('treats equal timestamps in different text forms as equal', () => {
    const t = { ...base, deleted_at: '2026-11-02T10:00:00.000Z' };
    const server = { ...base, deleted_at: '2026-11-02T10:00:00+00:00', version: 2 };
    expect(mergeRows('transactions', t, base, server).deleted_at).toBe('2026-11-02T10:00:00+00:00');
  });

});


describe('sync robustness (B1, B2, M2)', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => (k === 'stash:consent' ? JSON.stringify({ v: 1 }) : null), setItem: () => {}, removeItem: () => {} },
      addEventListener: () => {},
    });
    token = 'tok-1';
    failTable = null;
    rejectIds.clear();
    uniqueNames = false;
    loseResponseOnce = false;
    ignoreUserFilter = false;
    await freshUser();
    patchCount = 0;
    pushRequests = 0;
  });


  it('B1: an edit made while the phone clock runs backwards is still pushed', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 20, label: 'Tea', category: 'Food' });
    await settle();
    const real = Date.now;
    try {
      Date.now = () => real() - 3 * 24 * 60 * 60 * 1000; // clock set back three days
      await addSpend(cycle, { amount: 33, label: 'Back in time', category: 'Food' });
      await new Promise((r) => setTimeout(r, 4));
      calls.length = 0;
      await syncNow();
    } finally {
      Date.now = real;
    }
    const sent = calls.filter((c) => c.method === 'POST' && c.table === 'transactions').flatMap((c) => c.rows ?? []);
    expect(sent.map((r) => r.amount)).toEqual([33]);
    expect([...(server.get('transactions')?.values() ?? [])].some((r) => r.amount === 33)).toBe(true);
  });

  it('B1: localRev never goes down, even when Date.now does', async () => {
    const { nextRev } = await import('@/db/schema');
    const a = nextRev();
    const real = Date.now;
    try {
      Date.now = () => 5;
      expect(nextRev()).toBeGreaterThan(a);
    } finally {
      Date.now = real;
    }
  });

  it('B2: one rejected row is quarantined and the rest of the batch still syncs', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    for (let i = 1; i <= 6; i++) await addSpend(cycle, { amount: i * 10, label: `t${i}`, category: 'Food' });
    const txns = await getDB().transactions.toArray();
    const bad = txns.find((t) => t.amount === 40)!;
    rejectIds.add(bad.id);
    await settle(); // must not throw
    const onServer = server.get('transactions')!;
    expect(onServer.size).toBe(5);
    expect(onServer.has(bad.id)).toBe(false);
    const { getSyncFailures } = await import('@/lib/sync');
    expect((await getSyncFailures()).map((f) => f.id)).toEqual([bad.id]);
    // the cursor moved on: a later sync with nothing new sends nothing and does not hunt again
    pushRequests = 0;
    await settle();
    expect(pushRequests).toBe(0);
    // editing the bad row to something valid sends it and clears the failure
    rejectIds.clear();
    await updateEntry(bad.id, { amount: 41 });
    await settle();
    expect(server.get('transactions')!.has(bad.id)).toBe(true);
    expect(await getSyncFailures()).toHaveLength(0);
  });

  it('B2: finding the bad row among N rows costs about 2·log2(N) requests, not N', async () => {
    await createPlan(plan, '2026-10-01');
    const cycle = (await cycleFor(getDB()))!;
    for (let i = 1; i <= 64; i++) await addSpend(cycle, { amount: i, label: `t${i}`, category: 'Food' });
    const bad = (await getDB().transactions.toArray()).find((t) => t.amount === 17)!;
    rejectIds.add(bad.id);
    pushRequests = 0;
    await settle();
    expect(server.get('transactions')!.size).toBe(63);
    expect(pushRequests).toBeLessThan(30);
  });

  it('M2: the profile is only PATCHed when the currency changed', async () => {
    await createPlan(plan, '2026-10-01');
    await settle();
    expect(patchCount).toBe(1);
    const cycle = (await cycleFor(getDB()))!;
    await addSpend(cycle, { amount: 5, label: 'x', category: 'Food' });
    await settle();
    await settle();
    expect(patchCount).toBe(1);
  });

  it('H2: nothing is uploaded until the privacy notice is accepted', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, addEventListener: () => {} });
    await createPlan(plan, '2026-10-01');
    await expect(syncNow()).rejects.toThrow(/Privacy notice/);
    expect(rpcCalls).toHaveLength(0);
  });

  it('M5: countUnsynced reflects pending changes and drops to zero after a sync', async () => {
    const { countUnsynced } = await import('@/lib/sync');
    await createPlan(plan, '2026-10-01');
    expect(await countUnsynced()).toBeGreaterThan(0);
    await settle();
    expect(await countUnsynced()).toBe(0);
  });
});

describe('account isolation (the app enforces it, not only RLS)', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'stash:consent' ? JSON.stringify({ v: 1 }) : null), setItem: () => {}, removeItem: () => {} }, addEventListener: () => {} });
    ignoreUserFilter = false;
    await freshUser();
  });

  const foreignTxn = (id: string) => ({
    id, user_id: 'someone-else', client_updated_at: 1, version: 1, updated_at: new Date(clock++).toISOString(), deleted_at: null,
    cycle_id: null, txn_date: '2026-11-03', amount: 50000, type: 'Other', category_id: 'other', subtype: null, label: 'Sort later',
    event: null, event_id: null, payment: null, note: null, from_savings: false, adjusts_pool: true, is_estimate: false, hour: 0, created_at: 1,
  });

  it('every pull asks only for the signed-in user', async () => {
    await createPlan(plan, '2026-10-01');
    await settle();
    const gets: string[] = [];
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') gets.push(String(input));
      return fakeFetch(input, init);
    });
    await settle();
    expect(gets.length).toBeGreaterThan(0);
    for (const g of gets) expect(new URL(g).searchParams.get('user_id')).toBe(`eq.${auth.uid}`);
  });

  it('with broken RLS (server returns other users\' rows) nothing foreign reaches the device', async () => {
    ignoreUserFilter = true;
    server.set('transactions', new Map([['foreign-1', foreignTxn('foreign-1')]]));
    server.set('categories', new Map([['foreign-cat', { id: 'foreign-cat', user_id: 'someone-else', client_updated_at: 1, version: 1, updated_at: new Date(clock++).toISOString(), deleted_at: null, name: 'Food', sort_order: 0, is_system: false, subcategories: [], base_id: null, sub_added: [], sub_removed: [] }]]));
    await createPlan(plan, '2026-10-01');
    await settle();
    expect(await getDB().transactions.get('foreign-1')).toBeUndefined();
    expect(await getDB().cats.get('foreign-cat')).toBeUndefined();
    // and so it can never be re-uploaded under this account
    expect([...server.get('transactions')!.values()].filter((r) => r.user_id === auth.uid && r.id === 'foreign-1')).toHaveLength(0);
  });

  it('applyRemote drops rows of another user and rows with no owner', async () => {
    const { user_id, ...ownerless } = foreignTxn('no-owner');
    void user_id;
    await applyRemote(getDB(), { transactions: [foreignTxn('foreign-2'), ownerless as never] as never });
    expect(await getDB().transactions.count()).toBe(0);
  });

  it('refuses to sync when the open DB belongs to a different user (login/logout switch)', async () => {
    await createPlan(plan, '2026-10-01');
    const owner = auth.uid;
    auth.uid = 'another-account'; // auth already switched, DB not yet
    await expect(syncNow()).rejects.toThrow(/switching/);
    expect(server.get('plans')).toBeUndefined(); // nothing from the other DB was uploaded into this account
    auth.uid = owner;
  });
});

describe('export CSV syncs first', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', fakeFetch);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'stash:consent' ? JSON.stringify({ v: 1 }) : null), setItem: () => {}, removeItem: () => {} }, addEventListener: () => {} });
    ignoreUserFilter = false;
    await freshUser();
  });

  it('uploads what is still waiting on this phone and includes spends only the cloud had', async () => {
    const { exportCSV } = await import('@/db/queries');
    const { todayISO } = await import('@/lib/dates');
    const today = todayISO();
    await createPlan({ ...plan, periodStartDay: 1 }, today);
    await addSpend((await cycleFor(getDB()))!, { amount: 90, label: 'Tea on this phone', category: 'Food' });
    // a spend another device made: it exists only on the server
    server.set('transactions', new Map([[`${'a'.repeat(8)}-0000-7000-8000-000000000001`, {
      id: `${'a'.repeat(8)}-0000-7000-8000-000000000001`, user_id: auth.uid, client_updated_at: 1, version: 1, updated_at: new Date(clock++).toISOString(), deleted_at: null,
      txn_date: today, amount: 450, type: 'Food', category_id: 'food', subtype: null, label: 'Lunch on the laptop', event: null, event_id: null,
      payment: null, note: null, from_savings: false, adjusts_pool: true, is_estimate: false, hour: 13, created_at: 1,
    }]]));
    expect(await getDB().transactions.count()).toBe(1); // the laptop's spend is not here yet

    const csv = await exportCSV(); // no explicit sync before this

    expect(csv).toContain('Lunch on the laptop'); // pulled
    expect(csv).toContain('Tea on this phone');
    expect([...(server.get('transactions')?.values() ?? [])].some((r) => r.label === 'Tea on this phone')).toBe(true); // pushed
  });

  it('a guest (not signed in) just exports, without touching the network', async () => {
    const { exportCSV } = await import('@/db/queries');
    const auth2 = await import('@/lib/auth');
    const spy = vi.spyOn(auth2, 'getAuth').mockReturnValue({ status: 'guest' } as never);
    const before = calls.length;
    try {
      await exportCSV();
    } finally {
      spy.mockRestore();
    }
    expect(calls.length).toBe(before);
  });
});
