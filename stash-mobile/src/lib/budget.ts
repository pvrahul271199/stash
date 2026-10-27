/** Pure budget logic. All money is integer rupees; round only for display.
 *  Nothing here touches the database, so everything is unit-testable. */

import { inr } from './format';

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

export interface PlanInput {
  income: number;
  bills: number;
  savings: number;
  monthLength: number;
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

export function initialCycleState(p: PlanInput): CycleState {
  return { currentDay: 1, totalDays: p.monthLength, pool: moneyToLiveOn(p), fromSavingsTotal: 0 };
}

/* ---------- today ---------- */

export function daysLeft(s: Pick<CycleState, 'totalDays' | 'currentDay'>): number {
  return s.totalDays - s.currentDay + 1;
}

export function isCycleOver(s: CycleState): boolean {
  return s.currentDay > s.totalDays;
}

/** Amount for the current day, from the pool at the start of the day. */
export function todayAllowance(s: CycleState): number {
  const left = daysLeft(s);
  if (left <= 0) return 0;
  return Math.max(s.pool, 0) / left;
}

export interface SpendLike {
  amount: number;
  fromSavings: boolean;
}

export function spentToday(entries: SpendLike[]): number {
  return entries.reduce((sum, e) => (e.fromSavings ? sum : sum + e.amount), 0);
}

export function leftToday(allowance: number, spent: number): number {
  return allowance - spent;
}

export function displayLeft(allowance: number, spent: number): number {
  return Math.max(leftToday(allowance, spent), 0);
}

export function isPoolUsedUp(s: CycleState): boolean {
  return s.pool <= 0;
}

/** "₹X over today. It spreads across the next N days, about ₹Y each." */
export function overMessage(allowance: number, spent: number, s: CycleState): string | null {
  const over = spent - allowance;
  if (over <= 0) return null;
  const next = daysLeft(s) - 1;
  if (next <= 0) return `${inr(over)} over today.`;
  return `${inr(over)} over today. It spreads across the next ${next} ${next === 1 ? 'day' : 'days'}, about ${inr(over / next)} each.`;
}

export const POOL_USED_UP_MESSAGE =
  "This month's spending money is used up. You can pause spending, or take some from savings when something comes up.";

/* ---------- big spend ---------- */

export const BIG_SPEND_MIN = 500;

export function isBigSpend(amount: number, allowance: number, s: Pick<CycleState, 'totalDays' | 'currentDay'>): boolean {
  return amount >= BIG_SPEND_MIN && amount > 1.5 * allowance && daysLeft(s) > 1;
}

/** Taking a spend from savings leaves the pool (and so the daily amount) untouched. */
export function addFromSavings(s: CycleState, amount: number): CycleState {
  return { ...s, fromSavingsTotal: s.fromSavingsTotal + amount };
}

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
  const next: CycleState = { ...s, pool: s.pool - spent, currentDay: s.currentDay + 1 };
  const tomorrow = todayAllowance(next);
  const delta = tomorrow - allowance;
  const kind: CloseKind = Math.abs(delta) < 1 ? 'onplan' : delta > 0 ? 'less' : 'more';
  let message: string;
  if (kind === 'onplan') message = 'Right on plan. Tomorrow looks the same.';
  else if (kind === 'less')
    message = `You spent ${inr(allowance - spent)} less than your amount, so every day ahead gets ${inr(delta)} more.`;
  else
    message = `You spent ${inr(spent - allowance)} more, so every day ahead adjusts by ${inr(-delta)}. It's spread out, so no single day takes the hit.`;
  return { state: next, record, tomorrowAllowance: tomorrow, delta, kind, message };
}

/* ---------- calendar sync ---------- */

export interface DayInfo {
  hasEntries: boolean;
  spent: number;
}

export interface SyncPlan {
  /** Days closed quietly (they had entries). */
  closes: DayRecord[];
  /** Days nobody logged, to ask the user about. */
  gap: { from: number; to: number } | null;
  state: CycleState;
}

export function planSync(s: CycleState, calDay: number, info: (day: number) => DayInfo): SyncPlan {
  const closes: DayRecord[] = [];
  let state = s;
  while (state.currentDay < calDay && state.currentDay <= state.totalDays) {
    const d = info(state.currentDay);
    if (!d.hasEntries) break;
    const r = closeDay(state, d.spent);
    closes.push(r.record);
    state = r.state;
  }
  const gap =
    state.currentDay < calDay && state.currentDay <= state.totalDays
      ? { from: state.currentDay, to: Math.min(calDay - 1, state.totalDays) }
      : null;
  return { closes, gap, state };
}

/** What the missed days would have cost had the user spent exactly their amount. */
export function onPlanTotal(s: CycleState, gap: { from: number; to: number }): number {
  const n = gap.to - gap.from + 1;
  return Math.round(todayAllowance(s) * n);
}

export interface CatchUpResult {
  state: CycleState;
  days: DayRecord[];
  /** Rough-total entries to create (only days with amount > 0). */
  entries: { day: number; amount: number }[];
}

/** Split a rough total evenly across the missed days; all become `estimated`. */
export function catchUp(s: CycleState, total: number, gap: { from: number; to: number }): CatchUpResult {
  const n = gap.to - gap.from + 1;
  const safe = Math.max(0, Math.round(total));
  const base = Math.floor(safe / n);
  const extra = safe % n;
  const days: DayRecord[] = [];
  const entries: { day: number; amount: number }[] = [];
  let state = s;
  for (let i = 0; i < n; i++) {
    const spent = base + (i < extra ? 1 : 0);
    const r = closeDay(state, spent, 'estimated');
    days.push(r.record);
    if (spent > 0) entries.push({ day: r.record.day, amount: spent });
    state = r.state;
  }
  return { state, days, entries };
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
        ? `${inr(diff)} under pace so far. That's room in the days ahead.`
        : `${inr(-diff)} above pace so far. Your daily amount has already adjusted for it.`;
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
