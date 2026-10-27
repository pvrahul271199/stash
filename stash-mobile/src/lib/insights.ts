import { weekdayOfDay } from './dates';
import { pace, projection, todayAllowance, type CycleState } from './budget';
import { inr } from './format';

export type DayStatus = 'closed' | 'estimated' | 'today' | 'future';

export interface InsightEntry {
  day: number;
  amount: number;
  label: string;
  category: string;
  subcategory: string | null;
  fromSavings: boolean;
  isEstimate: boolean;
  hour: number;
}

export interface InsightDayRow {
  day: number;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

export interface InsightCycle extends CycleState {
  startDate: string;
  planAmount: number;
}

export interface DayPoint {
  day: number;
  status: DayStatus;
  /** Spend that follows the focus category (excludes fromSavings). */
  spent: number;
  /** All daily-money spend regardless of focus. */
  totalSpent: number;
  /** From savings (follows focus). */
  fromSavings: number;
  allowance: number | null;
  /** All categories for the day, biggest first (ignores focus). */
  byCategory: [string, number][];
  /** Types for the focused category, biggest first. */
  byType: [string, number][];
}

const sortDesc = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1]);

export function buildDays(
  cycle: InsightCycle,
  rows: InsightDayRow[],
  entries: InsightEntry[],
  focus: string | null,
): DayPoint[] {
  const rowBy = new Map(rows.map((r) => [r.day, r]));
  const over = cycle.currentDay > cycle.totalDays;
  const out: DayPoint[] = [];
  for (let day = 1; day <= cycle.totalDays; day++) {
    const mine = entries.filter((e) => e.day === day);
    let spent = 0;
    let totalSpent = 0;
    let fromSavings = 0;
    const cats = new Map<string, number>();
    const types = new Map<string, number>();
    for (const e of mine) {
      const inFocus = !focus || e.category === focus;
      if (e.fromSavings) {
        if (inFocus) fromSavings += e.amount;
        continue;
      }
      totalSpent += e.amount;
      cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
      if (inFocus) {
        spent += e.amount;
        if (focus) {
          const t = e.subcategory ?? 'No type';
          types.set(t, (types.get(t) ?? 0) + e.amount);
        }
      }
    }
    const row = rowBy.get(day);
    let status: DayStatus;
    let allowance: number | null = null;
    if (row) {
      status = row.status;
      allowance = row.allowanceAtStart;
    } else if (day < cycle.currentDay || over) {
      status = 'closed';
    } else if (day === cycle.currentDay) {
      status = 'today';
      allowance = todayAllowance(cycle);
    } else status = 'future';
    out.push({ day, status, spent, totalSpent, fromSavings, allowance, byCategory: sortDesc(cats), byType: sortDesc(types) });
  }
  return out;
}

/** Colors by rank of total spending (biggest first). Zero-spend categories follow in sort order. */
export function categoryColorMap(
  entries: Pick<InsightEntry, 'category' | 'amount' | 'fromSavings'>[],
  categoryNames: string[],
  ramp: readonly string[],
): Record<string, string> {
  const totals = new Map<string, number>(categoryNames.map((n) => [n, 0]));
  for (const e of entries) if (!e.fromSavings) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  const order = [...totals.keys()].sort((a, b) => (totals.get(b)! - totals.get(a)!) || categoryNames.indexOf(a) - categoryNames.indexOf(b));
  const map: Record<string, string> = {};
  order.forEach((n, i) => (map[n] = ramp[i % ramp.length]));
  return map;
}

export interface CategoryTotal {
  name: string;
  total: number;
  pct: number;
  types: { name: string; total: number }[];
}

export function categoryTotals(entries: InsightEntry[]): CategoryTotal[] {
  const cats = new Map<string, { total: number; types: Map<string, number> }>();
  let grand = 0;
  for (const e of entries) {
    if (e.fromSavings) continue;
    grand += e.amount;
    const c = cats.get(e.category) ?? { total: 0, types: new Map() };
    c.total += e.amount;
    const t = e.subcategory ?? 'No type';
    c.types.set(t, (c.types.get(t) ?? 0) + e.amount);
    cats.set(e.category, c);
  }
  return [...cats.entries()]
    .map(([name, c]) => ({
      name,
      total: c.total,
      pct: grand ? (c.total / grand) * 100 : 0,
      types: sortDesc(new Map([...c.types].map(([k, v]) => [k, v]))).map(([n, total]) => ({ name: n, total })),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

/* ---------- day of week ---------- */

export interface WeekdayStat {
  wd: number;
  letter: string;
  name: string;
  total: number;
  count: number;
  avg: number;
}

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WD_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WD_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

export function weekdayStats(days: DayPoint[], startDate: string): { stats: WeekdayStat[]; closedCount: number; usual: number } {
  const closed = days.filter((d) => d.status === 'closed' || d.status === 'estimated');
  const stats = WD_ORDER.map((wd) => {
    const mine = closed.filter((d) => weekdayOfDay(startDate, d.day) === wd);
    const total = mine.reduce((s, d) => s + d.spent, 0);
    return { wd, letter: WD_LETTER[wd], name: WD_PLURAL[wd], total, count: mine.length, avg: mine.length ? total / mine.length : 0 };
  });
  const sum = closed.reduce((s, d) => s + d.spent, 0);
  return { stats, closedCount: closed.length, usual: closed.length ? sum / closed.length : 0 };
}

export function weekdayDetail(s: WeekdayStat, usual: number): string {
  if (s.count === 0) return `No ${s.name.toLowerCase()} closed yet.`;
  const diff = s.avg - usual;
  const head = `${s.name} average ${inr(s.avg)} over ${s.count} ${s.count === 1 ? 'day' : 'days'}`;
  if (Math.abs(diff) < 1) return `${head}, about the same as your usual ${inr(usual)}.`;
  return `${head}, ${inr(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than your usual ${inr(usual)}.`;
}

/* ---------- time of day ---------- */

export type BucketId = 'morning' | 'afternoon' | 'evening' | 'night';

export function bucketOfHour(h: number): BucketId {
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'afternoon';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

export interface TimeBucket {
  id: BucketId;
  label: string;
  range: string;
  total: number;
  count: number;
  top: { label: string; total: number }[];
}

const BUCKETS: { id: BucketId; label: string; range: string }[] = [
  { id: 'morning', label: 'Morning', range: '5am to 11am' },
  { id: 'afternoon', label: 'Afternoon', range: '11am to 4pm' },
  { id: 'evening', label: 'Evening', range: '4pm to 8pm' },
  { id: 'night', label: 'Night', range: '8pm to 5am' },
];

/** Estimates have no real hour, so they are skipped. */
export function timeBuckets(entries: InsightEntry[], focus: string | null): TimeBucket[] {
  return BUCKETS.map((b) => {
    const mine = entries.filter(
      (e) => !e.fromSavings && !e.isEstimate && (!focus || e.category === focus) && bucketOfHour(e.hour) === b.id,
    );
    const by = new Map<string, number>();
    mine.forEach((e) => by.set(e.label, (by.get(e.label) ?? 0) + e.amount));
    return {
      ...b,
      total: mine.reduce((s, e) => s + e.amount, 0),
      count: mine.length,
      top: sortDesc(by).slice(0, 3).map(([label, total]) => ({ label, total })),
    };
  });
}

export function bucketDetail(b: TimeBucket): string {
  if (b.count === 0) return `Nothing logged in the ${b.label.toLowerCase()}.`;
  const top = b.top.map((t) => `${t.label} (${inr(t.total)})`).join(', ');
  return `${b.count} ${b.count === 1 ? 'spend' : 'spends'}. Mostly ${top}.`;
}

/* ---------- patterns and biggest ---------- */

export function mostFrequent(entries: InsightEntry[], focus: string | null) {
  const mine = entries.filter((e) => !e.fromSavings && !e.isEstimate && (!focus || e.category === focus));
  const by = new Map<string, { count: number; total: number }>();
  mine.forEach((e) => {
    const c = by.get(e.label) ?? { count: 0, total: 0 };
    c.count++;
    c.total += e.amount;
    by.set(e.label, c);
  });
  let best: { label: string; count: number; total: number } | null = null;
  for (const [label, c] of by) if (!best || c.count > best.count || (c.count === best.count && c.total > best.total)) best = { label, ...c };
  return best && best.count > 1 ? best : null;
}

export function fromSavingsTotal(entries: InsightEntry[], focus: string | null): number {
  return entries.filter((e) => e.fromSavings && (!focus || e.category === focus)).reduce((s, e) => s + e.amount, 0);
}

export function biggestSpends(entries: InsightEntry[], focus: string | null, n = 5): InsightEntry[] {
  return entries
    .filter((e) => !e.isEstimate && (!focus || e.category === focus))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

/* ---------- summary ---------- */

export interface Summary {
  spentSoFar: number;
  closedDays: number;
  spentOnClosed: number;
  averageDay: number | null;
  leftToLive: number;
  /** Fraction (0-1) of the bar where today's on-plan point sits. */
  planMarker: number;
  paceMessage: string | null;
  projectionMessage: string | null;
}

export const MIN_CLOSED_DAYS = 3;

export function summarize(cycle: InsightCycle, days: DayPoint[]): Summary {
  const closed = days.filter((d) => d.status === 'closed' || d.status === 'estimated');
  const spentOnClosed = closed.reduce((s, d) => s + d.totalSpent, 0);
  const todayPoint = days.find((d) => d.status === 'today');
  const spentSoFar = spentOnClosed + (todayPoint?.totalSpent ?? 0);
  const closedDays = closed.length;
  const enough = closedDays >= MIN_CLOSED_DAYS;
  return {
    spentSoFar,
    closedDays,
    spentOnClosed,
    averageDay: closedDays ? spentOnClosed / closedDays : null,
    leftToLive: Math.max(cycle.pool - (todayPoint?.totalSpent ?? 0), 0),
    planMarker: Math.min(closedDays / cycle.totalDays, 1),
    paceMessage: enough ? pace(cycle.planAmount, cycle.totalDays, closedDays, spentOnClosed).message : null,
    projectionMessage: enough
      ? projection(cycle.planAmount, cycle.totalDays, closedDays, spentOnClosed)?.message ?? null
      : null,
  };
}

/** Running total through the last day that has data. */
export function cumulative(days: DayPoint[]): { day: number; value: number }[] {
  const out: { day: number; value: number }[] = [];
  let sum = 0;
  for (const d of days) {
    if (d.status === 'future') break;
    sum += d.spent;
    out.push({ day: d.day, value: sum });
  }
  return out;
}

/** Projected end-of-month value for the (focused) running total. */
export function projectTotal(days: DayPoint[], totalDays: number): { fromDay: number; fromValue: number; endValue: number } | null {
  const closed = days.filter((d) => d.status === 'closed' || d.status === 'estimated');
  if (!closed.length) return null;
  const sum = closed.reduce((s, d) => s + d.spent, 0);
  const avg = sum / closed.length;
  const last = closed[closed.length - 1].day;
  if (last >= totalDays) return null;
  return { fromDay: last, fromValue: sum, endValue: sum + avg * (totalDays - closed.length) };
}
