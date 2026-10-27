'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DEFAULT_CATEGORIES,
  SCHEMA_VERSION,
  getDB,
  type Category,
  type Cycle,
  type Entry,
  type Plan,
  type StashEvent,
} from './schema';
import {
  catchUp,
  closeDay,
  initialCycleState,
  isPlanValid,
  moneyToLiveOn,
  onPlanTotal,
  planSync,
  spentToday,
  type CloseResult,
  type DayInfo,
  type PlanInput,
} from '@/lib/budget';
import { resolveLabel } from '@/lib/suggestions';
import { addDays, calendarDay, dateOfDay, todayISO } from '@/lib/dates';
import { DEFAULT_SAMPLE_PLAN, SAMPLE_DAYS, generateSampleSpends } from '@/lib/sample';
import { buildCSV, type CsvRow } from '@/lib/csv';
import { validateName } from '@/lib/categories';
import {
  clearRemoteWorkspace,
  deleteRemoteCategory,
  deleteRemoteEntry,
  deleteRemoteEvent,
  scheduleSync,
} from '@/lib/sync';

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

export function useCycleEntries(cycleId: number | undefined): Entry[] | undefined {
  return useLiveQuery(
    async () => (cycleId == null ? [] : getDB().entries.where('cycleId').equals(cycleId).toArray()),
    [cycleId],
  );
}

export function useDayRows(cycleId: number | undefined) {
  return useLiveQuery(async () => (cycleId == null ? [] : getDB().days.where('cycleId').equals(cycleId).toArray()), [cycleId]);
}

export function useLastUsedLabel(): string | null {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.lastUsedLabel ?? null, [], null) ?? null;
}

/** Last payment mode used (defaults to UPI). */
export function useLastPayment(): string {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.lastPayment ?? 'UPI', [], 'UPI') ?? 'UPI';
}

/** Every cycle, newest first. */
export function useAllCycles(): Cycle[] | undefined {
  return useLiveQuery(async () => (await getDB().cycle.orderBy('id').toArray()).reverse(), []);
}

/** Every spend across all cycles (loaded on demand when searching History). */
export function useAllEntries(enabled = true): Entry[] | undefined {
  return useLiveQuery(async () => (enabled ? getDB().entries.toArray() : []), [enabled]);
}

/** Event currently being logged into (or null). */
export function useActiveEvent(): string | null {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.activeEvent ?? null, [], null) ?? null;
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => (await getDB().categories.orderBy('sortOrder').toArray()), []);
}

export function useEvents(): StashEvent[] | undefined {
  return useLiveQuery(async () => getDB().events.orderBy('createdAt').reverse().toArray(), []);
}

/** category name -> number of spends */
export function useCategoryCounts(): Record<string, number> {
  return (
    useLiveQuery(async () => {
      const counts: Record<string, number> = {};
      await getDB().entries.each((e) => {
        counts[e.category] = (counts[e.category] ?? 0) + 1;
      });
      return counts;
    }, []) ?? {}
  );
}

/** event name -> number of spends */
export function useEventCounts(): Record<string, number> {
  return (
    useLiveQuery(async () => {
      const counts: Record<string, number> = {};
      await getDB().entries.each((e) => {
        const ev = e.event?.trim();
        if (ev) counts[ev] = (counts[ev] ?? 0) + 1;
      });
      return counts;
    }, []) ?? {}
  );
}

/* ---------- setup ---------- */

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

async function persistStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
}

async function startCycle(p: PlanInput, startDate: string, addPlan: boolean): Promise<void> {
  const db = getDB();
  const s = initialCycleState(p);
  await db.transaction('rw', db.plan, db.cycle, async () => {
    if (addPlan) await db.plan.add({ ...p, createdAt: Date.now() });
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
}

/** Saves the plan and starts a new cycle today. Also used by "Change my plan". */
export async function createPlanAndCycle(p: PlanInput, startDate: string = todayISO()): Promise<void> {
  await startCycle(p, startDate, true);
  await persistStorage();
  scheduleSync();
}

/** New cycle starting today with the same plan. */
export async function startNextMonth(): Promise<void> {
  const plan = await getDB().plan.orderBy('id').last();
  if (!plan) return;
  await startCycle(plan, todayISO(), false);
  scheduleSync();
}

/* ---------- spends ---------- */

export interface NewSpend {
  amount: number;
  label: string;
  category?: string;
  subcategory?: string | null;
  event?: string | null;
  /** 'UPI' | 'Card' | 'Cash'. */
  payment?: string | null;
  /** Optional short note for this spend. */
  note?: string | null;
  fromSavings?: boolean;
}

export interface SpendUpdate {
  amount?: number;
  label?: string;
  category?: string;
  subcategory?: string | null;
  event?: string | null;
  payment?: string | null;
  note?: string | null;
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
  const activeEvent = spend.event === undefined ? ((await db.meta.get('main'))?.activeEvent ?? null) : spend.event;
  const entry: Entry = {
    id: crypto.randomUUID(),
    cycleId: cycle.id!,
    day: cycle.currentDay,
    amount: Math.round(spend.amount),
    label: spend.label,
    category: resolved.category,
    subcategory: resolved.subcategory,
    event: activeEvent?.trim() || null,
    payment: spend.payment?.trim() || null,
    note: spend.note?.trim() || null,
    fromSavings: !!spend.fromSavings,
    isEstimate: false,
    hour: now.getHours(),
    createdAt: now.getTime(),
  };
  await db.transaction('rw', db.entries, db.meta, db.cycle, async () => {
    await db.entries.add(entry);
    await db.meta.update('main', {
      lastUsedLabel: spend.label,
      ...(entry.payment ? { lastPayment: entry.payment } : {}),
    });
    if (entry.fromSavings) {
      const c = await db.cycle.get(cycle.id!);
      if (c) await db.cycle.update(c.id!, { fromSavingsTotal: c.fromSavingsTotal + entry.amount });
    }
  });
  scheduleSync();
  return entry;
}

/**
 * Updates an existing spend (from Today or History calendar) and keeps the cycle's
 * rolling pool, fromSavingsTotal, and closed day record in sync.
 */
export async function updateEntry(id: string, patch: SpendUpdate): Promise<Entry | null> {
  const db = getDB();
  let updated: Entry | null = null;
  await db.transaction('rw', db.entries, db.cycle, db.days, async () => {
    const prev = await db.entries.get(id);
    if (!prev) return;
    const nextAmount = patch.amount != null ? Math.max(1, Math.round(patch.amount)) : prev.amount;
    const nextFromSavings = patch.fromSavings != null ? patch.fromSavings : prev.fromSavings;
    const next: Entry = {
      ...prev,
      amount: nextAmount,
      label: patch.label != null ? patch.label.trim() || prev.label : prev.label,
      category: patch.category != null ? patch.category : prev.category,
      subcategory: patch.subcategory !== undefined ? patch.subcategory : prev.subcategory,
      event: patch.event !== undefined ? patch.event?.trim() || null : prev.event,
      payment: patch.payment !== undefined ? patch.payment?.trim() || null : prev.payment,
      note: patch.note !== undefined ? patch.note?.trim() || null : prev.note,
      fromSavings: nextFromSavings,
    };
    await db.entries.put(next);
    updated = next;

    const oldPoolSpend = prev.fromSavings ? 0 : prev.amount;
    const newPoolSpend = next.fromSavings ? 0 : next.amount;
    const poolDiff = newPoolSpend - oldPoolSpend; // positive = spent more from pool

    const oldSav = prev.fromSavings ? prev.amount : 0;
    const newSav = next.fromSavings ? next.amount : 0;
    const savDiff = newSav - oldSav;

    if (poolDiff !== 0 || savDiff !== 0) {
      const c = await db.cycle.get(prev.cycleId);
      const dayRow = await db.days.get([prev.cycleId, prev.day]);
      if (dayRow && poolDiff !== 0) {
        await db.days.put({
          ...dayRow,
          spent: Math.max(0, dayRow.spent + poolDiff),
        });
      }
      if (c) {
        await db.cycle.update(c.id!, {
          // If the day was already closed, its spend was already deducted from c.pool, so adjust c.pool
          pool: dayRow ? Math.max(0, c.pool - poolDiff) : c.pool,
          fromSavingsTotal: Math.max(0, c.fromSavingsTotal + savDiff),
        });
      }
    }
  });
  if (updated) scheduleSync();
  return updated;
}

export async function removeEntry(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.entries, db.cycle, db.days, async () => {
    const e = await db.entries.get(id);
    if (!e) return;
    await db.entries.delete(id);
    const c = await db.cycle.get(e.cycleId);
    const dayRow = await db.days.get([e.cycleId, e.day]);
    if (e.fromSavings) {
      if (c) await db.cycle.update(c.id!, { fromSavingsTotal: Math.max(c.fromSavingsTotal - e.amount, 0) });
    } else if (dayRow) {
      // Removing a spend from an already-closed day refunds that amount back to the day & pool
      await db.days.put({ ...dayRow, spent: Math.max(0, dayRow.spent - e.amount) });
      if (c) await db.cycle.update(c.id!, { pool: c.pool + e.amount });
    }
  });
  void deleteRemoteEntry(id);
  scheduleSync();
}

/* ---------- closing days ---------- */

export async function closeCurrentDay(cycleId: number): Promise<CloseResult | null> {
  const db = getDB();
  const res = await db.transaction('rw', db.cycle, db.entries, db.days, async () => {
    const c = await db.cycle.get(cycleId);
    if (!c || c.currentDay > c.totalDays) return null;
    const entries = await db.entries.where('[cycleId+day]').equals([cycleId, c.currentDay]).toArray();
    const r = closeDay(c, spentToday(entries));
    await db.days.put({ cycleId, ...r.record });
    await db.cycle.update(cycleId, { currentDay: r.state.currentDay, pool: r.state.pool });
    return r;
  });
  if (res) scheduleSync();
  return res;
}

export interface PendingCatchUp {
  cycleId: number;
  gap: { from: number; to: number };
  onPlan: number;
  startDate: string;
}

/** Runs on load and whenever the app becomes visible again. */
export async function syncCalendar(today: string = todayISO()): Promise<PendingCatchUp | null> {
  const db = getDB();
  return db.transaction('rw', db.cycle, db.entries, db.days, async () => {
    const c = await db.cycle.orderBy('id').last();
    if (!c || c.currentDay > c.totalDays) return null;
    const cal = calendarDay(c.startDate, today, c.totalDays);
    if (c.currentDay >= cal) return null;
    const all = await db.entries.where('cycleId').equals(c.id!).toArray();
    const byDay = new Map<number, DayInfo>();
    for (const e of all) {
      const d = byDay.get(e.day) ?? { hasEntries: false, spent: 0 };
      d.hasEntries = true;
      if (!e.fromSavings) d.spent += e.amount;
      byDay.set(e.day, d);
    }
    const plan = planSync(c, cal, (day) => byDay.get(day) ?? { hasEntries: false, spent: 0 });
    if (plan.closes.length) {
      await db.days.bulkPut(plan.closes.map((r) => ({ cycleId: c.id!, ...r })));
      await db.cycle.update(c.id!, { currentDay: plan.state.currentDay, pool: plan.state.pool });
    }
    if (!plan.gap) return null;
    return { cycleId: c.id!, gap: plan.gap, onPlan: onPlanTotal(plan.state, plan.gap), startDate: c.startDate };
  });
}

export async function applyCatchUp(cycleId: number, total: number, gap: { from: number; to: number }, now = new Date()) {
  const db = getDB();
  await db.transaction('rw', db.cycle, db.entries, db.days, async () => {
    const c = await db.cycle.get(cycleId);
    if (!c || c.currentDay !== gap.from) return;
    const r = catchUp(c, total, gap);
    await db.days.bulkPut(r.days.map((d) => ({ cycleId, ...d })));
    await db.entries.bulkAdd(
      r.entries.map((e) => ({
        id: crypto.randomUUID(),
        cycleId,
        day: e.day,
        amount: e.amount,
        label: 'Rough total',
        category: 'Other',
        subcategory: null,
        fromSavings: false,
        isEstimate: true,
        hour: 12,
        createdAt: now.getTime(),
      })),
    );
    await db.cycle.update(cycleId, { currentDay: r.state.currentDay, pool: r.state.pool });
  });
  scheduleSync();
}

export async function moveLeftoverToSavings(cycleId: number): Promise<void> {
  const db = getDB();
  const c = await db.cycle.get(cycleId);
  if (c && !c.leftoverMoved) {
    await db.cycle.update(cycleId, { leftoverMoved: true });
    scheduleSync();
  }
}

/* ---------- categories ---------- */

async function reindexCategories() {
  const db = getDB();
  const all = await db.categories.toArray();
  all.sort((a, b) => Number(a.isSystem) - Number(b.isSystem) || a.sortOrder - b.sortOrder);
  await Promise.all(all.map((c, i) => db.categories.update(c.id!, { sortOrder: i })));
}

export async function addCategory(name: string): Promise<string | null> {
  const db = getDB();
  const all = await db.categories.toArray();
  const err = validateName(name, all.map((c) => c.name));
  if (err) return err;
  await db.categories.add({ name: name.trim(), sortOrder: all.length, isSystem: false, subcategories: [] });
  await reindexCategories();
  scheduleSync();
  return null;
}

export async function addSubcategory(catId: number, name: string): Promise<string | null> {
  const db = getDB();
  const c = await db.categories.get(catId);
  if (!c) return 'That category is gone.';
  const err = validateName(name, c.subcategories);
  if (err) return err;
  await db.categories.update(catId, { subcategories: [...c.subcategories, name.trim()] });
  scheduleSync();
  return null;
}

/** Spends keep their category and lose only the type. */
export async function removeSubcategory(catId: number, name: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.categories, db.entries, async () => {
    const c = await db.categories.get(catId);
    if (!c) return;
    await db.categories.update(catId, { subcategories: c.subcategories.filter((s) => s !== name) });
    await db.entries.where('category').equals(c.name).filter((e) => e.subcategory === name).modify({ subcategory: null });
  });
  scheduleSync();
}

/** Spends move to Other. "Other" itself can't be removed. */
export async function removeCategory(catId: number): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.categories, db.entries, db.events, async () => {
    const c = await db.categories.get(catId);
    if (!c || c.isSystem) return;
    await db.entries.where('category').equals(c.name).modify({ category: 'Other', subcategory: null });
    const events = await db.events.toArray();
    for (const ev of events) {
      if (ev.categories.includes(c.name)) {
        await db.events.update(ev.id!, { categories: ev.categories.filter((x) => x !== c.name) });
      }
    }
    await db.categories.delete(catId);
  });
  await reindexCategories();
  void deleteRemoteCategory(catId);
  scheduleSync();
}

/* ---------- events (with categories as sub-items) ---------- */

export async function addEvent(name: string, categories: string[] = [], note?: string | null): Promise<string | null> {
  const db = getDB();
  const all = await db.events.toArray();
  const err = validateName(name, all.map((e) => e.name));
  if (err) return err;
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await db.events.add({
    name: name.trim(),
    note: note?.trim() || null,
    categories: uniqueCats,
    createdAt: Date.now(),
  });
  scheduleSync();
  return null;
}

export async function toggleEventCategory(eventId: number, categoryName: string): Promise<void> {
  const db = getDB();
  const ev = await db.events.get(eventId);
  if (!ev) return;
  const exists = ev.categories.includes(categoryName);
  const next = exists ? ev.categories.filter((c) => c !== categoryName) : [...ev.categories, categoryName];
  await db.events.update(eventId, { categories: next });
  scheduleSync();
}

export async function updateEventNote(eventId: number, note: string): Promise<void> {
  const db = getDB();
  const ev = await db.events.get(eventId);
  if (!ev) return;
  await db.events.update(eventId, { note: note.trim() || null });
  scheduleSync();
}

/** Spends keep their category/amount and only clear the event tag. */
export async function removeEvent(eventId: number): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.events, db.entries, db.meta, async () => {
    const ev = await db.events.get(eventId);
    if (!ev) return;
    await db.entries.where('event').equals(ev.name).modify({ event: null });
    await db.events.delete(eventId);
    const meta = await db.meta.get('main');
    if (meta?.activeEvent === ev.name) await db.meta.update('main', { activeEvent: null });
  });
  void deleteRemoteEvent(eventId);
  scheduleSync();
}

/**
 * Starts logging into an event. Creates it if it doesn't exist yet (case-insensitive match
 * reuses the existing one). Every spend logged afterwards is tagged until `endEvent()`.
 */
export async function startEvent(name: string, note?: string | null): Promise<string | null> {
  const db = getDB();
  const trimmed = name.trim();
  const existing = (await db.events.toArray()).find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  let eventName = existing?.name;
  if (!existing) {
    const err = await addEvent(trimmed, [], note);
    if (err) return err;
    eventName = trimmed;
  }
  await ensureSeed();
  await db.meta.update('main', { activeEvent: eventName });
  return null;
}

export async function endEvent(): Promise<void> {
  await getDB().meta.update('main', { activeEvent: null });
}

/* ---------- sample data ---------- */

export async function fillSample(now: Date = new Date()): Promise<void> {
  await ensureSeed();
  const db = getDB();
  let plan: PlanInput | undefined = await db.plan.orderBy('id').last();
  let addPlan = false;
  if (!plan || !isPlanValid(plan) || plan.monthLength <= SAMPLE_DAYS) {
    plan = DEFAULT_SAMPLE_PLAN;
    addPlan = true;
  }
  const today = todayISO(now);
  const startDate = addDays(today, -SAMPLE_DAYS);
  const spends = generateSampleSpends(startDate, SAMPLE_DAYS);
  const cats = await db.categories.toArray();

  await db.transaction('rw', db.plan, db.cycle, db.days, db.entries, db.events, async () => {
    await Promise.all([db.cycle.clear(), db.days.clear(), db.entries.clear(), db.events.clear()]);
    await db.events.bulkAdd([
      {
        name: 'Weekend getaway',
        note: 'Lonavala trip with friends',
        categories: [],
        createdAt: Date.now() - 2000,
      },
      {
        name: 'Family dinner',
        note: 'Hosting parents at home',
        categories: [],
        createdAt: Date.now() - 1000,
      },
    ]);
    if (addPlan) await db.plan.add({ ...plan!, createdAt: Date.now() });
    let state = initialCycleState(plan!);
    const cycleId = await db.cycle.add({
      startDate,
      totalDays: state.totalDays,
      planAmount: moneyToLiveOn(plan!),
      currentDay: 1,
      pool: state.pool,
      fromSavingsTotal: 0,
      leftoverMoved: false,
    });
    let fromSavings = 0;
    const entries: Entry[] = [];
    const rows = [];
    for (let day = 1; day <= SAMPLE_DAYS; day++) {
      const mine = spends.filter((s) => s.day === day);
      const [y, m, d] = dateOfDay(startDate, day).split('-').map(Number);
      mine.forEach((s, i) => {
        const cat = cats.find((c) => c.name === s.category);
        const sub = cat?.subcategories.find((t) => t === s.subcategory) ?? null;
        if (s.fromSavings) fromSavings += s.amount;
        const resolvedCat = cat ? cat.name : 'Other';
        let sampleEvent: string | null = null;
        if ((day === 14 || day === 15) && ['Travel', 'Food', 'Fun'].includes(resolvedCat)) {
          sampleEvent = 'Weekend getaway';
        } else if (day === 8 && ['Food', 'Home'].includes(resolvedCat)) {
          sampleEvent = 'Family dinner';
        }
        entries.push({
          id: crypto.randomUUID(),
          cycleId,
          day,
          amount: s.amount,
          label: s.label,
          category: resolvedCat,
          subcategory: cat ? sub : null,
          event: sampleEvent,
          payment: resolvedCat === 'Bills' || resolvedCat === 'Shopping' ? 'Card' : s.amount <= 40 ? 'Cash' : 'UPI',
          fromSavings: s.fromSavings,
          isEstimate: false,
          hour: s.hour,
          createdAt: new Date(y, m - 1, d, s.hour, i).getTime(),
        });
      });
      const spent = mine.filter((s) => !s.fromSavings).reduce((t, s) => t + s.amount, 0);
      const r = closeDay(state, spent);
      rows.push({ cycleId, ...r.record });
      state = r.state;
    }
    await db.entries.bulkAdd(entries);
    await db.days.bulkAdd(rows);
    await db.cycle.update(cycleId, { currentDay: state.currentDay, pool: state.pool, fromSavingsTotal: fromSavings });
  });
  await persistStorage();
  scheduleSync();
}

/* ---------- export / delete ---------- */

export async function exportCSV(): Promise<string> {
  const db = getDB();
  const [cycles, entries] = await Promise.all([db.cycle.toArray(), db.entries.toArray()]);
  const start = new Map(cycles.map((c) => [c.id!, c.startDate]));
  const rows: CsvRow[] = entries
    .filter((e) => start.has(e.cycleId))
    .sort((a, b) => a.cycleId - b.cycleId || a.day - b.day || a.createdAt - b.createdAt)
    .map((e) => ({
      date: dateOfDay(start.get(e.cycleId)!, e.day),
      day: e.day,
      amount: e.amount,
      label: e.label,
      category: e.category,
      type: e.subcategory ?? '',
      fromSavings: e.fromSavings,
      estimate: e.isEstimate,
      payment: e.payment ?? '',
      event: e.event ?? '',
      note: e.note ?? '',
    }));
  return buildCSV(rows);
}

export async function deleteAllData(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  await ensureSeed();
  void clearRemoteWorkspace();
}
