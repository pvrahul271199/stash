'use client';
import { useMemo, useState } from 'react';
import { DayChart, type ChartMode } from '../charts/DayChart';
import { CategoryList, Donut } from '../charts/Donut';
import { TimeOfDayChart, WeekdayChart } from '../charts/WeekdayTime';
import { Note } from '../ui/Chip';
import { useCategories, useCycleEntries, useDayRows } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import {
  MIN_CLOSED_DAYS,
  biggestSpends,
  buildDays,
  categoryColorMap,
  categoryTotals,
  fromSavingsTotal,
  mostFrequent,
  summarize,
  timeBuckets,
  weekdayStats,
  type InsightCycle,
} from '@/lib/insights';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { colors, categoryRamp } from '@/theme/tokens';
import { useUI } from '@/store/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-section font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function InsightsTab({ cycle, plan }: { cycle: Cycle | undefined; plan: Plan | undefined }) {
  const focus = useUI((s) => s.focusCategory);
  const toggleFocus = useUI((s) => s.toggleFocusCategory);
  const setFocus = useUI((s) => s.setFocusCategory);
  const [mode, setMode] = useState<ChartMode>('each');
  const entries = useCycleEntries(cycle?.id);
  const rows = useDayRows(cycle?.id);
  const cats = useCategories();

  const data = useMemo(() => {
    if (!cycle || !entries || !rows || !cats) return null;
    const ic: InsightCycle = cycle;
    const names = cats.map((c) => c.name);
    const colorOf = categoryColorMap(entries, names, categoryRamp);
    const activeFocus = focus && names.includes(focus) ? focus : null;
    const days = buildDays(ic, rows, entries, activeFocus);
    return {
      ic,
      names,
      colorOf,
      activeFocus,
      days,
      summary: summarize(ic, buildDays(ic, rows, entries, null)),
      slices: categoryTotals(entries),
      weekday: weekdayStats(days, cycle.startDate),
      time: timeBuckets(entries, activeFocus),
      frequent: mostFrequent(entries, activeFocus),
      savings: fromSavingsTotal(entries, activeFocus),
      biggest: biggestSpends(entries, activeFocus),
    };
  }, [cycle, entries, rows, cats, focus]);

  if (!plan || !cycle) {
    return (
      <div className="px-6 pt-8">
        <h1 className="text-question font-semibold text-ink">Insights</h1>
        <p className="mt-2 text-body text-soft">Set up your month first, then your spending picture shows up here.</p>
      </div>
    );
  }
  if (!data) return <div className="flex-1" aria-busy="true" />;
  if (!entries || entries.length === 0) {
    return (
      <div className="px-6 pt-8">
        <h1 className="text-question font-semibold text-ink">Insights</h1>
        <p className="mt-2 text-body text-soft">Log a few spends and close a day to see your picture.</p>
      </div>
    );
  }

  const { summary, days, colorOf, activeFocus, slices, weekday, time, frequent, savings, biggest, names } = data;
  const focusColor = activeFocus ? colorOf[activeFocus] : colors.ink;
  const barColor = activeFocus ? focusColor : colors.ink;
  const fillPct = Math.min((summary.spentSoFar / cycle.planAmount) * 100, 100);
  const tryAgain = 'Close a few days to see this.';

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6" style={{ overflowAnchor: 'none' }}>
      <h1 className="text-question font-semibold text-ink">Insights</h1>

      {/* 1. Summary */}
      <section className="mt-5" aria-label="Summary">
        <p className="text-[14px] text-soft">Spent this month so far</p>
        <p className="num text-big text-ink">
          <span className="text-faint">₹</span>
          {Math.round(summary.spentSoFar).toLocaleString('en-IN')}
        </p>
        <p className="mt-1 text-[14px] text-soft">of {inr(cycle.planAmount)} to live on</p>
        <div
          className="relative mt-4 h-2.5 rounded-full bg-tint"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={cycle.planAmount}
          aria-valuenow={Math.round(summary.spentSoFar)}
          aria-label="Spent so far"
        >
          <div className="h-2.5 rounded-full bg-ink" style={{ width: `${fillPct}%` }} />
          <div
            className="absolute -top-1 h-[18px] w-0.5 bg-good"
            style={{ left: `calc(${summary.planMarker * 100}% - 1px)` }}
            title="On plan for today"
            aria-hidden="true"
          />
        </div>
        <p className="mt-3 text-[14px] text-soft">{summary.paceMessage ?? tryAgain}</p>
      </section>

      {/* 2. Stat boxes */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-note bg-tint p-3.5">
          <p className="text-[13px] text-soft">Average day</p>
          <p className="num text-[24px] text-ink">{summary.averageDay != null ? inr(summary.averageDay) : '—'}</p>
        </div>
        <div className="rounded-note bg-tint p-3.5">
          <p className="text-[13px] text-soft">Left to live on</p>
          <p className="num text-[24px] text-ink">{inr(summary.leftToLive)}</p>
        </div>
      </div>

      {/* 3. Spending over the month */}
      <Section title="Spending over the month">
        <div className="inline-flex rounded-key bg-tint p-1" role="group" aria-label="Chart view">
          {([
            ['each', 'Each day'],
            ['running', 'Running total'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`min-h-[40px] rounded-[10px] px-4 text-[14px] font-medium ${
                mode === id ? 'bg-white text-ink shadow-sm' : 'text-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="-mx-6 mt-3 overflow-x-auto px-6" role="group" aria-label="Filter by category">
          <div className="flex w-max gap-2 pb-1">
            <button
              onClick={() => setFocus(null)}
              aria-pressed={!activeFocus}
              className={`flex min-h-[44px] items-center rounded-full border px-4 text-[14px] font-medium ${
                !activeFocus ? 'border-ink bg-ink text-white' : 'border-line text-ink'
              }`}
            >
              All
            </button>
            {names.map((n) => (
              <button
                key={n}
                onClick={() => toggleFocus(n)}
                aria-pressed={activeFocus === n}
                className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[14px] font-medium ${
                  activeFocus === n ? 'border-ink bg-tint text-ink' : 'border-line text-ink'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf[n] }} />
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <DayChart
            days={days}
            mode={mode}
            focus={activeFocus}
            focusColor={focusColor}
            planAmount={cycle.planAmount}
            startDate={cycle.startDate}
            totalDays={cycle.totalDays}
          />
        </div>
      </Section>

      {/* 4. Where it went */}
      <Section title="Where it went">
        {slices.length === 0 ? (
          <p className="text-body text-soft">Nothing to split up yet.</p>
        ) : (
          <>
            <Donut slices={slices} colorOf={colorOf} focus={activeFocus} onFocus={toggleFocus} />
            <CategoryList slices={slices} colorOf={colorOf} focus={activeFocus} onFocus={toggleFocus} />
          </>
        )}
      </Section>

      {/* 5. By day of week */}
      <Section title="By day of week">
        {weekday.closedCount >= MIN_CLOSED_DAYS ? (
          <WeekdayChart stats={weekday.stats} usual={weekday.usual} color={barColor} resetKey={activeFocus} />
        ) : (
          <p className="text-body text-soft">{tryAgain}</p>
        )}
      </Section>

      {/* 6. By time of day */}
      <Section title="By time of day">
        <TimeOfDayChart buckets={time} color={barColor} resetKey={activeFocus} />
      </Section>

      {/* 7. Patterns */}
      <Section title="Patterns">
        <div className="flex flex-col gap-2.5">
          {frequent ? (
            <Note tone="neutral">
              {frequent.label} is your most frequent spend: {frequent.count} times, {inr(frequent.total)} in total.
            </Note>
          ) : (
            <p className="text-body text-soft">Patterns show up once you have a few repeat spends.</p>
          )}
          {savings > 0 && <Note tone="adjust">{inr(savings)} taken from savings this month.</Note>}
        </div>
      </Section>

      {/* 8. Biggest spends */}
      <Section title="Biggest spends">
        {biggest.length === 0 ? (
          <p className="text-body text-soft">Nothing here yet.</p>
        ) : (
          <ol className="divide-y divide-line">
            {biggest.map((e, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[15px] font-medium text-ink">
                    {e.label}
                    {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                  </p>
                  <p className="text-[13px] text-faint">
                    {formatWithWeekday(dateOfDay(cycle.startDate, e.day))} · {e.subcategory ?? e.category}
                  </p>
                </div>
                <p className="num text-[20px] text-ink">{inr(e.amount)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
