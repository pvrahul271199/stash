import { describe, it, expect } from 'vitest';
import {
  closeDay,
  displayLeft,
  isBigSpend,
  isPlanValid,
  moneyToLiveOn,
  monthEnd,
  overMessage,
  pace,
  projection,
  spentToday,
  todayAllowance,
  type CycleState,
} from '@/lib/budget';
import { inr } from '@/lib/format';

const plan = { income: 50000, bills: 18000, savings: 10000, monthLength: 30 };
const fresh = (): CycleState => ({ currentDay: 1, totalDays: plan.monthLength, pool: moneyToLiveOn(plan), fromSavingsTotal: 0 });

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
  it('is big only when the amount is more than the pool', () => {
    expect(isBigSpend(30000, 30000, s)).toBe(false);
    expect(isBigSpend(30001, 30000, s)).toBe(true);
    expect(isBigSpend(100, 80, s)).toBe(true);
    expect(isBigSpend(1200, a * 30, s)).toBe(false);
  });
  it('is never big on the last day', () => {
    expect(isBigSpend(5000, 100, { ...s, currentDay: 30 })).toBe(false);
  });
  it('closing a day carries the savings total and leaves the pool alone', () => {
    const next = { ...s, fromSavingsTotal: 2400 };
    expect(todayAllowance(next)).toBe(a);
    const r = closeDay(next, 0);
    expect(r.state.fromSavingsTotal).toBe(2400);
    expect(r.state.pool).toBe(s.pool);
  });
});

describe('cycle end and month summary', () => {
  it('computes the month-end rows', () => {
    let s = fresh();
    for (let i = 0; i < 30; i++) s = closeDay(s, 600).state;
    expect(s.currentDay).toBe(31);
    const m = monthEnd(plan, 22000, { ...s, fromSavingsTotal: 2400 });
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
