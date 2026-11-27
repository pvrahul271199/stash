import { roundMoney } from './money';
/** Pure budget logic. All money is integer rupees; round only for display.
 *  Nothing here touches the database, so everything is unit-testable. */

import { inr } from './format';
import { daysBetween } from './dates';

export interface CycleState {
  currentDay: number;
  totalDays: number;
  /** Spending money not yet consumed by *closed* days. */
  pool: number;
  fromSavingsTotal: number;
}

export interface DayRecord {
  day: number;
  allowanceAtStart: number;
  spent: number;
  status: 'closed' | 'estimated';
}

/** One line in an itemised bills/savings list, e.g. { name: 'Health EMI', amount: 2500 }. */
export interface PlanItem {
  name: string;
  amount: number;
}

export interface PlanInput {
  income: number;
  bills: number;
  savings: number;
  /** Length of the month the plan is saved in (28-31); derived from `periodStartDay` (lib/period.ts). */
  monthLength: number;
  /** Day of the month the money month starts on (1-31), e.g. salary day. */
  periodStartDay?: number;
  /** Optional breakdown of `bills`. When present, `bills` equals their sum. */
  billItems?: PlanItem[];
  /** Optional breakdown of `savings`. When present, `savings` equals their sum. */
  savingsItems?: PlanItem[];
}

export function sumItems(items: PlanItem[] | undefined): number {
  return roundMoney((items ?? []).reduce((t, i) => t + (Number.isFinite(i.amount) ? Math.max(0, roundMoney(i.amount)) : 0), 0));
}

/* ---------- plan ---------- */

export function moneyToLiveOn(p: Pick<PlanInput, 'income' | 'bills' | 'savings'>): number {
  return p.income - p.bills - p.savings;
}

export function isPlanValid(p: PlanInput): boolean {
  return (
    p.income > 0 &&
    p.bills >= 0 &&
    p.savings >= 0 &&
    moneyToLiveOn(p) > 0 &&
    Number.isInteger(p.monthLength) &&
    p.monthLength >= 1 &&
    p.monthLength <= 31
  );
}

/* ---------- today ---------- */

export function daysLeft(s: Pick<CycleState, 'totalDays' | 'currentDay'>): number {
  return s.totalDays - s.currentDay + 1;
}

/** Amount for the current day, from the pool at the start of the day. */
export function todayAllowance(s: CycleState): number {
  const left = daysLeft(s);
  if (left <= 0) return 0;
  return roundMoney(s.pool / left);
}

export interface SpendLike {
  amount: number;
  fromSavings: boolean;
  /** A lent amount: not spending (lib/lend.ts). */
  outsideBudget?: boolean;
}

export function spentToday(entries: SpendLike[]): number {
  return roundMoney(entries.reduce((sum, e) => (e.fromSavings || e.outsideBudget ? sum : sum + e.amount), 0));
}

export function leftToday(allowance: number, spent: number): number {
  return roundMoney(allowance - spent);
}

/** What the Today screen shows: can go negative when you've spent more than today's amount. */
export function displayLeft(allowance: number, spent: number): number {
  return leftToday(allowance, spent);
}

/** "₹X over today of ₹A. It spreads across the next N days, about ₹Y each." */
export function overMessage(allowance: number, spent: number, s: CycleState): string | null {
  const over = spent - allowance;
  if (over <= 0) return null;
  const next = daysLeft(s) - 1;
  const head = `${inr(over)} over today of ${inr(allowance)}.`;
  if (next <= 0) return head;
  return `${head} It spreads across the next ${next} ${next === 1 ? 'day' : 'days'}, about ${inr(over / next)} each.`;
}

export const POOL_USED_UP_MESSAGE =
  "This month's spending money is used up. You can pause spending, or take some from savings when something comes up.";

/* ---------- closing days ---------- */

export type CloseKind = 'less' | 'more' | 'onplan';

export interface CloseResult {
  state: CycleState;
  record: DayRecord;
  tomorrowAllowance: number;
  /** tomorrow - today. Positive means every day ahead gets more. */
  delta: number;
  kind: CloseKind;
  message: string;
}

export function closeDay(s: CycleState, spent: number, status: DayRecord['status'] = 'closed'): CloseResult {
  const allowance = todayAllowance(s);
  const record: DayRecord = { day: s.currentDay, allowanceAtStart: allowance, spent, status };
  const next: CycleState = { ...s, pool: roundMoney(s.pool - spent), currentDay: s.currentDay + 1 };
  const tomorrow = todayAllowance(next);
  const delta = roundMoney(tomorrow - allowance);
  const kind: CloseKind = Math.abs(delta) < 1 ? 'onplan' : delta > 0 ? 'less' : 'more';
  let message: string;
  if (kind === 'onplan') message = 'Right on plan. Tomorrow looks the same.';
  else if (kind === 'less')
    message = `You spent ${inr(allowance - spent)} less than your amount, so every day ahead gets ${inr(delta)} more.`;
  else
    message = `You spent ${inr(spent - allowance)} more, so every day ahead adjusts by ${inr(-delta)}. It's spread out, so no single day takes the hit.`;
  return { state: next, record, tomorrowAllowance: tomorrow, delta, kind, message };
}

/* ---------- month end ---------- */

export interface MonthEnd {
  spentOnDaily: number;
  savedFirst: number;
  fromSavings: number;
  leftOver: number;
}

export function monthEnd(plan: Pick<PlanInput, 'savings'>, planAmount: number, s: CycleState): MonthEnd {
  return {
    spentOnDaily: planAmount - s.pool,
    savedFirst: plan.savings,
    fromSavings: s.fromSavingsTotal,
    leftOver: Math.max(s.pool, 0),
  };
}

/* ---------- pace and projection ---------- */

export type PaceKind = 'on' | 'under' | 'over';

export interface Pace {
  expected: number;
  actual: number;
  diff: number;
  kind: PaceKind;
  message: string;
}

export function pace(moneyToLive: number, totalDays: number, closedDays: number, actualSpent: number): Pace {
  const expected = (moneyToLive * closedDays) / totalDays;
  const diff = expected - actualSpent;
  const within = Math.abs(diff) <= Math.max(0.01 * expected, 0);
  const kind: PaceKind = within ? 'on' : diff > 0 ? 'under' : 'over';
  const message =
    kind === 'on'
      ? 'Right on pace for the month.'
      : kind === 'under'
        ? `${inr(diff)} under pace so far. An even split would have you at ${inr(expected)} by now and you are at ${inr(actualSpent)}. That gap is spread over the days ahead.`
        : `${inr(-diff)} above pace so far. An even split would have you at ${inr(expected)} by now and you are at ${inr(actualSpent)}. Your daily amount has already adjusted for it.`;
  return { expected, actual: actualSpent, diff, kind, message };
}

export interface Projection {
  projected: number;
  /** planAmount - projected; positive means money left. */
  diff: number;
  message: string;
}

export function projection(
  planAmount: number,
  totalDays: number,
  closedDays: number,
  spentOnClosed: number,
): Projection | null {
  if (closedDays <= 0) return null;
  const avg = spentOnClosed / closedDays;
  const projected = avg * (totalDays - closedDays) + spentOnClosed;
  const diff = planAmount - projected;
  const message =
    diff >= 0
      ? `At your current pace you'd finish the month with about ${inr(diff)} left.`
      : `At your current pace you'd use about ${inr(-diff)} more than planned. Your daily amount is already adjusting for this.`;
  return { projected, diff, message };
}

/* ---------- rollup (derived state from transactions) ---------- */

export interface RollupCycle {
  startDate: string;
  totalDays: number;
  planAmount: number;
  /** First unclosed day (cursor). Days below it are closed. */
  currentDay: number;
  /** Closed days that were back-filled with a rough total. */
  estimatedDays?: number[];
}

export interface RollupTxn {
  txnDate: string;
  amount: number;
  fromSavings: boolean;
  /** Past-day spends only: false means the spend did not rebalance the pool. */
  adjustsPool?: boolean | null;
  deletedAt?: number | null;
}

/** 1-based cycle day for a calendar date; 0 when the date is outside the cycle. */
export function dayOfTxn(c: Pick<RollupCycle, 'startDate' | 'totalDays'>, txnDate: string): number {
  const diff = daysBetween(c.startDate, txnDate);
  return diff >= 0 && diff < c.totalDays ? diff + 1 : 0;
}

/**
 * Pure, order-independent derivation of a cycle's closed-day rows, pool and
 * fromSavings total from its live transactions. Replays `closeDay` for every
 * closed day, so it matches the incremental math and heals any drift.
 *
 * `credits` are dated month-level adjustments that are not transactions (lib/lend.ts `loanEffects`: a written-off loan
 * is a negative amount). On a closed day a credit changes that day's net `spent` and the pool; one dated today or ahead
 * moves the pool at once (not "left today": a spend only moves the pool once its day is closed). Dates outside the cycle
 * are ignored.
 */
export function rollupCycle(
  c: RollupCycle,
  txns: RollupTxn[],
  credits: { date: string; amount: number }[] = [],
): { days: DayRecord[]; pool: number; fromSavingsTotal: number } {
  const perDay = new Map<number, { spent: number; poolSpent: number }>();
  let fromSavingsTotal = 0;
  for (const t of txns) {
    if (t.deletedAt != null) continue;
    if (t.fromSavings) {
      fromSavingsTotal += t.amount;
      continue;
    }
    const d = dayOfTxn(c, t.txnDate);
    if (d === 0) continue;
    const row = perDay.get(d) ?? { spent: 0, poolSpent: 0 };
    row.spent += t.amount;
    if (t.adjustsPool !== false) row.poolSpent += t.amount;
    perDay.set(d, row);
  }
  const creditOn = new Map<number, number>();
  for (const k of credits) {
    const d = dayOfTxn(c, k.date);
    if (d !== 0) creditOn.set(d, (creditOn.get(d) ?? 0) + k.amount);
  }
  const estimated = new Set(c.estimatedDays ?? []);
  let state: CycleState = { currentDay: 1, totalDays: c.totalDays, pool: c.planAmount, fromSavingsTotal: 0 };
  const days: DayRecord[] = [];
  const lastClosed = Math.min(c.currentDay - 1, c.totalDays);
  for (let d = 1; d <= lastClosed; d++) {
    const row = perDay.get(d) ?? { spent: 0, poolSpent: 0 };
    const credit = creditOn.get(d) ?? 0;
    const r = closeDay(state, roundMoney(row.poolSpent - credit), estimated.has(d) ? 'estimated' : 'closed');
    days.push({ ...r.record, spent: row.spent - credit });
    state = r.state;
  }
  // Spends logged ahead of time on an upcoming day that the user chose to spread over the
  // remaining days: they lower the pool now. Once that day becomes today it counts as normal.
  let pool = state.pool;
  for (const [d, row] of perDay) {
    if (d > c.currentDay && d <= c.totalDays) pool -= row.poolSpent;
  }
  for (const [d, credit] of creditOn) if (d >= c.currentDay) pool += credit;
  return { days, pool: roundMoney(pool), fromSavingsTotal: roundMoney(fromSavingsTotal) };
}
