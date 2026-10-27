import Dexie, { type Table } from 'dexie';

export interface Plan {
  id?: number;
  income: number;
  bills: number;
  savings: number;
  /** Days until next salary. */
  monthLength: number;
  createdAt: number;
}

export interface Cycle {
  id?: number;
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
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

export interface Entry {
  id: string;
  cycleId: number;
  day: number;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  fromSavings: boolean;
  isEstimate: boolean;
  /** 0-23, device clock when logged. */
  hour: number;
  createdAt: number;
}

export interface Category {
  id?: number;
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
}

export const SCHEMA_VERSION = 1;

export class StashDB extends Dexie {
  plan!: Table<Plan, number>;
  cycle!: Table<Cycle, number>;
  days!: Table<DayRow, [number, number]>;
  entries!: Table<Entry, string>;
  categories!: Table<Category, number>;
  meta!: Table<Meta, string>;

  constructor(name = 'stash') {
    super(name);
    // v1. When the schema changes, add `this.version(2).stores({...}).upgrade(...)`
    // and bump SCHEMA_VERSION. Never edit a shipped version in place.
    this.version(1).stores({
      plan: '++id',
      cycle: '++id',
      days: '[cycleId+day], cycleId',
      entries: 'id, cycleId, [cycleId+day], category, createdAt',
      categories: '++id, name, sortOrder',
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
