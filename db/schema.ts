import Dexie, { type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { migrateV4ToV5, migrateCatsToOverrides, migrateTxnLinks } from './migrate';
import { V4_STORES } from './legacy';
import type { DefaultCategory } from '@/lib/categories';

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
  /** Active Base64 user ID on this device. */
  activeUserId?: string | null;
  /** Event currently being logged into. Every new spend is tagged with it until it ends. */
  activeEvent?: string | null;
  /** Last payment mode used, so the next spend defaults to it. */
  lastPayment?: string | null;
  /** Result of the v4 -> v5 data migration (old vs derived pool, counts). */
  migrationReport?: unknown;
  /** Last local updatedAt cutoff successfully pushed. */
  lastPushedAt?: number;
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
  /** Active display currency (e.g. 'INR', 'USD', 'EUR'). */
  currency?: string | null;
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
}

export interface Plan extends Syncable {
  income: number;
  bills: number;
  savings: number;
  monthLength: number;
  currency?: string;
  billItems?: { name: string; amount: number }[];
  savingsItems?: { name: string; amount: number }[];
  createdAt: number;
}

export interface Cycle extends Syncable {
  startDate: string;
  totalDays: number;
  planAmount: number;
  /** Cursor: first unclosed day. */
  currentDay: number;
  /** Cache written by recompute. */
  pool: number;
  /** Cache written by recompute. */
  fromSavingsTotal: number;
  /** CALC_VERSION the pool/fromSavingsTotal/dayRows caches were built with (local only, not synced). */
  calcVersion?: number;
  leftoverMoved: boolean;
  /** Closed days that were back-filled with a rough total. */
  estimatedDays: number[];
}

export interface Txn extends Syncable {
  cycleId: string | null;
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

/** Derived from transactions by recompute; never synced. */
export interface DayRow {
  cycleId: string;
  day: number;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
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

export const SCHEMA_VERSION = 9;

export class StashDB extends Dexie {
  users!: Table<UserRecord, string>;
  meta!: Table<Meta, string>;
  plans!: Table<Plan, string>;
  cycles!: Table<Cycle, string>;
  transactions!: Table<Txn, string>;
  dayRows!: Table<DayRow, [string, number]>;
  cats!: Table<CategoryRow, string>;
  evts!: Table<StashEvent, string>;
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
