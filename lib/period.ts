/**
 * Derived budget periods (E-4). Nothing here is stored or synced: the "month" a user is in, how much of it is
 * left and today's amount are a pure function of (plans, transactions, today). Two devices holding the same rows
 * therefore always show the same numbers, and there is no cycle row that can be duplicated, closed early or merged.
 *
 *   period(plan, date)  = [startDay of this month .. day before next startDay], e.g. salary day 25 -> 25 Nov .. 24 Dec
 *   tracking start      = earliest plan's `effectiveFrom` (days before it are not budgeted)
 *   allowance(today)    = max(planAmount - spent on earlier days of the period, 0) / days left including today
 */
import { moneyToLiveOn, rollupCycle, type DayRecord } from './budget';
import { MONTHS_LONG, addDays, daysBetween, formatShort } from './dates';

export interface Period {
  /** First day (yyyy-mm-dd), inclusive. */
  start: string;
  /** Last day (yyyy-mm-dd), inclusive. */
  end: string;
  totalDays: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m is 1-based

/** Day `startDay` of a month, clamped to the month's length (31 -> 30 Apr, 28/29 Feb). */
function startIn(y: number, m: number, startDay: number): string {
  // normalise month overflow (m = 0 or 13)
  const d = new Date(Date.UTC(y, m - 1, 1));
  const yy = d.getUTCFullYear();
  const mm = d.getUTCMonth() + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(startDay, daysInMonth(yy, mm)))}`;
}

export function clampStartDay(n: number | null | undefined): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 1 ? Math.min(v, 31) : 1;
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** The period that contains `date` for a month starting on `startDay` (1-31). */
export function periodFor(startDay: number, date: string): Period {
  const sd = clampStartDay(startDay);
  const [y, m] = date.split('-').map(Number);
  let start = startIn(y, m, sd);
  if (start > date) start = startIn(y, m - 1, sd);
  const [sy, sm] = start.split('-').map(Number);
  const next = startIn(sy, sm + 1, sd);
  const end = addDays(next, -1);
  return { start, end, totalDays: daysBetween(start, next) };
}

/** Every period from the one containing `from` to the one containing `to`, oldest first. */
export function periodsBetween(startDay: number, from: string, to: string): Period[] {
  const out: Period[] = [];
  if (from > to) return out;
  let p = periodFor(startDay, from);
  for (let guard = 0; guard < 600; guard++) {
    out.push(p);
    if (p.end >= to) break;
    p = periodFor(startDay, addDays(p.end, 1));
  }
  return out;
}

/** "1st", "2nd", "23rd", "31st". */
export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** "Starts on the 25th of each month" (+ a note for days some months don't have). */
export function describeStartDay(day: number): string {
  const d = clampStartDay(day);
  return `the ${ordinal(d)} of each month${d > 28 ? ' (or the last day, in shorter months)' : ''}`;
}

/* ---------- plans ---------- */

export interface PlanLike {
  income: number;
  bills: number;
  savings: number;
  createdAt: number;
  deletedAt?: number | null;
  /** yyyy-mm-dd from which this plan applies; the earliest one is when tracking started. */
  effectiveFrom?: string | null;
  /** Day of the month the money month starts on (1-31). */
  periodStartDay?: number | null;
}

const localISO = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const effectiveFromOf = (p: PlanLike) => p.effectiveFrom ?? localISO(p.createdAt);

/** Live plans ordered by when they apply (ties: creation order). */
export function orderPlans<P extends PlanLike>(plans: P[]): P[] {
  return plans
    .filter((p) => p.deletedAt == null)
    .sort((a, b) => effectiveFromOf(a).localeCompare(effectiveFromOf(b)) || a.createdAt - b.createdAt);
}

/** The plan that governs a period: the latest one that started on or before the period's last day. */
export function planInEffect<P extends PlanLike>(plans: P[], period: Pick<Period, 'end'>): P | undefined {
  const ordered = orderPlans(plans);
  let pick: P | undefined;
  for (const p of ordered) if (effectiveFromOf(p) <= period.end) pick = p;
  return pick ?? ordered[0];
}

/**
 * What old plans need to take part in derived months: an `effectiveFrom` (the first plan's is the start of the first old
 * cycle when there was one, so history stays in range) and, for the newest plan, `periodStartDay` 1 (calendar months).
 * Pure; used by the Dexie v11 upgrade (which still sees the stored cycles) and for plans pulled from older devices.
 */
export function planPeriodPatches<P extends PlanLike & { id: string }>(
  plans: P[],
  firstCycleStart: string | null,
): { id: string; patch: { effectiveFrom?: string; periodStartDay?: number } }[] {
  const live = plans.filter((p) => p.deletedAt == null).sort((a, b) => a.createdAt - b.createdAt);
  const patches = new Map<string, { effectiveFrom?: string; periodStartDay?: number }>();
  const eff = new Map<string, string>();
  live.forEach((p, i) => {
    if (p.effectiveFrom) return eff.set(p.id, p.effectiveFrom);
    const created = localISO(p.createdAt);
    const from = i === 0 && firstCycleStart ? firstCycleStart : created; // the first old cycle's start is when budgeting began
    eff.set(p.id, from);
    patches.set(p.id, { effectiveFrom: from });
  });
  const latest = [...live].sort((a, b) => eff.get(a.id)!.localeCompare(eff.get(b.id)!) || a.createdAt - b.createdAt).pop();
  if (latest && latest.periodStartDay == null) patches.set(latest.id, { ...patches.get(latest.id), periodStartDay: 1 });
  return [...patches].map(([id, patch]) => ({ id, patch }));
}

export function trackingStart(plans: PlanLike[]): string | null {
  const ordered = orderPlans(plans);
  return ordered.length ? effectiveFromOf(ordered[0]) : null;
}

/** How many months before the plans' tracking start a spend can still pull tracking back (a typo like 2019 must not invent years of months). */
export const MAX_BACKFILL_MONTHS = 12;

/**
 * Where tracking really starts: the plans' tracking start, or earlier when there are spends dated before it, so a spend
 * logged in an earlier month gets that month (and its Insights) instead of staying an orphan record. At most
 * `MAX_BACKFILL_MONTHS` months back. Derived on every read, so every device agrees and nothing is stored.
 */
export function trackingWithSpends(plans: PlanLike[], firstSpendDate: string | null | undefined): string | null {
  const tracking = trackingStart(plans);
  if (!tracking || !firstSpendDate || firstSpendDate >= tracking) return tracking;
  const startDay = startDayOf(plans);
  let floor = periodFor(startDay, tracking).start;
  for (let i = 0; i < MAX_BACKFILL_MONTHS; i++) floor = periodFor(startDay, addDays(floor, -1)).start;
  return firstSpendDate > floor ? firstSpendDate : floor;
}

/**
 * The tracking start to build ONE period with. Months before the plans' tracking start (only reachable through earlier
 * spends) are clipped at the earliest spend; the month budgeting began in and every later one keep the plans' start, so
 * logging an old spend never changes the current month's amount. A spend earlier in the same month budgeting began in
 * still pulls that month's start back (the long-standing "log on an earlier day of the first month" rule).
 */
export function trackingForPeriod(plans: PlanLike[], firstSpendDate: string | null | undefined, period: Pick<Period, 'end'>): string | null {
  const planStart = trackingStart(plans);
  if (!planStart) return null;
  const back = trackingWithSpends(plans, firstSpendDate);
  if (!back || back >= planStart) return planStart;
  if (back >= periodFor(startDayOf(plans), planStart).start) return back;
  return period.end < planStart ? back : planStart;
}

/** The month start day all periods use: the newest plan's choice, else the 1st. */
export function startDayOf(plans: PlanLike[]): number {
  const latest = orderPlans(plans).pop();
  return latest?.periodStartDay != null ? clampStartDay(latest.periodStartDay) : 1;
}

/* ---------- the derived "cycle" ---------- */

export interface BudgetTxn {
  txnDate: string;
  amount: number;
  fromSavings: boolean;
  adjustsPool?: boolean | null;
  isEstimate?: boolean;
  deletedAt?: number | null;
}

/** Same shape the UI has always read (`Cycle`), but computed, never stored. */
export interface DerivedCycle {
  /** `p:<startDate>:<totalDays>`: stable while the plan's start day is unchanged; hooks decode the date range from it. */
  id: string;
  updatedAt: number;
  startDate: string;
  totalDays: number;
  planAmount: number;
  /** Today's 1-based day in the period; `totalDays + 1` for a past period. */
  currentDay: number;
  /** Money not yet consumed by earlier days (what `closeDay` used to maintain). */
  pool: number;
  fromSavingsTotal: number;
  leftoverMoved: boolean;
  /** Days whose spends are all rough totals. */
  estimatedDays: number[];
  /** The whole calendar month this cycle belongs to (the strip on Today shows all of it, even days before tracking began). */
  monthStart: string;
  monthEnd: string;
  monthDays: number;
  /** Day rows for every day before today. */
  days: DayRecord[];
}

export const periodId = (startDate: string, totalDays: number) => `p:${startDate}:${totalDays}`;

export function decodePeriodId(id: string | undefined | null): { startDate: string; totalDays: number } | null {
  const m = id?.match(/^p:(\d{4}-\d{2}-\d{2}):(\d+)$/);
  return m ? { startDate: m[1], totalDays: Number(m[2]) } : null;
}

export function endOf(c: { startDate: string; totalDays: number }): string {
  return addDays(c.startDate, c.totalDays - 1);
}

/**
 * Builds the derived cycle of one period. The first period is shortened to start at the tracking start (a plan made
 * on the 6th with salary day 1 budgets the 6th..30th, not days that were never tracked). Returns null for a period
 * that ends before tracking started.
 */
export function buildCycle(
  period: Period,
  plan: PlanLike,
  txns: BudgetTxn[],
  today: string,
  tracking: string,
  leftoverMoved = false,
): DerivedCycle | null {
  const startDate = period.start < tracking ? tracking : period.start;
  if (startDate > period.end) return null;
  const totalDays = daysBetween(startDate, period.end) + 1;
  const currentDay = today < startDate ? 1 : today > period.end ? totalDays + 1 : daysBetween(startDate, today) + 1;
  const inRange = txns.filter((t) => t.deletedAt == null && t.txnDate >= startDate && t.txnDate <= period.end);
  const perDay = new Map<number, { all: number; est: number }>();
  for (const t of inRange) {
    const d = daysBetween(startDate, t.txnDate) + 1;
    const r = perDay.get(d) ?? { all: 0, est: 0 };
    r.all++;
    if (t.isEstimate) r.est++;
    perDay.set(d, r);
  }
  const estimatedDays = [...perDay].filter(([, r]) => r.all > 0 && r.all === r.est).map(([d]) => d).sort((a, b) => a - b);
  const planAmount = moneyToLiveOn(plan);
  const r = rollupCycle({ startDate, totalDays, planAmount, currentDay, estimatedDays }, inRange);
  return {
    id: periodId(startDate, totalDays),
    updatedAt: 0,
    startDate,
    totalDays,
    planAmount,
    currentDay,
    pool: r.pool,
    fromSavingsTotal: r.fromSavingsTotal,
    leftoverMoved,
    estimatedDays,
    monthStart: period.start,
    monthEnd: period.end,
    monthDays: period.totalDays,
    days: r.days,
  };
}

/**
 * The same cycle seen over its whole calendar month (day 1 = the month's first day, even before tracking began).
 * Used by the day strip, the day sheet and the log screen, so every date of the month can be tapped and logged into.
 * The pool and `daysLeft` are unchanged: they depend only on today and the month's last day.
 */
export function monthView(c: DerivedCycle): DerivedCycle {
  const today = addDays(c.startDate, c.currentDay - 1);
  return {
    ...c,
    id: periodId(c.monthStart, c.monthDays),
    startDate: c.monthStart,
    totalDays: c.monthDays,
    currentDay: Math.min(c.monthDays + 1, Math.max(1, daysBetween(c.monthStart, today) + 1)),
  };
}

/** "November 2026", or "25 Oct – 24 Nov" when the month doesn't start on the 1st. */
export function monthLabel(c: Pick<DerivedCycle, 'monthStart' | 'monthEnd'>): string {
  if (dayOfMonth(c.monthStart) === 1) {
    const [y, m] = c.monthStart.split('-').map(Number);
    return `${MONTHS_LONG[m - 1]} ${y}`;
  }
  return `${formatShort(c.monthStart)} – ${formatShort(c.monthEnd)}`;
}

/** Every tracked period up to today's, newest first. */
export function buildAllCycles(
  plans: PlanLike[],
  txns: BudgetTxn[],
  today: string,
  leftoverMoved: (id: string) => boolean = () => false,
): DerivedCycle[] {
  const firstSpend = txns.reduce<string | null>((m, t) => (t.deletedAt == null && (m == null || t.txnDate < m) ? t.txnDate : m), null);
  const tracking = trackingWithSpends(plans, firstSpend);
  if (!tracking) return [];
  const startDay = startDayOf(plans);
  const out: DerivedCycle[] = [];
  for (const p of periodsBetween(startDay, tracking, today > tracking ? today : tracking)) {
    const plan = planInEffect(plans, p)!;
    const c = buildCycle(p, plan, txns, today, trackingForPeriod(plans, firstSpend, p) ?? tracking);
    if (c) out.push({ ...c, leftoverMoved: leftoverMoved(c.id) });
  }
  return out.reverse();
}
