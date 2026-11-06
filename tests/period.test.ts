import { describe, expect, it } from 'vitest';
import {
  buildAllCycles,
  buildCycle,
  decodePeriodId,
  monthLabel,
  monthView,
  planPeriodPatches,
  periodFor,
  periodsBetween,
  planInEffect,
  startDayOf,
  trackingStart,
  type BudgetTxn,
  type PlanLike,
} from '@/lib/period';
import { todayAllowance } from '@/lib/budget';

const plan = (over: Partial<PlanLike> = {}): PlanLike => ({
  income: 50000, bills: 20000, savings: 0, createdAt: 1, effectiveFrom: '2026-11-01', periodStartDay: 1, ...over,
});
const spend = (txnDate: string, amount: number, over: Partial<BudgetTxn> = {}): BudgetTxn => ({ txnDate, amount, fromSavings: false, ...over });

describe('periodFor', () => {
  it('calendar month from the 1st', () => {
    expect(periodFor(1, '2026-11-06')).toEqual({ start: '2026-11-01', end: '2026-11-30', totalDays: 30 });
    expect(periodFor(1, '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28', totalDays: 28 });
  });

  it('salary day mid-month, before and after the day', () => {
    expect(periodFor(25, '2026-11-06')).toEqual({ start: '2026-10-25', end: '2026-11-24', totalDays: 31 });
    expect(periodFor(25, '2026-11-25')).toEqual({ start: '2026-11-25', end: '2026-12-24', totalDays: 30 });
  });

  it('crosses the year boundary', () => {
    expect(periodFor(15, '2027-01-03')).toEqual({ start: '2026-12-15', end: '2027-01-14', totalDays: 31 });
  });

  it('a start day past the month end clamps (31 -> 30 Apr, 28 Feb)', () => {
    expect(periodFor(31, '2026-04-30').start).toBe('2026-04-30');
    expect(periodFor(31, '2026-03-05')).toEqual({ start: '2026-02-28', end: '2026-03-30', totalDays: 31 });
    expect(periodFor(30, '2026-03-01')).toEqual({ start: '2026-02-28', end: '2026-03-29', totalDays: 30 });
  });

  it('periods tile the calendar with no gaps or overlaps', () => {
    for (const sd of [1, 15, 28, 29, 30, 31]) {
      const ps = periodsBetween(sd, '2026-01-01', '2027-12-31');
      for (let i = 1; i < ps.length; i++) {
        const prevEnd = new Date(ps[i - 1].end + 'T00:00:00Z').getTime();
        expect(new Date(ps[i].start + 'T00:00:00Z').getTime() - prevEnd).toBe(86_400_000);
      }
    }
  });
});

describe('plans over time', () => {
  it('tracking starts at the earliest plan; the newest plan picks the start day', () => {
    const plans = [plan({ effectiveFrom: '2026-10-30', periodStartDay: 30 }), plan({ effectiveFrom: '2026-11-10', createdAt: 2, periodStartDay: 1 })];
    expect(trackingStart(plans)).toBe('2026-10-30');
    expect(startDayOf(plans)).toBe(1);
  });

  it('a plan without a start day means calendar months (the 1st)', () => {
    expect(startDayOf([plan({ periodStartDay: null, effectiveFrom: '2026-10-30' })])).toBe(1);
  });

  it('a plan set mid-period governs that whole period; the previous period keeps its own plan', () => {
    const old = plan({ effectiveFrom: '2026-10-01', income: 40000 });
    const raise = plan({ effectiveFrom: '2026-11-15', createdAt: 2, income: 60000 });
    expect(planInEffect([old, raise], periodFor(1, '2026-11-20'))!.income).toBe(60000);
    expect(planInEffect([old, raise], periodFor(1, '2026-10-20'))!.income).toBe(40000);
  });
});

describe('buildCycle', () => {
  const nov = periodFor(1, '2026-11-06');

  it('today\'s amount = money not used by earlier days / days left (today\'s own spends do not lower it)', () => {
    const c = buildCycle(nov, plan(), [spend('2026-11-01', 1000), spend('2026-11-03', 500), spend('2026-11-06', 200)], '2026-11-06', '2026-11-01')!;
    expect(c.currentDay).toBe(6);
    expect(c.pool).toBe(30000 - 1500);
    expect(todayAllowance(c)).toBeCloseTo(28500 / 25);
    expect(c.days).toHaveLength(5);
  });

  it('the first period starts when tracking started, not at the period start', () => {
    const c = buildCycle(nov, plan({ effectiveFrom: '2026-11-06' }), [], '2026-11-06', '2026-11-06')!;
    expect(c.startDate).toBe('2026-11-06');
    expect(c.totalDays).toBe(25);
    expect(c.currentDay).toBe(1);
    expect(todayAllowance(c)).toBeCloseTo(30000 / 25);
  });

  it('from-savings spends never touch the pool; record-only past spends do not either', () => {
    const c = buildCycle(nov, plan(), [spend('2026-11-02', 900, { fromSavings: true }), spend('2026-11-02', 300, { adjustsPool: false })], '2026-11-06', '2026-11-01')!;
    expect(c.pool).toBe(30000);
    expect(c.fromSavingsTotal).toBe(900);
  });

  it('a past period is fully closed', () => {
    const c = buildCycle(periodFor(1, '2026-10-10'), plan({ effectiveFrom: '2026-10-01' }), [spend('2026-10-05', 700)], '2026-11-06', '2026-10-01')!;
    expect(c.currentDay).toBe(c.totalDays + 1);
    expect(c.pool).toBe(30000 - 700);
  });

  it('same rows in any order give the same numbers (two devices always agree)', () => {
    const rows = [spend('2026-11-01', 100), spend('2026-11-02', 250), spend('2026-11-04', 75), spend('2026-11-05', 400, { isEstimate: true })];
    const a = buildCycle(nov, plan(), rows, '2026-11-06', '2026-11-01')!;
    const b = buildCycle(nov, plan(), [...rows].reverse(), '2026-11-06', '2026-11-01')!;
    expect(a).toEqual(b);
    expect(a.estimatedDays).toEqual([5]);
  });

  it('the id carries the date range', () => {
    const c = buildCycle(nov, plan(), [], '2026-11-06', '2026-11-01')!;
    expect(decodePeriodId(c.id)).toEqual({ startDate: '2026-11-01', totalDays: 30 });
  });
});

describe('the whole month stays visible', () => {
  it('a month that tracking started inside still reports its full calendar range', () => {
    const c = buildCycle(periodFor(1, '2026-11-20'), plan({ effectiveFrom: '2026-11-20' }), [], '2026-11-20', '2026-11-20')!;
    expect(c.startDate).toBe('2026-11-20');
    expect(c.totalDays).toBe(11);
    expect([c.monthStart, c.monthEnd, c.monthDays]).toEqual(['2026-11-01', '2026-11-30', 30]);
  });

  it('monthView numbers days from the 1st but keeps today and the money the same', () => {
    const c = buildCycle(periodFor(1, '2026-11-20'), plan({ effectiveFrom: '2026-11-15' }), [spend('2026-11-16', 400)], '2026-11-20', '2026-11-15')!;
    const v = monthView(c);
    expect(v.startDate).toBe('2026-11-01');
    expect(v.totalDays).toBe(30);
    expect(v.currentDay).toBe(20); // 20 Nov is day 20 of the month
    expect(v.pool).toBe(c.pool);
    expect(30 - v.currentDay + 1).toBe(c.totalDays - c.currentDay + 1); // days left is the same either way
    expect(decodePeriodId(v.id)).toEqual({ startDate: '2026-11-01', totalDays: 30 });
  });

  it('month labels', () => {
    const nov = buildCycle(periodFor(1, '2026-11-06'), plan(), [], '2026-11-06', '2026-11-01')!;
    expect(monthLabel(nov)).toBe('November 2026');
    const odd = buildCycle(periodFor(25, '2026-11-06'), plan({ periodStartDay: 25 }), [], '2026-11-06', '2026-10-01')!;
    expect(monthLabel(odd)).toBe('25 Oct – 24 Nov');
  });
});

describe('planPeriodPatches (old plans -> derived months)', () => {
  const old = (id: string, createdAt: number, over: Partial<PlanLike> = {}) => ({ id, ...plan({ createdAt, effectiveFrom: null, periodStartDay: null, ...over }) });
  const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

  it('the first plan starts where the first old cycle started; the newest plan gets calendar months', () => {
    const patches = planPeriodPatches([old('a', day(2026, 11, 1))], '2026-10-30');
    expect(patches).toEqual([{ id: 'a', patch: { effectiveFrom: '2026-10-30', periodStartDay: 1 } }]);
  });

  it('with no old cycle the plan starts on the day it was created; later plans start on theirs', () => {
    const patches = planPeriodPatches([old('a', day(2026, 9, 3)), old('b', day(2026, 10, 20))], null);
    expect(patches).toEqual([
      { id: 'a', patch: { effectiveFrom: '2026-09-03' } },
      { id: 'b', patch: { effectiveFrom: '2026-10-20', periodStartDay: 1 } },
    ]);
  });

  it('does nothing for plans that are already complete, ignores deleted ones, and is idempotent', () => {
    expect(planPeriodPatches([{ id: 'a', ...plan() }], '2026-01-01')).toEqual([]);
    expect(planPeriodPatches([old('x', day(2026, 11, 1), { deletedAt: 5 })], null)).toEqual([]);
  });
});

describe('buildAllCycles', () => {
  it('one cycle per tracked period, newest first, never more than one for today', () => {
    const all = buildAllCycles([plan({ effectiveFrom: '2026-09-20' })], [], '2026-11-06');
    expect(all.map((c) => c.startDate)).toEqual(['2026-11-01', '2026-10-01', '2026-09-20']);
    expect(all.filter((c) => c.currentDay <= c.totalDays)).toHaveLength(1);
  });

  it('no plan, no cycles', () => {
    expect(buildAllCycles([], [], '2026-11-06')).toEqual([]);
  });
});
