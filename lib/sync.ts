import Dexie from 'dexie';
import { getDB, dbNameFor, GUEST_UID, type Category, type Cycle, type Plan, type StashDB, type StashEvent, type Txn } from '@/db/schema';
import { getAuth, getAccessToken } from './auth';
import { getSupabase, supabaseEnv } from './supabaseClient';
import { decodeBase64Username, encodeUsernameToBase64 } from './user';
import { reportSyncProgress } from './syncState';
import { getStoredCurrencyCode } from './currency';

export { decodeBase64Username, encodeUsernameToBase64 };

export interface SyncService {
  push(): Promise<void>;
  pull(): Promise<boolean>;
  isEnabled(): boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const LAST_SYNC_KEY = 'stash:last-synced-at';
const PAGE = 1000;
const PUSH_CHUNK = 500;
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Env config, but only while a real account is signed in (guests never sync). */
export function getSupabaseConfig(): SupabaseConfig | null {
  if (!getAuth().uid) return null;
  return supabaseEnv();
}

export function getLastSyncedAt(): number | null {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SYNC_KEY) : null;
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function setLastSyncedAt(ts: number) {
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {
    /* ignore */
  }
}

/* ---------- row mapping ---------- */

type Remote = Record<string, unknown> & { id: string; client_updated_at: number; deleted_at: string | null; updated_at?: string };

const iso = (ms?: number | null) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: unknown) => (typeof s === 'string' ? Date.parse(s) : null);

const common = (r: { id: string; updatedAt: number; deletedAt?: number | null }) => ({
  id: r.id,
  client_updated_at: r.updatedAt,
  deleted_at: iso(r.deletedAt),
});

export const MAPPERS = {
  plans: {
    local: 'plans' as const,
    toRemote: (p: Plan) => ({
      ...common(p),
      income: p.income,
      bills: p.bills,
      savings: p.savings,
      month_length: p.monthLength,
      currency: p.currency ?? null,
      bill_items: p.billItems ?? null,
      savings_items: p.savingsItems ?? null,
      created_at: p.createdAt,
    }),
    toLocal: (r: Remote): Plan => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      income: r.income as number,
      bills: r.bills as number,
      savings: r.savings as number,
      monthLength: r.month_length as number,
      currency: (r.currency as string | null) ?? undefined,
      billItems: (r.bill_items as Plan['billItems'] | null) ?? undefined,
      savingsItems: (r.savings_items as Plan['savingsItems'] | null) ?? undefined,
      createdAt: r.created_at as number,
    }),
  },
  cycles: {
    local: 'cycles' as const,
    toRemote: (c: Cycle) => ({
      ...common(c),
      start_date: c.startDate,
      total_days: c.totalDays,
      plan_amount: c.planAmount,
      current_day: c.currentDay,
      leftover_moved: c.leftoverMoved,
      estimated_days: c.estimatedDays,
    }),
    toLocal: (r: Remote): Cycle => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      startDate: r.start_date as string,
      totalDays: r.total_days as number,
      planAmount: r.plan_amount as number,
      currentDay: r.current_day as number,
      leftoverMoved: !!r.leftover_moved,
      estimatedDays: (r.estimated_days as number[]) ?? [],
      pool: r.plan_amount as number, // derived by recompute
      fromSavingsTotal: 0,
    }),
  },
  transactions: {
    local: 'transactions' as const,
    toRemote: (t: Txn) => ({
      ...common(t),
      cycle_id: t.cycleId,
      txn_date: t.txnDate,
      amount: t.amount,
      type: t.type,
      subtype: t.subtype,
      label: t.label,
      event: t.event,
      payment: t.payment,
      note: t.note,
      from_savings: t.fromSavings,
      adjusts_pool: t.adjustsPool,
      is_estimate: t.isEstimate,
      hour: t.hour,
      created_at: t.createdAt,
    }),
    toLocal: (r: Remote): Txn => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      cycleId: (r.cycle_id as string | null) ?? null,
      txnDate: r.txn_date as string,
      amount: r.amount as number,
      type: r.type as string,
      subtype: (r.subtype as string | null) ?? null,
      label: (r.label as string) ?? '',
      event: (r.event as string | null) ?? null,
      payment: (r.payment as string | null) ?? null,
      note: (r.note as string | null) ?? null,
      fromSavings: !!r.from_savings,
      adjustsPool: r.adjusts_pool !== false,
      isEstimate: !!r.is_estimate,
      hour: (r.hour as number) ?? 0,
      createdAt: r.created_at as number,
    }),
  },
  categories: {
    local: 'cats' as const,
    toRemote: (c: Category) => ({
      ...common(c),
      name: c.name,
      sort_order: c.sortOrder,
      is_system: c.isSystem,
      subcategories: c.subcategories,
    }),
    toLocal: (r: Remote): Category => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      name: r.name as string,
      sortOrder: r.sort_order as number,
      isSystem: !!r.is_system,
      subcategories: (r.subcategories as string[]) ?? [],
    }),
  },
  events: {
    local: 'evts' as const,
    toRemote: (e: StashEvent) => ({
      ...common(e),
      name: e.name,
      note: e.note,
      categories: e.categories,
      created_at: e.createdAt,
    }),
    toLocal: (r: Remote): StashEvent => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      name: r.name as string,
      note: (r.note as string | null) ?? null,
      categories: (r.categories as string[]) ?? [],
      createdAt: r.created_at as number,
    }),
  },
};

type TableName = keyof typeof MAPPERS;
/** Parents first. */
export const TABLE_ORDER: TableName[] = ['plans', 'cycles', 'transactions', 'categories', 'events'];

export type RemoteRows = Partial<Record<TableName, Remote[]>>;

/* ---------- http ---------- */

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'auth' | 'server',
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit, token: string): Promise<Response> {
  const env = supabaseEnv();
  if (!env) throw new SyncError('Cloud sync is not configured', 'server');
  let res: Response;
  try {
    res = await fetch(`${env.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new SyncError('You are offline', 'offline');
  }
  return res;
}

/** One automatic token refresh on 401; a second 401 is an auth failure. */
async function authed(path: string, init: RequestInit): Promise<Response> {
  let token = await getAccessToken();
  if (!token) throw new SyncError('Not signed in', 'auth');
  let res = await request(path, init, token);
  if (res.status === 401) {
    try {
      await getSupabase()?.auth.refreshSession();
    } catch {
      throw new SyncError('Session expired', 'auth');
    }
    token = await getAccessToken();
    if (!token) throw new SyncError('Session expired', 'auth');
    res = await request(path, init, token);
    if (res.status === 401) throw new SyncError('Session expired', 'auth');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new SyncError(`Sync failed (${res.status}) ${body.slice(0, 160)}`, 'server');
  }
  return res;
}

/* ---------- push ---------- */

async function getMeta(db: StashDB) {
  return (await db.meta.get('main')) ?? { id: 'main' as const, lastUsedLabel: null, schemaVersion: 0 };
}

/** Pushes every row changed since `meta.lastPushedAt` (tombstones included), parents first. */
export async function pushDirty(db: StashDB): Promise<number> {
  const meta = await getMeta(db);
  const since = meta.lastPushedAt ?? 0;
  const cutoff = Date.now() - 1;
  let sent = 0;
  for (const name of TABLE_ORDER) {
    const m = MAPPERS[name];
    const table = db[m.local] as unknown as Dexie.Table<{ id: string; updatedAt: number }, string>;
    const dirty = await table.where('updatedAt').above(since).and((r) => r.updatedAt <= cutoff).toArray();
    for (let i = 0; i < dirty.length; i += PUSH_CHUNK) {
      const chunk = dirty.slice(i, i + PUSH_CHUNK).map((r) => (m.toRemote as (x: unknown) => unknown)(r));
      await authed(`${name}?on_conflict=id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      });
      sent += chunk.length;
    }
  }
  await db.meta.update('main', { lastPushedAt: cutoff });
  return sent;
}

/* ---------- pull ---------- */

type Cursor = { ts: string; id: string };

async function pullTable(
  db: StashDB,
  name: TableName,
  cursor: Cursor | null,
): Promise<{ cursor: Cursor | null; touchedCycles: Set<string> }> {
  const touched = new Set<string>();
  let cur = cursor;
  for (;;) {
    const filter = cur
      ? `&or=(updated_at.gt.${encodeURIComponent(cur.ts)},and(updated_at.eq.${encodeURIComponent(cur.ts)},id.gt.${cur.id}))`
      : '';
    const res = await authed(`${name}?select=*&order=updated_at.asc,id.asc&limit=${PAGE}${filter}`, { method: 'GET' });
    const rows = (await res.json()) as Remote[];
    if (rows.length) {
      const t = await applyRemote(db, { [name]: rows });
      t.forEach((id) => touched.add(id));
      const last = rows[rows.length - 1];
      cur = { ts: last.updated_at as string, id: last.id };
    }
    if (rows.length < PAGE) break;
  }
  return { cursor: cur, touchedCycles: touched };
}

/** Pulls everything newer than the stored per-table cursors. Never clears local data. */
export async function pullSince(db: StashDB): Promise<void> {
  const meta = await getMeta(db);
  const cursors: Record<string, Cursor | null> = { ...(meta.pullCursors ?? {}) };
  for (const name of TABLE_ORDER) {
    const r = await pullTable(db, name, cursors[name] ?? null);
    cursors[name] = r.cursor;
  }
  // Advance only after every table succeeded.
  await db.meta.update('main', { pullCursors: cursors });
}

/**
 * Last-write-wins per row on client_updated_at. Cycle.currentDay merges as max(local, remote),
 * then touched cycles are re-derived. Returns the touched cycle ids.
 */
export async function applyRemote(db: StashDB, rows: RemoteRows): Promise<Set<string>> {
  const touched = new Set<string>();
  const { recompute } = await import('@/db/queries');
  await db.transaction(
    'rw',
    [db.plans, db.cycles, db.transactions, db.cats, db.evts, db.dayRows, db.meta],
    async () => {
      for (const name of TABLE_ORDER) {
        const list = rows[name];
        if (!list?.length) continue;
        const m = MAPPERS[name];
        const table = db[m.local] as unknown as Dexie.Table<Record<string, unknown> & { id: string; updatedAt: number }, string>;
        for (const r of list) {
          const incoming = m.toLocal(r) as unknown as Record<string, unknown> & { id: string; updatedAt: number };
          const local = await table.get(r.id);
          if (name === 'cycles' && local) {
            const l = local as unknown as Cycle;
            const inc = incoming as unknown as Cycle;
            const day = Math.max(l.currentDay, inc.currentDay);
            if (local.updatedAt >= incoming.updatedAt) {
              if (day !== l.currentDay) {
                await db.cycles.update(l.id, { currentDay: day });
                touched.add(l.id);
              }
              continue;
            }
            inc.currentDay = day;
            inc.pool = l.pool;
            inc.fromSavingsTotal = l.fromSavingsTotal;
          } else if (local && local.updatedAt >= incoming.updatedAt) {
            continue;
          }
          await table.put(incoming);
          if (name === 'cycles') touched.add(r.id);
          if (name === 'transactions') {
            const cid = (incoming as unknown as Txn).cycleId;
            const prev = (local as unknown as Txn | undefined)?.cycleId;
            if (cid) touched.add(cid);
            if (prev) touched.add(prev);
          }
        }
      }
      for (const id of touched) await recompute(db, id);
    },
  );
  return touched;
}

/* ---------- orchestration ---------- */

async function pushProfile(): Promise<void> {
  const a = getAuth();
  if (!a.uid) return;
  await authed(`profiles?id=eq.${a.uid}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ currency: getStoredCurrencyCode() }),
  });
}

async function purgeTombstones(db: StashDB): Promise<void> {
  const meta = await getMeta(db);
  const limit = Date.now() - TOMBSTONE_TTL_MS;
  const pushed = meta.lastPushedAt ?? 0;
  for (const name of TABLE_ORDER) {
    const table = db[MAPPERS[name].local] as unknown as Dexie.Table<{ id: string; updatedAt: number; deletedAt?: number | null }, string>;
    await table
      .filter((r) => r.deletedAt != null && r.deletedAt < limit && r.updatedAt <= pushed)
      .delete();
  }
}

export interface SyncResult {
  pushed: number;
  ok: true;
}

let chain: Promise<unknown> = Promise.resolve();

/** Push then pull, serialised through one promise chain. Rejects (and reports 'error') on any failure. */
export function syncNow(): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    const auth = getAuth();
    if (!auth.uid || !supabaseEnv()) throw new SyncError('Not signed in', 'auth');
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      reportSyncProgress('offline');
      throw new SyncError('You are offline', 'offline');
    }
    const db = getDB();
    reportSyncProgress('syncing');
    try {
      const pushed = await pushDirty(db);
      await pushProfile().catch(() => {});
      await pullSince(db);
      await purgeTombstones(db);
      const meta = await getMeta(db);
      if (meta.guestClaimPending) {
        await Dexie.delete(dbNameFor(GUEST_UID));
        await db.meta.update('main', { guestClaimPending: false });
      }
      setLastSyncedAt(Date.now());
      reportSyncProgress('synced');
      return { pushed, ok: true };
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError(e instanceof Error ? e.message : 'Sync failed', 'server');
      if (err.kind === 'offline') reportSyncProgress('offline');
      else reportSyncProgress('error', err.message);
      throw err;
    }
  };
  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** The only call queries make after a write. Debounced 300 ms; no-op for guests. */
export function requestSync(): void {
  if (!getAuth().uid) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow().catch(() => {});
  }, 300);
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => requestSync());
}

export const supabaseSync: SyncService = {
  isEnabled: () => !!getAuth().uid && !!supabaseEnv(),
  async push() {
    await syncNow();
  },
  async pull() {
    await syncNow();
    return true;
  },
};
