import { dateOfDay } from './dates';
import { inr } from './format';
import {
  biggestSpends,
  buildDays,
  categoryTotals,
  eventTotals,
  mostFrequent,
  weekdayStats,
  type InsightCycle,
  type InsightDayRow,
  type InsightEntry,
} from './insights';

/** A dated entry is all the recap needs from a month's spends. */
export type RecapEntry = InsightEntry & { date: string };

export interface RecapCategory {
  name: string;
  total: number;
  /** Share of everything spent (0-100, whole numbers). */
  pct: number;
}

export interface MonthRecap {
  totalSpent: number;
  /** Spent / calendar days in the month. */
  avgPerDay: number;
  noSpendDays: number;
  /** Biggest categories first; anything beyond the top four is folded into "Other". */
  categories: RecapCategory[];
  busiestDay: { date: string; total: number } | null;
  biggest: { label: string; category: string; amount: number; date: string } | null;
  /** The weekday with the highest average spend (needs at least two different weekdays with spends). */
  topWeekday: { name: string; avg: number } | null;
  frequent: { label: string; count: number; total: number } | null;
  topEvent: { name: string; total: number } | null;
}

const TOP = 4;

/**
 * Everything the month-end recap says about a finished month, derived from its spends. Pure (no DB): spends dated in the
 * month (lent money already left out) plus the month's closed-day rows. Lent money and savings-funded spends are not
 * "spent", same as Insights.
 */
export function buildRecap(cycle: InsightCycle, rows: InsightDayRow[], entries: RecapEntry[]): MonthRecap {
  const days = buildDays(cycle, rows, entries, null);
  const spentDays = days.filter((d) => d.totalSpent > 0);
  const totalSpent = days.reduce((s, d) => s + d.totalSpent, 0);

  const cats = categoryTotals(entries);
  const top = cats.slice(0, TOP).map((c) => ({ name: c.name, total: c.total, pct: Math.round(c.pct) }));
  const rest = cats.slice(TOP);
  if (rest.length) {
    const total = rest.reduce((s, c) => s + c.total, 0);
    top.push({ name: 'Other', total, pct: Math.round(rest.reduce((s, c) => s + c.pct, 0)) });
  }

  const busiest = spentDays.reduce<(typeof days)[number] | null>((m, d) => (!m || d.totalSpent > m.totalSpent ? d : m), null);

  const big = biggestSpends(
    entries.filter((e) => !e.fromSavings),
    null,
    1,
  )[0];

  const wd = weekdayStats(days, cycle.startDate);
  const withSpend = wd.stats.filter((s) => s.total > 0);
  const best = withSpend.reduce<(typeof withSpend)[number] | null>((m, s) => (!m || s.avg > m.avg ? s : m), null);

  const ev = eventTotals(entries, [], null).sort((a, b) => b.total - a.total)[0];
  const freq = mostFrequent(entries, null);

  return {
    totalSpent,
    avgPerDay: cycle.totalDays > 0 ? totalSpent / cycle.totalDays : 0,
    noSpendDays: days.filter((d) => d.totalSpent === 0 && d.status !== 'future').length,
    categories: top,
    busiestDay: busiest ? { date: dateOfDay(cycle.startDate, busiest.day), total: busiest.totalSpent } : null,
    biggest: big ? { label: big.label, category: big.category, amount: big.amount, date: (big as RecapEntry).date } : null,
    topWeekday: best && withSpend.length >= 2 ? { name: best.name, avg: Math.round(best.avg) } : null,
    frequent: freq,
    topEvent: ev && ev.total > 0 ? { name: ev.name, total: ev.total } : null,
  };
}

/** One honest sentence about how the month went against its spending money. */
export function recapStory(planAmount: number, pool: number): string {
  if (planAmount <= 0) return 'Here is how the month went.';
  if (pool < 0) return `You went ${inr(-pool)} over your spending money.`;
  const spentPct = Math.round(((planAmount - pool) / planAmount) * 100);
  if (pool === 0) return 'You used every bit of your spending money.';
  if (spentPct <= 60) return `You spent ${spentPct}% of your spending money and kept the rest.`;
  return `You spent ${spentPct}% of your spending money and had a little left.`;
}
