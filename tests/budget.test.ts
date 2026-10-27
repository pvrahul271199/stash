import { describe, it, expect } from 'vitest';
import {
  addFromSavings,
  catchUp,
  closeDay,
  displayLeft,
  initialCycleState,
  isBigSpend,
  isCycleOver,
  isPlanValid,
  moneyToLiveOn,
  monthEnd,
  onPlanTotal,
  overMessage,
  pace,
  planSync,
  projection,
  spentToday,
  todayAllowance,
  type CycleState,
  type DayInfo,
} from '@/lib/budget';
import { inr } from '@/lib/format';

const plan = { income: 50000, bills: 18000, savings: 10000, monthLength: 30 };
const fresh = (): CycleState => initialCycleState(plan);

describe('plan', () => {
  it('computes money to live on and blocks <= 0', () => {
    expect(moneyToLiveOn(plan)).toBe(22000);
    expect(isPlanValid(plan)).toBe(true);
    expect(isPlanValid({ ...plan, bills: 40000 })).toBe(false);
    expect(isPlanValid({ ...plan, bills: 40000, savings: 10000 })).toBe(false);
    expect(isPlanValid({ ...plan, monthLength: 32 })).toBe(false);
    expect(isPlanValid({ ...plan, bills: 0 })).toBe(true);
  });
});

describe('allowance', () => {
  it('divides the pool by days left', () => {
    const s = { ...fresh(), pool: 3000, currentDay: 21 };
    expect(todayAllowance(s)).toBeCloseTo(3000 / 10);
  });
  it('is 0 when the pool is empty or negative', () => {
    expect(todayAllowance({ ...fresh(), pool: -50 })).toBe(0);
  });
  it('excludes fromSavings from spentToday and clamps display', () => {
    const e = [
      { amount: 100, fromSavings: false },
      { amount: 2400, fromSavings: true },
    ];
    expect(spentToday(e)).toBe(100);
    expect(displayLeft(300, 500)).toBe(0);
  });
});

describe('spreading', () => {
  it('overspend spreads across future days', () => {
    const s = fresh();
    const a = todayAllowance(s);
    const r = closeDay(s, a + 300);
    expect(r.kind).toBe('more');
    expect(r.delta).toBeCloseTo(-300 / 29);
    expect(r.state.currentDay).toBe(2);
    expect(r.message).toContain('spread out');
  });
  it('underspend raises tomorrow', () => {
    const s = fresh();
    const a = todayAllowance(s);
    const r = closeDay(s, a - 290);
    expect(r.kind).toBe('less');
    expect(r.tomorrowAllowance).toBeGreaterThan(a);
    expect(r.message).toContain('less than your amount');
  });
  it('spending exactly the amount is on plan', () => {
    const s = fresh();
    const r = closeDay(s, todayAllowance(s));
    expect(r.kind).toBe('onplan');
    expect(r.message).toBe('Right on plan. Tomorrow looks the same.');
  });
  it('shows the over message with the next-days spread', () => {
    const s = { ...fresh(), currentDay: 19, pool: 12 * 500 + 1 };
    const msg = overMessage(500, 620, { ...s, pool: 6000, currentDay: 19, totalDays: 30 });
    expect(msg).toContain('₹120 over today');
    expect(msg).toContain('next 11 days');
    expect(overMessage(500, 400, s)).toBeNull();
  });
});

describe('big spend', () => {
  const s = fresh();
  const a = todayAllowance(s); // ~733
  it('needs >= 500 and > 1.5x the amount', () => {
    expect(isBigSpend(499, 100, s)).toBe(false);
    expect(isBigSpend(500, 300, s)).toBe(true);
    expect(isBigSpend(1000, a, s)).toBe(false);
    expect(isBigSpend(1200, a, s)).toBe(true);
  });
  it('is never big on the last day', () => {
    expect(isBigSpend(5000, 100, { ...s, currentDay: 30 })).toBe(false);
  });
  it('from savings leaves the pool alone', () => {
    const next = addFromSavings(s, 2400);
    expect(next.pool).toBe(s.pool);
    expect(next.fromSavingsTotal).toBe(2400);
    expect(todayAllowance(next)).toBe(a);
    const r = closeDay(next, 0);
    expect(r.state.fromSavingsTotal).toBe(2400);
  });
});

const none = (): DayInfo => ({ hasEntries: false, spent: 0 });

describe('calendar sync', () => {
  it('does nothing when the calendar day matches', () => {
    const p = planSync(fresh(), 1, none);
    expect(p.closes).toEqual([]);
    expect(p.gap).toBeNull();
  });
  it('quietly closes a day that has entries', () => {
    const p = planSync(fresh(), 2, (d) => (d === 1 ? { hasEntries: true, spent: 400 } : none()));
    expect(p.closes).toHaveLength(1);
    expect(p.closes[0]).toMatchObject({ day: 1, spent: 400, status: 'closed' });
    expect(p.state.currentDay).toBe(2);
    expect(p.state.pool).toBe(22000 - 400);
    expect(p.gap).toBeNull();
  });
  it('closes the logged day then asks for the rest', () => {
    const p = planSync(fresh(), 5, (d) => (d === 1 ? { hasEntries: true, spent: 400 } : none()));
    expect(p.closes).toHaveLength(1);
    expect(p.gap).toEqual({ from: 2, to: 4 });
  });
  it('opens the gap for nothing logged', () => {
    expect(planSync(fresh(), 4, none).gap).toEqual({ from: 1, to: 3 });
  });
  it('ends the cycle when the final day has entries', () => {
    const s = { ...fresh(), currentDay: 30 };
    const p = planSync(s, 31, () => ({ hasEntries: true, spent: 100 }));
    expect(isCycleOver(p.state)).toBe(true);
    expect(p.gap).toBeNull();
  });
  it('does not misbehave after the cycle ended or if the clock jumps far ahead', () => {
    const over = { ...fresh(), currentDay: 31 };
    expect(planSync(over, 31, none)).toMatchObject({ closes: [], gap: null });
    expect(planSync(fresh(), 31, none).gap).toEqual({ from: 1, to: 30 });
  });
});

describe('catch-up', () => {
  it.each([1, 3, 7])('splits evenly across %i missed days', (n) => {
    const s = fresh();
    const r = catchUp(s, 1000, { from: 1, to: n });
    expect(r.days).toHaveLength(n);
    expect(r.days.every((d) => d.status === 'estimated')).toBe(true);
    expect(r.days.reduce((x, d) => x + d.spent, 0)).toBe(1000);
    expect(r.state.currentDay).toBe(n + 1);
    expect(r.state.pool).toBe(s.pool - 1000);
    const amounts = r.days.map((d) => d.spent);
    expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
  });
  it('zero creates no entries but still closes the days', () => {
    const r = catchUp(fresh(), 0, { from: 1, to: 3 });
    expect(r.entries).toEqual([]);
    expect(r.days).toHaveLength(3);
    expect(r.state.pool).toBe(22000);
  });
  it('on-plan total keeps tomorrow the same', () => {
    const s = fresh();
    const gap = { from: 1, to: 3 };
    const total = onPlanTotal(s, gap);
    expect(total).toBe(Math.round((22000 / 30) * 3));
    const r = catchUp(s, total, gap);
    expect(Math.abs(todayAllowance(r.state) - todayAllowance(s))).toBeLessThan(1);
  });
});

describe('cycle end and month summary', () => {
  it('computes the month-end rows', () => {
    let s = fresh();
    for (let i = 0; i < 30; i++) s = closeDay(s, 600).state;
    expect(isCycleOver(s)).toBe(true);
    const m = monthEnd(plan, 22000, addFromSavings(s, 2400));
    expect(m.spentOnDaily).toBe(18000);
    expect(m.leftOver).toBe(4000);
    expect(m.fromSavings).toBe(2400);
    expect(m.savedFirst).toBe(10000);
  });
  it('leftover is 0 when everything was used', () => {
    let s = fresh();
    s = closeDay(s, 25000).state;
    expect(monthEnd(plan, 22000, s).leftOver).toBe(0);
  });
  it('allowance is 0 after the end', () => {
    expect(todayAllowance({ ...fresh(), currentDay: 31 })).toBe(0);
  });
});

describe('pace and projection', () => {
  it('on pace within 1%', () => {
    expect(pace(22000, 30, 10, 7333).kind).toBe('on');
  });
  it('under pace', () => {
    const p = pace(22000, 30, 10, 6000);
    expect(p.kind).toBe('under');
    expect(p.message).toContain('under pace');
  });
  it('over pace', () => {
    const p = pace(22000, 30, 10, 9000);
    expect(p.kind).toBe('over');
    expect(p.message).toContain('above pace');
  });
  it('projects under plan', () => {
    const p = projection(22000, 30, 10, 6000)!;
    expect(p.projected).toBe(18000);
    expect(p.diff).toBe(4000);
    expect(p.message).toContain('left');
  });
  it('projects over plan', () => {
    const p = projection(22000, 30, 10, 9000)!;
    expect(p.projected).toBe(27000);
    expect(p.message).toContain('more than planned');
  });
  it('has no projection with no closed days', () => {
    expect(projection(22000, 30, 0, 0)).toBeNull();
  });
});

describe('format', () => {
  it('uses Indian grouping', () => {
    expect(inr(125000)).toBe('₹1,25,000');
    expect(inr(733.4)).toBe('₹733');
  });
});

describe('spends after closing land on the next day', () => {
  it('entries are per-day; a closed day is not re-opened', () => {
    const s = fresh();
    const closed = closeDay(s, 300).state;
    // A spend logged now is attributed to closed.currentDay (2), not day 1.
    expect(closed.currentDay).toBe(2);
    const day2 = spentToday([{ amount: 150, fromSavings: false }]);
    expect(closeDay(closed, day2).record).toMatchObject({ day: 2, spent: 150 });
  });
});
