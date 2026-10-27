'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_CATEGORIES, SCHEMA_VERSION, getDB, type Cycle, type Entry, type Plan } from './schema';
import { initialCycleState, moneyToLiveOn, type PlanInput } from '@/lib/budget';
import { resolveLabel } from '@/lib/suggestions';
import { todayISO } from '@/lib/dates';

/* ---------- reads ---------- */

export interface Snapshot {
  plan: Plan | undefined;
  cycle: Cycle | undefined;
}

/** `undefined` while loading, then always an object (maybe with empty fields). */
export function useSnapshot(): Snapshot | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [plan, cycle] = await Promise.all([db.plan.orderBy('id').last(), db.cycle.orderBy('id').last()]);
    return { plan, cycle };
  }, []);
}

export function useDayEntries(cycleId: number | undefined, day: number | undefined): Entry[] | undefined {
  return useLiveQuery(async () => {
    if (cycleId == null || day == null) return [];
    const rows = await getDB().entries.where('[cycleId+day]').equals([cycleId, day]).toArray();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [cycleId, day]);
}

export function useDayRows(cycleId: number | undefined) {
  return useLiveQuery(async () => (cycleId == null ? [] : getDB().days.where('cycleId').equals(cycleId).toArray()), [cycleId]);
}

export function useLastUsedLabel(): string | null {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.lastUsedLabel ?? null, [], null) ?? null;
}

/* ---------- writes ---------- */

export async function ensureSeed(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.categories, db.meta, async () => {
    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd(
        DEFAULT_CATEGORIES.map((c, i) => ({
          name: c.name,
          sortOrder: i,
          isSystem: c.name === 'Other',
          subcategories: c.subcategories,
        })),
      );
    }
    if (!(await db.meta.get('main'))) {
      await db.meta.put({ id: 'main', lastUsedLabel: null, schemaVersion: SCHEMA_VERSION });
    }
  });
}

/** Saves the plan and starts a new cycle today. */
export async function createPlanAndCycle(p: PlanInput, startDate: string = todayISO()): Promise<void> {
  const db = getDB();
  const s = initialCycleState(p);
  await db.transaction('rw', db.plan, db.cycle, async () => {
    await db.plan.add({ ...p, createdAt: Date.now() });
    await db.cycle.add({
      startDate,
      totalDays: s.totalDays,
      planAmount: moneyToLiveOn(p),
      currentDay: s.currentDay,
      pool: s.pool,
      fromSavingsTotal: 0,
      leftoverMoved: false,
    });
  });
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
}

export interface NewSpend {
  amount: number;
  label: string;
  category?: string;
  subcategory?: string | null;
  fromSavings?: boolean;
}

/** Logs a spend on the cycle's current day. Spends after closing land on the next day. */
export async function addSpend(cycle: Cycle, spend: NewSpend, now: Date = new Date()): Promise<Entry> {
  const db = getDB();
  const cats = await db.categories.toArray();
  const resolved =
    spend.category != null
      ? { category: spend.category, subcategory: spend.subcategory ?? null }
      : spend.label === 'Sort later'
        ? { category: 'Other', subcategory: null }
        : resolveLabel(spend.label, cats);
  const entry: Entry = {
    id: crypto.randomUUID(),
    cycleId: cycle.id!,
    day: cycle.currentDay,
    amount: Math.round(spend.amount),
    label: spend.label,
    category: resolved.category,
    subcategory: resolved.subcategory,
    fromSavings: !!spend.fromSavings,
    isEstimate: false,
    hour: now.getHours(),
    createdAt: now.getTime(),
  };
  await db.transaction('rw', db.entries, db.meta, db.cycle, async () => {
    await db.entries.add(entry);
    await db.meta.update('main', { lastUsedLabel: spend.label });
    if (entry.fromSavings) {
      await db.cycle.update(cycle.id!, { fromSavingsTotal: cycle.fromSavingsTotal + entry.amount });
    }
  });
  return entry;
}
