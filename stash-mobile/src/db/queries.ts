import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  DEFAULT_CATEGORIES,
  SCHEMA_VERSION,
  type Category,
  type Cycle,
  type DayRow,
  type Entry,
  type Meta,
  type Plan,
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

const STORAGE_KEY = 'stash_db_v1';

interface DBData {
  plans: Plan[];
  cycles: Cycle[];
  days: DayRow[];
  entries: Entry[];
  categories: Category[];
  meta: Meta;
  nextId: number;
}

function emptyDB(): DBData {
  return {
    plans: [],
    cycles: [],
    days: [],
    entries: [],
    categories: DEFAULT_CATEGORIES.map((c, i) => ({
      id: i + 1,
      name: c.name,
      sortOrder: i,
      isSystem: c.name === 'Other',
      subcategories: [...c.subcategories],
    })),
    meta: { id: 'main', lastUsedLabel: null, schemaVersion: SCHEMA_VERSION },
    nextId: 100,
  };
}

let cache: DBData | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function loadDB(): Promise<DBData> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as DBData;
      return cache;
    }
  } catch {
    /* ignore */
  }
  cache = emptyDB();
  await saveDB(cache);
  return cache;
}

async function saveDB(data: DBData): Promise<void> {
  cache = data;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  notify();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function useDBSelector<T>(selector: (db: DBData) => T): T | undefined {
  const [val, setVal] = useState<T | undefined>(() => (cache ? selector(cache) : undefined));
  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (mounted && cache) setVal(selector(cache));
    };
    listeners.add(update);
    loadDB().then(() => update());
    return () => {
      mounted = false;
      listeners.delete(update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return val;
}

/* ---------- reads ---------- */

export interface Snapshot {
  plan: Plan | undefined;
  cycle: Cycle | undefined;
}

export function useSnapshot(): Snapshot | undefined {
  return useDBSelector((db) => ({
    plan: db.plans[db.plans.length - 1],
    cycle: db.cycles[db.cycles.length - 1],
  }));
}

export function useDayEntries(cycleId: number | undefined, day: number | undefined): Entry[] | undefined {
  const all = useDBSelector((db) => db.entries);
  if (!all || cycleId == null || day == null) return [];
  return all
    .filter((e) => e.cycleId === cycleId && e.day === day)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function useCycleEntries(cycleId: number | undefined): Entry[] | undefined {
  const all = useDBSelector((db) => db.entries);
  if (!all || cycleId == null) return [];
  return all.filter((e) => e.cycleId === cycleId);
}

export function useDayRows(cycleId: number | undefined): DayRow[] | undefined {
  const all = useDBSelector((db) => db.days);
  if (!all || cycleId == null) return [];
  return all.filter((d) => d.cycleId === cycleId);
}

export function useLastUsedLabel(): string | null {
  return useDBSelector((db) => db.meta.lastUsedLabel) ?? null;
}

export function useCategories(): Category[] | undefined {
  return useDBSelector((db) => [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder));
}

export function useCategoryCounts(): Record<string, number> {
  return (
    useDBSelector((db) => {
      const counts: Record<string, number> = {};
      db.entries.forEach((e) => {
        counts[e.category] = (counts[e.category] ?? 0) + 1;
      });
      return counts;
    }) ?? {}
  );
}

/* ---------- writes ---------- */

export async function ensureSeed(): Promise<void> {
  await loadDB();
}

export async function createPlanAndCycle(p: PlanInput, startDate: string = todayISO()): Promise<void> {
  const db = await loadDB();
  const s = initialCycleState(p);
  const planId = db.nextId++;
  const cycleId = db.nextId++;
  db.plans.push({ id: planId, ...p, createdAt: Date.now() });
  db.cycles.push({
    id: cycleId,
    startDate,
    totalDays: s.totalDays,
    planAmount: moneyToLiveOn(p),
    currentDay: s.currentDay,
    pool: s.pool,
    fromSavingsTotal: 0,
    leftoverMoved: false,
  });
  await saveDB({ ...db });
}

export async function startNextMonth(): Promise<void> {
  const db = await loadDB();
  const plan = db.plans[db.plans.length - 1];
  if (!plan) return;
  const s = initialCycleState(plan);
  const cycleId = db.nextId++;
  db.cycles.push({
    id: cycleId,
    startDate: todayISO(),
    totalDays: s.totalDays,
    planAmount: moneyToLiveOn(plan),
    currentDay: s.currentDay,
    pool: s.pool,
    fromSavingsTotal: 0,
    leftoverMoved: false,
  });
  await saveDB({ ...db });
}

export interface NewSpend {
  amount: number;
  label: string;
  category?: string;
  subcategory?: string | null;
  fromSavings?: boolean;
}

export async function addSpend(cycle: Cycle, spend: NewSpend, now: Date = new Date()): Promise<Entry> {
  const db = await loadDB();
  const resolved =
    spend.category != null
      ? { category: spend.category, subcategory: spend.subcategory ?? null }
      : spend.label === 'Sort later'
        ? { category: 'Other', subcategory: null }
        : resolveLabel(spend.label, db.categories);
  const entry: Entry = {
    id: uid(),
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
  db.entries.push(entry);
  db.meta.lastUsedLabel = spend.label;
  if (entry.fromSavings) {
    const c = db.cycles.find((x) => x.id === cycle.id);
    if (c) c.fromSavingsTotal += entry.amount;
  }
  await saveDB({ ...db });
  return entry;
}

export async function removeEntry(id: string): Promise<void> {
  const db = await loadDB();
  const idx = db.entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const [e] = db.entries.splice(idx, 1);
  if (e.fromSavings) {
    const c = db.cycles.find((x) => x.id === e.cycleId);
    if (c) c.fromSavingsTotal = Math.max(0, c.fromSavingsTotal - e.amount);
  }
  await saveDB({ ...db });
}

export async function closeCurrentDay(cycleId: number): Promise<CloseResult | null> {
  const db = await loadDB();
  const c = db.cycles.find((x) => x.id === cycleId);
  if (!c || c.currentDay > c.totalDays) return null;
  const entries = db.entries.filter((e) => e.cycleId === cycleId && e.day === c.currentDay);
  const r = closeDay(c, spentToday(entries));
  db.days = db.days.filter((d) => !(d.cycleId === cycleId && d.day === r.record.day));
  db.days.push({ cycleId, ...r.record });
  c.currentDay = r.state.currentDay;
  c.pool = r.state.pool;
  await saveDB({ ...db });
  return r;
}

export interface PendingCatchUp {
  cycleId: number;
  gap: { from: number; to: number };
  onPlan: number;
  startDate: string;
}

export async function syncCalendar(today: string = todayISO()): Promise<PendingCatchUp | null> {
  const db = await loadDB();
  const c = db.cycles[db.cycles.length - 1];
  if (!c || c.currentDay > c.totalDays) return null;
  const cal = calendarDay(c.startDate, today, c.totalDays);
  if (c.currentDay >= cal) return null;
  const all = db.entries.filter((e) => e.cycleId === c.id);
  const byDay = new Map<number, DayInfo>();
  for (const e of all) {
    const d = byDay.get(e.day) ?? { hasEntries: false, spent: 0 };
    d.hasEntries = true;
    if (!e.fromSavings) d.spent += e.amount;
    byDay.set(e.day, d);
  }
  const plan = planSync(c, cal, (day) => byDay.get(day) ?? { hasEntries: false, spent: 0 });
  if (plan.closes.length) {
    for (const r of plan.closes) {
      db.days = db.days.filter((d) => !(d.cycleId === c.id && d.day === r.day));
      db.days.push({ cycleId: c.id!, ...r });
    }
    c.currentDay = plan.state.currentDay;
    c.pool = plan.state.pool;
    await saveDB({ ...db });
  }
  if (!plan.gap) return null;
  return { cycleId: c.id!, gap: plan.gap, onPlan: onPlanTotal(plan.state, plan.gap), startDate: c.startDate };
}

export async function applyCatchUp(cycleId: number, total: number, gap: { from: number; to: number }, now = new Date()) {
  const db = await loadDB();
  const c = db.cycles.find((x) => x.id === cycleId);
  if (!c || c.currentDay !== gap.from) return;
  const r = catchUp(c, total, gap);
  for (const d of r.days) {
    db.days = db.days.filter((x) => !(x.cycleId === cycleId && x.day === d.day));
    db.days.push({ cycleId, ...d });
  }
  for (const e of r.entries) {
    db.entries.push({
      id: uid(),
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
    });
  }
  c.currentDay = r.state.currentDay;
  c.pool = r.state.pool;
  await saveDB({ ...db });
}

export async function moveLeftoverToSavings(cycleId: number): Promise<void> {
  const db = await loadDB();
  const c = db.cycles.find((x) => x.id === cycleId);
  if (c && !c.leftoverMoved) {
    c.leftoverMoved = true;
    await saveDB({ ...db });
  }
}

/* ---------- categories ---------- */

function reindex(db: DBData) {
  db.categories.sort((a, b) => Number(a.isSystem) - Number(b.isSystem) || a.sortOrder - b.sortOrder);
  db.categories.forEach((c, i) => (c.sortOrder = i));
}

export async function addCategory(name: string): Promise<string | null> {
  const db = await loadDB();
  const err = validateName(name, db.categories.map((c) => c.name));
  if (err) return err;
  db.categories.push({
    id: db.nextId++,
    name: name.trim(),
    sortOrder: db.categories.length,
    isSystem: false,
    subcategories: [],
  });
  reindex(db);
  await saveDB({ ...db });
  return null;
}

export async function addSubcategory(catId: number, name: string): Promise<string | null> {
  const db = await loadDB();
  const c = db.categories.find((x) => x.id === catId);
  if (!c) return 'That category is gone.';
  const err = validateName(name, c.subcategories);
  if (err) return err;
  c.subcategories = [...c.subcategories, name.trim()];
  await saveDB({ ...db });
  return null;
}

export async function removeSubcategory(catId: number, name: string): Promise<void> {
  const db = await loadDB();
  const c = db.categories.find((x) => x.id === catId);
  if (!c) return;
  c.subcategories = c.subcategories.filter((s) => s !== name);
  db.entries.forEach((e) => {
    if (e.category === c.name && e.subcategory === name) e.subcategory = null;
  });
  await saveDB({ ...db });
}

export async function removeCategory(catId: number): Promise<void> {
  const db = await loadDB();
  const c = db.categories.find((x) => x.id === catId);
  if (!c || c.isSystem) return;
  db.entries.forEach((e) => {
    if (e.category === c.name) {
      e.category = 'Other';
      e.subcategory = null;
    }
  });
  db.categories = db.categories.filter((x) => x.id !== catId);
  reindex(db);
  await saveDB({ ...db });
}

/* ---------- sample / export / delete ---------- */

export async function fillSample(now: Date = new Date()): Promise<void> {
  const db = await loadDB();
  let plan: PlanInput | undefined = db.plans[db.plans.length - 1];
  if (!plan || !isPlanValid(plan) || plan.monthLength <= SAMPLE_DAYS) {
    plan = DEFAULT_SAMPLE_PLAN;
    db.plans.push({ id: db.nextId++, ...plan, createdAt: Date.now() });
  }
  const today = todayISO(now);
  const startDate = addDays(today, -SAMPLE_DAYS);
  const spends = generateSampleSpends(startDate, SAMPLE_DAYS);
  let state = initialCycleState(plan);
  const cycleId = db.nextId++;
  db.cycles = [];
  db.days = [];
  db.entries = [];

  let fromSavings = 0;
  for (let day = 1; day <= SAMPLE_DAYS; day++) {
    const mine = spends.filter((s) => s.day === day);
    const [y, m, d] = dateOfDay(startDate, day).split('-').map(Number);
    mine.forEach((s, i) => {
      const cat = db.categories.find((c) => c.name === s.category);
      const sub = cat?.subcategories.find((t) => t === s.subcategory) ?? null;
      if (s.fromSavings) fromSavings += s.amount;
      db.entries.push({
        id: uid(),
        cycleId,
        day,
        amount: s.amount,
        label: s.label,
        category: cat ? cat.name : 'Other',
        subcategory: cat ? sub : null,
        fromSavings: s.fromSavings,
        isEstimate: false,
        hour: s.hour,
        createdAt: new Date(y, m - 1, d, s.hour, i).getTime(),
      });
    });
    const spent = mine.filter((s) => !s.fromSavings).reduce((t, s) => t + s.amount, 0);
    const r = closeDay(state, spent);
    db.days.push({ cycleId, ...r.record });
    state = r.state;
  }

  db.cycles.push({
    id: cycleId,
    startDate,
    totalDays: state.totalDays,
    planAmount: moneyToLiveOn(plan),
    currentDay: state.currentDay,
    pool: state.pool,
    fromSavingsTotal: fromSavings,
    leftoverMoved: false,
  });
  await saveDB({ ...db });
}

export async function exportCSV(): Promise<string> {
  const db = await loadDB();
  const start = new Map(db.cycles.map((c) => [c.id!, c.startDate]));
  const rows: CsvRow[] = db.entries
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
    }));
  return buildCSV(rows);
}

export async function deleteAllData(): Promise<void> {
  await saveDB(emptyDB());
}
