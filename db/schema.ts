import Dexie, { type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { migrateV4ToV5, migrateCatsToOverrides, migrateTxnLinks, migrateToDerivedPeriods } from './migrate';
import { V4_STORES } from './legacy';
import type { DefaultCategory } from '@/lib/categories';
import { setClosedThrough } from '@/lib/dates';

export interface UserRecord {
  /** Primary key: Base64-encoded username (e.g. "cmFodWw="). */
  userId: string;
  /** Normalized lowercase username (e.g. "rahul"). */
  username: string;
  displayName: string;
  avatarTheme: string;
  currency?: string;
  createdAt: number;
  lastSeenAt?: number;
  updatedAt: number;
}

export interface Meta {
  id: 'main';
  lastUsedLabel: string | null;
  schemaVersion: number;
  /** Last day the user closed with "Close the day" (yyyy-mm-dd, per device). The next day starts at once; see lib/dates `todayISO`. */
  closedThrough?: string | null;
  /** Active Base64 user ID on this device. */
  activeUserId?: string | null;
  /** Event currently being logged into. Every new spend is tagged with it until it ends. */
  activeEvent?: string | null;
  /** Last payment mode used, so the next spend defaults to it. */
  lastPayment?: string | null;
  /** Types the user pinned as quick chips on the log screen, as `Category::Type` keys (per device). */
  quickTypes?: string[];
  /** Result of the v4 -> v5 data migration (old vs derived pool, counts). */
  migrationReport?: unknown;
  /** Legacy dirty cutoff (client ms). Only used for rows written before `localRev` existed. */
  lastPushedAt?: number;
  /** Highest `localRev` already handed to the server. Rows with a larger `localRev` are unsynced. Never depends on the wall clock. */
  lastPushedRev?: number;
  /** Rows the server rejected (4xx). Kept out of the push batch so one bad row cannot wedge sync; retried on edit and once per session. */
  syncFailures?: Record<string, SyncFailure>;
  /** Per remote table keyset cursor for pulls. */
  pullCursors?: Record<string, { ts: string; id: string } | null>;
  /** Batch sent to `push_changes` whose outcome is unknown (offline / 5xx). Resent with the same id so the retry is idempotent. */
  pendingPush?: { id: string; payload: Record<string, Record<string, unknown>[]> } | null;
  /** Set by claim; the guest DB is deleted after the first successful sync. */
  guestClaimPending?: boolean;
  /** True once sample data was loaded; sample data is never claimed into an account. */
  sampleLoaded?: boolean;
  /** Set on a DB created from the legacy shared `stash` DB. */
  migratedFrom?: string | null;
  /** Latest device date accepted for closing days, plus a pending suspicious one (see `vetToday`). */
  calendarSeen?: { date: string; suspect?: { date: string; since: number } | null } | null;
  /** Currency last written to the server profile; the profile is only PATCHed when this differs. */
  profileCurrencyPushed?: string | null;
  /** Active display currency (e.g. 'INR', 'USD', 'EUR'). */
  currency?: string | null;
  /** Period ids whose month-end summary was dismissed on this device. */
  monthSummarySeen?: string[];
  /** Period ids whose leftover the user marked as moved to savings. */
  leftoverMoved?: string[];
}

export interface SyncFailure {
  table: string;
  id: string;
  message: string;
  at: number;
}

/* ---------- v5 tables (uuid ids, soft delete, derived day rows) ---------- */

/** Last server state of a synced row: the common ancestor for field-level merges and the OCC token. */
export interface SyncBase {
  /** `<remote table>/<row id>` */
  key: string;
  /** Server `version` this base was read at (sent back as `_base_version`). */
  version: number;
  /** The remote-shaped row as the server holds it. */
  row: Record<string, unknown>;
}

export interface Syncable {
  id: string;
  /** Client ms of the last local change (LWW + dirty tracking). */
  updatedAt: number;
  /** Tombstone ms; reads must ignore rows where this is set. */
  deletedAt?: number | null;
  /** Local-only monotonic revision stamped on every real change; decides what still needs pushing (see `nextRev`). */
  localRev?: number;
}

export interface Plan extends Syncable {
  income: number;
  bills: number;
  savings: number;
  /** Length of the period the plan was saved in (kept for the server column; the real length is derived, see lib/period.ts). */
  monthLength: number;
  /** Day of the month the money month starts on (1-31, clamped to short months). The newest plan's value is used. */
  periodStartDay?: number;
  /** yyyy-mm-dd this plan applies from. The earliest one is when budgeting started. */
  effectiveFrom?: string;
  currency?: string;
  billItems?: { name: string; amount: number }[];
  savingsItems?: { name: string; amount: number }[];
  createdAt: number;
}

export interface Txn extends Syncable {
  /** Calendar date yyyy-mm-dd; the day is derived via dayOfTxn. */
  txnDate: string;
  amount: number;
  /** Display snapshot of the category name; `categoryId` is the link (see `CategoryRow`/defaults). */
  type: string;
  /** Resolved category id: a default's key or a `cats` row id. Null only for legacy/unknown names. */
  categoryId: string | null;
  subtype: string | null;
  label: string;
  /** Display snapshot of the event name; `eventId` is the link. */
  event: string | null;
  /** `evts` row id. Null when untagged (or a legacy name-only event). */
  eventId: string | null;
  payment: string | null;
  note: string | null;
  fromSavings: boolean;
  adjustsPool: boolean;
  isEstimate: boolean;
  hour: number;
  createdAt: number;
}

/** Stored per-user row: a category the user created, or an override of a shared default (baseId). */
export interface CategoryRow extends Syncable {
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
  baseId: string | null;
  subAdded: string[];
  subRemoved: string[];
}

/** Resolved view (defaults + this user's changes) used by the UI. */
export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
  baseId: string | null;
}

/** A finished month's leftover the user moved to savings. `monthId` is the derived period id (`p:<start>:<days>`). */
export interface LeftoverSaving extends Syncable {
  monthId: string;
  amount: number;
  createdAt: number;
}

export interface StashEvent extends Syncable {
  name: string;
  note: string | null;
  categories: string[];
  createdAt: number;
}

/** UI view of a transaction with the day derived from its cycle (`day` 0 = outside the cycle). */
export interface Entry {
  id: string;
  cycleId: string;
  day: number;
  date: string;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  event: string | null;
  payment: string | null;
  note: string | null;
  fromSavings: boolean;
  adjustsPool: boolean;
  isEstimate: boolean;
  hour: number;
  createdAt: number;
}

export const PAYMENT_MODES = ['UPI', 'Card', 'Cash'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SCHEMA_VERSION = 12;

/* ---------- local revisions ----------
 * "What still needs pushing" must not depend on the phone's clock: a clock that moves backwards would
 * make new edits look older than the last push and they would be skipped silently. `nextRev` is a hybrid
 * counter, max(previous + 1, Date.now()), so it never goes down within a device even if the clock does.
 * It is re-seeded from the database on open (highest stored localRev / lastPushedRev). */
let lastRev = 0;
export function nextRev(): number {
  lastRev = Math.max(lastRev + 1, Date.now());
  return lastRev;
}
export function seedRev(n: number): void {
  if (n > lastRev) lastRev = n;
}

/** Tables whose rows sync; each gets `localRev` stamped by Dexie hooks. */
export const SYNCED_TABLES = ['plans', 'transactions', 'cats', 'evts', 'leftovers'] as const;
/** Fields that are local caches (written by recompute): changing only these is not a user edit. */
const CACHE_FIELDS = new Set(['localRev']);
let stampingOff = false;

/** Runs `fn` without stamping `localRev`: for writing server state we already have (applyRemote). */
export async function withoutRevStamp<T>(fn: () => Promise<T>): Promise<T> {
  stampingOff = true;
  try {
    return await fn();
  } finally {
    stampingOff = false;
  }
}

export class StashDB extends Dexie {
  users!: Table<UserRecord, string>;
  meta!: Table<Meta, string>;
  plans!: Table<Plan, string>;
  transactions!: Table<Txn, string>;
  cats!: Table<CategoryRow, string>;
  evts!: Table<StashEvent, string>;
  leftovers!: Table<LeftoverSaving, string>;
  syncBase!: Table<SyncBase, string>;

  constructor(name = dbNameFor(GUEST_UID)) {
    super(name);
    // Never edit a shipped version in place: add this.version(N+1) and bump SCHEMA_VERSION.
    // v1-v3 only exist in LegacyStashDB; v4 is declared so Dexie knows the installed schema.
    this.version(4).stores(V4_STORES);
    this.version(5)
      .stores({
        plans: 'id, updatedAt',
        cycles: 'id, startDate, updatedAt',
        transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, updatedAt',
        dayRows: '[cycleId+day], cycleId',
        cats: 'id, name, updatedAt',
        evts: 'id, name, updatedAt',
      })
      .upgrade((tx) => migrateV4ToV5(tx));
    // v6: the v4 tables are dropped; v5 data is rebuilt once more from them to catch late writes.
    this.version(6)
      .stores({
        plan: null,
        cycle: null,
        days: null,
        entries: null,
        categories: null,
        events: null,
      })
      .upgrade((tx) => migrateV4ToV5(tx));
    // v7: categories become shared defaults + per-user overrides (rows only for adds/removals).
    this.version(7)
      .stores({ cats: 'id, name, updatedAt, baseId' })
      .upgrade((tx) => migrateCatsToOverrides(tx));
    // v8: transactions link to categories/events by id (names stay as display snapshots).
    this.version(8)
      .stores({ transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, categoryId, eventId, updatedAt' })
      .upgrade((tx) => migrateTxnLinks(tx));
    // v9: per-row server version + last-synced snapshot (optimistic concurrency, field-level merge).
    this.version(9).stores({ syncBase: 'key' });
    // v10: monotonic localRev on every synced table decides what is unsynced (replaces the clock-based updatedAt cutoff).
    this.version(10).stores({
      plans: 'id, updatedAt, localRev',
      cycles: 'id, startDate, updatedAt, localRev',
      transactions: 'id, cycleId, txnDate, [cycleId+txnDate], type, event, categoryId, eventId, updatedAt, localRev',
      cats: 'id, name, updatedAt, baseId, localRev',
      evts: 'id, name, updatedAt, localRev',
    });
    // v11: months are derived from plans + transactions (lib/period.ts), so the stored `cycles` and `dayRows` tables
    // and the transactions' cycle index go. The upgrade still sees `cycles` and carries the first cycle's start over.
    this.version(11)
      .stores({
        cycles: null,
        dayRows: null,
        transactions: 'id, txnDate, type, event, categoryId, eventId, updatedAt, localRev',
      })
      .upgrade((tx) => migrateToDerivedPeriods(tx));
    // v12: leftovers moved to savings sync like everything else (one row per month).
    this.version(12).stores({ leftovers: 'id, monthId, updatedAt, localRev' });

    for (const name of SYNCED_TABLES) {
      const t = this.table(name) as Table<Record<string, unknown>, string>;
      t.hook('creating', (_key, obj) => {
        if (!stampingOff) obj.localRev = nextRev();
      });
      t.hook('updating', (mods) => {
        if (stampingOff) return undefined;
        return Object.keys(mods).some((k) => !CACHE_FIELDS.has(k)) ? { localRev: nextRev() } : undefined;
      });
    }
    this.on('ready', async (vip) => {
      const db = vip as StashDB;
      let max = (await db.meta.get('main'))?.lastPushedRev ?? 0;
      for (const name of SYNCED_TABLES) {
        const top = (await db.table(name).orderBy('localRev').last()) as { localRev?: number } | undefined;
        if (top?.localRev && top.localRev > max) max = top.localRev;
      }
      seedRev(max);
    });
  }
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: 'food', name: 'Food', subcategories: ['Chai & snacks', 'Breakfast', 'Lunch', 'Dinner', 'Delivery'] },
  { key: 'travel', name: 'Travel', subcategories: ['Auto', 'Metro', 'Cab', 'Fuel'] },
  { key: 'home', name: 'Home', subcategories: ['Groceries', 'Household'] },
  { key: 'bills', name: 'Bills', subcategories: ['Recharge', 'Subscriptions'] },
  { key: 'health', name: 'Health', subcategories: ['Medicine', 'Doctor'] },
  { key: 'shopping', name: 'Shopping', subcategories: ['Clothes', 'Gifts'] },
  { key: 'fun', name: 'Fun', subcategories: ['Movies', 'Outings'] },
  { key: 'other', name: 'Other', subcategories: [], isSystem: true },
];

export const GUEST_UID = 'default';
/** The throwaway database "explore with sample data" runs in (lib/sampleMode.ts). Never synced, never claimed. */
export const SAMPLE_UID = 'sample';

export function dbNameFor(uid: string): string {
  return `stash-${uid}`;
}

interface Active {
  db: StashDB;
  uid: string;
}
let active: Active | null = null;
let opening: Promise<StashDB> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Closes the current handle (if different) and opens `stash-<uid>`.
 * Subscribers (`useActiveUid`) are notified so live queries re-run.
 */
export async function openUserDB(uid: string): Promise<StashDB> {
  if (active && active.uid === uid) return active.db;
  // Serialise switches so quick login/logout never leaves two handles open.
  const prev = opening ?? Promise.resolve(null);
  const next = prev
    .catch(() => null)
    .then(async () => {
      if (active && active.uid === uid) return active.db;
      const old = active;
      const db = new StashDB(dbNameFor(uid));
      await db.open();
      active = { db, uid };
      setClosedThrough((await db.meta.get('main').catch(() => undefined))?.closedThrough);
      old?.db.close();
      notify();
      return db;
    });
  opening = next;
  return next;
}

/** Active DB. Lazily opens the guest DB so SSR/import and tests never see "no DB". */
export function getDB(): StashDB {
  if (!active) {
    active = { db: new StashDB(dbNameFor(GUEST_UID)), uid: GUEST_UID };
    void active.db.meta.get('main').then((m) => setClosedThrough(m?.closedThrough)).catch(() => {});
  }
  return active.db;
}

export function getActiveDBUid(): string {
  return active?.uid ?? GUEST_UID;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Changes whenever the active DB switches; add it to every live-query dependency list. */
export function useActiveUid(): string {
  return useSyncExternalStore(subscribe, getActiveDBUid, () => GUEST_UID);
}

export function useActiveDB(): { db: StashDB; uid: string } {
  const uid = useActiveUid();
  return { db: getDB(), uid };
}
