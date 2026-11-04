'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DayChart, type ChartMode } from '../charts/DayChart';
import { CategoryList, Donut } from '../charts/Donut';
import { TimeOfDayChart, WeekdayChart } from '../charts/WeekdayTime';
import { Note } from '../ui/Chip';
import { useCategories, useCycleEntries, useDayRows, useEvents } from '@/db/queries';
import type { Cycle, Plan } from '@/db/schema';
import {
  MIN_CLOSED_DAYS,
  biggestSpends,
  buildDays,
  categoryColorMap,
  categoryTotals,
  eventTotals,
  fromSavingsTotal,
  mostFrequent,
  paymentTotals,
  summarize,
  timeBuckets,
  weekdayStats,
  type InsightCycle,
} from '@/lib/insights';
import { compactINR } from '@/lib/history';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
import { colors, categoryRamp } from '@/theme/tokens';
import { useUI } from '@/store/ui';
import { SwipeRow } from '../ui/SwipeRow';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-3.5">
        <h2 className="text-section font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const HOT = '#D98324';

type Level = 'good' | 'warn' | 'bad';

const LEVEL_DOT: Record<Level, string> = { good: 'bg-good', warn: 'bg-warm', bad: 'bg-bad' };

const LEVEL_TEXT: Record<Level, string> = { good: 'text-good', warn: 'text-warm', bad: 'text-bad' };

/** Direction arrow: points up/down vs a benchmark; colour carries the judgement (green fine, amber watch, red over). */
function TrendArrow({ dir, level }: { dir: 'up' | 'down'; level: Level }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${LEVEL_TEXT[level]}`}
    >
      {dir === 'up' ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  );
}

function Stat({
  label,
  value,
  sub,
  status,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  /** good = green text; warn / bad = light amber / red wash behind ink text. */
  status?: Level;
  trend?: { dir: 'up' | 'down'; level: Level };
}) {
  const bg = status === 'warn' ? 'bg-warm/10' : status === 'bad' ? 'bg-bad/10' : 'bg-tint';
  return (
    <div className={`rounded-note p-3.5 ${bg}`}>
      <p className="text-[12px] font-medium uppercase tracking-wide text-soft">{label}</p>
      <p className={`num mt-1 flex items-center gap-1.5 text-[24px] leading-tight ${status === 'good' ? 'text-good' : 'text-ink'}`}>
        {value}
        {trend && <TrendArrow dir={trend.dir} level={trend.level} />}
      </p>
      {sub && (
        <p className={`mt-0.5 text-[12px] ${status === 'good' ? 'text-good' : 'text-soft'}`}>{sub}</p>
      )}
    </div>
  );
}

export function InsightsTab({ cycle, plan }: { cycle: Cycle | undefined; plan: Plan | undefined }) {
  const { currency } = useCurrency();
  const focus = useUI((s) => s.focusCategory);
  const toggleFocus = useUI((s) => s.toggleFocusCategory);
  const setFocus = useUI((s) => s.setFocusCategory);
  const [focusType, setFocusType] = useState<string | null>(null);
  const [focusEvent, setFocusEvent] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>('each');
  const entries = useCycleEntries(cycle?.id);
  const rows = useDayRows(cycle?.id);
  const cats = useCategories();
  const events = useEvents();

  // Clear sub-type selection whenever the parent category changes
  useEffect(() => {
    setFocusType(null);
  }, [focus]);

  const data = useMemo(() => {
    if (!cycle || !entries || !rows || !cats) return null;
    const ic: InsightCycle = cycle;
    const names = cats.map((c) => c.name);
    const colorOf = categoryColorMap(entries, names, categoryRamp);
    const activeFocus = focus && names.includes(focus) ? focus : null;
    const evList = eventTotals(entries, events ?? [], activeFocus);
    const eventNames = evList.map((e) => e.name);
    const activeEvent = focusEvent && eventNames.includes(focusEvent) ? focusEvent : null;
    const eventScopedEntries = activeEvent ? entries.filter((e) => e.event === activeEvent) : entries;
    const slices = categoryTotals(eventScopedEntries);
    const focusedSlice = activeFocus ? slices.find((s) => s.name === activeFocus) ?? null : null;
    const availableTypes = focusedSlice?.types ?? [];
    const activeType =
      activeFocus && focusType && availableTypes.some((t) => t.name === focusType) ? focusType : null;

    // If a specific subcategory/type is focused, scope entries for that category down to the chosen type
    const scopedEntries = activeType
      ? eventScopedEntries.filter(
          (e) => e.category !== activeFocus || (e.subcategory ?? 'No type') === activeType,
        )
      : eventScopedEntries;

    // Event-only filter: treat every scoped spend as "focused" so the chart shows just the event.
    const finalDays =
      activeEvent && !activeFocus
        ? buildDays(
            ic,
            rows,
            scopedEntries.map((e) => ({ ...e, category: '__all__' })),
            '__all__',
          )
        : buildDays(ic, rows, scopedEntries, activeFocus);

    // Order category pills with active spend first (highest to lowest), followed by remaining categories
    const sliceMap = new Map(slices.map((s) => [s.name, s.total]));
    const orderedNames = [...names].sort(
      (a, b) => (sliceMap.get(b) ?? 0) - (sliceMap.get(a) ?? 0) || names.indexOf(a) - names.indexOf(b),
    );

    const fullDays = buildDays(ic, rows, entries, null);
    return {
      ic,
      names: orderedNames,
      sliceMap,
      colorOf,
      activeFocus,
      activeType,
      availableTypes,
      activeEvent,
      evList,
      days: finalDays,
      fullDays,
      summary: summarize(ic, fullDays),
      slices,
      weekday: weekdayStats(finalDays, cycle.startDate),
      time: timeBuckets(scopedEntries, activeFocus),
      frequent: mostFrequent(scopedEntries, activeFocus),
      payments: paymentTotals(scopedEntries, activeFocus),
      savings: fromSavingsTotal(scopedEntries, activeFocus),
      biggest: biggestSpends(scopedEntries, activeFocus),
    };
  }, [cycle, entries, rows, cats, events, focus, focusType, focusEvent]);

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

  const {
    summary,
    fullDays,
    days,
    colorOf,
    activeFocus,
    activeType,
    availableTypes,
    activeEvent,
    evList,
    slices,
    sliceMap,
    weekday,
    time,
    frequent,
    payments,
    savings,
    biggest,
    names,
  } = data;
  const focusColor = activeFocus ? colorOf[activeFocus] : colors.ink;
  const barColor = activeFocus ? focusColor : colors.ink;
  const fillPct = Math.min((summary.spentSoFar / cycle.planAmount) * 100, 100);
  const tryAgain = 'Close a few days to see this.';
  const topEventTotal = evList.reduce((m, e) => Math.max(m, e.total), 0);
  const space = currency.symbol.length > 1 ? ' ' : '';
  const dailyBase = cycle.planAmount / Math.max(cycle.totalDays, 1);
  const daysLeft = Math.max(cycle.totalDays - summary.closedDays, 0);
  const paceRatio =
    summary.closedDays >= MIN_CLOSED_DAYS
      ? summary.spentOnClosed / summary.closedDays / (cycle.planAmount / cycle.totalDays)
      : null;
  const paceLevel: Level | null = paceRatio == null ? null : paceRatio <= 1 ? 'good' : paceRatio <= 1.1 ? 'warn' : 'bad';
  const projected =
    summary.closedDays >= MIN_CLOSED_DAYS ? Math.round((summary.spentOnClosed / summary.closedDays) * cycle.totalDays) : null;
  const noSpendDays = fullDays.filter((d) => (d.status === 'closed' || d.status === 'estimated') && d.totalSpent === 0).length;

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6" style={{ overflowAnchor: 'none' }}>
      <h1 className="text-question font-semibold text-ink">Insights</h1>

      {/* 1. Summary */}
      <section className="mt-5 rounded-[20px] border border-line bg-white p-5 shadow-sm" aria-label="Summary">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium uppercase tracking-wide text-soft">Spent this month</p>
          <span className="num rounded-full bg-tint px-2.5 py-1 text-[12px] font-medium text-ink">
            {Math.round(fillPct)}% used
          </span>
        </div>
        <p className="num mt-1 text-big text-ink">
          <span className="text-faint">{currency.symbol}{space}</span>
          {Math.round(summary.spentSoFar).toLocaleString(currency.locale)}
        </p>
        <p className="mt-1 text-[14px] text-soft">of {inr(cycle.planAmount)} to live on</p>
        <div
          className="relative mt-5 h-3 rounded-full bg-tint"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={cycle.planAmount}
          aria-valuenow={Math.round(summary.spentSoFar)}
          aria-label="Spent so far"
        >
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${fillPct}%`, background: paceLevel === 'bad' ? colors.bad : paceLevel === 'warn' ? colors.warm : colors.ink }}
          />
          <div
            className="absolute -top-1.5 h-[24px] w-[3px] rounded-full bg-good ring-2 ring-white"
            style={{ left: `calc(${summary.planMarker * 100}% - 1.5px)` }}
            title="On plan for today"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-faint">
          <span>Day {summary.closedDays} of {cycle.totalDays}</span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-0.5 rounded-full bg-good" /> on plan
          </span>
        </div>
        <p
          className={`mt-3 flex items-start gap-2.5 rounded-note px-3.5 py-2.5 text-[14px] ${
            !summary.paceMessage || !paceLevel
              ? 'bg-tint text-soft'
              : paceLevel === 'good'
                ? 'bg-tint text-good'
                : paceLevel === 'warn'
                  ? 'bg-warm/10 text-ink'
                  : 'bg-bad/10 text-ink'
          }`}
        >
          {summary.paceMessage && paceLevel && (
            <span aria-hidden="true" className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[paceLevel]}`} />
          )}
          <span>{summary.paceMessage ?? tryAgain}</span>
        </p>
      </section>

      {/* 2. Stat boxes */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Stat
          label="Average day"
          value={summary.averageDay != null ? inr(summary.averageDay) : '—'}
          sub="on closed days"
          trend={
            summary.averageDay == null
              ? undefined
              : summary.averageDay > dailyBase * 1.1
                ? { dir: 'up', level: 'bad' }
                : summary.averageDay > dailyBase
                  ? { dir: 'up', level: 'warn' }
                  : { dir: 'down', level: 'good' }
          }
        />
        <Stat
          label="Left to live on"
          value={inr(summary.leftToLive)}
          sub={`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} to go`}
          trend={
            summary.closedDays === 0
              ? undefined
              : summary.leftToLive >= cycle.planAmount * (1 - summary.planMarker)
                ? { dir: 'up', level: 'good' }
                : { dir: 'down', level: summary.leftToLive < 0 ? 'bad' : 'warn' }
          }
        />
        <Stat
          label="Month-end pace"
          value={projected != null ? inr(projected) : '—'}
          sub={projected != null ? (projected > cycle.planAmount ? 'over your plan' : 'within your plan') : 'needs a few closed days'}
          status={projected == null || paceLevel == null ? undefined : paceLevel}
          trend={
            projected == null || paceLevel == null
              ? undefined
              : projected > cycle.planAmount
                ? { dir: 'up', level: paceLevel === 'good' ? 'warn' : paceLevel }
                : { dir: 'down', level: 'good' }
          }
        />
        <Stat
          label="No-spend days"
          value={String(noSpendDays)}
          status={noSpendDays > 0 ? 'good' : undefined}
          sub={summary.closedDays ? `of ${summary.closedDays} closed` : 'none closed yet'}
        />
      </div>

      {/* 3. Spending over the month */}
      <Section title="Spending over the month" hint="Filter by category, type or event to zoom in.">
        <div className="grid grid-cols-2 rounded-key bg-tint p-1" role="group" aria-label="Chart view">
          {([
            ['each', 'Each day'],
            ['running', 'Running total'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`min-h-[40px] rounded-[10px] px-4 text-[14px] font-medium transition-all ${
                mode === id ? 'bg-white text-ink shadow-sm' : 'text-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <SwipeRow label="Filter by category" className="mt-3">
          <div className="flex w-max items-center gap-1.5 pb-1">
            <button
              onClick={() => setFocus(null)}
              aria-pressed={!activeFocus}
              className={`flex h-9 min-h-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                !activeFocus ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
              }`}
            >
              All
            </button>
            {names.map((n) => {
              const catTotal = sliceMap.get(n) ?? 0;
              const isSelected = activeFocus === n;
              return (
                <button
                  key={n}
                  onClick={() => toggleFocus(n)}
                  aria-pressed={isSelected}
                  className={`flex h-9 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
                    isSelected
                      ? 'border-ink bg-white font-semibold text-ink'
                      : catTotal > 0
                        ? 'border-line bg-white text-ink'
                        : 'border-line/70 bg-white text-faint'
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf[n] }} />
                  <span>{n}</span>
                  {catTotal > 0 && (
                    <span className="num text-[12px] text-soft">{compactINR(catTotal)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </SwipeRow>

        {activeFocus && availableTypes.length > 0 && (
          <SwipeRow label="Filter by type" className="mt-2">
            <div className="flex w-max items-center gap-1.5 pb-1">
              <span className="text-[12px] font-medium text-soft">Type:</span>
              <button
                type="button"
                onClick={() => setFocusType(null)}
                aria-pressed={!activeType}
                className={`flex h-8 min-h-0 items-center rounded-full border px-3 text-[12px] font-medium transition-colors ${
                  !activeType ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                }`}
              >
                All {activeFocus}
              </button>
              {availableTypes.map((t) => {
                const isTypeSel = activeType === t.name;
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setFocusType(isTypeSel ? null : t.name)}
                    aria-pressed={isTypeSel}
                    className={`flex h-8 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${
                      isTypeSel ? 'border-ink bg-white text-ink' : 'border-line bg-white text-ink'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className="num text-[11px] text-soft">{inr(t.total)}</span>
                  </button>
                );
              })}
            </div>
          </SwipeRow>
        )}

        {evList.length > 0 && (
          <SwipeRow label="Filter by event" className="mt-2">
            <div className="flex w-max items-center gap-1.5 pb-1">
              <span className="text-[12px] font-medium text-soft">Event:</span>
              <button
                onClick={() => setFocusEvent(null)}
                aria-pressed={!activeEvent}
                className={`flex h-8 min-h-0 items-center rounded-full border px-3 text-[12px] font-medium ${
                  !activeEvent ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                }`}
              >
                All events
              </button>
              {evList.map((ev) => (
                <button
                  key={ev.name}
                  onClick={() => setFocusEvent(activeEvent === ev.name ? null : ev.name)}
                  aria-pressed={activeEvent === ev.name}
                  className={`flex h-8 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${
                    activeEvent === ev.name ? 'border-ink bg-white text-ink' : 'border-line bg-white text-ink'
                  }`}
                >
                  <span>{ev.name}</span>
                  <span className="num text-[11px] text-soft">{inr(ev.total)}</span>
                </button>
              ))}
            </div>
          </SwipeRow>
        )}

        <div className="mt-3 rounded-[20px] border border-line bg-white p-3">
          <DayChart
            days={days}
            mode={mode}
            focus={activeType ? `${activeFocus} · ${activeType}` : activeFocus ?? activeEvent}
            focusColor={focusColor}
            planAmount={cycle.planAmount}
            startDate={cycle.startDate}
            totalDays={cycle.totalDays}
          />
        </div>
      </Section>

      {/* 4. Where it went */}
      <Section title="Where it went" hint="Tap a slice to focus the whole page on it.">
        {slices.length === 0 ? (
          <p className="text-body text-soft">Nothing to split up yet.</p>
        ) : (
          <>
            <Donut slices={slices} colorOf={colorOf} focus={activeFocus} onFocus={toggleFocus} />
            <CategoryList
              slices={slices}
              colorOf={colorOf}
              focus={activeFocus}
              onFocus={toggleFocus}
              focusType={activeType}
              onFocusType={(t) => setFocusType(activeType === t ? null : t)}
            />
          </>
        )}
      </Section>

      {/* 4b. By event (with sub-categories breakdown) */}
      <Section title="By event" hint="Trips, parties, anything you tagged.">
        {evList.length === 0 ? (
          <p className="text-body text-soft">
            Tap the calendar button on Today to start an event. Spends you log inside it show up here, split by category.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {evList.map((ev) => {
              const isSelected = activeEvent === ev.name;
              const barWidth = topEventTotal > 0 ? Math.max((ev.total / topEventTotal) * 100, ev.total > 0 ? 4 : 0) : 0;

              return (
                <li
                  key={ev.name}
                  className={`rounded-note border p-4 transition-colors ${
                    isSelected ? 'border-ink bg-white' : 'border-line bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusEvent(isSelected ? null : ev.name)}
                    aria-pressed={isSelected}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-[16px] font-semibold text-ink">{ev.name}</p>
                      {ev.note && <p className="mt-0.5 text-[13px] text-soft">{ev.note}</p>}
                      <p className="mt-1 text-[12px] text-faint">
                        {ev.count} {ev.count === 1 ? 'spend' : 'spends'}
                        {ev.pct > 0 ? ` · ${Math.round(ev.pct)}% of spending` : ''}
                      </p>
                    </div>
                    <p className="num text-[20px] font-semibold text-ink">{inr(ev.total)}</p>
                  </button>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-tint">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${barWidth}%`, background: barColor }}
                    />
                  </div>

                  {ev.categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`Categories in ${ev.name}`}>
                      {ev.categories.map((cat) => (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => toggleFocus(cat.name)}
                          aria-pressed={activeFocus === cat.name}
                          className={`flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${
                            activeFocus === cat.name
                              ? 'border-ink bg-ink text-white'
                              : cat.total > 0
                                ? 'border-line bg-white text-ink'
                                : 'border-line bg-white text-faint'
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: colorOf[cat.name] ?? colors.ink }}
                          />
                          <span>{cat.name}</span>
                          <span className="num opacity-80">{inr(cat.total)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 4c. By payment mode */}
      {payments.length > 0 && (
        <Section title="By payment mode" hint="How you paid, by share of spend.">
          <div className="rounded-note border border-line bg-white p-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-tint" aria-hidden="true">
              {payments.map((p, i) => (
                <div
                  key={p.name}
                  className="h-full border-r-2 border-white last:border-r-0"
                  style={{ width: `${p.pct}%`, background: categoryRamp[i % categoryRamp.length] }}
                />
              ))}
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {payments.map((p, i) => (
                <li key={p.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: categoryRamp[i % categoryRamp.length] }}
                    />
                    <div>
                      <p className="text-[14px] font-medium text-ink">{p.name}</p>
                      <p className="text-[12px] text-faint">
                        {p.count} {p.count === 1 ? 'spend' : 'spends'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="num text-[16px] font-semibold text-ink">{inr(p.total)}</p>
                    <p className="num text-[12px] text-soft">{Math.round(p.pct)}%</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* 5. By day of week */}
      <Section title="By day of week" hint="Which days run hotter than usual.">
        {weekday.closedCount >= MIN_CLOSED_DAYS ? (
          <WeekdayChart stats={weekday.stats} usual={weekday.usual} color={barColor} hotColor={activeFocus ? undefined : HOT} resetKey={activeFocus} />
        ) : (
          <p className="text-body text-soft">{tryAgain}</p>
        )}
      </Section>

      {/* 6. By time of day */}
      <Section title="By time of day" hint="When in the day your money moves.">
        <TimeOfDayChart buckets={time} color={barColor} hotColor={activeFocus ? undefined : HOT} resetKey={activeFocus} />
      </Section>

      {/* 7. Patterns */}
      <Section title="Patterns">
        <div className="flex flex-col gap-2.5">
          {frequent ? (
            <Note tone="neutral">
              <span className="font-semibold">{frequent.label}</span> is your most frequent spend: {frequent.count} times,{' '}
              {inr(frequent.total)} in total.
            </Note>
          ) : (
            <p className="text-body text-soft">Patterns show up once you have a few repeat spends.</p>
          )}
          {savings > 0 && <Note tone="adjust">{inr(savings)} taken from savings this month.</Note>}
        </div>
      </Section>

      {/* 8. Biggest spends */}
      <Section title="Biggest spends" hint="Your five largest this month.">
        {biggest.length === 0 ? (
          <p className="text-body text-soft">Nothing here yet.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {biggest.map((e, i) => (
              <li key={i} className="flex items-center gap-3 rounded-note border border-line bg-white p-3.5">
                <span
                  className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                    i === 0 ? 'bg-ink text-white' : 'bg-tint text-soft'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {e.label}
                    {e.fromSavings && (
                      <span className="ml-2 rounded-full bg-warm/10 px-2 py-0.5 text-[11px] text-ink">from savings</span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-faint">
                    {formatWithWeekday(dateOfDay(cycle.startDate, e.day))} · {e.subcategory ?? e.category}
                    {e.payment ? ` · ${e.payment}` : ''}
                    {e.event ? ` · ${e.event}` : ''}
                  </p>
                  {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
                </div>
                <p className="num text-[18px] font-semibold text-ink">{inr(e.amount)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
