export interface Plan {
  id?: number;
  income: number;
  bills: number;
  savings: number;
  monthLength: number;
  createdAt: number;
}

export interface Cycle {
  id?: number;
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
  hour: number;
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  subcategories: string[];
}

export interface Meta {
  id: 'main';
  lastUsedLabel: string | null;
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;

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
