'use client';
import { useMemo, useState } from 'react';
import { PrimaryButton } from '../ui/Button';
import { RecapRing } from '../charts/RecapRing';
import { HugeNumber } from '../ui/HugeNumber';
import { dayRowsOf, useCycleEntries } from '@/db/queries';
import type { Entry, Plan } from '@/db/schema';
import type { DerivedCycle } from '@/lib/period';
import { monthEnd } from '@/lib/budget';
import { formatMonthYear } from '@/lib/dates';
import { inr1 } from '@/lib/format';
import { buildRecap, recapStory } from '@/lib/recap';
import { categoryRamp } from '@/theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Month-end recap, shown once after a month in which the user logged on its last day has turned over. A quiet look back:
 * what was left, where the money went, and a few things worth noticing. Nothing to decide: one Continue button.
 * `MonthEnd` loads the month's spends; `MonthEndView` is the pure screen (Storybook renders it directly).
 */
export function MonthEnd({ cycle, plan, onDone }: { cycle: DerivedCycle; plan: Plan; onDone: () => void }) {
  const entries = useCycleEntries(cycle.id);
  return <MonthEndView cycle={cycle} plan={plan} entries={entries ?? []} onDone={onDone} />;
}

export function MonthEndView({ cycle, plan, entries, onDone }: { cycle: DerivedCycle; plan: Plan; entries: Entry[]; onDone: () => void }) {
  const m = monthEnd(plan, cycle.planAmount, cycle);
  const year = Number(cycle.monthStart.slice(0, 4));
  const monthNo = Number(cycle.monthStart.slice(5, 7));
  const name = MONTHS[monthNo - 1] ?? formatMonthYear(year, monthNo);
  const recap = useMemo(() => buildRecap(cycle, dayRowsOf(cycle), entries), [cycle, entries]);

  const spent = Math.max(0, m.spentOnDaily);
  const budget = Math.max(1, cycle.planAmount);
  const spentPct = Math.min(100, Math.round((spent / budget) * 100));
  const leftPct = m.leftOver > 0 ? 100 - spentPct : 0;
  const over = cycle.pool < 0;
  const hasSpends = recap.categories.length > 0;
  const [picked, setPicked] = useState<string | null>(null);
  const sel = recap.categories.find((c) => c.name === picked) ?? null;
  const pick = (n: string) => setPicked((cur) => (cur === n ? null : n));

  return (
    <main className="flex h-full flex-col px-6 pb-5 pt-10">
      <div className="thin-scrollbar -mx-1 flex-1 overflow-y-auto px-1 pb-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-soft">
          {name} {year}
        </p>
        <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-ink">Month wrapped up</h1>
        <p className="mt-1 text-[14px] leading-snug text-soft">{recapStory(cycle.planAmount, cycle.pool)}</p>

        {/* Hero: what was left */}
        <section className="mt-4 rounded-[20px] border border-line bg-white p-4 shadow-sm" aria-label="Left over">
          {m.leftOver > 0 ? (
            <>
              <p className="text-[12px] font-medium text-soft">You had this left</p>
              <HugeNumber value={m.leftOver} size={40} className="mt-0.5" color="text-[#3A7CA5]" />
            </>
          ) : (
            <>
              <p className="text-[12px] font-medium text-soft">{over ? 'Over your spending money by' : 'Your spending money'}</p>
              <p className="num mt-0.5 font-display text-[30px] font-semibold leading-tight text-ink">{over ? inr1(-cycle.pool) : 'All used'}</p>
            </>
          )}
          <div
            className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-tint"
            role="img"
            aria-label={`${spentPct}% of your spending money spent, ${leftPct}% left`}
          >
            <div className="h-full bg-ink" style={{ width: `${spentPct}%` }} />
            <div className="h-full bg-good/50" style={{ width: `${leftPct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-soft">
            <span>Spent {inr1(spent)}</span>
            <span>of {inr1(cycle.planAmount)}</span>
          </div>
        </section>

        {hasSpends && (
          <>
            {/* Where it went: tap a slice (or a row) to look at one category */}
            <section className="mt-5" aria-label="Where it went">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Where it went</h2>
              <div className="mt-2">
                <RecapRing
                  size={168}
                  stroke={20}
                  label="Spending by category. Tap a slice for its amount."
                  selected={picked}
                  onSelect={pick}
                  segments={recap.categories.map((c, i) => ({ name: c.name, value: c.total, color: categoryRamp[i % categoryRamp.length] }))}
                >
                  {sel ? (
                    <>
                      <span className="max-w-[96px] truncate text-[12px] font-semibold text-soft">{sel.name}</span>
                      <span className="num text-[20px] leading-tight text-ink">{inr1(sel.total)}</span>
                      <span className="text-[11px] text-faint">{sel.pct}% of spending</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-medium text-soft">Spent</span>
                      <span className="num text-[20px] leading-tight text-ink">{inr1(recap.totalSpent)}</span>
                      <span className="text-[11px] text-faint">Tap a slice</span>
                    </>
                  )}
                </RecapRing>
              </div>
              <ul className="mt-3 flex flex-col">
                {recap.categories.map((c, i) => {
                  const on = picked === c.name;
                  return (
                    <li key={c.name} style={{ opacity: picked && !on ? 0.45 : 1 }} className="transition-opacity">
                      <button
                        type="button"
                        onClick={() => pick(c.name)}
                        aria-pressed={on}
                        className={`flex min-h-[36px] w-full items-center gap-2.5 rounded-[10px] px-2 text-left ${on ? 'bg-tint' : ''}`}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryRamp[i % categoryRamp.length] }} aria-hidden="true" />
                        <span className="flex-1 truncate text-[14px] text-ink">{c.name}</span>
                        <span className="num text-[11px] text-faint">{c.pct}%</span>
                        <span className="num w-[76px] text-right text-[14px] text-ink">{inr1(c.total)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {(recap.topWeekday || recap.frequent || recap.topEvent) && (
                <ul className="mt-3 flex flex-col gap-1.5 text-[13px] leading-snug text-soft">
                  {recap.topWeekday && (
                    <li>
                      You spend the most on <b className="font-medium text-ink">{recap.topWeekday.name}</b>, about <span className="num text-ink">{inr1(recap.topWeekday.avg)}</span> a day.
                    </li>
                  )}
                  {recap.frequent && (
                    <li>
                      Most repeated: <b className="font-medium text-ink">{recap.frequent.label}</b>, {recap.frequent.count} times for <span className="num text-ink">{inr1(recap.frequent.total)}</span>.
                    </li>
                  )}
                  {recap.topEvent && (
                    <li>
                      Biggest event: <b className="font-medium text-ink">{recap.topEvent.name}</b>, <span className="num text-ink">{inr1(recap.topEvent.total)}</span>.
                    </li>
                  )}
                </ul>
              )}
            </section>
          </>
        )}

        {/* Money split */}
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-[14px] text-soft">Saved and invested first</dt>
            <dd className="num text-[17px] text-ink">{inr1(m.savedFirst)}</dd>
          </div>
          {m.fromSavings > 0 && (
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[14px] text-soft">Taken from savings</dt>
              <dd className="num text-[17px] text-ink">{inr1(m.fromSavings)}</dd>
            </div>
          )}
        </dl>
      </div>
      <PrimaryButton onClick={onDone}>Continue</PrimaryButton>
    </main>
  );
}
