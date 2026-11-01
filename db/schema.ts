import Dexie, { type Table } from 'dexie';
import { useSyncExternalStore } from 'react';
import { migrateV4ToV5 } from './migrate';

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

export interface Plan {
  id?: number;
  /** Base64-encoded user ID owning this plan. */
  userId?: string;
  income: number;
  bills: number;
  savings: number;
  /** Days until next salary. */
  monthLength: number;
  currency?: string;
  /** Optional itemised bills, e.g. Rent, Health EMI. Sum equals `bills`. */
  billItems?: { name: string; amount: number }[];
  /** Optional itemised savings, e.g. SIP, RD. Sum equals `savings`. */
  savingsItems?: { name: string; amount: number }[];
  createdAt: number;
}

export interface Cycle {
  id?: number;
  /** Base64-encoded user ID owning this cycle. */
  userId?: string;
  /** ISO yyyy-mm-dd, local. */
  startDate: string;
  totalDays: number;
  planAmount: number;
  currentDay: number;
  pool: number;
  fromSavingsTotal: number;
  leftoverMoved: boolean;
}

export interface DayRow {
  cycleId: number;
  day: number;
  /** Base64-encoded user ID owning this closed day record. */
  userId?: string;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

export interface Entry {
  id: string;
  /** Base64-encoded user ID who logged this spend transaction. */
  userId?: string;
  cycleId: number;
  day: number;
  /** Exact calendar ISO date (yyyy-mm-dd) this transaction belongs to. */
  date?: string;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  /** Optional event name this spend is tagged with (e.g. "Goa trip", "Diwali"). */
  event?: string | null;
  /** How it was paid: 'UPI' | 'Card' | 'Cash' (free text kept for future modes). */
  payment?: string | null;
  /** Optional short note for this spend. */
  note?: string | null;
  fromSavings: boolean;
  /** For past-day spends: whether this spend adjusted the remaining cycle pool (defaults to true). */
  adjustsPool?: boolean;
  isEstimate: boolean;
  /** 0-23, device clock when logged. */
  hour: number;
  createdAt: number;
}

export interface StashEvent {
  id?: number;
  /** Base64-encoded user ID owning this event. */
  userId?: string;
  /** Event title / text provided by user (e.g. "Goa trip", "Birthday party"). */
  name: string;
  /** Optional descriptive text / note for the event. */
  note?: string | null;
  /** Categories tagged under this event as sub-categories. */
  categories: string[];
  createdAt: number;
}

export interface Category {
  id?: number;
  /** Base64-encoded user ID owning this category. */
  userId?: string;
  name: string;
  sortOrder: number;
  /** Only "Other". */
  isSystem: boolean;
  subcategories: string[];
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
  /** True once sample data was loaded; sample data is never claimed into an account. */
  sampleLoaded?: boolean;
  /** Set on a DB created from the legacy shared `stash` DB. */
  migratedFrom?: string | null;
  /** Active display currency (e.g. 'INR', 'USD', 'EUR'). */
  currency?: string | null;
}

/* ---------- v5 tables (uuid ids, soft delete, derived day rows) ---------- */

export interface Syncable {
  id: string;
  /** Client ms of the last local change (LWW + dirty tracking). */
  updatedAt: number;
  /** Tombstone ms; reads must ignore rows where this is set. */
  deletedAt?: number | null;
}

export interface PlanV5 extends Syncable {
  income: number;
  bills: number;
  savings: number;
  monthLength: number;
  currency?: string;
  billItems?: { name: string; amount: number }[];
  savingsItems?: { name: string; amount: number }[];
  createdAt: number;
}

export interface CycleV5 extends Syncable {
  startDate: string;
  totalDays: number;
  planAmount: number;
  /** Cursor: first unclosed day. */
  currentDay: number;
  /** Cache written by recompute. */
  pool: number;
  /** Cache written by recompute. */
  fromSavingsTotal: number;
  leftoverMoved: boolean;
  /** Closed days that were back-filled with a rough total. */
  estimatedDays: number[];
}

export interface Txn extends Syncable {
  cycleId: string | null;
  /** Calendar date yyyy-mm-dd; the day is derived via dayOfTxn. */
  txnDate: string;
  amount: number;
  type: string;
  subtype: string | null;
  label: string;
  event: string | null;
  payment: string | null;
  note: string | null;
  fromSavings: boolean;
  adjustsPool: boolean;
  isEstimate: boolean;
  hour: number;
  createdAt: number;
}

/** Derived from transactions by recompute; never synced. */
export interface DayRowV5 {
  cycleId: string;
  day: number;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

export interface CategoryV5 extends Syncable {
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
}

export interface EventV5 extends Syncable {
  name: string;
  note: string | null;
  categories: string[];
  createdAt: number;
}

export const PAYMENT_MODES = ['UPI', 'Card', 'Cash'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SCHEMA_VERSION = 5;

export class StashDB extends Dexie {
  users!: Table<UserRecord, string>;
  plan!: Table<Plan, number>;
  cycle!: Table<Cycle, number>;
  days!: Table<DayRow, [number, number]>;
  entries!: Table<Entry, string>;
  categories!: Table<Category, number>;
  events!: Table<StashEvent, number>;
  meta!: Table<Meta, string>;
  // v5
  plans!: Table<PlanV5, string>;
  cycles!: Table<CycleV5, string>;
  transactions!: Table<Txn, string>;
  dayRows!: Table<DayRowV5, [string, number]>;
  cats!: Table<CategoryV5, string>;
  evts!: Table<EventV5, string>;

  constructor(name = dbNameFor(GUEST_UID)) {
    super(name);
    // v1. When the schema changes, add `this.version(N).stores({...}).upgrade(...)`
    // and bump SCHEMA_VERSION. Never edit a shipped version in place.
    this.version(1).stores({
      plan: '++id',
      cycle: '++id',
      days: '[cycleId+day], cycleId',
      entries: 'id, cycleId, [cycleId+day], category, createdAt',
      categories: '++id, name, sortOrder',
      meta: 'id',
    });
    this.version(2).stores({
      plan: '++id',
      cycle: '++id',
      days: '[cycleId+day], cycleId',
      entries: 'id, cycleId, [cycleId+day], category, event, createdAt',
      categories: '++id, name, sortOrder',
      events: '++id, name, createdAt',
      meta: 'id',
    });
    this.version(3).stores({
      plan: '++id, createdAt',
      cycle: '++id, startDate',
      days: '[cycleId+day], cycleId',
      entries: 'id, cycleId, [cycleId+day], [cycleId+createdAt], category, event, payment, createdAt',
      categories: '++id, name, sortOrder',
      events: '++id, name, createdAt',
      meta: 'id',
    });
    this.version(4).stores({
      users: 'userId, username, updatedAt',
      plan: '++id, userId, createdAt',
      cycle: '++id, userId, startDate',
      days: '[cycleId+day], cycleId, userId',
      entries:
        'id, userId, cycleId, date, [cycleId+date], [userId+cycleId], [cycleId+day], [cycleId+createdAt], category, event, payment, createdAt',
      categories: '++id, userId, name, sortOrder',
      events: '++id, userId, name, createdAt',
      meta: 'id',
    });
    // v5 is additive: the v4 tables stay until the queries move over (v6).
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
  }
}

export const DEFAULT_CATEGORIES: { name: string; subcategories: string[] }[] = [
  { name: 'Food', subcategories: ['Chai & snacks', 'Breakfast', 'Lunch', 'Dinner', 'Delivery'] },
  { name: 'Travel', subcategories: ['Auto', 'Metro', 'Cab', 'Fuel'] },
  { name: 'Home', subcategories: ['Groceries', 'Household'] },
  { name: 'Bills', subcategories: ['Recharge', 'Subscriptions'] },
  { name: 'Health', subcategories: ['Medicine', 'Doctor'] },
  { name: 'Shopping', subcategories: ['Clothes', 'Gifts'] },
  { name: 'Fun', subcategories: ['Movies', 'Outings'] },
  { name: 'Other', subcategories: [] },
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
