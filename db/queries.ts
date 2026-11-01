'use client';
import { useLiveQuery as useDexieLive } from 'dexie-react-hooks';
import {
  DEFAULT_CATEGORIES,
  SCHEMA_VERSION,
  getDB,
  useActiveUid,
  type Category,
  type Cycle,
  type Entry,
  type Plan,
  type StashDB,
  type StashEvent,
  type Txn,
  type UserRecord,
} from './schema';
import {
  catchUp,
  closeDay,
  dayOfTxn,
  initialCycleState,
  isPlanValid,
  moneyToLiveOn,
  onPlanTotal,
  planSync,
  rollupCycle,
  spentToday,
  type CloseResult,
  type DayInfo,
  type PlanInput,
} from '@/lib/budget';
import { resolveLabel } from '@/lib/suggestions';
import { addDays, calendarDay, dateOfDay, daysBetween, todayISO } from '@/lib/dates';
import { DEFAULT_SAMPLE_PLAN, SAMPLE_DAYS, generateSampleSpends } from '@/lib/sample';
import { buildCSV, type CsvRow } from '@/lib/csv';
import { resolveCategories, validateName, type ResolvedCategory } from '@/lib/categories';
import { getStoredCurrencyCode } from '@/lib/currency';
import { buildUserProfile, getActiveUserId, getStoredAvatarTheme, getStoredUsername } from '@/lib/user';
import { requestSync } from '@/lib/sync';

/* ---------- helpers ---------- */

const uuid = () => crypto.randomUUID();

const alive = <T extends { deletedAt?: number | null }>(r: T) => r.deletedAt == null;

/** Live query that re-runs when the active per-user DB switches. */
function useLiveQuery<T>(q: () => Promise<T> | T, deps?: unknown[]): T | undefined;
function useLiveQuery<T, D>(q: () => Promise<T> | T, deps: unknown[], def: D): T | D;
function useLiveQuery<T, D>(q: () => Promise<T> | T, deps: unknown[] = [], def?: D) {
  const uid = useActiveUid();
  return useDexieLive(q, [uid, ...deps], def as D);
}

export function toEntry(t: Txn, cycle: Pick<Cycle, 'startDate' | 'totalDays'> | undefined): Entry {
  return {
    id: t.id,
    cycleId: t.cycleId ?? '',
    day: cycle ? dayOfTxn(cycle, t.txnDate) : 0,
    date: t.txnDate,
    amount: t.amount,
    label: t.label,
    category: t.type,
    subcategory: t.subtype,
    event: t.event,
    payment: t.payment,
    note: t.note,
    fromSavings: t.fromSavings,
    adjustsPool: t.adjustsPool,
    isEstimate: t.isEstimate,
    hour: t.hour,
    createdAt: t.createdAt,
  };
}

/**
 * Rebuilds a cycle's day rows, pool and fromSavingsTotal from its live transactions.
 * Must run inside the same Dexie transaction as the write that changed them
 * (tables: cycles, transactions, dayRows).
 */
export async function recompute(db: StashDB, cycleId: string): Promise<void> {
  const c = await db.cycles.get(cycleId);
  if (!c || c.deletedAt != null) return;
  const txns = await db.transactions.where('cycleId').equals(cycleId).toArray();
  const r = rollupCycle(c, txns);
  await db.dayRows.where('cycleId').equals(cycleId).delete();
  await db.dayRows.bulkPut(
    r.days.map((d) => ({
      cycleId,
      day: d.day,
      allowanceAtStart: d.allowanceAtStart,
      spent: d.spent,
      status: d.status,
    })),
  );
  if (c.pool !== r.pool || c.fromSavingsTotal !== r.fromSavingsTotal) {
    await db.cycles.update(cycleId, { pool: r.pool, fromSavingsTotal: r.fromSavingsTotal });
  }
}

/** Defaults + this user's overrides, resolved. */
export async function loadCategories(db: StashDB = getDB()): Promise<ResolvedCategory[]> {
  return resolveCategories(DEFAULT_CATEGORIES, await db.cats.toArray());
}

async function latestPlan(db: StashDB): Promise<Plan | undefined> {
  const all = (await db.plans.toArray()).filter(alive);
  return all.sort((a, b) => a.createdAt - b.createdAt).pop();
}

async function latestCycle(db: StashDB): Promise<Cycle | undefined> {
  const all = (await db.cycles.toArray()).filter(alive);
  return all.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.updatedAt - b.updatedAt).pop();
}

/* ---------- reads ---------- */

export interface Snapshot {
  plan: Plan | undefined;
  cycle: Cycle | undefined;
}

/** `undefined` while loading, then always an object (maybe with empty fields). */
export function useSnapshot(): Snapshot | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const [plan, cycle] = await Promise.all([latestPlan(db), latestCycle(db)]);
    return { plan, cycle };
  }, []);
}

export function useDayEntries(cycleId: string | undefined, day: number | undefined): Entry[] | undefined {
  return useLiveQuery(async () => {
    if (cycleId == null || day == null) return [];
    const db = getDB();
    const cycle = await db.cycles.get(cycleId);
    if (!cycle) return [];
    const date = dateOfDay(cycle.startDate, day);
    const rows = await db.transactions.where('[cycleId+txnDate]').equals([cycleId, date]).toArray();
    return rows
      .filter(alive)
      .map((t) => toEntry(t, cycle))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cycleId, day]);
}

export function useCycleEntries(cycleId: string | undefined): Entry[] | undefined {
  return useLiveQuery(async () => {
    if (cycleId == null) return [];
    const db = getDB();
    const cycle = await db.cycles.get(cycleId);
    const rows = await db.transactions.where('cycleId').equals(cycleId).toArray();
    return rows.filter(alive).map((t) => toEntry(t, cycle));
  }, [cycleId]);
}

export function useDayRows(cycleId: string | undefined) {
  return useLiveQuery(
    async () => (cycleId == null ? [] : getDB().dayRows.where('cycleId').equals(cycleId).toArray()),
    [cycleId],
  );
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
  return useLiveQuery(async () => {
    const all = (await getDB().cycles.toArray()).filter(alive);
    return all.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.updatedAt - a.updatedAt);
  }, []);
}

/** Every spend across all cycles (loaded on demand when searching History). */
export function useAllEntries(enabled = true): Entry[] | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return [];
    const db = getDB();
    const [cycles, txns] = await Promise.all([db.cycles.toArray(), db.transactions.toArray()]);
    const byId = new Map(cycles.map((c) => [c.id, c]));
    return txns.filter(alive).map((t) => toEntry(t, t.cycleId ? byId.get(t.cycleId) : undefined));
  }, [enabled]);
}

/** Event currently being logged into (or null). */
export function useActiveEvent(): string | null {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.activeEvent ?? null, [], null) ?? null;
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => loadCategories(), []);
}

export function useEvents(): StashEvent[] | undefined {
  return useLiveQuery(
    async () => (await getDB().evts.toArray()).filter(alive).sort((a, b) => b.createdAt - a.createdAt),
    [],
  );
}

export function useCurrentUser(): UserRecord | undefined {
  return useLiveQuery(async () => {
    const uid = getActiveUserId();
    return (await getDB().users.get(uid)) ?? buildUserProfile(getStoredUsername(), getStoredAvatarTheme());
  }, []);
}

/** category name -> number of spends */
export function useCategoryCounts(): Record<string, number> {
  return (
    useLiveQuery(async () => {
      const counts: Record<string, number> = {};
      await getDB().transactions.each((t) => {
        if (t.deletedAt != null) return;
        counts[t.type] = (counts[t.type] ?? 0) + 1;
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
      await getDB().transactions.each((t) => {
        if (t.deletedAt != null) return;
        const ev = t.event?.trim();
        if (ev) counts[ev] = (counts[ev] ?? 0) + 1;
      });
      return counts;
    }, []) ?? {}
  );
}

/* ---------- setup ---------- */

export async function ensureSeed(): Promise<void> {
  const db = getDB();
  const uid = getActiveUserId();
  await db.transaction('rw', [db.meta, db.users], async () => {
    const existingMeta = await db.meta.get('main');
    if (!existingMeta) {
      await db.meta.put({ id: 'main', lastUsedLabel: null, activeUserId: uid, schemaVersion: SCHEMA_VERSION });
    } else if (existingMeta.activeUserId !== uid) {
      await db.meta.update('main', { activeUserId: uid });
    }
    const existingUser = await db.users.get(uid);
    const profile = buildUserProfile(getStoredUsername(), getStoredAvatarTheme());
    await db.users.put({
      ...profile,
      currency: getStoredCurrencyCode(),
      createdAt: existingUser?.createdAt ?? profile.createdAt,
      lastSeenAt: Date.now(),
    });
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
  const currency = getStoredCurrencyCode();
  const now = Date.now();
  await db.transaction('rw', [db.plans, db.cycles], async () => {
    if (addPlan) {
      await db.plans.add({
        id: uuid(),
        updatedAt: now,
        createdAt: now,
        income: p.income,
        bills: p.bills,
        savings: p.savings,
        monthLength: p.monthLength,
        billItems: p.billItems,
        savingsItems: p.savingsItems,
        currency,
      });
    }
    await db.cycles.add({
      id: uuid(),
      updatedAt: now,
      startDate,
      totalDays: s.totalDays,
      planAmount: moneyToLiveOn(p),
      currentDay: s.currentDay,
      pool: s.pool,
      fromSavingsTotal: 0,
      leftoverMoved: false,
      estimatedDays: [],
    });
  });
}

/** Saves the plan and starts a new cycle today. Used for initial onboarding. */
export async function createPlanAndCycle(p: PlanInput, startDate: string = todayISO()): Promise<void> {
  await startCycle(p, startDate, true);
  await persistStorage();
  requestSync();
}

/**
 * Updates the plan and re-bases the active cycle: the cycle's pool is derived from
 * the new plan amount minus what closed days consumed, so past allowances are re-based too.
 */
export async function updateActivePlan(p: PlanInput): Promise<void> {
  const db = getDB();
  const currency = getStoredCurrencyCode();
  const now = Date.now();
  await db.transaction('rw', [db.plans, db.cycles, db.transactions, db.dayRows], async () => {
    const plan = await latestPlan(db);
    const fields = {
      income: Math.round(p.income),
      bills: Math.round(p.bills),
      savings: Math.round(p.savings),
      monthLength: Math.round(p.monthLength),
      billItems: p.billItems,
      savingsItems: p.savingsItems,
      currency,
      updatedAt: now,
    };
    if (plan) {
      await db.plans.update(plan.id, fields);
    } else {
      await db.plans.add({ id: uuid(), createdAt: now, ...fields });
    }
    const cycle = await latestCycle(db);
    if (cycle) {
      await db.cycles.update(cycle.id, {
        planAmount: moneyToLiveOn(p),
        totalDays: p.monthLength,
        updatedAt: now,
      });
      await recompute(db, cycle.id);
    }
  });
  await persistStorage();
  requestSync();
}

export function useCanMergeCycle(): boolean {
  const count = useLiveQuery(async () => (await getDB().cycles.toArray()).filter(alive).length, []);
  return (count ?? 0) > 1;
}

/**
 * Merges an accidentally restarted cycle back into the original month: its spends move into
 * the original cycle, the original returns to today's day with the latest plan, and the
 * accidental cycle is tombstoned.
 */
export async function mergeAccidentalCycle(): Promise<{ success: boolean; message: string; currentDay?: number }> {
  const db = getDB();
  const cycles = (await db.cycles.toArray()).filter(alive);
  if (cycles.length < 2) {
    return { success: false, message: 'Only one cycle exists. No previous cycle to restore.' };
  }
  cycles.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.updatedAt - b.updatedAt);
  const latest = cycles[cycles.length - 1];
  const original = cycles[cycles.length - 2];
  const plan = await latestPlan(db);
  const planAmount = plan ? moneyToLiveOn(plan) : original.planAmount;
  const monthLength = plan?.monthLength ?? original.totalDays;
  const currentDay = Math.min(monthLength, Math.max(1, calendarDay(original.startDate, todayISO(), monthLength)));
  const now = Date.now();

  await db.transaction('rw', [db.cycles, db.transactions, db.dayRows], async () => {
    const moved = await db.transactions.where('cycleId').equals(latest.id).toArray();
    for (const t of moved) await db.transactions.update(t.id, { cycleId: original.id, updatedAt: now });
    await db.cycles.update(original.id, { currentDay, totalDays: monthLength, planAmount, updatedAt: now });
    await db.cycles.update(latest.id, { deletedAt: now, updatedAt: now });
    await db.dayRows.where('cycleId').equals(latest.id).delete();
    await recompute(db, original.id);
  });
  requestSync();
  return {
    success: true,
    currentDay,
    message: `Restored to Day ${currentDay} of your original month! Your past logs and updated plan are unified.`,
  };
}

/** New cycle starting today with the same plan. */
export async function startNextMonth(): Promise<void> {
  const plan = await latestPlan(getDB());
  if (!plan) return;
  await startCycle(plan, todayISO(), false);
  requestSync();
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
  /** When adding to a previous day: whether to adjust the remaining month pool & unfilled days (default true). */
  adjustPool?: boolean;
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

/** Logs a spend on the cycle's current day (or a specific `targetDay` / `targetDate` when adding from History). */
export async function addSpend(
  cycle: Cycle,
  spend: NewSpend,
  now: Date = new Date(),
  targetDay?: number,
  targetDate?: string,
): Promise<Entry> {
  const db = getDB();
  const cats = await loadCategories(db);
  const resolved =
    spend.category != null
      ? { category: spend.category, subcategory: spend.subcategory ?? null }
      : spend.label === 'Sort later'
        ? { category: 'Other', subcategory: null }
        : resolveLabel(spend.label, cats);
  const activeEvent = spend.event === undefined ? ((await db.meta.get('main'))?.activeEvent ?? null) : spend.event;

  let entryDate: string;
  let targetCycle: Cycle = cycle;
  let adjustsPool = spend.adjustPool !== false;

  if (targetDate) {
    entryDate = targetDate;
    const diff = daysBetween(cycle.startDate, targetDate);
    if (!(diff >= 0 && diff < cycle.totalDays)) {
      const all = (await db.cycles.toArray()).filter(alive);
      const matched = all.find((c) => {
        const d = daysBetween(c.startDate, targetDate);
        return d >= 0 && d < c.totalDays;
      });
      if (matched) targetCycle = matched;
      adjustsPool = false; // never deduct from a cycle's pool for a date outside its range
    }
  } else {
    const day =
      targetDay != null ? Math.min(Math.max(1, Math.round(targetDay)), cycle.totalDays) : cycle.currentDay;
    entryDate = dateOfDay(cycle.startDate, day);
  }

  const [ey, em, ed] = entryDate.split('-').map(Number);
  const isToday = entryDate === dateOfDay(cycle.startDate, cycle.currentDay);
  const createdAt = !isToday
    ? new Date(ey, em - 1, ed, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()).getTime()
    : now.getTime();

  const txn: Txn = {
    id: uuid(),
    updatedAt: Date.now(),
    cycleId: targetCycle.id,
    txnDate: entryDate,
    amount: Math.round(spend.amount),
    label: spend.label,
    type: resolved.category,
    subtype: resolved.subcategory,
    event: activeEvent?.trim() || null,
    payment: spend.payment?.trim() || null,
    note: spend.note?.trim() || null,
    fromSavings: !!spend.fromSavings,
    adjustsPool,
    isEstimate: false,
    hour: now.getHours(),
    createdAt,
  };

  await db.transaction('rw', [db.transactions, db.meta, db.cycles, db.dayRows], async () => {
    await db.transactions.add(txn);
    await db.meta.update('main', {
      lastUsedLabel: spend.label,
      ...(txn.payment ? { lastPayment: txn.payment } : {}),
    });
    await recompute(db, targetCycle.id);
  });
  requestSync();
  return toEntry(txn, targetCycle);
}

/**
 * Updates an existing spend (from Today or History calendar). Pool, savings total and the
 * closed day row are re-derived in the same transaction.
 */
export async function updateEntry(id: string, patch: SpendUpdate): Promise<Entry | null> {
  const db = getDB();
  let updated: Entry | null = null;
  await db.transaction('rw', [db.transactions, db.cycles, db.dayRows], async () => {
    const prev = await db.transactions.get(id);
    if (!prev || prev.deletedAt != null) return;
    const next: Txn = {
      ...prev,
      updatedAt: Date.now(),
      amount: patch.amount != null ? Math.max(1, Math.round(patch.amount)) : prev.amount,
      label: patch.label != null ? patch.label.trim() || prev.label : prev.label,
      type: patch.category != null ? patch.category : prev.type,
      subtype: patch.subcategory !== undefined ? patch.subcategory : prev.subtype,
      event: patch.event !== undefined ? patch.event?.trim() || null : prev.event,
      payment: patch.payment !== undefined ? patch.payment?.trim() || null : prev.payment,
      note: patch.note !== undefined ? patch.note?.trim() || null : prev.note,
      fromSavings: patch.fromSavings != null ? patch.fromSavings : prev.fromSavings,
    };
    await db.transactions.put(next);
    if (prev.cycleId) await recompute(db, prev.cycleId);
    const cycle = prev.cycleId ? await db.cycles.get(prev.cycleId) : undefined;
    updated = toEntry(next, cycle);
  });
  if (updated) requestSync();
  return updated;
}

/** Soft delete: the tombstone syncs, and the cycle is re-derived. */
export async function removeEntry(id: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', [db.transactions, db.cycles, db.dayRows], async () => {
    const t = await db.transactions.get(id);
    if (!t || t.deletedAt != null) return;
    const now = Date.now();
    await db.transactions.update(id, { deletedAt: now, updatedAt: now });
    if (t.cycleId) await recompute(db, t.cycleId);
  });
  requestSync();
}

/* ---------- closing days ---------- */

export async function closeCurrentDay(cycleId: string): Promise<CloseResult | null> {
  const db = getDB();
  const res = await db.transaction('rw', [db.cycles, db.transactions, db.dayRows], async () => {
    const c = await db.cycles.get(cycleId);
    if (!c || c.deletedAt != null || c.currentDay > c.totalDays) return null;
    const date = dateOfDay(c.startDate, c.currentDay);
    const today = (await db.transactions.where('[cycleId+txnDate]').equals([cycleId, date]).toArray()).filter(alive);
    const r = closeDay(c, spentToday(today));
    await db.cycles.update(cycleId, { currentDay: r.state.currentDay, updatedAt: Date.now() });
    await recompute(db, cycleId);
    return r;
  });
  if (res) requestSync();
  return res;
}

export interface PendingCatchUp {
  cycleId: string;
  gap: { from: number; to: number };
  onPlan: number;
  startDate: string;
}

/** Runs on load and whenever the app becomes visible again. */
export async function syncCalendar(today: string = todayISO()): Promise<PendingCatchUp | null> {
  const db = getDB();
  let changed = false;
  const result = await db.transaction('rw', [db.cycles, db.transactions, db.dayRows], async () => {
    const c = await latestCycle(db);
    if (!c || c.currentDay > c.totalDays) return null;
    const cal = calendarDay(c.startDate, today, c.totalDays);
    if (c.currentDay >= cal) return null;
    const all = (await db.transactions.where('cycleId').equals(c.id).toArray()).filter(alive);
    const byDay = new Map<number, DayInfo>();
    for (const t of all) {
      const day = dayOfTxn(c, t.txnDate);
      if (day === 0) continue;
      const d = byDay.get(day) ?? { hasEntries: false, spent: 0 };
      d.hasEntries = true;
      if (!t.fromSavings) d.spent += t.amount;
      byDay.set(day, d);
    }
    const plan = planSync(c, cal, (day) => byDay.get(day) ?? { hasEntries: false, spent: 0 });
    if (plan.closes.length) {
      await db.cycles.update(c.id, { currentDay: plan.state.currentDay, updatedAt: Date.now() });
      await recompute(db, c.id);
      changed = true;
    }
    if (!plan.gap) return null;
    return { cycleId: c.id, gap: plan.gap, onPlan: onPlanTotal(plan.state, plan.gap), startDate: c.startDate };
  });
  if (changed) requestSync();
  return result;
}

export async function applyCatchUp(
  cycleId: string,
  total: number,
  gap: { from: number; to: number },
  now = new Date(),
) {
  void now;
  const db = getDB();
  await db.transaction('rw', [db.cycles, db.transactions, db.dayRows], async () => {
    const c = await db.cycles.get(cycleId);
    if (!c || c.currentDay !== gap.from) return;
    const r = catchUp(c, total, gap);
    const stamp = Date.now();
    await db.transactions.bulkAdd(
      r.entries.map((e) => {
        const iso = dateOfDay(c.startDate, e.day);
        const [y, m, d] = iso.split('-').map(Number);
        const createdAt = new Date(y, m - 1, d, 12, 0, 0).getTime();
        return {
          id: uuid(),
          updatedAt: stamp,
          cycleId,
          txnDate: iso,
          amount: e.amount,
          label: 'Rough total',
          type: 'Other',
          subtype: null,
          event: null,
          payment: null,
          note: null,
          fromSavings: false,
          adjustsPool: true,
          isEstimate: true,
          hour: 12,
          createdAt,
        } satisfies Txn;
      }),
    );
    const estimated = Array.from(new Set([...c.estimatedDays, ...r.days.map((d) => d.day)])).sort((a, b) => a - b);
    await db.cycles.update(cycleId, { currentDay: r.state.currentDay, estimatedDays: estimated, updatedAt: stamp });
    await recompute(db, cycleId);
  });
  requestSync();
}

export async function moveLeftoverToSavings(cycleId: string): Promise<void> {
  const db = getDB();
  const c = await db.cycles.get(cycleId);
  if (c && !c.leftoverMoved) {
    await db.cycles.update(cycleId, { leftoverMoved: true, updatedAt: Date.now() });
    requestSync();
  }
}

/* ---------- categories ----------
 * Defaults are shared (DEFAULT_CATEGORIES, stored once). A user's `cats` rows hold only
 * what differs: categories they created, defaults they removed, subcategories added/removed. */

/** The user's override row for a default category, created on first change. */
async function overrideFor(db: StashDB, baseId: string, now: number) {
  const rows = (await db.cats.where('baseId').equals(baseId).toArray()).sort((a, b) => b.updatedAt - a.updatedAt);
  if (rows[0]) return rows[0];
  const d = DEFAULT_CATEGORIES.find((x) => x.key === baseId)!;
  const row = {
    id: uuid(), updatedAt: now, name: d.name, sortOrder: 0, isSystem: !!d.isSystem,
    subcategories: [] as string[], baseId, subAdded: [] as string[], subRemoved: [] as string[],
  };
  await db.cats.add(row);
  return row;
}

export async function addCategory(name: string): Promise<string | null> {
  const db = getDB();
  const all = await loadCategories(db);
  const trimmed = name.trim();
  const err = validateName(trimmed, all.map((c) => c.name));
  if (err) return err;
  await db.cats.add({
    id: uuid(), updatedAt: Date.now(), name: trimmed, sortOrder: all.length, isSystem: false,
    subcategories: [], baseId: null, subAdded: [], subRemoved: [],
  });
  requestSync();
  return null;
}

export async function addSubcategory(catId: string, name: string): Promise<string | null> {
  const db = getDB();
  const c = (await loadCategories(db)).find((x) => x.id === catId);
  if (!c) return 'That category is gone.';
  const trimmed = name.trim();
  const err = validateName(trimmed, c.subcategories);
  if (err) return err;
  const now = Date.now();
  await db.transaction('rw', db.cats, async () => {
    if (c.baseId) {
      const o = await overrideFor(db, c.baseId, now);
      const d = DEFAULT_CATEGORIES.find((x) => x.key === c.baseId)!;
      // re-adding a default subcategory just un-removes it
      const inDefault = d.subcategories.includes(trimmed);
      await db.cats.update(o.id, {
        subRemoved: o.subRemoved.filter((x) => x !== trimmed),
        subAdded: inDefault ? o.subAdded : [...o.subAdded, trimmed],
        deletedAt: null,
        updatedAt: now,
      });
    } else {
      const row = await db.cats.get(catId);
      if (row) await db.cats.update(catId, { subcategories: [...row.subcategories, trimmed], updatedAt: now });
    }
  });
  requestSync();
  return null;
}

/** Spends keep their category and lose only the type. */
export async function removeSubcategory(catId: string, name: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', [db.cats, db.transactions], async () => {
    const c = (await loadCategories(db)).find((x) => x.id === catId);
    if (!c) return;
    const now = Date.now();
    if (c.baseId) {
      const o = await overrideFor(db, c.baseId, now);
      const d = DEFAULT_CATEGORIES.find((x) => x.key === c.baseId)!;
      await db.cats.update(o.id, {
        subAdded: o.subAdded.filter((x) => x !== name),
        subRemoved: d.subcategories.includes(name) && !o.subRemoved.includes(name) ? [...o.subRemoved, name] : o.subRemoved,
        updatedAt: now,
      });
    } else {
      const row = await db.cats.get(catId);
      if (row) await db.cats.update(catId, { subcategories: row.subcategories.filter((x) => x !== name), updatedAt: now });
    }
    await db.transactions
      .where('type')
      .equals(c.name)
      .filter((t) => t.subtype === name && alive(t))
      .modify({ subtype: null, updatedAt: now });
  });
  requestSync();
}

/** Spends move to Other. "Other" itself can't be removed. */
export async function removeCategory(catId: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', [db.cats, db.transactions, db.evts], async () => {
    const c = (await loadCategories(db)).find((x) => x.id === catId);
    if (!c || c.isSystem) return;
    const now = Date.now();
    await db.transactions
      .where('type')
      .equals(c.name)
      .filter(alive)
      .modify({ type: 'Other', subtype: null, updatedAt: now });
    for (const ev of (await db.evts.toArray()).filter(alive)) {
      if (ev.categories.includes(c.name)) {
        await db.evts.update(ev.id, { categories: ev.categories.filter((x) => x !== c.name), updatedAt: now });
      }
    }
    if (c.baseId) {
      const o = await overrideFor(db, c.baseId, now);
      await db.cats.update(o.id, { deletedAt: now, updatedAt: now });
    } else {
      await db.cats.update(catId, { deletedAt: now, updatedAt: now });
    }
  });
  requestSync();
}

/* ---------- events (with categories as sub-items) ---------- */

export async function addEvent(name: string, categories: string[] = [], note?: string | null): Promise<string | null> {
  const db = getDB();
  const all = (await db.evts.toArray()).filter(alive);
  const err = validateName(name, all.map((e) => e.name));
  if (err) return err;
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  const now = Date.now();
  await db.evts.add({
    id: uuid(),
    updatedAt: now,
    name: name.trim(),
    note: note?.trim() || null,
    categories: uniqueCats,
    createdAt: now,
  });
  requestSync();
  return null;
}

export async function toggleEventCategory(eventId: string, categoryName: string): Promise<void> {
  const db = getDB();
  const ev = await db.evts.get(eventId);
  if (!ev || ev.deletedAt != null) return;
  const next = ev.categories.includes(categoryName)
    ? ev.categories.filter((c) => c !== categoryName)
    : [...ev.categories, categoryName];
  await db.evts.update(eventId, { categories: next, updatedAt: Date.now() });
  requestSync();
}

export async function updateEventNote(eventId: string, note: string): Promise<void> {
  const db = getDB();
  const ev = await db.evts.get(eventId);
  if (!ev || ev.deletedAt != null) return;
  await db.evts.update(eventId, { note: note.trim() || null, updatedAt: Date.now() });
  requestSync();
}

/** Spends keep their category/amount and only clear the event tag. */
export async function removeEvent(eventId: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', [db.evts, db.transactions, db.meta], async () => {
    const ev = await db.evts.get(eventId);
    if (!ev || ev.deletedAt != null) return;
    const now = Date.now();
    await db.transactions.where('event').equals(ev.name).filter(alive).modify({ event: null, updatedAt: now });
    await db.evts.update(eventId, { deletedAt: now, updatedAt: now });
    const meta = await db.meta.get('main');
    if (meta?.activeEvent === ev.name) await db.meta.update('main', { activeEvent: null });
  });
  requestSync();
}

/**
 * Starts logging into an event. Creates it if it doesn't exist yet (case-insensitive match
 * reuses the existing one). Every spend logged afterwards is tagged until `endEvent()`.
 */
export async function startEvent(name: string, note?: string | null): Promise<string | null> {
  const db = getDB();
  const trimmed = name.trim();
  const existing = (await db.evts.toArray()).filter(alive).find((e) => e.name.toLowerCase() === trimmed.toLowerCase());
  let eventName = existing?.name;
  if (!existing) {
    const err = await addEvent(trimmed, [], note);
    if (err) return err;
    eventName = trimmed;
  }
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
  let plan: PlanInput | undefined = await latestPlan(db);
  let addPlan = false;
  if (!plan || !isPlanValid(plan) || plan.monthLength <= SAMPLE_DAYS) {
    plan = DEFAULT_SAMPLE_PLAN;
    addPlan = true;
  }
  const today = todayISO(now);
  const startDate = addDays(today, -SAMPLE_DAYS);
  const spends = generateSampleSpends(startDate, SAMPLE_DAYS);
  const cats = await loadCategories(db);
  const stamp = Date.now();

  await db.transaction(
    'rw',
    [db.plans, db.cycles, db.dayRows, db.transactions, db.evts, db.meta],
    async () => {
      await db.meta.update('main', { sampleLoaded: true });
      // Tombstone whatever existed so the replacement syncs.
      await db.cycles.toCollection().filter(alive).modify({ deletedAt: stamp, updatedAt: stamp });
      await db.transactions.toCollection().filter(alive).modify({ deletedAt: stamp, updatedAt: stamp });
      await db.evts.toCollection().filter(alive).modify({ deletedAt: stamp, updatedAt: stamp });
      await db.dayRows.clear();
      await db.evts.bulkAdd([
        {
          id: uuid(), updatedAt: stamp, name: 'Weekend getaway', note: 'Lonavala trip with friends',
          categories: [], createdAt: stamp - 2000,
        },
        {
          id: uuid(), updatedAt: stamp, name: 'Family dinner', note: 'Hosting parents at home',
          categories: [], createdAt: stamp - 1000,
        },
      ]);
      if (addPlan) {
        await db.plans.add({
          id: uuid(), updatedAt: stamp, createdAt: stamp,
          income: plan!.income, bills: plan!.bills, savings: plan!.savings, monthLength: plan!.monthLength,
          billItems: plan!.billItems, savingsItems: plan!.savingsItems,
        });
      }
      const state = initialCycleState(plan!);
      const cycleId = uuid();
      await db.cycles.add({
        id: cycleId,
        updatedAt: stamp,
        startDate,
        totalDays: state.totalDays,
        planAmount: moneyToLiveOn(plan!),
        currentDay: SAMPLE_DAYS + 1,
        pool: state.pool,
        fromSavingsTotal: 0,
        leftoverMoved: false,
        estimatedDays: [],
      });
      const txns: Txn[] = [];
      for (let day = 1; day <= SAMPLE_DAYS; day++) {
        const mine = spends.filter((s) => s.day === day);
        const dayIso = dateOfDay(startDate, day);
        const [y, m, d] = dayIso.split('-').map(Number);
        mine.forEach((s, i) => {
          const cat = cats.find((c) => c.name === s.category);
          const sub = cat?.subcategories.find((t) => t === s.subcategory) ?? null;
          const resolvedCat = cat ? cat.name : 'Other';
          let sampleEvent: string | null = null;
          if ((day === 14 || day === 15) && ['Travel', 'Food', 'Fun'].includes(resolvedCat)) {
            sampleEvent = 'Weekend getaway';
          } else if (day === 8 && ['Food', 'Home'].includes(resolvedCat)) {
            sampleEvent = 'Family dinner';
          }
          txns.push({
            id: uuid(),
            updatedAt: stamp,
            cycleId,
            txnDate: dayIso,
            amount: s.amount,
            label: s.label,
            type: resolvedCat,
            subtype: cat ? sub : null,
            event: sampleEvent,
            payment: resolvedCat === 'Bills' || resolvedCat === 'Shopping' ? 'Card' : s.amount <= 40 ? 'Cash' : 'UPI',
            note: null,
            fromSavings: s.fromSavings,
            adjustsPool: true,
            isEstimate: false,
            hour: s.hour,
            createdAt: new Date(y, m - 1, d, s.hour, i).getTime(),
          });
        });
      }
      await db.transactions.bulkAdd(txns);
      await recompute(db, cycleId);
    },
  );
  await persistStorage();
  requestSync();
}

/* ---------- export / delete ---------- */

export async function exportCSV(): Promise<string> {
  const db = getDB();
  const [cycles, txns] = await Promise.all([db.cycles.toArray(), db.transactions.toArray()]);
  const byId = new Map(cycles.filter(alive).map((c) => [c.id, c]));
  const rows: CsvRow[] = txns
    .filter((t) => alive(t) && t.cycleId != null && byId.has(t.cycleId))
    .map((t) => ({ t, c: byId.get(t.cycleId!)! }))
    .sort(
      (a, b) =>
        a.c.startDate.localeCompare(b.c.startDate) ||
        a.t.txnDate.localeCompare(b.t.txnDate) ||
        a.t.createdAt - b.t.createdAt,
    )
    .map(({ t, c }) => ({
      date: t.txnDate,
      day: dayOfTxn(c, t.txnDate),
      amount: t.amount,
      label: t.label,
      category: t.type,
      type: t.subtype ?? '',
      fromSavings: t.fromSavings,
      estimate: t.isEstimate,
      payment: t.payment ?? '',
      event: t.event ?? '',
      note: t.note ?? '',
    }));
  return buildCSV(rows);
}

/** Clears only the active user's local DB (never other users' DBs, never the cloud copy). */
export async function deleteAllData(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  await ensureSeed();
}
