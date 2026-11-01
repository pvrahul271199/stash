import Dexie, { type Table } from 'dexie';
import type { Meta, UserRecord } from './schema';

/** v1-v4 shapes, kept only to read old data (split, v4 -> v5 migration, tests). */
export interface LegacyPlan {
  id?: number;
  userId?: string;
  income: number;
  bills: number;
  savings: number;
  monthLength: number;
  currency?: string;
  billItems?: { name: string; amount: number }[];
  savingsItems?: { name: string; amount: number }[];
  createdAt: number;
}

export interface LegacyCycle {
  id?: number;
  userId?: string;
  startDate: string;
  totalDays: number;
  planAmount: number;
  currentDay: number;
  pool: number;
  fromSavingsTotal: number;
  leftoverMoved: boolean;
}

export interface LegacyDayRow {
  cycleId: number;
  day: number;
  userId?: string;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

export interface LegacyEntry {
  id: string;
  userId?: string;
  cycleId: number;
  day: number;
  date?: string;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  event?: string | null;
  payment?: string | null;
  note?: string | null;
  fromSavings: boolean;
  adjustsPool?: boolean;
  isEstimate: boolean;
  hour: number;
  createdAt: number;
}

export interface LegacyEvent {
  id?: number;
  userId?: string;
  name: string;
  note?: string | null;
  categories: string[];
  createdAt: number;
}

export interface LegacyCategory {
  id?: number;
  userId?: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
}

export const V4_STORES = {
  users: 'userId, username, updatedAt',
  plan: '++id, userId, createdAt',
  cycle: '++id, userId, startDate',
  days: '[cycleId+day], cycleId, userId',
  entries:
    'id, userId, cycleId, date, [cycleId+date], [userId+cycleId], [cycleId+day], [cycleId+createdAt], category, event, payment, createdAt',
  categories: '++id, userId, name, sortOrder',
  events: '++id, userId, name, createdAt',
  meta: 'id',
};

export class LegacyStashDB extends Dexie {
  users!: Table<UserRecord, string>;
  plan!: Table<LegacyPlan, number>;
  cycle!: Table<LegacyCycle, number>;
  days!: Table<LegacyDayRow, [number, number]>;
  entries!: Table<LegacyEntry, string>;
  categories!: Table<LegacyCategory, number>;
  events!: Table<LegacyEvent, number>;
  meta!: Table<Meta, string>;

  constructor(name: string) {
    super(name);
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
    this.version(4).stores(V4_STORES);
  }
}
