/** Shared sample data + Insights building blocks for the insights-*.stories.tsx files (not a stories file itself). */
import { useMemo, useState, type ReactNode } from 'react';
import { DayChart, type ChartMode } from '@/components/charts/DayChart';
import { CategoryList, Donut } from '@/components/charts/Donut';
import { TimeOfDayChart, WeekdayChart } from '@/components/charts/WeekdayTime';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { Note } from '@/components/ui/Chip';
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
  projectTotal,
  summarize,
  timeBuckets,
  weekdayStats,
  type InsightCycle,
  type InsightDayRow,
  type InsightEntry,
} from '@/lib/insights';
import { compactINR } from '@/lib/history';
import { dateOfDay, formatWithWeekday, weekdayOfDay } from '@/lib/dates';
import { inr1, num1 } from '@/lib/format';
import { colors, categoryRamp } from '@/theme/tokens';

/**
 * Insights sub-tabs: six designs for splitting today's long Insights page into sections.
 *
 * EVERYTHING on the current page is here, drawn by the app's own charts and `lib/insights` maths on a sample month
 * (November, day 25 of 30): Summary (income line, pace, on-plan marker), Spending over the month (Each day /
 * Running total, category / type / event filters, day tooltip with "over its amount"), Where it went (donut +
 * types), the spends behind a focus, By event (note, count, % of spending, category chips), By payment mode,
 * By day of week, By time of day, Patterns, Biggest spends, and the month picker.
 *
 * Sections (same in all six designs):
 *   Overview   = Summary, At a glance*, Patterns (+ new lines*), Biggest spends
 *   Trend      = Spending over the month (+ filters), By day of week, By time of day
 *   Categories = Where it went, vs last month*, Spends in focus, By payment mode
 *   Events     = By event, Spends in the event
 * (* = NEW, marked with a "New" tag. "At a glance" uses numbers `summarize()` already computes but the page never shows.)
 *
 * A focus (category, type or event) is page-wide, as today: it follows you across tabs and a "Showing …" bar
 * on every tab says so and clears it.
 */

export const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';

/* =================================================================================================
 * Sample month: November 2026, plan ₹36,000 (₹1,200 a day), today = day 25. Deterministic.
 * ================================================================================================= */
export type SEntry = InsightEntry & { id: string; date: string; createdAt: number };
export const START = '2026-11-01';
export const TOTAL_DAYS = 30;
export const TODAY = 25;
export const PLAN = 36000;
export const INCOME = 5000;

export const EVENTS = [
  { name: 'Weekend getaway', note: 'Lonavala trip with friends', categories: ['Travel', 'Fun', 'Food'] },
  { name: 'Family dinner', note: 'Hosting parents at home', categories: ['Home', 'Food'] },
  { name: 'Diwali', note: null, categories: ['Home', 'Fun', 'Food'] },
];
export const CATS = ['Home', 'Food', 'Fun', 'Travel', 'Health', 'Bills', 'Shopping'];
/** What the same categories came to by day 24 of last month (sample only, for the "vs last month" idea). */
export const LAST_MONTH: Record<string, number> = { Home: 3100, Food: 4400, Fun: 1500, Travel: 2400, Health: 900, Bills: 299, Shopping: 1800 };

export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSample(): SEntry[] {
  const r = rng(42);
  const out: SEntry[] = [];
  const pay = () => { const x = r(); return x < 0.6 ? 'UPI' : x < 0.85 ? 'Card' : 'Cash'; };
  const add = (day: number, amount: number, label: string, category: string, subcategory: string | null, hour: number,
    extra: Partial<SEntry> = {}) =>
    out.push({ id: `e${out.length}`, day, date: dateOfDay(START, day), createdAt: day * 100 + out.length, amount: Math.round(amount),
      label, category, subcategory, hour, payment: pay(), event: null, note: null, fromSavings: false, isEstimate: false, ...extra });

  for (let d = 1; d <= TODAY; d++) {
    const wd = weekdayOfDay(START, d); // 0 = Sunday
    const weekend = wd === 0 || wd === 6;
    if (d === 6) { add(6, 900, 'Rough total', 'Food', null, 20, { isEstimate: true }); continue; }
    if (d === 11 || d === 19) continue; // no-spend days
    if (r() < 0.8) add(d, 110 + r() * 70, 'Coffee', 'Food', 'Coffee', 9);
    if (d === TODAY) { add(d, 260, 'Lunch', 'Food', 'Eating out', 13); break; }
    if (!weekend) {
      add(d, 60 + r() * 180, r() < 0.5 ? 'Cab to office' : 'Metro', 'Travel', r() < 0.5 ? 'Cab' : 'Metro', 9);
      if (r() < 0.55) add(d, 180 + r() * 170, 'Lunch', 'Food', 'Eating out', 13);
    } else if (d !== 14 && d !== 15) {
      add(d, 300 + r() * 600, r() < 0.5 ? 'Movie' : 'Drinks', 'Fun', r() < 0.5 ? 'Movies' : 'Drinks', 21);
      add(d, 280 + r() * 260, 'Dinner delivery', 'Food', 'Delivery', 20);
    }
    if (d % 4 === 2) add(d, 450 + r() * 700, 'Groceries', 'Home', 'Groceries', 18);
  }
  // fixed one-offs
  add(3, 299, 'Phone recharge', 'Bills', 'Phone', 11, { payment: 'Card' });
  add(10, 360, 'Pharmacy', 'Health', 'Medicines', 19);
  add(12, 450, 'House help extra', 'Home', 'Cleaning', 10, { payment: 'Cash' });
  add(17, 1900, 'Running shoes', 'Shopping', 'Clothes', 16, { payment: 'Card', note: 'Sale at Decathlon' });
  add(18, 4500, 'Dentist', 'Health', 'Doctor', 17, { fromSavings: true, payment: 'Card' });
  // events
  const ev = (day: number, amt: number, label: string, cat: string, sub: string, hour: number, event: string) =>
    add(day, amt, label, cat, sub, hour, { event });
  ev(8, 900, 'Diyas and lights', 'Home', 'Decor', 11, 'Diwali');
  ev(8, 600, 'Crackers', 'Fun', 'Festival', 18, 'Diwali');
  ev(8, 450, 'Sweets box', 'Food', 'Sweets', 12, 'Diwali');
  ev(14, 250, 'Bus to Lonavala', 'Travel', 'Bus', 7, 'Weekend getaway');
  ev(14, 160, 'Breakfast stop', 'Food', 'Eating out', 9, 'Weekend getaway');
  ev(14, 220, 'Tiger Point entry', 'Fun', 'Outing', 15, 'Weekend getaway');
  ev(14, 180, 'Chikki and snacks', 'Food', 'Snacks', 17, 'Weekend getaway');
  ev(15, 190, 'Boating', 'Fun', 'Outing', 11, 'Weekend getaway');
  ev(15, 180, 'Bus back', 'Travel', 'Bus', 18, 'Weekend getaway');
  ev(15, 60, 'Auto to the bus stand', 'Travel', 'Cab', 20, 'Weekend getaway');
  ev(15, 210, 'Dinner at the dhaba', 'Food', 'Eating out', 21, 'Weekend getaway');
  ev(22, 1030, 'Groceries for parents', 'Home', 'Groceries', 17, 'Family dinner');
  ev(22, 20, 'Ice', 'Food', 'Snacks', 19, 'Family dinner');
  add(22, 990, 'Sunday movie', 'Fun', 'Movies', 21);
  return out.filter((e) => e.amount > 0);
}

export const SAMPLE = buildSample();

export function sampleCycle(entries: SEntry[]): { cycle: InsightCycle; rows: InsightDayRow[] } {
  let pool = PLAN;
  const rows: InsightDayRow[] = [];
  for (let d = 1; d < TODAY; d++) {
    const mine = entries.filter((e) => e.day === d && !e.fromSavings);
    const spent = mine.reduce((s, e) => s + e.amount, 0);
    rows.push({ day: d, allowanceAtStart: Math.round(pool / (TOTAL_DAYS - d + 1)), spent,
      status: mine.length && mine.every((e) => e.isEstimate) ? 'estimated' : 'closed' });
    pool -= spent;
  }
  return {
    cycle: { startDate: START, planAmount: PLAN, currentDay: TODAY, totalDays: TOTAL_DAYS, pool,
      fromSavingsTotal: entries.filter((e) => e.fromSavings).reduce((s, e) => s + e.amount, 0) },
    rows,
  };
}

/* =================================================================================================
 * The same derivation InsightsTab does, with the focus kept in local state.
 * ================================================================================================= */
export function useInsights(initialFocus: string | null = null) {
  const [focus, setFocusRaw] = useState<string | null>(initialFocus);
  const [focusType, setFocusType] = useState<string | null>(null);
  const [focusEvent, setFocusEvent] = useState<string | null>(null);
  const [mode, setMode] = useState<ChartMode>('each');
  const setFocus = (n: string | null) => { setFocusRaw(n); setFocusType(null); };
  const toggleFocus = (n: string) => setFocus(focus === n ? null : n);

  const data = useMemo(() => {
    const entries = SAMPLE;
    const { cycle: ic, rows } = sampleCycle(entries);
    const colorOf = categoryColorMap(entries, CATS, categoryRamp);
    const activeFocus = focus;
    const evList = eventTotals(entries, EVENTS, activeFocus).filter((e) => e.count > 0);
    const activeEvent = focusEvent && evList.some((e) => e.name === focusEvent) ? focusEvent : null;
    const eventScoped = activeEvent ? entries.filter((e) => e.event === activeEvent) : entries;
    const slices = categoryTotals(eventScoped);
    const availableTypes = activeFocus ? slices.find((s) => s.name === activeFocus)?.types ?? [] : [];
    const activeType = activeFocus && focusType && availableTypes.some((t) => t.name === focusType) ? focusType : null;
    const scoped = activeType
      ? eventScoped.filter((e) => e.category !== activeFocus || (e.subcategory ?? 'No type') === activeType)
      : eventScoped;
    const days = activeEvent && !activeFocus
      ? buildDays(ic, rows, scoped.map((e) => ({ ...e, category: '__all__' })), '__all__')
      : buildDays(ic, rows, scoped, activeFocus);
    const sliceMap = new Map(slices.map((s) => [s.name, s.total]));
    const names = [...CATS].sort((a, b) => (sliceMap.get(b) ?? 0) - (sliceMap.get(a) ?? 0) || CATS.indexOf(a) - CATS.indexOf(b));
    const fullDays = buildDays(ic, rows, entries, null);
    const summary = summarize(ic, fullDays);
    const closed = fullDays.filter((d) => d.status === 'closed' || d.status === 'estimated');
    const weekendSpent = closed.filter((d) => [0, 6].includes(weekdayOfDay(START, d.day))).reduce((s, d) => s + d.totalSpent, 0);
    const biggestDay = [...closed].sort((a, b) => b.totalSpent - a.totalSpent)[0];
    return {
      ic, rows, colorOf, activeFocus, activeType, availableTypes, activeEvent, evList, slices, sliceMap, names, days,
      fullDays, summary,
      weekday: weekdayStats(days, START),
      time: timeBuckets(scoped, activeFocus),
      frequent: mostFrequent(scoped, activeFocus),
      payments: paymentTotals(scoped, activeFocus),
      savings: fromSavingsTotal(scoped, activeFocus),
      biggest: biggestSpends(scoped, activeFocus),
      listed: scoped.filter((e) => !activeFocus || e.category === activeFocus)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
      projected: projectTotal(fullDays, TOTAL_DAYS),
      noSpendDays: closed.filter((d) => d.totalSpent === 0).length,
      weekendShare: summary.spentOnClosed ? (weekendSpent / summary.spentOnClosed) * 100 : 0,
      biggestDay,
    };
  }, [focus, focusType, focusEvent]);

  const fillPct = Math.min((data.summary.spentSoFar / PLAN) * 100, 100);
  const paceRatio = data.summary.closedDays >= MIN_CLOSED_DAYS
    ? data.summary.spentOnClosed / data.summary.closedDays / (PLAN / TOTAL_DAYS) : null;
  const paceLevel = paceRatio == null ? null : paceRatio <= 1 ? 'good' : paceRatio <= 1.1 ? 'warn' : 'bad';
  const focusColor = data.activeFocus ? data.colorOf[data.activeFocus] : colors.ink;
  return {
    ...data, mode, setMode, setFocus, toggleFocus, setFocusType, setFocusEvent, fillPct, paceLevel, focusColor,
    barColor: data.activeFocus ? focusColor : colors.ink,
    clearAll: () => { setFocus(null); setFocusEvent(null); },
    hasFocus: !!(data.activeFocus || data.activeEvent),
  };
}
export type Ctx = ReturnType<typeof useInsights>;
export const HOT = '#D98324';
export const perDay = PLAN / TOTAL_DAYS;
export const daysLeft = TOTAL_DAYS - TODAY + 1;

/* =================================================================================================
 * Building blocks (current page parts, unchanged in behaviour) + the few NEW ones.
 * ================================================================================================= */
export const NewTag = () => <span className="ml-2 rounded-full bg-goodBg px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-good">New</span>;

export function Section({ title, hint, isNew, children }: { title: ReactNode; hint?: string; isNew?: boolean; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-4">
      <div className="mb-3">
        <h2 className="text-section font-semibold text-ink">{title}{isNew && <NewTag />}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function MonthPicker({ small = false }: { small?: boolean }) {
  const btn = `flex ${small ? 'h-8 w-8' : 'h-9 w-9'} min-h-0 items-center justify-center rounded-full border border-line text-ink`;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <button type="button" aria-label="Earlier month" className={btn}>‹</button>
      <span className={`${small ? 'min-w-[84px]' : 'min-w-[110px]'} text-center text-[13px] font-medium text-ink`}>November 2026</span>
      <button type="button" aria-label="Later month" disabled className={`${btn} disabled:opacity-30`}>›</button>
    </div>
  );
}
export const Header = () => (
  <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-6">
    <h1 className="text-question font-semibold text-ink">Insights</h1>
    <MonthPicker />
  </div>
);

/** Shown on every tab while a focus is on, so a filter set on one tab is never a surprise on another. */
export function FocusBar({ c }: { c: Ctx }) {
  if (!c.hasFocus) return null;
  const parts = [c.activeFocus, c.activeType, c.activeEvent].filter(Boolean).join(' · ');
  return (
    <div className="mx-6 mb-1 mt-2 flex items-center gap-2 rounded-full bg-tint py-1.5 pl-3.5 pr-1.5 text-[13px]">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.focusColor }} />
      <span className="min-w-0 flex-1 truncate text-ink">Showing <b>{parts}</b></span>
      <button onClick={c.clearAll} className="h-7 min-h-0 rounded-full bg-white px-3 text-[12px] font-medium text-ink shadow-sm">Clear</button>
    </div>
  );
}

export function SummaryCard({ c }: { c: Ctx }) {
  return (
    <section className="rounded-[20px] border border-line bg-white p-5 shadow-sm" aria-label="Summary">
      <SummaryContent c={c} />
    </section>
  );
}

/** The Summary card's insides, without the card (used by SummaryCard and the flip card's front). */
export function SummaryContent({ c }: { c: Ctx }) {
  const s = c.summary;
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium uppercase tracking-wide text-soft">Spent this month</p>
        <span className="num rounded-full bg-tint px-2.5 py-1 text-[12px] font-medium text-ink">{Math.round(c.fillPct)}% used</span>
      </div>
      <p className="num mt-1 text-big text-ink"><span className="text-faint">₹</span>{num1(s.spentSoFar)}</p>
      <p className="mt-1 text-[14px] text-soft">of {inr1(PLAN)} to live on</p>
      <p className="num mt-0.5 text-[12px] text-faint">+ {inr1(INCOME)} income this month, not counted as spent</p>
      <div className="relative mt-5 h-3 rounded-full bg-tint">
        <div className="h-3 rounded-full" style={{ width: `${c.fillPct}%`, background: c.paceLevel === 'bad' ? colors.bad : c.paceLevel === 'warn' ? colors.warm : colors.ink }} />
        <div className="absolute -top-1.5 h-[24px] w-[3px] rounded-full bg-good ring-2 ring-white" style={{ left: `calc(${s.planMarker * 100}% - 1.5px)` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px] text-faint">
        <span>Day {s.closedDays} of {TOTAL_DAYS}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-0.5 rounded-full bg-good" /> on plan</span>
      </div>
      <p className={`mt-3 flex items-start gap-2.5 rounded-note px-3.5 py-2.5 text-[14px] ${
        c.paceLevel === 'good' ? 'bg-tint text-good' : c.paceLevel === 'warn' ? 'bg-warm/10 text-ink' : c.paceLevel === 'bad' ? 'bg-bad/10 text-ink' : 'bg-tint text-soft'}`}>
        {c.paceLevel && <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${c.paceLevel === 'good' ? 'bg-good' : c.paceLevel === 'warn' ? 'bg-warm' : 'bg-bad'}`} />}
        <span>{s.paceMessage ?? 'Close a few days to see this.'}</span>
      </p>
    </>
  );
}

/** Compact one-line summary for designs that pin it above the tabs. */
export function SummaryStrip({ c }: { c: Ctx }) {
  return (
    <div className="rounded-[18px] border border-line bg-white px-4 py-3 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="num text-[24px] font-semibold text-ink"><span className="text-faint">₹</span>{num1(c.summary.spentSoFar)}
          <span className="ml-1.5 text-[13px] font-normal text-soft">of {compactINR(PLAN)}</span></p>
        <span className={`text-[12px] font-medium ${c.paceLevel === 'bad' ? 'text-bad' : c.paceLevel === 'warn' ? 'text-warm' : 'text-good'}`}>
          {Math.round(c.fillPct)}% used · day {c.summary.closedDays}/{TOTAL_DAYS}
        </span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-tint">
        <div className="h-2 rounded-full" style={{ width: `${c.fillPct}%`, background: c.paceLevel === 'bad' ? colors.bad : c.paceLevel === 'warn' ? colors.warm : colors.ink }} />
        <div className="absolute -top-1 h-4 w-[3px] rounded-full bg-good ring-2 ring-white" style={{ left: `${c.summary.planMarker * 100}%` }} />
      </div>
    </div>
  );
}

/** NEW: numbers summarize() already computes (averageDay, leftToLive, projection) plus no-spend days. */
export function AtAGlance({ c }: { c: Ctx }) {
  return (
    <>
      <GlanceTiles c={c} />
      {c.summary.projectionMessage && <p className="mt-2.5 text-[13px] text-soft">{c.summary.projectionMessage}</p>}
    </>
  );
}

/** The four "At a glance" numbers. `flat` = tinted tiles for use inside another card (the flip card's back). */
export function GlanceTiles({ c, flat = false }: { c: Ctx; flat?: boolean }) {
  const s = c.summary;
  const avg = s.averageDay ?? 0;
  const leftPerDay = s.leftToLive / daysLeft;
  const end = c.projected?.endValue ?? s.spentSoFar;
  const Tile = ({ label, value, sub, tone = 'ink' }: { label: string; value: string; sub: string; tone?: 'ink' | 'good' | 'bad' }) => (
    <div className={flat ? 'rounded-note bg-tint px-3.5 py-3' : 'rounded-note border border-line bg-white p-3.5'}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`num mt-1 text-[20px] font-semibold ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink'}`}>{value}</p>
      <p className="mt-0.5 text-[12px] leading-snug text-soft">{sub}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Tile label="Average day" value={inr1(avg)} sub={`Day's amount is ${inr1(perDay)}`} tone={avg <= perDay ? 'good' : 'bad'} />
      <Tile label="Left a day" value={inr1(leftPerDay)} sub={`${inr1(s.leftToLive)} for ${daysLeft} days`} tone={leftPerDay >= 0 ? 'ink' : 'bad'} />
      <Tile label="Month end" value={compactINR(end)} sub={end <= PLAN ? `About ${compactINR(PLAN - end)} to spare` : `About ${compactINR(end - PLAN)} over`} tone={end <= PLAN ? 'good' : 'bad'} />
      <Tile label="No-spend days" value={String(c.noSpendDays)} sub={`of ${s.closedDays} days so far`} />
    </div>
  );
}

/* ---------- Flip card: Summary on the front, At a glance on the back; tap turns it 180° ---------- */
const FLIP_MS = 760;
const FLIP_EASE = 'cubic-bezier(.3,.7,.2,1)';
const FLIP_CSS = `
@keyframes flipLiftA{0%,100%{transform:scale(1)}50%{transform:scale(.94)}}
@keyframes flipLiftB{0%,100%{transform:scale(1)}50%{transform:scale(.94)}}
@keyframes flipSheen{0%{opacity:0}50%{opacity:.55}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){.flip-inner{transition:none!important}.flip-lift,.flip-sheen{animation:none!important}}`;

const RotateIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" /><path d="M3 21v-5h5" />
  </svg>
);
const FaceDots = ({ back }: { back: boolean }) => (
  <span className="flex gap-1" aria-hidden="true">
    <span className={`h-1.5 rounded-full transition-all ${back ? 'w-1.5 bg-line' : 'w-4 bg-ink'}`} />
    <span className={`h-1.5 rounded-full transition-all ${back ? 'w-4 bg-ink' : 'w-1.5 bg-line'}`} />
  </span>
);

/**
 * axis 'y' = turns side to side like a playing card; 'x' = tips over top to bottom like a calendar page.
 * Both faces sit in the same grid cell, so the card is as tall as the taller face and nothing below it moves.
 * The card dips slightly (scale .94) mid-turn and a soft sheen passes over it; reduced motion = instant swap.
 */
export function FlipCard({ c, axis = 'y' }: { c: Ctx; axis?: 'x' | 'y' }) {
  const [back, setBack] = useState(false);
  const [turns, setTurns] = useState(0);
  const flip = () => { setBack((b) => !b); setTurns((t) => t + 1); };
  const turn = (deg: number) => (axis === 'y' ? `rotateY(${deg}deg)` : `rotateX(${-deg}deg)`);
  const face = 'relative flex flex-col rounded-[20px] border border-line bg-white p-5 shadow-sm [grid-area:1/1]';
  const hidden = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const };
  const sheen = turns ? { animation: `flipSheen ${FLIP_MS}ms ${FLIP_EASE}` } : { opacity: 0 };
  return (
    <div style={{ perspective: 1400 }}>
      <style>{FLIP_CSS}</style>
      <div className="flip-lift" style={turns ? { animation: `${turns % 2 ? 'flipLiftA' : 'flipLiftB'} ${FLIP_MS}ms ${FLIP_EASE}` } : undefined}>
        <div
          role="button"
          tabIndex={0}
          aria-pressed={back}
          aria-label={back ? 'At a glance. Tap to see the month summary.' : 'Month summary. Tap to see at a glance.'}
          onClick={flip}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } }}
          className="flip-inner grid cursor-pointer select-none rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          style={{ transformStyle: 'preserve-3d', transition: `transform ${FLIP_MS}ms ${FLIP_EASE}`, transform: turn(back ? 180 : 0) }}
        >
          {/* front: the month summary */}
          <section className={face} style={hidden} aria-hidden={back}>
            <SummaryContent c={c} />
            <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-soft">
              <span className="flex items-center gap-1.5"><RotateIcon /> Tap for at a glance</span>
              <FaceDots back={false} />
            </div>
            <span className="flip-sheen pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white via-tint to-white mix-blend-multiply" style={sheen} />
          </section>
          {/* back: at a glance */}
          <section className={face} style={{ ...hidden, transform: turn(180) }} aria-hidden={!back}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium uppercase tracking-wide text-soft">At a glance<NewTag /></p>
              <span className="num rounded-full bg-tint px-2.5 py-1 text-[12px] font-medium text-ink">Day {c.summary.closedDays} of {TOTAL_DAYS}</span>
            </div>
            <div className="mt-3"><GlanceTiles c={c} flat /></div>
            {c.summary.projectionMessage && <p className="mt-3 text-[13px] leading-snug text-soft">{c.summary.projectionMessage}</p>}
            <div className="mt-auto flex items-center justify-between pt-4 text-[12px] text-soft">
              <span className="flex items-center gap-1.5"><RotateIcon /> Tap for the month</span>
              <FaceDots back />
            </div>
            <span className="flip-sheen pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-br from-white via-tint to-white mix-blend-multiply" style={sheen} />
          </section>
        </div>
      </div>
    </div>
  );
}

export function Patterns({ c }: { c: Ctx }) {
  return (
    <div className="flex flex-col gap-2.5">
      {c.frequent ? (
        <Note tone="neutral"><span className="font-semibold">{c.frequent.label}</span> is your most frequent spend: {c.frequent.count} times, {inr1(c.frequent.total)} in total.</Note>
      ) : <p className="text-body text-soft">Patterns show up once you have a few repeat spends.</p>}
      <Note tone="good"><span className="font-semibold">{inr1(1800)}</span> saved from leftovers across 2 months.</Note>
      {c.savings > 0 && <Note tone="adjust">{inr1(c.savings)} taken from savings this month.</Note>}
      {!c.hasFocus && c.biggestDay && (
        <Note tone="neutral"><span className="font-semibold">{formatWithWeekday(dateOfDay(START, c.biggestDay.day))}</span> was your biggest day: {inr1(c.biggestDay.totalSpent)}.<NewTag /></Note>
      )}
      {!c.hasFocus && (
        <Note tone="neutral">Weekends took <span className="font-semibold">{Math.round(c.weekendShare)}%</span> of your spending, in 2 of every 7 days.<NewTag /></Note>
      )}
    </div>
  );
}

export function Biggest({ c, n = 5 }: { c: Ctx; n?: number }) {
  if (!c.biggest.length) return <p className="text-body text-soft">Nothing here yet.</p>;
  return (
    <ol className="flex flex-col gap-2.5">
      {c.biggest.slice(0, n).map((e, i) => (
        <li key={i} className="flex items-center gap-3 rounded-note border border-line bg-white p-3.5">
          <span className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${i === 0 ? 'bg-ink text-white' : 'bg-tint text-soft'}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-ink">{e.label}
              {e.fromSavings && <span className="ml-2 rounded-full bg-warm/10 px-2 py-0.5 text-[11px] text-ink">from savings</span>}</p>
            <p className="truncate text-[12px] text-faint">{formatWithWeekday(dateOfDay(START, e.day))} · {e.subcategory ?? e.category}{e.payment ? ` · ${e.payment}` : ''}{e.event ? ` · ${e.event}` : ''}</p>
            {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
          </div>
          <p className="num text-[18px] font-semibold text-ink">{inr1(e.amount)}</p>
        </li>
      ))}
    </ol>
  );
}

export function Filters({ c }: { c: Ctx }) {
  return (
    <>
      <SwipeRow label="Filter by category" className="mt-3">
        <div className="flex w-max items-center gap-1.5 pb-1">
          <button onClick={() => c.setFocus(null)} aria-pressed={!c.activeFocus}
            className={`flex h-9 min-h-0 items-center rounded-full border px-3.5 text-[13px] font-medium ${!c.activeFocus ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>All</button>
          {c.names.map((n) => {
            const t = c.sliceMap.get(n) ?? 0;
            const on = c.activeFocus === n;
            return (
              <button key={n} onClick={() => c.toggleFocus(n)} aria-pressed={on}
                className={`flex h-9 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${on ? 'border-ink bg-white font-semibold text-ink' : t > 0 ? 'border-line bg-white text-ink' : 'border-line/70 bg-white text-faint'}`}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.colorOf[n] }} />{n}
                {t > 0 && <span className="num text-[12px] text-soft">{compactINR(t)}</span>}
              </button>
            );
          })}
        </div>
      </SwipeRow>
      {c.activeFocus && c.availableTypes.length > 0 && (
        <SwipeRow label="Filter by type" className="mt-2">
          <div className="flex w-max items-center gap-1.5 pb-1">
            <span className="text-[12px] font-medium text-soft">Type:</span>
            <button onClick={() => c.setFocusType(null)} className={`flex h-8 min-h-0 items-center rounded-full border px-3 text-[12px] font-medium ${!c.activeType ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>All {c.activeFocus}</button>
            {c.availableTypes.map((t) => (
              <button key={t.name} onClick={() => c.setFocusType(c.activeType === t.name ? null : t.name)}
                className={`flex h-8 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${c.activeType === t.name ? 'border-ink bg-white text-ink' : 'border-line bg-white text-ink'}`}>
                {t.name}<span className="num text-[11px] text-soft">{inr1(t.total)}</span>
              </button>
            ))}
          </div>
        </SwipeRow>
      )}
      {c.evList.length > 0 && (
        <SwipeRow label="Filter by event" className="mt-2">
          <div className="flex w-max items-center gap-1.5 pb-1">
            <span className="text-[12px] font-medium text-soft">Event:</span>
            <button onClick={() => c.setFocusEvent(null)} className={`flex h-8 min-h-0 items-center rounded-full border px-3 text-[12px] font-medium ${!c.activeEvent ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>All events</button>
            {c.evList.map((ev) => (
              <button key={ev.name} onClick={() => c.setFocusEvent(c.activeEvent === ev.name ? null : ev.name)}
                className={`flex h-8 min-h-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium ${c.activeEvent === ev.name ? 'border-ink bg-white text-ink' : 'border-line bg-white text-ink'}`}>
                {ev.name}<span className="num text-[11px] text-soft">{inr1(ev.total)}</span>
              </button>
            ))}
          </div>
        </SwipeRow>
      )}
    </>
  );
}

export function Trend({ c, filters = true }: { c: Ctx; filters?: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 rounded-key bg-tint p-1" role="group" aria-label="Chart view">
        {([['each', 'Each day'], ['running', 'Running total']] as const).map(([id, label]) => (
          <button key={id} onClick={() => c.setMode(id)} aria-pressed={c.mode === id}
            className={`min-h-[40px] rounded-[10px] px-4 text-[14px] font-medium ${c.mode === id ? 'bg-white text-ink shadow-sm' : 'text-soft'}`}>{label}</button>
        ))}
      </div>
      {filters && <Filters c={c} />}
      <div className="mt-3 rounded-[20px] border border-line bg-white p-3">
        <DayChart days={c.days} mode={c.mode} focus={c.activeType ? `${c.activeFocus} · ${c.activeType}` : c.activeFocus ?? c.activeEvent}
          focusColor={c.focusColor} planAmount={PLAN} startDate={START} totalDays={TOTAL_DAYS} />
      </div>
    </>
  );
}

export const Weekday = ({ c }: { c: Ctx }) => c.weekday.closedCount >= MIN_CLOSED_DAYS
  ? <WeekdayChart stats={c.weekday.stats} usual={c.weekday.usual} color={c.barColor} hotColor={c.activeFocus ? undefined : HOT} resetKey={c.activeFocus} />
  : <p className="text-body text-soft">Close a few days to see this.</p>;
export const TimeOfDay = ({ c }: { c: Ctx }) => (
  <TimeOfDayChart buckets={c.time} color={c.barColor} hotColor={c.activeFocus ? undefined : HOT} resetKey={c.activeFocus} />
);

export function Where({ c }: { c: Ctx }) {
  if (!c.slices.length) return <p className="text-body text-soft">Nothing to split up yet.</p>;
  return (
    <>
      <Donut slices={c.slices} colorOf={c.colorOf} focus={c.activeFocus} onFocus={c.toggleFocus} />
      <CategoryList slices={c.slices} colorOf={c.colorOf} focus={c.activeFocus} onFocus={c.toggleFocus}
        focusType={c.activeType} onFocusType={(t) => c.setFocusType(c.activeType === t ? null : t)} />
    </>
  );
}

/** NEW: this month vs the same point last month, per category. */
export function VsLastMonth({ c }: { c: Ctx }) {
  const rows = c.slices.slice(0, 5);
  return (
    <div className="rounded-note border border-line bg-white p-4">
      <ul className="flex flex-col gap-3">
        {rows.map((s) => {
          const last = LAST_MONTH[s.name] ?? 0;
          const diff = s.total - last;
          const pct = last ? Math.round((diff / last) * 100) : null;
          return (
            <li key={s.name} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.colorOf[s.name] }} />
              <span className="flex-1 text-[14px] font-medium text-ink">{s.name}</span>
              <span className="num text-[12px] text-faint">{compactINR(last)} →</span>
              <span className="num w-[64px] text-right text-[14px] text-ink">{compactINR(s.total)}</span>
              <span className={`num w-[52px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold ${diff > 0 ? 'bg-bad/10 text-bad' : 'bg-goodBg text-good'}`}>
                {pct == null ? 'new' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12px] text-faint">October, by day 24, against this month so far.</p>
    </div>
  );
}

export function FocusedSpends({ c }: { c: Ctx }) {
  if (!c.hasFocus) return null;
  return (
    <Section title={`Spends${c.activeFocus ? ` in ${c.activeFocus}` : ''}${c.activeType ? ` · ${c.activeType}` : ''}${c.activeEvent ? ` · ${c.activeEvent}` : ''}`} hint="Tap a spend to see or change it.">
      <ul className="flex flex-col gap-2">
        {c.listed.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-note border border-line bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-ink">{e.label}</p>
              <p className="truncate text-[12px] text-faint">{formatWithWeekday(e.date)} · {e.subcategory ?? e.category}{e.payment ? ` · ${e.payment}` : ''}</p>
            </div>
            <p className="num text-[16px] font-semibold text-ink">{inr1(e.amount)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Payments({ c }: { c: Ctx }) {
  return (
    <div className="rounded-note border border-line bg-white p-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-tint">
        {c.payments.map((p, i) => <div key={p.name} className="h-full border-r-2 border-white last:border-r-0" style={{ width: `${p.pct}%`, background: categoryRamp[i % categoryRamp.length] }} />)}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {c.payments.map((p, i) => (
          <li key={p.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoryRamp[i % categoryRamp.length] }} />
              <div><p className="text-[14px] font-medium text-ink">{p.name}</p><p className="text-[12px] text-faint">{p.count} {p.count === 1 ? 'spend' : 'spends'}</p></div>
            </div>
            <div className="text-right"><p className="num text-[16px] font-semibold text-ink">{inr1(p.total)}</p><p className="num text-[12px] text-soft">{Math.round(p.pct)}%</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Events({ c }: { c: Ctx }) {
  if (!c.evList.length) return <p className="text-body text-soft">Tag spends with an event (a trip, a party) and they add up here.</p>;
  const top = c.evList.reduce((m, e) => Math.max(m, e.total), 0);
  return (
    <ul className="flex flex-col gap-3">
      {c.evList.map((ev) => {
        const on = c.activeEvent === ev.name;
        return (
          <li key={ev.name} className={`rounded-note border bg-white p-4 ${on ? 'border-ink' : 'border-line'}`}>
            <button type="button" onClick={() => c.setFocusEvent(on ? null : ev.name)} aria-pressed={on} className="flex w-full items-start justify-between gap-3 text-left">
              <div>
                <p className="text-[16px] font-semibold text-ink">{ev.name}</p>
                {ev.note && <p className="mt-0.5 text-[13px] text-soft">{ev.note}</p>}
                <p className="mt-1 text-[12px] text-faint">{ev.count} {ev.count === 1 ? 'spend' : 'spends'}{ev.pct > 0 ? ` · ${Math.round(ev.pct)}% of spending` : ''}</p>
              </div>
              <p className="num text-[20px] font-semibold text-ink">{inr1(ev.total)}</p>
            </button>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-tint">
              <div className="h-full rounded-full" style={{ width: `${top ? Math.max((ev.total / top) * 100, 4) : 0}%`, background: c.barColor }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ev.categories.map((cat) => (
                <button key={cat.name} type="button" onClick={() => c.toggleFocus(cat.name)} aria-pressed={c.activeFocus === cat.name}
                  className={`flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${c.activeFocus === cat.name ? 'border-ink bg-ink text-white' : cat.total > 0 ? 'border-line bg-white text-ink' : 'border-line bg-white text-faint'}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: c.colorOf[cat.name] ?? colors.ink }} />{cat.name}<span className="num opacity-80">{inr1(cat.total)}</span>
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- sections ---------- */
export type Sec = 'Overview' | 'Trend' | 'Categories' | 'Events';
export const SECS: Sec[] = ['Overview', 'Trend', 'Categories', 'Events'];

export function Body({ sec, c, summary = true, filtersInTrend = true, flip }: { sec: Sec; c: Ctx; summary?: boolean; filtersInTrend?: boolean; flip?: 'x' | 'y' }) {
  switch (sec) {
    case 'Overview':
      return (<>
        {flip ? <div className="mt-4"><FlipCard c={c} axis={flip} /></div> : (<>
          {summary && <div className="mt-4"><SummaryCard c={c} /></div>}
          <Section title="At a glance" isNew><AtAGlance c={c} /></Section>
        </>)}
        <Section title="Patterns"><Patterns c={c} /></Section>
        <Section title="Biggest spends" hint={`Your five largest${c.activeFocus ? ` in ${c.activeFocus}` : ''} this month.`}><Biggest c={c} /></Section>
      </>);
    case 'Trend':
      return (<>
        <Section title="Spending over the month" hint="Filter by category, type or event to zoom in."><Trend c={c} filters={filtersInTrend} /></Section>
        <Section title="By day of week" hint="Which days run hotter than usual."><Weekday c={c} /></Section>
        <Section title="By time of day" hint="When in the day your money moves."><TimeOfDay c={c} /></Section>
      </>);
    case 'Categories':
      return (<>
        <Section title="Where it went" hint="Tap a slice to focus the whole page on it."><Where c={c} /></Section>
        <FocusedSpends c={c} />
        {!c.activeEvent && <Section title="vs last month" hint="Same point in October." isNew><VsLastMonth c={c} /></Section>}
        {c.payments.length > 0 && <Section title="By payment mode" hint="How you paid, by share of spend."><Payments c={c} /></Section>}
      </>);
    case 'Events':
      return (<>
        <Section title="By event" hint="Trips, parties, anything you tagged. Tap one to focus on it."><Events c={c} /></Section>
        {c.activeEvent && <FocusedSpends c={c} />}
      </>);
  }
}

export const Nav = () => (
  <div className="flex h-16 shrink-0 items-center justify-around border-t border-line bg-white text-[11px] text-faint">
    {['Today', 'History', 'Insights', 'Splits', 'You'].map((t) => (
      <span key={t} className={t === 'Insights' ? 'font-semibold text-ink' : ''}>{t}</span>
    ))}
  </div>
);
export const Pad = ({ children, bottom = 'pb-8' }: { children: ReactNode; bottom?: string }) => <div className={`px-6 ${bottom}`}>{children}</div>;
