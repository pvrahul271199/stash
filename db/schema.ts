import Dexie, { type Table } from 'dexie';

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
  /** Active display currency (e.g. 'INR', 'USD', 'EUR'). */
  currency?: string | null;
}

export const PAYMENT_MODES = ['UPI', 'Card', 'Cash'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SCHEMA_VERSION = 4;

export class StashDB extends Dexie {
  users!: Table<UserRecord, string>;
  plan!: Table<Plan, number>;
  cycle!: Table<Cycle, number>;
  days!: Table<DayRow, [number, number]>;
  entries!: Table<Entry, string>;
  categories!: Table<Category, number>;
  events!: Table<StashEvent, number>;
  meta!: Table<Meta, string>;

  constructor(name = 'stash') {
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

/** Lazily created so importing this module on the server (static export) is safe. */
let _db: StashDB | null = null;
export function getDB(): StashDB {
  if (!_db) _db = new StashDB();
  return _db;
}
