'use client';
import { useEffect, useState } from 'react';
import { useLiveQuery as useDexieLive } from 'dexie-react-hooks';
import {
  DEFAULT_CATEGORIES,
  SCHEMA_VERSION,
  SAMPLE_UID,
  getActiveDBUid,
  getDB,
  useActiveUid,
  type Category,
  type Entry,
  type Income,
  type Loan,
  type Plan,
  type StashDB,
  type StashEvent,
  type Txn,
  type UserRecord,
} from './schema';
import {
  closeDay,
  dayOfTxn,
  isPlanValid,
  spentToday,
  type CloseResult,
  type DayRecord,
  type PlanInput,
} from '@/lib/budget';
import {
  buildAllCycles,
  buildCycle,
  clampStartDay,
  dayOfMonth,
  decodePeriodId,
  effectiveFromOf,
  endOf,
  orderPlans,
  periodFor,
  planPeriodPatches,
  planInEffect,
  startDayOf,
  trackingStart,
  trackingForPeriod,
  type DerivedCycle,
} from '@/lib/period';
import { dropPinned, renamePinnedCategory, resolveLabel, togglePin, type PinResult } from '@/lib/suggestions';
import { addDays, dateOfDay, daysBetween, setClosedThrough, subscribeDay, toISO, todayISO } from '@/lib/dates';
import { buildCSV, type CsvRow } from '@/lib/csv';
import { MAX_NAME, resolveCategories, validateName, type ResolvedCategory } from '@/lib/categories';
import { getStoredCurrencyCode } from '@/lib/currency';
import { buildUserProfile, getActiveUserId, getStoredAvatarTheme, getStoredUsername } from '@/lib/user';
import { requestSync, syncNow } from '@/lib/sync';
import { getAuth } from '@/lib/auth';
import { LEND_CATEGORY, remaining, validateLoan, loanEffects, type LoanKind } from '@/lib/lend';
import { DEFAULT_INCOME_SOURCE, incomeEffects, validateIncome } from '@/lib/income';
import { uuidv7 } from '@/lib/uuid';
import { roundMoney } from '@/lib/money';
import {
  addItem, itemState, normalizeItems, planTotals, removeItem, setItemTxn, updateItem, validateAmount,
  type EventItem, type ItemState, type ItemTxn, type PlanTotals,
} from '@/lib/eventPlan';

/* ---------- helpers ---------- */

const uuid = () => crypto.randomUUID();
/** Transactions are the big table: time-ordered ids keep its Postgres primary-key index compact. */
const txnId = uuidv7;

const alive = <T extends { deletedAt?: number | null }>(r: T) => r.deletedAt == null;

/** Live query that re-runs when the active per-user DB switches. */
function useLiveQuery<T>(q: () => Promise<T> | T, deps?: unknown[]): T | undefined;
function useLiveQuery<T, D>(q: () => Promise<T> | T, deps: unknown[], def: D): T | D;
function useLiveQuery<T, D>(q: () => Promise<T> | T, deps: unknown[] = [], def?: D) {
  const uid = useActiveUid();
  return useDexieLive(q, [uid, ...deps], def as D);
}

/** Current names by id. Transactions store a name snapshot, but the id link is what is trusted. */
export interface LinkNames {
  cats: Map<string, string>;
  evts: Map<string, string>;
  /** Ids of the spends that belong to a loan: shown in lists, but outside the budget (lib/lend.ts). */
  lend: Set<string>;
}

/** Spends behind a live loan. They never count as spending: not in today's spend, the pool, History totals or Insights. */
export async function lendTxnIds(db: StashDB = getDB()): Promise<Set<string>> {
  return new Set((await db.loans.toArray()).filter((l) => alive(l) && l.txnId).map((l) => l.txnId as string));
}

export async function loadLinkNames(db: StashDB = getDB()): Promise<LinkNames> {
  const [cats, evts, lend] = await Promise.all([loadCategories(db), db.evts.toArray(), lendTxnIds(db)]);
  return {
    cats: new Map(cats.map((c) => [c.id, c.name])),
    evts: new Map(evts.filter(alive).map((e) => [e.id, e.name])),
    lend,
  };
}

const catNameOf = (t: Txn, n?: LinkNames) => (t.categoryId && n?.cats.get(t.categoryId)) || t.type;
const eventNameOf = (t: Txn, n?: LinkNames) => (t.eventId && n?.evts.get(t.eventId)) || t.event;

/** Id link first; legacy rows that never got an id fall back to the old name match. */
const inCategory = (t: Txn, c: { id: string; name: string }) =>
  t.categoryId != null ? t.categoryId === c.id : t.type.toLowerCase() === c.name.toLowerCase();
const inEvent = (t: Txn, e: { id: string; name: string }) =>
  t.eventId != null ? t.eventId === e.id : t.event?.trim().toLowerCase() === e.name.toLowerCase();

export function toEntry(
  t: Txn,
  cycle: { startDate: string; totalDays: number } | null | undefined,
  names?: LinkNames,
): Entry {
  return {
    id: t.id,
    cycleId: cycle ? periodKey(cycle) : '',
    day: cycle ? dayOfTxn(cycle, t.txnDate) : 0,
    date: t.txnDate,
    amount: t.amount,
    label: t.label,
    category: catNameOf(t, names),
    subcategory: t.subtype,
    event: eventNameOf(t, names),
    payment: t.payment,
    note: t.note,
    fromSavings: t.fromSavings,
    adjustsPool: t.adjustsPool,
    isEstimate: t.isEstimate,
    ...(names?.lend.has(t.id) ? { outsideBudget: true } : {}),
    hour: t.hour,
    createdAt: t.createdAt,
  };
}

/* ---------- derived periods (docs/ENHANCEMENTS.md E-4) ----------
 * There is no stored "cycle" any more. The month, today's amount and every day row are computed from the plans and
 * transactions (lib/period.ts), so nothing about the month can be duplicated, closed early, merged or out of sync. */

const periodKey = (c: { startDate: string; totalDays: number }) => `p:${c.startDate}:${c.totalDays}`;

/** The derived cycle of the period that contains `date`; undefined before the first plan (or before tracking began). */
export async function cycleFor(db: StashDB, date: string = todayISO(), today: string = todayISO()): Promise<DerivedCycle | undefined> {
  const [plans, meta, loans, incomes] = await Promise.all([db.plans.toArray(), db.meta.get('main'), db.loans.toArray(), db.incomes.toArray()]);
  const lend = new Set(loans.filter(alive).map((l) => l.txnId).filter(Boolean) as string[]);
  // a lent amount is not spending, so it does not decide when budgeting started either
  const firstSpend = await db.transactions.orderBy('txnDate').filter((t) => alive(t) && !lend.has(t.id)).first();
  const period = periodFor(startDayOf(plans), date);
  const tracking = trackingForPeriod(plans, firstSpend?.txnDate, period);
  if (!tracking) return undefined;
  const txns = (await db.transactions.where('txnDate').between(period.start, period.end, true, true).toArray()).filter((t) => !lend.has(t.id));
  const c = buildCycle(period, planInEffect(plans, period)!, txns, today, tracking, false, [...loanEffects(loans), ...incomeEffects(incomes)]);
  if (!c) return undefined;
  c.leftoverMoved = (meta?.leftoverMoved ?? []).includes(c.id);
  return c;
}

/** The derived cycle a period id (`p:<start>:<days>`) stands for, as of today. */
async function cycleById(db: StashDB, id: string): Promise<DerivedCycle | undefined> {
  const r = decodePeriodId(id);
  return r ? cycleFor(db, r.startDate) : undefined;
}

export async function allCycles(db: StashDB, today: string = todayISO()): Promise<DerivedCycle[]> {
  const [plans, txns, meta, loans, incomes] = await Promise.all([db.plans.toArray(), db.transactions.toArray(), db.meta.get('main'), db.loans.toArray(), db.incomes.toArray()]);
  const moved = new Set(meta?.leftoverMoved ?? []);
  const lend = new Set(loans.filter(alive).map((l) => l.txnId).filter(Boolean) as string[]);
  return buildAllCycles(plans, txns.filter((t) => !lend.has(t.id)), today, (id) => moved.has(id), [...loanEffects(loans), ...incomeEffects(incomes)]);
}

const cycleOfDate = (cycles: DerivedCycle[], iso: string) => cycles.find((c) => iso >= c.startDate && iso <= endOf(c));

/** Today's date, re-read every minute and when the app comes back, so the month and day roll over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    const off = subscribeDay(tick); // a day was closed early: move on now, not at midnight
    return () => {
      off();
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

/** Day rows (every day before today) of a derived cycle. */
export function dayRowsOf(cycle: { id: string; days?: DayRecord[] } | undefined) {
  return (cycle?.days ?? []).map((d) => ({ cycleId: cycle!.id, ...d }));
}

/**
 * Gives plans that don't have them yet an `effectiveFrom` (the date they were created) and the newest plan calendar
 * months (start day 1). Needed for plans pulled from a device that predates derived months. (The one-time move from
 * the old stored cycles is the Dexie v11 upgrade, `migrateToDerivedPeriods`.) Idempotent; the edit syncs.
 */
export async function migrateToPeriods(db: StashDB = getDB()): Promise<boolean> {
  return db.transaction('rw', db.plans, async () => {
    const patches = planPeriodPatches((await db.plans.toArray()).filter(alive), null);
    const now = Date.now();
    for (const { id, patch } of patches) await db.plans.update(id, { ...patch, updatedAt: now });
    return patches.length > 0;
  });
}

/** Defaults + this user's overrides, resolved. */
export async function loadCategories(db: StashDB = getDB()): Promise<ResolvedCategory[]> {
  return resolveCategories(DEFAULT_CATEGORIES, await db.cats.toArray());
}

/** The plan that applies now (the one edits change). */
async function latestPlan(db: StashDB): Promise<Plan | undefined> {
  return orderPlans((await db.plans.toArray()).filter(alive)).pop();
}

/* ---------- reads ---------- */

export interface Snapshot {
  plan: Plan | undefined;
  /** This month (derived). Undefined until a plan exists. */
  cycle: DerivedCycle | undefined;
  /** Last month (derived), for the month-end summary. */
  previous: DerivedCycle | undefined;
  /** Whether the month-end summary of `previous` was already seen on this device. */
  previousSeen: boolean;
  /** Last month, when the user logged on its last day and has not seen its recap yet (at most one). */
  pending: DerivedCycle[];
}

/** Everything the shell needs about "now": the plan, this month and last month's summary. */
export async function loadSnapshot(db: StashDB, today: string): Promise<Snapshot> {
  const [plan, cycle, meta] = await Promise.all([latestPlan(db), cycleFor(db, today, today), db.meta.get('main')]);
  // Last month = the calendar month before this one (NOT the day before tracking began, which is in this same month when
  // tracking started mid-month). It must exist (tracking had started) and have spends, or there is nothing to summarise.
  const earlier = cycle ? await cycleFor(db, addDays(cycle.monthStart, -1), today) : undefined;
  const previous = earlier && (earlier.fromSavingsTotal > 0 || earlier.days.some((d) => d.spent > 0)) ? earlier : undefined;
  const previousSeen = !previous || (meta?.monthSummarySeen ?? []).includes(previous.id) || (await db.monthRecaps.where('monthId').equals(previous.id).toArray()).some(alive);
  // The month-end screen has one rule: the user logged something on the LAST day of the month that has just ended (last month),
  // and has not seen that recap yet. Nothing else gates it: not "close the day", not whether money is left. Older months are
  // never pushed at the user (they live in History > Month recaps). "Seen" is the synced `monthRecaps` table (plus the old
  // per-device meta list), so a login, a new device or a reinstall does not bring a recap back.
  const seen = new Set([...(meta?.monthSummarySeen ?? []), ...(await db.monthRecaps.toArray()).filter(alive).map((r) => r.monthId)]);
  const pending: DerivedCycle[] = [];
  if (cycle && earlier && !seen.has(earlier.id)) {
    const onLastDay = (await db.transactions.where('txnDate').equals(earlier.monthEnd).toArray()).some(alive);
    if (onLastDay) pending.push(earlier);
  }
  return { plan, cycle, previous, previousSeen, pending };
}

/** `undefined` while loading, then always an object (maybe with empty fields). */
export function useSnapshot(): Snapshot | undefined {
  const today = useToday();
  return useLiveQuery(async () => loadSnapshot(getDB(), today), [today]);
}

/** Spends of one day of a derived cycle (`cycleId` = period id), newest first. */
export function useDayEntries(cycleId: string | undefined, day: number | undefined): Entry[] | undefined {
  return useLiveQuery(async () => {
    const range = decodePeriodId(cycleId);
    if (!range || day == null) return [];
    const db = getDB();
    const date = dateOfDay(range.startDate, day);
    const [rows, names] = await Promise.all([db.transactions.where('txnDate').equals(date).toArray(), loadLinkNames(db)]);
    return rows
      .filter(alive)
      .map((t) => toEntry(t, range, names))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cycleId, day]);
}

/** Every spend dated inside a derived cycle. */
export function useCycleEntries(cycleId: string | undefined): Entry[] | undefined {
  return useLiveQuery(async () => {
    const range = decodePeriodId(cycleId);
    if (!range) return [];
    const db = getDB();
    const [rows, names] = await Promise.all([
      db.transactions.where('txnDate').between(range.startDate, endOf(range), true, true).toArray(),
      loadLinkNames(db),
    ]);
    // Insights is about spending: money lent is not part of it
    return rows.filter(alive).map((t) => toEntry(t, range, names)).filter((e) => !e.outsideBudget);
  }, [cycleId]);
}

export function useLastUsedLabel(): string | null {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.lastUsedLabel ?? null, [], null) ?? null;
}

/** A type is identified by its category and name; used for the log screen's quick chips. */
export const typeKey = (category: string, type: string) => `${category}::${type}`;

/** Types the user pinned to the log screen (per device). */
export function useQuickTypes(): string[] {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.quickTypes ?? [], [], []) ?? [];
}

/** Pin or unpin a type on the log screen. Returns true when it is now pinned. */
export async function toggleQuickType(category: string, type: string): Promise<PinResult> {
  const db = getDB();
  let result: PinResult = 'unpinned';
  await db.transaction('rw', db.meta, async () => {
    const meta = await db.meta.get('main');
    const t = togglePin(meta?.quickTypes ?? [], category, type);
    result = t.result;
    if (t.result === 'full') return;
    // `update` does nothing when the meta row is missing, which silently lost the pin: create the row then
    if (meta) await db.meta.update('main', { quickTypes: t.keys });
    else await db.meta.put({ id: 'main', lastUsedLabel: null, schemaVersion: SCHEMA_VERSION, quickTypes: t.keys });
  });
  return result;
}

/** Keeps the pinned list tidy when a category/type is renamed (`to` set) or removed (`to` omitted). Run inside a transaction on `meta`. */
async function updatePins(db: StashDB, fn: (keys: string[]) => string[]): Promise<void> {
  const cur = (await db.meta.get('main'))?.quickTypes;
  if (!cur?.length) return;
  const next = fn(cur);
  if (next.length !== cur.length || next.some((k, i) => k !== cur[i])) await db.meta.update('main', { quickTypes: next });
}

/**
 * Types that spends actually carry, per category name, with how many spends use each.
 * Category types are a separate list the user edits; a spend keeps its own type, so the two can
 * differ (a type removed later, or logged on another device). Read straight from transactions.
 */
export function useUsedTypes(): Record<string, { name: string; count: number }[]> {
  return (
    useLiveQuery(async () => {
      const db = getDB();
      const names = await loadLinkNames(db);
      const by = new Map<string, Map<string, number>>();
      // toArray (one bulk read) is ~10x faster than a per-row cursor (.each), and this re-runs after every save
      for (const t of await db.transactions.toArray()) {
        if (t.deletedAt != null || !t.subtype) continue;
        const cat = catNameOf(t, names);
        const m = by.get(cat) ?? new Map<string, number>();
        m.set(t.subtype, (m.get(t.subtype) ?? 0) + 1);
        by.set(cat, m);
      }
      const out: Record<string, { name: string; count: number }[]> = {};
      for (const [cat, m] of by) out[cat] = [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      return out;
    }, []) ?? {}
  );
}

/**
 * Heals the category list from the spends themselves. Categories are not tied to months: they are one list.
 * Removing a type clears it from its spends, so a type that spends still carry but the list lacks came from
 * older data, another device or an import. Add those to their category so every spend's type is in the list.
 * Returns how many were added. Names the list refuses (too long) stay visible as "used" chips.
 */
export async function adoptUsedTypes(): Promise<number> {
  const db = getDB();
  const [cats, names] = await Promise.all([loadCategories(db), loadLinkNames(db)]);
  const missing = new Map<string, Set<string>>();
  for (const t of await db.transactions.toArray()) {
    if (t.deletedAt != null || !t.subtype) continue;
    const c = cats.find((x) => x.name.toLowerCase() === catNameOf(t, names).toLowerCase());
    if (!c || c.subcategories.some((s) => s.toLowerCase() === t.subtype!.toLowerCase())) continue;
    const set = missing.get(c.id) ?? new Set<string>();
    set.add(t.subtype);
    missing.set(c.id, set);
  }
  let added = 0;
  for (const [id, set] of missing) {
    for (const name of set) if ((await addSubcategory(id, name)) === null) added++;
  }
  return added;
}

/** Last payment mode used (defaults to UPI). */
export function useLastPayment(): string {
  return useLiveQuery(async () => (await getDB().meta.get('main'))?.lastPayment ?? 'UPI', [], 'UPI') ?? 'UPI';
}

/** Every tracked month (derived), newest first. */
export function useAllCycles(): DerivedCycle[] | undefined {
  const today = useToday();
  return useLiveQuery(async () => allCycles(getDB(), today), [today]);
}

/** Every spend across all months (loaded on demand when searching History). */
export function useAllEntries(enabled = true): Entry[] | undefined {
  return useLiveQuery(async () => {
    if (!enabled) return [];
    const db = getDB();
    const [cycles, txns, names] = await Promise.all([allCycles(db), db.transactions.toArray(), loadLinkNames(db)]);
    return txns.filter(alive).map((t) => toEntry(t, cycleOfDate(cycles, t.txnDate), names));
  }, [enabled]);
}

export interface DateTotal {
  spent: number;
  fromSavings: number;
  /** Money lent that day: listed, but not spending. */
  lent: number;
  count: number;
}

/**
 * Per-date totals straight from the transactions table (indexed by txnDate) for an inclusive
 * date range. The date a spend was logged on is the only thing that decides which cell it lands in.
 */
export async function dateTotalsBetween(db: StashDB, fromIso: string, toIso: string): Promise<Map<string, DateTotal>> {
  const [rows, lend] = await Promise.all([db.transactions.where('txnDate').between(fromIso, toIso, true, true).toArray(), lendTxnIds(db)]);
  const map = new Map<string, DateTotal>();
  for (const t of rows) {
    if (t.deletedAt != null) continue;
    const d = map.get(t.txnDate) ?? { spent: 0, fromSavings: 0, lent: 0, count: 0 };
    if (lend.has(t.id)) {
      d.lent += t.amount; // listed on its day but adds to no spending total
    } else if (t.fromSavings) d.fromSavings += t.amount;
    else d.spent += t.amount;
    d.count += 1;
    map.set(t.txnDate, d);
  }
  return map;
}

export function useDateTotals(fromIso: string, toIso: string): Map<string, DateTotal> {
  return useLiveQuery(() => dateTotalsBetween(getDB(), fromIso, toIso), [fromIso, toIso]) ?? new Map<string, DateTotal>();
}

/** Every live spend on one calendar date, newest first. */
export function useDateEntries(iso: string): Entry[] {
  return (
    useLiveQuery(async () => {
      const db = getDB();
      const [rows, cycle, names] = await Promise.all([
        db.transactions.where('txnDate').equals(iso).toArray(),
        cycleFor(db, iso),
        loadLinkNames(db),
      ]);
      return rows
        .filter(alive)
        .map((t) => toEntry(t, cycle, names))
        .sort((a, b) => b.createdAt - a.createdAt);
    }, [iso]) ?? []
  );
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
      const db = getDB();
      const names = await loadLinkNames(db);
      for (const t of await db.transactions.toArray()) {
        if (t.deletedAt != null) continue;
        const name = catNameOf(t, names);
        counts[name] = (counts[name] ?? 0) + 1;
      }
      return counts;
    }, []) ?? {}
  );
}

/** event name -> number of spends */
export function useEventCounts(): Record<string, number> {
  return (
    useLiveQuery(async () => {
      const counts: Record<string, number> = {};
      const db = getDB();
      const names = await loadLinkNames(db);
      for (const t of await db.transactions.toArray()) {
        if (t.deletedAt != null) continue;
        const ev = eventNameOf(t, names)?.trim();
        if (ev) counts[ev] = (counts[ev] ?? 0) + 1;
      }
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
  const migrated = await migrateToPeriods(db);
  if ((await dedupeCategories(db)) > 0 || migrated) requestSync();
}

async function persistStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
}

const nonNeg = (n: number) => Math.max(0, roundMoney(n));

/**
 * Logging on a day of the first month that is before budgeting began (the month strip shows the whole month) pulls the
 * tracking start back to that day, so the spend counts like any other past day: in the pool, the day rows, History and
 * Insights. The days in between simply count as nothing spent. Earlier months are covered too: `cycleFor`/`buildAllCycles` derive the tracking start from the earliest spend (lib/period `trackingForPeriod`).
 * Must run inside a transaction that includes `plans`.
 */
async function extendTrackingStart(db: StashDB, date: string): Promise<void> {
  const plans = (await db.plans.toArray()).filter(alive);
  const tracking = trackingStart(plans);
  if (!tracking || date >= tracking) return;
  if (date < periodFor(startDayOf(plans), tracking).start) return;
  await db.plans.update(orderPlans(plans)[0].id, { effectiveFrom: date, updatedAt: Date.now() });
}

function planFields(p: PlanInput, periodStartDay: number, now: number) {
  return {
    income: nonNeg(p.income),
    bills: nonNeg(p.bills),
    savings: nonNeg(p.savings),
    monthLength: Math.min(31, Math.max(1, Math.round(p.monthLength))),
    billItems: p.billItems,
    savingsItems: p.savingsItems,
    currency: getStoredCurrencyCode(),
    periodStartDay: clampStartDay(periodStartDay),
    updatedAt: now,
  };
}

/**
 * Saves a plan that applies from `startDate` (onboarding: today or up to 3 days back). It never creates, ends or
 * restarts a month: months are derived, so redoing onboarding mid-month just changes the numbers from that day on.
 */
export async function createPlan(p: PlanInput, startDate: string = todayISO()): Promise<void> {
  const db = getDB();
  const now = Date.now();
  const existing = (await db.plans.toArray()).filter(alive);
  // with no explicit start day, months stay as they are; a first plan gets calendar months (start day 1)
  const startDay = p.periodStartDay ?? (existing.length ? startDayOf(existing) : 1);
  await db.plans.add({ id: uuid(), createdAt: now, effectiveFrom: startDate, ...planFields(p, startDay, now) });
  await persistStorage();
  requestSync();
}

/**
 * Changes the plan. Within the month the current plan started in, it is edited in place; otherwise a new plan
 * version starts today, so earlier months keep the amounts they were planned with. Either way this month is
 * re-based: what earlier days used stays used, the rest is spread over the days left.
 */
export async function updateActivePlan(p: PlanInput): Promise<void> {
  const db = getDB();
  const now = Date.now();
  const today = todayISO();
  await db.transaction('rw', db.plans, async () => {
    const plans = (await db.plans.toArray()).filter(alive);
    const latest = orderPlans(plans).pop();
    const fields = planFields(p, p.periodStartDay ?? startDayOf(plans), now);
    if (latest && effectiveFromOf(latest) >= periodFor(startDayOf(plans), today).start) {
      await db.plans.update(latest.id, fields);
    } else {
      await db.plans.add({ id: uuid(), createdAt: now, effectiveFrom: today, ...fields });
    }
  });
  await persistStorage();
  requestSync();
}

/** Real (not rough-total) spends logged so far; drives the "back up your month" prompt. */
/** On how many different days the person has logged a (real) spend. */
export function useLoggedDays(enabled = true): number {
  // `enabled` false (only guests are nudged to back up): skip the full read that otherwise re-runs after every save
  return useLiveQuery(
    async () => (enabled ? new Set((await getDB().transactions.toArray()).filter((t) => alive(t) && !t.isEstimate).map((t) => t.txnDate)).size : 0),
    [enabled],
    0,
  );
}

export function useSpendCount(): number {
  return useLiveQuery(async () => (await getDB().transactions.toArray()).filter((t) => alive(t) && !t.isEstimate).length, [], 0);
}

/** How many rows the server rejected and sync has set aside (shown as "N items couldn't sync"). */
export function useSyncFailureCount(): number {
  return useLiveQuery(async () => Object.keys((await getDB().meta.get('main'))?.syncFailures ?? {}).length, [], 0);
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

/** Builds (does not save) the transaction for a new spend: category/event links, the day it lands on, the pool flag. */
async function buildTxn(
  cycle: { startDate: string; totalDays: number; currentDay: number },
  spend: NewSpend,
  now: Date = new Date(),
  targetDay?: number,
  targetDate?: string,
): Promise<Txn> {
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
  let adjustsPool = spend.adjustPool !== false;

  if (targetDate) {
    entryDate = targetDate;
    const diff = daysBetween(cycle.startDate, targetDate);
    // a date in another month only ever counts in that month's own numbers
    if (!(diff >= 0 && diff < cycle.totalDays)) adjustsPool = true;
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

  const linkedCat = cats.find((c) => c.name.toLowerCase() === resolved.category.toLowerCase());
  const eventName = activeEvent?.trim() || null;
  const linkedEvent = eventName ? await findEventByName(db, eventName) : undefined;

  const txn: Txn = {
    id: txnId(),
    updatedAt: Date.now(),
    txnDate: entryDate,
    amount: roundMoney(spend.amount),
    label: spend.label,
    type: linkedCat?.name ?? resolved.category,
    categoryId: linkedCat?.id ?? null,
    subtype: resolved.subcategory,
    event: linkedEvent?.name ?? eventName,
    eventId: linkedEvent?.id ?? null,
    payment: spend.payment?.trim() || null,
    note: spend.note?.trim() || null,
    fromSavings: !!spend.fromSavings,
    adjustsPool,
    isEstimate: false,
    hour: now.getHours(),
    createdAt,
  };

  return txn;
}

type SpendCycle = { startDate: string; totalDays: number; currentDay: number };

/** Logs a spend on the cycle's current day (or a specific `targetDay` / `targetDate` when adding from History). */
export async function addSpend(
  cycle: SpendCycle,
  spend: NewSpend,
  now: Date = new Date(),
  targetDay?: number,
  targetDate?: string,
): Promise<Entry> {
  const db = getDB();
  const txn = await buildTxn(cycle, spend, now, targetDay, targetDate);
  await db.transaction('rw', [db.transactions, db.meta, db.plans], async () => {
    await extendTrackingStart(db, txn.txnDate);
    await db.transactions.add(txn);
    await db.meta.update('main', {
      lastUsedLabel: spend.label,
      ...(txn.payment ? { lastPayment: txn.payment } : {}),
    });
  });
  requestSync();
  return toEntry(txn, cycle);
}

/**
 * Updates an existing spend (from Today or History calendar). Pool, savings total and the
 * closed day row are re-derived in the same transaction.
 */
export async function updateEntry(id: string, patch: SpendUpdate): Promise<Entry | null> {
  const db = getDB();
  let saved: Txn | null = null;
  await db.transaction('rw', [db.transactions, db.cats, db.evts, db.loans], async () => {
    const prev = await db.transactions.get(id);
    if (!prev || prev.deletedAt != null) return;
    // The loan owns a Lend spend's amount, category and type (and who it was lent to): only note, payment and event edit.
    if ((await db.loans.where('txnId').equals(id).toArray()).some(alive)) {
      patch = { ...patch, amount: undefined, category: undefined, subcategory: undefined, label: undefined, fromSavings: undefined };
    }
    const cat = patch.category != null ? (await loadCategories(db)).find((c) => c.name.toLowerCase() === patch.category!.toLowerCase()) : undefined;
    const newEventName = patch.event !== undefined ? patch.event?.trim() || null : undefined;
    const ev = newEventName ? await findEventByName(db, newEventName) : undefined;
    const next: Txn = {
      ...prev,
      updatedAt: Date.now(),
      amount: patch.amount != null ? Math.max(0.01, roundMoney(patch.amount)) : prev.amount,
      label: patch.label != null ? patch.label.trim() || prev.label : prev.label,
      type: patch.category != null ? (cat?.name ?? patch.category) : prev.type,
      categoryId: patch.category != null ? (cat?.id ?? null) : prev.categoryId,
      subtype: patch.subcategory !== undefined ? patch.subcategory : prev.subtype,
      event: newEventName !== undefined ? (ev?.name ?? newEventName) : prev.event,
      eventId: newEventName !== undefined ? (ev?.id ?? null) : prev.eventId,
      payment: patch.payment !== undefined ? patch.payment?.trim() || null : prev.payment,
      note: patch.note !== undefined ? patch.note?.trim() || null : prev.note,
      fromSavings: patch.fromSavings != null ? patch.fromSavings : prev.fromSavings,
    };
    await db.transactions.put(next);
    saved = next;
  });
  if (!saved) return null;
  const t: Txn = saved;
  requestSync();
  return toEntry(t, await cycleFor(db, t.txnDate), await loadLinkNames(db));
}

/* ---------- extra income (lib/income.ts) ---------- */

export interface NewIncome {
  amount: number;
  /** Optional label (older rows). New incomes are just "Income" plus the note. */
  source?: string;
  payment?: string | null;
  note?: string | null;
  /** Event name; `undefined` = the active event, `null` = none. */
  event?: string | null;
}

/**
 * Records extra income on the cycle's current day (or `targetDay` / `targetDate` when adding from History). It raises that
 * month's money, so every remaining day gets more (a credit, see `incomeEffects`). It is not a spend and does not move when
 * budgeting started. Throws on invalid input; the UI checks first with `validateIncome`.
 */
export async function addIncome(
  cycle: { startDate: string; totalDays: number; currentDay: number },
  input: NewIncome,
  targetDay?: number,
  targetDate?: string,
): Promise<Income> {
  const db = getDB();
  const amount = roundMoney(input.amount);
  const source = (input.source ?? DEFAULT_INCOME_SOURCE).trim();
  const bad = validateIncome({ amount, source }, MAX_NAME);
  if (bad) throw new Error(bad);
  const date =
    targetDate ??
    dateOfDay(cycle.startDate, targetDay != null ? Math.min(Math.max(1, Math.round(targetDay)), cycle.totalDays) : cycle.currentDay);
  const stamp = Date.now();
  const event = input.event === undefined ? ((await db.meta.get('main'))?.activeEvent ?? null) : input.event;
  const income: Income = {
    id: uuid(),
    updatedAt: stamp,
    amount,
    source,
    date,
    event: event?.trim() || null,
    payment: input.payment ?? null,
    note: input.note?.trim() || null,
    createdAt: stamp,
  };
  await db.incomes.add(income);
  requestSync();
  return income;
}

/** Live extra incomes, newest first. `undefined` while loading. */
export function useIncomes(): Income[] | undefined {
  return useLiveQuery(
    async () => (await getDB().incomes.toArray()).filter(alive).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [],
  );
}

/** Takes an income back: the month's money drops by that amount again. */
export async function removeIncome(id: string): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.incomes.update(id, { deletedAt: now, updatedAt: now });
  requestSync();
}

/* ---------- lending (docs/ENHANCEMENTS.md E-LEND) ---------- */

export interface NewLoan {
  amount: number;
  person: string;
  kind: LoanKind;
  /** yyyy-mm-dd the money should be back, or null for "no date". */
  dueDate: string | null;
  payment?: string | null;
}

/**
 * Records a loan: the Lend spend (it lowers the month's money like any spend, the cash really left) and the loan row that
 * tracks it, written in ONE transaction so neither can exist without the other. Throws on invalid input; the UI checks first
 * with `validateLoan` and shows its message.
 */
export async function addLoan(
  cycle: SpendCycle,
  input: NewLoan,
  now: Date = new Date(),
  targetDay?: number,
  targetDate?: string,
): Promise<{ loan: Loan; entry: Entry }> {
  const db = getDB();
  const amount = roundMoney(input.amount);
  const person = input.person.trim();
  const kind = input.kind.trim();
  const txn = await buildTxn(
    cycle,
    {
      amount,
      label: person || input.kind.trim(),
      category: LEND_CATEGORY,
      subcategory: kind,
      payment: input.payment ?? null,
      fromSavings: false,
      adjustPool: true,
    },
    now,
    targetDay,
    targetDate,
  );
  const bad = validateLoan({ amount, person, kind, dueDate: input.dueDate }, txn.txnDate, MAX_NAME);
  if (bad) throw new Error(bad);
  const stamp = Date.now();
  const loan: Loan = {
    id: uuid(),
    updatedAt: stamp,
    txnId: txn.id,
    person,
    kind,
    amount,
    lentOn: txn.txnDate,
    dueDate: input.dueDate,
    willPay: 'yes', // no longer asked; kept as a column for sync compatibility
    repayments: [],
    writtenOff: false,
    writtenOffOn: null,
    holdBack: true, // always: a lend comes out of the daily amount until it is paid back (lib/lend.ts loanEffects)
    createdAt: stamp,
  };
  await db.transaction('rw', [db.transactions, db.loans, db.meta], async () => {
    // no extendTrackingStart: a loan is not spending, so a lend dated before budgeting began must not move its start
    await db.transactions.add(txn);
    await db.loans.add(loan);
    await db.meta.update('main', { lastUsedLabel: person || kind, ...(txn.payment ? { lastPayment: txn.payment } : {}) });
  });
  requestSync();
  return { loan, entry: toEntry(txn, cycle) };
}

/** Live loans (open and closed), newest first. `undefined` while loading. */
export function useLoans(): Loan[] | undefined {
  return useLiveQuery(async () => (await getDB().loans.toArray()).filter(alive).sort((a, b) => b.createdAt - a.createdAt), []);
}

/** Ids of the spends that belong to a loan: their amount and category are owned by the loan. */
export function useLoanTxnIds(): Set<string> {
  return (
    useLiveQuery(async () => new Set((await getDB().loans.toArray()).filter((l) => alive(l) && l.txnId).map((l) => l.txnId as string)), [], new Set<string>()) ??
    new Set<string>()
  );
}

async function patchLoan(id: string, f: (l: Loan) => Loan | null): Promise<Loan | null> {
  const db = getDB();
  let out: Loan | null = null;
  await db.transaction('rw', [db.loans], async () => {
    const l = await db.loans.get(id);
    if (!l || l.deletedAt != null) return;
    const next = f(l);
    if (!next) return;
    await db.loans.put({ ...next, updatedAt: Date.now() });
    out = next;
  });
  if (out) requestSync();
  return out;
}

/**
 * Money came back. Clamped to what is still owed; ignored when nothing is owed. The wallet gets back what the lend took
 * out, but the lend never touched the budget, so neither does this (lib/lend.ts). Append-only: a mistake is undone with
 * `undoLastRepayment`.
 */
export async function recordRepayment(id: string, amount: number, date: string = todayISO()): Promise<Loan | null> {
  return patchLoan(id, (l) => {
    const owed = remaining(l);
    const a = Math.min(roundMoney(amount), owed);
    if (!(a > 0)) return null;
    return { ...l, repayments: [...l.repayments, { id: uuid(), amount: a, date }] };
  });
}

export async function undoLastRepayment(id: string): Promise<Loan | null> {
  return patchLoan(id, (l) => (l.repayments.length ? { ...l, repayments: l.repayments.slice(0, -1), writtenOff: false, writtenOffOn: null } : null));
}

export async function setLoanDue(id: string, dueDate: string | null): Promise<Loan | null> {
  return patchLoan(id, (l) => (dueDate && dueDate < l.lentOn ? null : { ...l, dueDate }));
}

/**
 * The rest is not coming back. It is now a real loss: what was still owed counts as spent in the month it is written off
 * (a month-level debit that lowers the pool, never "left today"), once. Nothing else about a loan touches the budget.
 */
export async function writeOffLoan(id: string, date: string = todayISO()): Promise<Loan | null> {
  return patchLoan(id, (l) => (remaining(l) > 0 ? { ...l, writtenOff: true, writtenOffOn: date } : null));
}

/** Takes a write-off back: the loan is open again and the month gets the money back. */
export async function reopenLoan(id: string): Promise<Loan | null> {
  return patchLoan(id, (l) => (l.writtenOff ? { ...l, writtenOff: false, writtenOffOn: null } : null));
}

/** Soft delete: the tombstone syncs; the month's numbers are derived, so nothing else changes. */
export async function removeEntry(id: string): Promise<'removed' | 'has-repayments'> {
  const db = getDB();
  let result: 'removed' | 'has-repayments' = 'removed';
  await db.transaction('rw', [db.transactions, db.loans], async () => {
    const t = await db.transactions.get(id);
    if (!t || t.deletedAt != null) return;
    const now = Date.now();
    // A Lend spend takes its loan with it (the record of who owes what is meaningless without the spend), unless money
    // already came back: that credit is in the month's numbers, so the loan has to be settled or written off in Lend instead.
    const loan = (await db.loans.where('txnId').equals(id).toArray()).find(alive);
    if (loan) {
      if (loan.repayments.length > 0) {
        result = 'has-repayments';
        return;
      }
      await db.loans.update(loan.id, { deletedAt: now, updatedAt: now });
    }
    await db.transactions.update(id, { deletedAt: now, updatedAt: now });
  });
  if (result === 'removed') requestSync();
  return result;
}

/* ---------- the day and the month ---------- */

/**
 * What today cost and what tomorrow's amount will be. Read-only; `closeToday` is the action that moves on.
 */
export async function previewCloseDay(today: string = todayISO()): Promise<CloseResult | null> {
  const db = getDB();
  const c = await cycleFor(db, today, today);
  if (!c || c.currentDay > c.totalDays) return null;
  const lend = await lendTxnIds(db);
  const spends = (await db.transactions.where('txnDate').equals(today).toArray()).filter((t) => alive(t) && !lend.has(t.id));
  return closeDay(c, spentToday(spends));
}

/**
 * "Close the day": the user says the day on screen is done. Returns the recap (tomorrow's amount) and, from that
 * moment, the app treats the next day as today instead of waiting for midnight. The day on screen is whatever
 * `todayISO()` says, so a user who closed early can log the next day and close that too.
 * Stored per device in `meta.closedThrough`; nothing is synced and no month state is stored.
 */
export async function closeToday(): Promise<CloseResult | null> {
  const day = todayISO();
  const r = await previewCloseDay(day);
  if (!r) return null;
  const db = getDB();
  const m = await db.meta.get('main');
  if (m) await db.meta.update('main', { closedThrough: day });
  else await db.meta.put({ id: 'main', lastUsedLabel: null, schemaVersion: SCHEMA_VERSION, closedThrough: day });
  setClosedThrough(day);
  return r;
}

/** One amount per month: if two devices both moved the same month, the newest row wins. `byMonth` is newest month first. */
export function leftoverTotals(rows: { monthId: string; amount: number; updatedAt: number; deletedAt?: number | null }[]): {
  total: number;
  months: number;
  byMonth: { monthId: string; amount: number }[];
} {
  const by = new Map<string, { monthId: string; amount: number; updatedAt: number }>();
  for (const r of rows) {
    if (r.deletedAt != null || r.amount <= 0) continue;
    const cur = by.get(r.monthId);
    if (!cur || r.updatedAt > cur.updatedAt) by.set(r.monthId, r);
  }
  const byMonth = [...by.values()].map(({ monthId, amount }) => ({ monthId, amount })).sort((a, b) => b.monthId.localeCompare(a.monthId));
  return { total: byMonth.reduce((s, r) => s + r.amount, 0), months: byMonth.length, byMonth };
}

/** Running total of leftovers moved to savings, and how many months contributed. */
const NO_LEFTOVERS = { total: 0, months: 0, byMonth: [] as { monthId: string; amount: number }[] };
export function useSavedFromLeftovers() {
  return useLiveQuery(async () => leftoverTotals(await getDB().leftovers.toArray()), [], NO_LEFTOVERS) ?? NO_LEFTOVERS;
}

/** Marks a finished month's recap as seen. Synced (`monthRecaps`), so it stays seen on every device and after a login. */
export async function dismissMonthSummary(cycleId: string): Promise<void> {
  const db = getDB();
  const now = Date.now();
  await db.transaction('rw', [db.monthRecaps, db.meta], async () => {
    const rows = await db.monthRecaps.where('monthId').equals(cycleId).toArray();
    const live = rows.find(alive);
    if (live) return;
    const dead = rows[0];
    if (dead) await db.monthRecaps.update(dead.id, { deletedAt: null, seenAt: now, updatedAt: now });
    else await db.monthRecaps.add({ id: uuid(), monthId: cycleId, seenAt: now, updatedAt: now });
  });
  requestSync();
}

/** Finished months (newest first) that can be looked back on in History: any past month with something logged. */
export function usePastMonthRecaps(): { cycle: DerivedCycle; seen: boolean }[] | undefined {
  const today = useToday();
  return useLiveQuery(async () => {
    const db = getDB();
    const [cycles, meta, rows] = await Promise.all([allCycles(db, today), db.meta.get('main'), db.monthRecaps.toArray()]);
    const seen = new Set([...(meta?.monthSummarySeen ?? []), ...rows.filter(alive).map((r) => r.monthId)]);
    return cycles
      .filter((c) => c.monthEnd < today && (c.fromSavingsTotal > 0 || c.days.some((d) => d.spent > 0)))
      .sort((a, b) => b.monthStart.localeCompare(a.monthStart))
      .map((cycle) => ({ cycle, seen: seen.has(cycle.id) }));
  }, [today]);
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

/**
 * Repairs duplicate categories. A user-created row (baseId null) whose name matches a visible default, or an
 * older user-created row of the same name, is a duplicate: old full copies of the defaults, guest data claimed into
 * an account, or the same name created on two devices. Its spends are re-pointed to the kept category, extra
 * subcategories are kept (as an override for a default, or added to the kept row), and the duplicate is tombstoned
 * so the repair syncs to every device. Idempotent. Must run inside a transaction that includes `cats` and
 * `transactions` (or opens its own when called outside one).
 */
export async function dedupeCategories(db: StashDB = getDB()): Promise<number> {
  return db.transaction('rw', [db.cats, db.transactions], async () => {
    const rows = await db.cats.toArray();
    const now = Date.now();
    const removedDefaults = new Set<string>();
    const latestOverride = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      if (!r.baseId) continue;
      const prev = latestOverride.get(r.baseId);
      if (!prev || r.updatedAt > prev.updatedAt) latestOverride.set(r.baseId, r);
    }
    for (const [key, o] of latestOverride) if (o.deletedAt != null) removedDefaults.add(key);
    const visibleDefault = new Map(
      DEFAULT_CATEGORIES.filter((d) => d.isSystem || !removedDefaults.has(d.key)).map((d) => [d.name.toLowerCase(), d]),
    );
    const own = rows
      .filter((r) => r.baseId == null && r.deletedAt == null)
      .sort((a, b) => a.updatedAt - b.updatedAt || a.id.localeCompare(b.id));
    const keptOwn = new Map<string, (typeof rows)[number]>();
    let fixed = 0;
    for (const r of own) {
      const lower = r.name.trim().toLowerCase();
      const d = visibleDefault.get(lower);
      const keeper = keptOwn.get(lower);
      if (!d && !keeper) {
        keptOwn.set(lower, r);
        continue;
      }
      const targetId = d ? d.key : keeper!.id;
      const extra = r.subcategories.filter((s) => !(d ? d.subcategories : keeper!.subcategories).includes(s));
      if (extra.length && d) {
        const o = await overrideFor(db, d.key, now);
        const subAdded = [...o.subAdded, ...extra.filter((s) => !o.subAdded.includes(s))];
        const subRemoved = o.subRemoved.filter((s) => !extra.includes(s));
        await db.cats.update(o.id, { subAdded, subRemoved, updatedAt: now });
      } else if (extra.length && keeper) {
        const subcategories = [...keeper.subcategories, ...extra];
        await db.cats.update(keeper.id, { subcategories, updatedAt: now });
        keeper.subcategories = subcategories;
      }
      const linked = await db.transactions.where('categoryId').equals(r.id).toArray();
      for (const t of linked) await db.transactions.update(t.id, { categoryId: targetId, type: d ? d.name : keeper!.name, updatedAt: now });
      await db.cats.update(r.id, { deletedAt: now, updatedAt: now });
      fixed++;
    }
    return fixed;
  });
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

/**
 * Renames a user-created category. Transactions link by id so history follows; events list
 * categories by name, so those lists are updated. Defaults and "Other" keep their names.
 */
export async function renameCategory(catId: string, name: string): Promise<string | null> {
  const db = getDB();
  const trimmed = name.trim();
  const all = await loadCategories(db);
  const c = all.find((x) => x.id === catId);
  if (!c) return 'That category is gone.';
  if (c.isSystem || c.baseId) return "Built-in categories can't be renamed.";
  const err = validateName(trimmed, all.filter((x) => x.id !== catId).map((x) => x.name));
  if (err) return err;
  await db.transaction('rw', [db.cats, db.evts, db.meta], async () => {
    const now = Date.now();
    await db.cats.update(catId, { name: trimmed, updatedAt: now });
    await updatePins(db, (k) => renamePinnedCategory(k, c.name, trimmed));
    for (const ev of (await db.evts.toArray()).filter(alive)) {
      if (ev.categories.includes(c.name)) {
        await db.evts.update(ev.id, { categories: ev.categories.map((x) => (x === c.name ? trimmed : x)), updatedAt: now });
      }
    }
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
  await db.transaction('rw', [db.cats, db.transactions, db.meta], async () => {
    const c = (await loadCategories(db)).find((x) => x.id === catId);
    if (!c) return;
    const now = Date.now();
    await updatePins(db, (k) => dropPinned(k, c.name, name));
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
      .filter((t) => inCategory(t, c) && t.subtype === name && alive(t))
      .modify({ subtype: null, updatedAt: now });
  });
  requestSync();
}

/** Spends move to Other. "Other" itself can't be removed. */
export async function removeCategory(catId: string): Promise<void> {
  const db = getDB();
  await db.transaction('rw', [db.cats, db.transactions, db.evts, db.meta], async () => {
    const c = (await loadCategories(db)).find((x) => x.id === catId);
    if (!c || c.isSystem) return;
    const now = Date.now();
    await updatePins(db, (k) => dropPinned(k, c.name));
    await db.transactions
      .filter((t) => alive(t) && inCategory(t, c))
      .modify({ type: 'Other', categoryId: 'other', subtype: null, updatedAt: now });
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

/** Live event by case-insensitive name; the oldest wins if (legacy) duplicates exist. */
async function findEventByName(db: StashDB, name: string): Promise<StashEvent | undefined> {
  const key = name.trim().toLowerCase();
  return (await db.evts.toArray())
    .filter(alive)
    .sort((a, b) => a.createdAt - b.createdAt)
    .find((e) => e.name.toLowerCase() === key);
}

/**
 * Renames an event. Transactions link by id, so history follows without rewriting any of them;
 * their name snapshot is refreshed lazily the next time they are edited.
 */
export async function renameEvent(eventId: string, name: string): Promise<string | null> {
  const db = getDB();
  const trimmed = name.trim();
  const all = (await db.evts.toArray()).filter(alive);
  const ev = all.find((e) => e.id === eventId);
  if (!ev) return 'That event is gone.';
  const err = validateName(trimmed, all.filter((e) => e.id !== eventId).map((e) => e.name));
  if (err) return err;
  await db.transaction('rw', [db.evts, db.meta], async () => {
    await db.evts.update(eventId, { name: trimmed, updatedAt: Date.now() });
    const meta = await db.meta.get('main');
    if (meta?.activeEvent === ev.name) await db.meta.update('main', { activeEvent: trimmed });
  });
  requestSync();
  return null;
}

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
    await db.transactions.filter((t) => alive(t) && inEvent(t, ev)).modify({ event: null, eventId: null, updatedAt: now });
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

/* ---------- event checklist (occasions): lib/eventPlan.ts, docs/FLOWS.md 19c ---------- */

/** The spends the items point at, keyed by id (dead or missing ones are simply absent or flagged by `deletedAt`). */
async function itemTxnMap(db: StashDB, items: readonly EventItem[]): Promise<Map<string, ItemTxn>> {
  const ids = items.map((i) => i.txnId).filter((x): x is string => !!x);
  const rows = ids.length ? await db.transactions.bulkGet(ids) : [];
  const m = new Map<string, ItemTxn>();
  rows.forEach((t) => t && m.set(t.id, { amount: t.amount, fromSavings: t.fromSavings, deletedAt: t.deletedAt }));
  return m;
}

export interface PlannedItem {
  item: EventItem;
  state: ItemState;
}
export interface EventPlanView {
  event: StashEvent;
  items: PlannedItem[];
  totals: PlanTotals;
}

async function loadPlan(db: StashDB, ev: StashEvent): Promise<EventPlanView> {
  const items = normalizeItems(ev.items);
  const txns = await itemTxnMap(db, items);
  return { event: ev, items: items.map((item) => ({ item, state: itemState(item, txns) })), totals: planTotals(items, txns) };
}

/** Non-hook read of one occasion (used by tests and one-off checks). */
export async function getEventPlan(eventId: string): Promise<EventPlanView | null> {
  const db = getDB();
  const ev = await liveEvent(db, eventId);
  return ev ? loadPlan(db, ev) : null;
}

/** One occasion with its items; `null` once the event is deleted. Re-reads when the event or any spend changes. */
export function useEventPlan(eventId: string | null): EventPlanView | null | undefined {
  return useLiveQuery(async () => {
    if (!eventId) return null;
    const db = getDB();
    const ev = await db.evts.get(eventId);
    return ev && alive(ev) ? loadPlan(db, ev) : null;
  }, [eventId]);
}

/** Every event that has a checklist, newest first. */
export function useOccasions(): EventPlanView[] | undefined {
  return useLiveQuery(async () => {
    const db = getDB();
    const evs = (await db.evts.toArray()).filter((e) => alive(e) && normalizeItems(e.items).length > 0);
    evs.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(evs.map((e) => loadPlan(db, e)));
  }, []);
}

async function liveEvent(db: StashDB, eventId: string): Promise<StashEvent | null> {
  const ev = await db.evts.get(eventId);
  return ev && alive(ev) ? ev : null;
}

/**
 * Creates an event together with its checklist. It does NOT turn the event on: planning an occasion and logging into an
 * event are different jobs (paying an item tags the spend by id, whether or not the event is the active one).
 */
export async function createOccasion(
  name: string,
  items: { name: string; planned: number }[],
): Promise<{ error: string | null; id?: string }> {
  const db = getDB();
  const trimmed = name.trim();
  const all = (await db.evts.toArray()).filter(alive);
  const err = validateName(trimmed, all.map((e) => e.name));
  if (err) return { error: err };
  let list: EventItem[] = [];
  const now = Date.now();
  for (const it of items) {
    const r = addItem(list, it.name, it.planned, uuid(), now);
    if (r.error || !r.items) return { error: `${it.name || 'An item'}: ${r.error ?? 'could not add'}` };
    list = r.items;
  }
  const id = uuid();
  await db.evts.add({ id, updatedAt: now, name: trimmed, note: null, categories: [], createdAt: now, items: list });
  requestSync();
  return { error: null, id };
}

type ItemEdit = (items: EventItem[], txns: Map<string, ItemTxn>) => { items: EventItem[] | null; error: string | null };

/** Reads the event's items, applies a pure edit, writes the result: all in one transaction. */
async function editItems(eventId: string, edit: ItemEdit): Promise<string | null> {
  const db = getDB();
  let error: string | null = null;
  await db.transaction('rw', [db.evts, db.transactions], async () => {
    const ev = await liveEvent(db, eventId);
    if (!ev) { error = 'That event is gone.'; return; }
    const cur = normalizeItems(ev.items);
    const r = edit(cur, await itemTxnMap(db, cur));
    if (r.error || !r.items) { error = r.error ?? 'Could not save.'; return; }
    await db.evts.update(eventId, { items: r.items, updatedAt: Date.now() });
  });
  if (!error) requestSync();
  return error;
}

export const addEventItem = (eventId: string, name: string, planned: number) =>
  editItems(eventId, (items) => addItem(items, name, planned, uuid(), Date.now()));

export const updateEventItem = (eventId: string, itemId: string, patch: { name?: string; planned?: number }) =>
  editItems(eventId, (items) => updateItem(items, itemId, patch));

/** Refused while the item is paid: untick it first. */
export const removeEventItem = (eventId: string, itemId: string) =>
  editItems(eventId, (items, txns) => removeItem(items, itemId, txns));

/**
 * Ticks an item: logs a real spend (label = item name, tagged with the event) and links it, in one transaction.
 * "From savings" never touches the daily amount. Returns an error message, or null.
 */
export async function payEventItem(
  cycle: SpendCycle,
  eventId: string,
  itemId: string,
  opts: { amount: number; fromSavings: boolean; /** ISO day to log it on (the log screen's day); default = the cycle's current day. */ date?: string },
  now: Date = new Date(),
): Promise<string | null> {
  const amountErr = validateAmount(opts.amount);
  if (amountErr) return amountErr;
  const db = getDB();
  const ev0 = await liveEvent(db, eventId);
  if (!ev0) return 'That event is gone.';
  const item0 = normalizeItems(ev0.items).find((i) => i.id === itemId);
  if (!item0) return 'That item is gone.';
  const txn = await buildTxn(
    cycle,
    { amount: opts.amount, label: item0.name, category: ev0.categories[0], event: ev0.name, fromSavings: opts.fromSavings },
    now,
    undefined,
    opts.date,
  );
  txn.event = ev0.name;
  txn.eventId = ev0.id;
  let error: string | null = null;
  await db.transaction('rw', [db.transactions, db.meta, db.plans, db.evts], async () => {
    // re-check under the lock: another tab or device may have changed the item meanwhile
    const ev = await liveEvent(db, eventId);
    const items = normalizeItems(ev?.items);
    const item = items.find((i) => i.id === itemId);
    if (!ev || !item) { error = 'That item is gone.'; return; }
    if (itemState(item, await itemTxnMap(db, [item])).paid) { error = 'That item is already paid.'; return; }
    await extendTrackingStart(db, txn.txnDate);
    await db.transactions.add(txn);
    await db.evts.update(eventId, { items: setItemTxn(items, itemId, txn.id), updatedAt: Date.now() });
  });
  if (!error) requestSync();
  return error;
}

/** Unticks an item: removes the spend that paid it and makes the item a plan again. */
export async function unpayEventItem(eventId: string, itemId: string): Promise<string | null> {
  const db = getDB();
  let error: string | null = null;
  await db.transaction('rw', [db.evts, db.transactions], async () => {
    const ev = await liveEvent(db, eventId);
    const items = normalizeItems(ev?.items);
    const item = items.find((i) => i.id === itemId);
    if (!ev || !item) { error = 'That item is gone.'; return; }
    const now = Date.now();
    if (item.txnId) {
      const t = await db.transactions.get(item.txnId);
      if (t && alive(t)) await db.transactions.update(t.id, { deletedAt: now, updatedAt: now });
    }
    await db.evts.update(eventId, { items: setItemTxn(items, itemId, null), updatedAt: now });
  });
  if (!error) requestSync();
  return error;
}

/* ---------- sample data ---------- */

/**
 * Fills the sample sandbox with two months of dummy spends: all of last month, and this month up to yesterday. Only ever
 * runs on the throwaway sample database (lib/sampleMode.ts), never on a real account or a real guest's data.
 */
export async function fillSample(now: Date = new Date()): Promise<void> {
  if (getActiveDBUid() !== SAMPLE_UID) throw new Error('Sample data only goes into the sample sandbox');
  await ensureSeed();
  const db = getDB();
  // Loaded only here: the sample generator is not needed on the first page.
  const { DEFAULT_SAMPLE_PLAN, generateSampleSpends } = await import('@/lib/sample');
  const plan: PlanInput = DEFAULT_SAMPLE_PLAN;
  const today = todayISO(now);
  const startDate = periodFor(1, addDays(periodFor(1, today).start, -1)).start; // the 1st of last month
  const sampleDays = daysBetween(startDate, today); // through yesterday (0 spends on the 1st of a month for "this month")
  const spends = generateSampleSpends(startDate, sampleDays);
  const cats = await loadCategories(db);
  const stamp = Date.now();

  await db.transaction('rw', [db.plans, db.transactions, db.evts, db.meta], async () => {
    await db.meta.update('main', { sampleLoaded: true });
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
    await db.plans.add({ id: uuid(), createdAt: stamp, effectiveFrom: startDate, ...planFields(plan, 1, stamp) });
    const txns: Txn[] = [];
    for (let day = 1; day <= sampleDays; day++) {
      const mine = spends.filter((s) => s.day === day);
      const dayIso = dateOfDay(startDate, day);
      const [y, m, d] = dayIso.split('-').map(Number);
      const dom = d;
      mine.forEach((s, i) => {
        const cat = cats.find((c) => c.name === s.category);
        const sub = cat?.subcategories.find((t) => t === s.subcategory) ?? null;
        const resolvedCat = cat ? cat.name : 'Other';
        let sampleEvent: string | null = null;
        if ((dom === 14 || dom === 15) && ['Travel', 'Food', 'Fun'].includes(resolvedCat)) {
          sampleEvent = 'Weekend getaway';
        } else if (dom === 8 && ['Food', 'Home'].includes(resolvedCat)) {
          sampleEvent = 'Family dinner';
        }
        txns.push({
          id: txnId(),
          updatedAt: stamp,
          txnDate: dayIso,
          amount: s.amount,
          label: s.label,
          type: resolvedCat,
          categoryId: cat?.id ?? 'other',
          subtype: cat ? sub : null,
          event: sampleEvent,
          eventId: null,
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
  });
}

/* ---------- export / delete ---------- */

export async function exportCSV(): Promise<string> {
  // Signed in: sync first, so the file has everything this account holds (other devices' spends) and anything still
  // waiting on this phone is uploaded. Offline or a slow network never blocks the export: it waits a few seconds, then exports.
  if (getAuth().uid) {
    await Promise.race([syncNow().catch(() => {}), new Promise<void>((r) => setTimeout(r, 8000))]);
  }
  const db = getDB();
  const [cycles, txns, names] = await Promise.all([allCycles(db), db.transactions.toArray(), loadLinkNames(db)]);
  const rows: CsvRow[] = txns
    .filter(alive)
    .sort((a, b) => a.txnDate.localeCompare(b.txnDate) || a.createdAt - b.createdAt)
    .map((t) => ({ t, c: cycleOfDate(cycles, t.txnDate) }))
    .map(({ t, c }) => ({
      date: t.txnDate,
      day: c ? dayOfTxn(c, t.txnDate) : 0,
      amount: t.amount,
      label: t.label,
      category: catNameOf(t, names),
      type: t.subtype ?? '',
      fromSavings: t.fromSavings,
      estimate: t.isEstimate,
      payment: t.payment ?? '',
      event: eventNameOf(t, names) ?? '',
      note: t.note ?? '',
    }));
  return buildCSV(rows);
}

/**
 * Resets the active user's data so they can start over.
 * - Guest (never syncs): clears every local table.
 * - Signed in: tombstones every plan, cycle, spend, custom category and event (soft delete), so the
 *   deletion syncs to the cloud and to the user's other devices instead of being restored from them.
 *   The account itself stays. If offline, the tombstones are pushed on the next sync.
 */
export async function deleteAllData(): Promise<void> {
  const db = getDB();
  if (!getAuth().uid) {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
    await ensureSeed();
    return;
  }
  const now = Date.now();
  await db.transaction(
    'rw',
    [db.plans, db.transactions, db.cats, db.evts, db.leftovers, db.loans, db.incomes, db.monthRecaps, db.meta],
    async () => {
      const tombstone = { deletedAt: now, updatedAt: now };
      await db.leftovers.toCollection().modify(tombstone);
      await db.loans.toCollection().modify(tombstone);
      await db.incomes.toCollection().modify(tombstone);
      await db.monthRecaps.toCollection().modify(tombstone);
      await db.transactions.toCollection().modify(tombstone);
      await db.plans.toCollection().modify(tombstone);
      await db.cats.toCollection().modify(tombstone);
      await db.evts.toCollection().modify(tombstone);
      await db.meta.update('main', {
        sampleLoaded: false, lastUsedLabel: null, activeEvent: null,
        monthSummarySeen: [], leftoverMoved: [],
      });
    },
  );
  await ensureSeed();
  // Push now (not debounced) so the tombstones leave before the user can sign out or switch DBs.
  await syncNow().catch(() => {});
}
