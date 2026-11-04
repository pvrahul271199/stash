import Dexie from 'dexie';
import { getDB, dbNameFor, GUEST_UID, nextRev, withoutRevStamp, type CategoryRow, type Cycle, type Plan, type StashDB, type StashEvent, type SyncBase, type SyncFailure, type Txn } from '@/db/schema';
import { getAuth, getAccessToken } from './auth';
import { getSupabase, supabaseEnv } from './supabaseClient';
import { decodeBase64Username, encodeUsernameToBase64 } from './user';
import { reportSyncProgress } from './syncState';
import { getStoredCurrencyCode } from './currency';
import { hasSyncConsent } from './consent';

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
/** Each pull restarts this far behind its cursor: a slow transaction that took its updated_at before the last pull but committed after it would otherwise be skipped forever. Re-reading is free (applyRemote skips versions it already has). */
const PULL_OVERLAP_MS = 5 * 60 * 1000;
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

type Remote = Record<string, unknown> & { id: string; client_updated_at: number; deleted_at: string | null; updated_at?: string; version?: number };

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
      category_id: t.categoryId,
      subtype: t.subtype,
      label: t.label,
      event: t.event,
      event_id: t.eventId,
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
      categoryId: (r.category_id as string | null) ?? null,
      subtype: (r.subtype as string | null) ?? null,
      label: (r.label as string) ?? '',
      event: (r.event as string | null) ?? null,
      eventId: (r.event_id as string | null) ?? null,
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
    toRemote: (c: CategoryRow) => ({
      ...common(c),
      name: c.name,
      sort_order: c.sortOrder,
      is_system: c.isSystem,
      subcategories: c.subcategories,
      base_id: c.baseId,
      sub_added: c.subAdded,
      sub_removed: c.subRemoved,
    }),
    toLocal: (r: Remote): CategoryRow => ({
      id: r.id,
      updatedAt: r.client_updated_at,
      deletedAt: ms(r.deleted_at),
      name: r.name as string,
      sortOrder: r.sort_order as number,
      isSystem: !!r.is_system,
      subcategories: (r.subcategories as string[]) ?? [],
      baseId: (r.base_id as string | null) ?? null,
      subAdded: (r.sub_added as string[]) ?? [],
      subRemoved: (r.sub_removed as string[]) ?? [],
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
/** Parents first: transactions reference categories and events (events.id is a real FK remotely). */
export const TABLE_ORDER: TableName[] = ['plans', 'cycles', 'categories', 'events', 'transactions'];

export type RemoteRows = Partial<Record<TableName, Remote[]>>;

/* ---------- http ---------- */

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'auth' | 'server',
    /** HTTP status when the server answered. */
    readonly status?: number,
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
    throw new SyncError(`Sync failed (${res.status}) ${body.slice(0, 160)}`, 'server', res.status);
  }
  return res;
}

/* ---------- merge ---------- */

/** Bookkeeping columns: never merged field-by-field and never compared when looking for local edits. */
const META_KEYS = new Set(['id', 'client_updated_at', 'updated_at', 'version', 'user_id', 'status', '_base_version']);

/** Comparable form of a column value (timestamps differ in text between local ISO and Postgres output). */
function norm(key: string, v: unknown): unknown {
  if (key === 'deleted_at') return typeof v === 'string' ? Date.parse(v) : null;
  return v === undefined ? null : v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const fieldsOf = (row: Record<string, unknown>) => Object.keys(row).filter((k) => !META_KEYS.has(k));
const sameField = (k: string, a: unknown, b: unknown) => deepEqual(norm(k, a), norm(k, b));

/** True when `local` has no field the base doesn't already have. */
function sameFields(local: Record<string, unknown>, other: Record<string, unknown>): boolean {
  return fieldsOf(local).every((k) => sameField(k, local[k], other[k]));
}

/**
 * Three-way, field-level merge of one row. `base` is the last state both sides agreed on.
 * A field changed on only one side keeps that change, so a note edited on the phone and an amount
 * edited on the laptop both survive. When both sides changed the same field (or there is no base),
 * the newer `client_updated_at` decides: client time is only a tiebreaker here.
 */
export function mergeRows(
  table: TableName,
  local: Record<string, unknown>,
  base: Record<string, unknown> | null,
  server: Record<string, unknown>,
): Record<string, unknown> {
  const localWins = Number(local.client_updated_at) >= Number(server.client_updated_at);
  const out: Record<string, unknown> = { ...server };
  for (const k of fieldsOf(local)) {
    const lv = local[k];
    const sv = server[k];
    if (sameField(k, lv, sv)) continue;
    if (base && sameField(k, lv, base[k])) continue; // only the server changed it
    if (base && sameField(k, sv, base[k])) out[k] = lv; // only we changed it
    else out[k] = localWins ? lv : sv; // both changed
  }
  // a cycle's day cursor only ever moves forward
  if (table === 'cycles') out.current_day = Math.max(Number(local.current_day), Number(server.current_day));
  out.client_updated_at = Math.max(Number(local.client_updated_at), Number(server.client_updated_at));
  return out;
}

/* ---------- push ---------- */

async function getMeta(db: StashDB) {
  return (await db.meta.get('main')) ?? { id: 'main' as const, lastUsedLabel: null, schemaVersion: 0 };
}

type Ref = { name: TableName; id: string };
type Payload = Record<string, Record<string, unknown>[]>;
type PushResult =
  | { status: 'ok'; versions: Record<string, Record<string, number>> }
  | { status: 'conflict'; conflicts: Record<string, Remote[]> };

const baseKey = (name: string, id: string) => `${name}/${id}`;
const toRemoteRow = (name: TableName, row: unknown) => (MAPPERS[name].toRemote as (x: unknown) => Record<string, unknown>)(row);
const isNameTable = (n: string) => n === 'categories' || n === 'events';

/** Dirty rows -> payload items, with the server version each was based on. Rows identical to their base are skipped. */
async function buildPayload(db: StashDB, refs: Ref[]): Promise<{ payload: Payload; items: Ref[] }> {
  const payload: Payload = {};
  const items: Ref[] = [];
  for (const { name, id } of refs) {
    const table = db[MAPPERS[name].local] as unknown as Dexie.Table<{ id: string }, string>;
    const row = await table.get(id);
    if (!row) continue;
    const remote = toRemoteRow(name, row);
    const base = await db.syncBase.get(baseKey(name, id));
    if (base && sameFields(remote, base.row) && norm('deleted_at', remote.deleted_at) === norm('deleted_at', base.row.deleted_at)) continue;
    (payload[name] ??= []).push({ ...remote, _base_version: base?.version ?? null });
    items.push({ name, id });
  }
  return { payload, items };
}

async function callPush(mutationId: string, payload: Payload): Promise<PushResult> {
  const res = await authed('rpc/push_changes', {
    method: 'POST',
    body: JSON.stringify({ p_mutation_id: mutationId, p_changes: payload }),
  });
  return (await res.json()) as PushResult;
}

/** Records the versions the server assigned, so the next edit of each row is based on them. */
async function recordPushed(db: StashDB, payload: Payload, versions: Record<string, Record<string, number>>) {
  const bases: SyncBase[] = [];
  for (const [name, rows] of Object.entries(payload)) {
    for (const r of rows) {
      const v = versions[name]?.[r.id as string];
      if (v == null) continue;
      const { _base_version, ...row } = r;
      void _base_version;
      bases.push({ key: baseKey(name, r.id as string), version: v, row });
    }
  }
  await db.syncBase.bulkPut(bases);
  await clearFailures(db, bases.map((b) => b.key));
}

/* ---------- quarantine (B2) ---------- */

/** HTTP statuses that mean "the server rejected this data" (constraint, malformed, too large), as opposed to auth / config / outage. */
const ROW_ERROR_STATUSES = new Set([400, 409, 413, 422]);
/** Upper bound on extra requests one sync spends hunting for a bad row. */
const MAX_SPLIT_REQUESTS = 40;

const isRowError = (e: unknown): e is SyncError => e instanceof SyncError && e.status != null && ROW_ERROR_STATUSES.has(e.status);

async function recordFailure(db: StashDB, ref: Ref, e: SyncError): Promise<void> {
  const meta = await getMeta(db);
  const failures = { ...(meta.syncFailures ?? {}) };
  failures[baseKey(ref.name, ref.id)] = { table: ref.name, id: ref.id, message: e.message.slice(0, 160), at: Date.now() };
  await db.meta.update('main', { syncFailures: failures });
}

async function clearFailures(db: StashDB, keys: string[]): Promise<void> {
  const failures = (await getMeta(db)).syncFailures;
  if (!failures || !keys.some((k) => k in failures)) return;
  const next = { ...failures };
  for (const k of keys) delete next[k];
  await db.meta.update('main', { syncFailures: next });
}

/** Rows the server refused. They stay on the device and are listed in the UI; everything else keeps syncing. */
export async function getSyncFailures(db: StashDB = getDB()): Promise<SyncFailure[]> {
  return Object.values((await getMeta(db)).syncFailures ?? {});
}

/** Gives a row that lost a unique-name race a free "Name (n)"; its id (and so every link to it) is unchanged. */
async function renameForClash(db: StashDB, name: 'categories' | 'events', id: string): Promise<void> {
  const table = db[MAPPERS[name].local] as unknown as Dexie.Table<{ id: string; name: string; updatedAt: number }, string>;
  const row = await table.get(id);
  if (!row) return;
  const m = row.name.match(/^(.*) \((\d+)\)$/);
  const next = m ? `${m[1]} (${Number(m[2]) + 1})` : `${row.name} (2)`;
  await table.update(id, { name: next, updatedAt: Date.now() });
}

/**
 * Sends these rows in one `push_changes` call (one Postgres transaction). On a version conflict the
 * server rows are merged in field by field and the call is retried with the new versions. The batch is
 * stored as `meta.pendingPush` first, so if the response is lost the same mutation id is resent and the
 * server replays its stored result instead of applying it twice.
 */
async function pushBatch(db: StashDB, refs: Ref[]): Promise<number> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { payload, items } = await buildPayload(db, refs);
    if (!items.length) return 0;
    const id = crypto.randomUUID();
    await db.meta.update('main', { pendingPush: { id, payload } });
    let res: PushResult;
    try {
      res = await callPush(id, payload);
    } catch (e) {
      // a 4xx means the server rolled the batch back; offline / 5xx leave the outcome unknown, so keep it pending
      if (e instanceof SyncError && e.status != null && e.status < 500) await db.meta.update('main', { pendingPush: null });
      if (e instanceof SyncError && e.status === 409 && items.some((r) => isNameTable(r.name))) {
        // another device already holds one of these live names (unique index)
        if (items.length === 1) await renameForClash(db, items[0].name as 'categories' | 'events', items[0].id);
        else for (const r of items.filter((x) => isNameTable(x.name))) await pushRefs(db, [r]);
        continue;
      }
      throw e;
    }
    await db.meta.update('main', { pendingPush: null });
    if (res.status === 'ok') {
      await recordPushed(db, payload, res.versions);
      return items.length;
    }
    await applyRemote(db, res.conflicts as RemoteRows); // field-level merge, bases move to the server versions
  }
  throw new SyncError('Sync could not settle after repeated conflicts', 'server');
}

/**
 * `pushBatch`, but a batch the server rejects as bad data is halved until the offending row is found.
 * That row is quarantined (`meta.syncFailures`) and the rest of the batch goes through, so one invalid
 * row can no longer block a user's sync forever.
 */
async function pushRefs(db: StashDB, refs: Ref[], budget = { left: MAX_SPLIT_REQUESTS }): Promise<number> {
  try {
    return await pushBatch(db, refs);
  } catch (e) {
    if (!isRowError(e)) throw e;
    if (refs.length === 1) {
      await recordFailure(db, refs[0], e);
      return 0;
    }
    if (budget.left-- <= 0) throw e;
    const mid = refs.length >> 1;
    const a = await pushRefs(db, refs.slice(0, mid), budget);
    return a + (await pushRefs(db, refs.slice(mid), budget));
  }
}

/** Resends a batch whose outcome is unknown. Returns how many rows it covered. */
async function resendPending(db: StashDB): Promise<number> {
  const pending = (await getMeta(db)).pendingPush;
  if (!pending) return 0;
  let res: PushResult;
  try {
    res = await callPush(pending.id, pending.payload);
  } catch (e) {
    if (e instanceof SyncError && e.status != null && e.status < 500) await db.meta.update('main', { pendingPush: null });
    throw e;
  }
  await db.meta.update('main', { pendingPush: null });
  if (res.status !== 'ok') return 0; // the rows are still dirty; the normal path re-merges them
  await recordPushed(db, pending.payload, res.versions);
  return Object.values(pending.payload).reduce((n, rows) => n + rows.length, 0);
}

/** Quarantined rows are retried once per app session (and whenever they are edited again). */
const retriedFailures = new Set<string>();

/**
 * Finds every unsynced row. "Unsynced" = `localRev > meta.lastPushedRev`. `localRev` is a local counter that
 * only goes up (db/schema.ts `nextRev`), so a phone clock that moves backwards cannot hide an edit.
 * Rows written before localRev existed fall back to the old updatedAt cutoff, once.
 */
async function scanDirty(db: StashDB, cutoff: number): Promise<{ refs: Ref[]; maxRev: number }> {
  const meta = await getMeta(db);
  const sinceRev = meta.lastPushedRev ?? 0;
  const legacy = meta.lastPushedRev == null;
  const sinceAt = meta.lastPushedAt ?? 0;
  const refs: Ref[] = [];
  let maxRev = sinceRev;
  const seen = new Set<string>();
  // One read transaction over every table: a write that already took its rev has either committed
  // (and is seen) or is still running (and this read waits for it), so no lower rev can appear later.
  await db.transaction('r', [db.plans, db.cycles, db.cats, db.evts, db.transactions], async () => {
    for (const name of TABLE_ORDER) {
      const table = db[MAPPERS[name].local] as unknown as Dexie.Table<{ id: string; updatedAt: number; localRev?: number }, string>;
      const dirty = await table.where('localRev').above(sinceRev).toArray();
      if (legacy) dirty.push(...(await table.where('updatedAt').above(sinceAt).and((r) => r.localRev == null && r.updatedAt <= cutoff).toArray()));
      for (const r of dirty) {
        if (seen.has(baseKey(name, r.id))) continue;
        seen.add(baseKey(name, r.id));
        refs.push({ name, id: r.id });
        if (r.localRev != null && r.localRev > maxRev) maxRev = r.localRev;
      }
    }
  });
  return { refs, maxRev };
}

/** Changes on this device the server does not have yet (unsynced rows plus rows it refused). */
export async function countUnsynced(db: StashDB = getDB()): Promise<number> {
  const { refs } = await scanDirty(db, Date.now() - 1);
  const keys = new Set(refs.map((r) => baseKey(r.name, r.id)));
  for (const k of Object.keys((await getMeta(db)).syncFailures ?? {})) keys.add(k);
  // a dirty row identical to its server copy (e.g. just pulled) is not a real pending change
  let n = 0;
  for (const k of keys) {
    const [name, id] = k.split('/') as [TableName, string];
    if ((await buildPayload(db, [{ name, id }])).items.length) n++;
  }
  return n;
}

/** Pushes every unsynced row (tombstones included), parents first. */
export async function pushDirty(db: StashDB): Promise<number> {
  let sent = await resendPending(db);
  const meta = await getMeta(db);
  const cutoff = Date.now() - 1;
  const { refs, maxRev } = await scanDirty(db, cutoff);
  if (!retriedFailures.has(db.name)) {
    retriedFailures.add(db.name);
    const seen = new Set(refs.map((r) => baseKey(r.name, r.id)));
    for (const f of Object.values(meta.syncFailures ?? {})) {
      const name = f.table as TableName;
      if (!seen.has(baseKey(name, f.id))) refs.push({ name, id: f.id });
    }
  }
  for (let i = 0; i < refs.length; i += PUSH_CHUNK) sent += await pushRefs(db, refs.slice(i, i + PUSH_CHUNK));
  await db.meta.update('main', { lastPushedRev: maxRev, lastPushedAt: cutoff });
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
  // first page: plain `updated_at > cursor - overlap`; later pages: the exact (updated_at, id) keyset
  let filter = cursor ? `&updated_at=gt.${encodeURIComponent(new Date(Date.parse(cursor.ts) - PULL_OVERLAP_MS).toISOString())}` : '';
  for (;;) {
    const res = await authed(`${name}?select=*&order=updated_at.asc,id.asc&limit=${PAGE}${filter}`, { method: 'GET' });
    const rows = (await res.json()) as Remote[];
    if (rows.length) {
      const t = await applyRemote(db, { [name]: rows });
      t.forEach((id) => touched.add(id));
      const last = rows[rows.length - 1];
      const next = { ts: last.updated_at as string, id: last.id };
      // the overlap window re-reads old rows first; never let the stored cursor move backwards
      if (!cur || Date.parse(next.ts) > Date.parse(cur.ts) || (next.ts === cur.ts && next.id > cur.id)) cur = next;
      filter = `&or=(updated_at.gt.${encodeURIComponent(next.ts)},and(updated_at.eq.${encodeURIComponent(next.ts)},id.gt.${next.id}))`;
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
 * Applies server rows. A row we never edited is replaced; a row with local edits is merged field by
 * field against the last synced version (`mergeRows`), and what still differs from the server stays
 * dirty so the next push sends it. Cycle.currentDay merges as max(local, remote); touched cycles are
 * re-derived. Returns the touched cycle ids.
 */
export async function applyRemote(db: StashDB, rows: RemoteRows): Promise<Set<string>> {
  const touched = new Set<string>();
  const { recompute } = await import('@/db/queries');
  await db.transaction(
    'rw',
    [db.plans, db.cycles, db.transactions, db.cats, db.evts, db.dayRows, db.meta, db.syncBase],
    async () => {
      for (const name of TABLE_ORDER) {
        const list = rows[name];
        if (!list?.length) continue;
        const m = MAPPERS[name];
        const table = db[m.local] as unknown as Dexie.Table<Record<string, unknown> & { id: string; updatedAt: number }, string>;
        for (const r of list) {
          const key = baseKey(name, r.id);
          const version = r.version == null ? null : Number(r.version);
          const base = await db.syncBase.get(key);
          if (base && version != null && version <= base.version) continue; // already have this (our own push, or an old page)
          const local = await table.get(r.id);
          let next: Record<string, unknown> & { id: string; updatedAt: number; localRev?: number };
          if (!local) {
            next = m.toLocal(r) as never;
          } else {
            const merged = mergeRows(name, toRemoteRow(name, local), base?.row ?? null, r);
            const dirty = !sameFields(merged, r) || norm('deleted_at', merged.deleted_at) !== norm('deleted_at', r.deleted_at);
            next = m.toLocal({ ...r, ...merged } as Remote) as never;
            next.updatedAt = dirty ? Math.max(Date.now(), local.updatedAt) : Number(merged.client_updated_at);
            if (dirty) next.localRev = nextRev(); // still differs from the server: the next push sends it
            if (name === 'cycles') {
              const c = next as unknown as Cycle;
              c.pool = (local as unknown as Cycle).pool;
              c.fromSavingsTotal = (local as unknown as Cycle).fromSavingsTotal;
            }
          }
          // server state we already have is not a local edit: don't stamp it for push
          if (next.localRev != null) await table.put(next);
          else await withoutRevStamp(() => table.put(next));
          if (version != null) await db.syncBase.put({ key, version, row: r });
          if (name === 'cycles') touched.add(r.id);
          if (name === 'transactions') {
            const cid = (next as unknown as Txn).cycleId;
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

/** Only writes the profile when the currency differs from what the server was last told (it used to PATCH on every sync). */
async function pushProfile(db: StashDB): Promise<void> {
  const a = getAuth();
  if (!a.uid) return;
  const currency = getStoredCurrencyCode();
  if ((await getMeta(db)).profileCurrencyPushed === currency) return;
  await authed(`profiles?id=eq.${a.uid}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ currency }),
  });
  await db.meta.update('main', { profileCurrencyPushed: currency });
}

async function purgeTombstones(db: StashDB): Promise<void> {
  const meta = await getMeta(db);
  const limit = Date.now() - TOMBSTONE_TTL_MS;
  const failed = meta.syncFailures ?? {};
  const pushed = (r: { updatedAt: number; localRev?: number }) =>
    r.localRev != null ? r.localRev <= (meta.lastPushedRev ?? 0) : r.updatedAt <= (meta.lastPushedAt ?? 0);
  for (const name of TABLE_ORDER) {
    const table = db[MAPPERS[name].local] as unknown as Dexie.Table<{ id: string; updatedAt: number; localRev?: number; deletedAt?: number | null }, string>;
    // categories with baseId are "built-in category removed" markers: purging one would bring the built-in back
    const old = await table
      .filter((r) => r.deletedAt != null && r.deletedAt < limit && pushed(r) && !(baseKey(name, r.id) in failed) && !(name === 'categories' && (r as { baseId?: string | null }).baseId))
      .primaryKeys();
    await table.bulkDelete(old);
    await db.syncBase.bulkDelete(old.map((id) => baseKey(name, id)));
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
    if (!hasSyncConsent()) {
      reportSyncProgress('local_only');
      throw new SyncError('Privacy notice not accepted yet', 'auth');
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      reportSyncProgress('offline');
      throw new SyncError('You are offline', 'offline');
    }
    const db = getDB();
    reportSyncProgress('syncing');
    try {
      const pushed = await pushDirty(db);
      await pushProfile(db).catch(() => {});
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
