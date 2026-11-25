import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { compactINR } from '@/lib/history';
import { phone, useInsights, Header, FocusBar, Filters, Body, Nav, Pad, SummaryCard, SummaryStrip, AtAGlance, Patterns, Section, SECS, type Sec } from './insights-shared';


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
const meta: Meta = { title: 'Insights sub-tabs (6 designs)', parameters: { layout: 'centered' } };
export default meta;


/* =================================================================================================
 * A. Segmented pill tabs, sticky under the header.  Simplest change; same look as Spend | Lend | Income.
 * ================================================================================================= */
export const A_StickyPills = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec>('Overview');
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <div className="sticky top-0 z-10 bg-white/95 px-6 pb-2 pt-1 backdrop-blur">
          <div role="tablist" className="grid grid-cols-4 rounded-full bg-tint p-1">
            {SECS.map((k) => (
              <button key={k} role="tab" aria-selected={s === k} onClick={() => setS(k)}
                className={`h-9 min-h-0 rounded-full text-[13px] font-medium ${s === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
            ))}
          </div>
          <FocusBar c={c} />
        </div>
        <Pad><Body sec={s} c={c} /></Pad>
      </div>
      <Nav />
    </div>
  );
};

/* =================================================================================================
 * B. Underline tabs that carry a small live value under each label.  Sticky; filters live above the tabs
 *    (they shape every tab), so Trend shows only the chart.
 * ================================================================================================= */
export const B_UnderlineWithValues = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec>('Overview');
  const sub: Record<Sec, string> = {
    Overview: `${Math.round(c.fillPct)}% used`,
    Trend: `${compactINR(c.summary.averageDay ?? 0)}/day`,
    Categories: c.slices[0] ? `${c.slices[0].name} ${Math.round(c.slices[0].pct)}%` : '—',
    Events: `${c.evList.length} tagged`,
  };
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <div className="px-6"><Filters c={c} /></div>
        <div className="sticky top-0 z-10 mt-3 grid grid-cols-4 border-b border-line bg-white">
          {SECS.map((k) => (
            <button key={k} onClick={() => setS(k)} className={`-mb-px flex min-h-0 flex-col items-center border-b-2 pb-2 pt-2.5 ${s === k ? 'border-ink' : 'border-transparent'}`}>
              <span className={`text-[14px] ${s === k ? 'font-semibold text-ink' : 'text-soft'}`}>{k}</span>
              <span className={`num mt-0.5 text-[11px] ${s === k ? 'text-ink' : 'text-faint'}`}>{sub[k]}</span>
            </button>
          ))}
        </div>
        <FocusBar c={c} />
        <Pad><Body sec={s} c={c} filtersInTrend={false} /></Pad>
      </div>
      <Nav />
    </div>
  );
};

/* =================================================================================================
 * C. Floating tab bar at the bottom, above the app nav: within thumb reach while you scroll a long section.
 * ================================================================================================= */
export const C_FloatingBottom = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec>('Overview');
  return (
    <div className={phone}>
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto">
          <Header />
          <FocusBar c={c} />
          <Pad bottom="pb-28"><Body sec={s} c={c} /></Pad>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <div className="pointer-events-auto flex gap-1 rounded-full border border-line bg-white/95 p-1 shadow-lg backdrop-blur">
            {SECS.map((k) => (
              <button key={k} onClick={() => setS(k)}
                className={`h-10 min-h-0 rounded-full px-3.5 text-[13px] font-medium ${s === k ? 'bg-ink text-white' : 'text-soft'}`}>{k}</button>
            ))}
          </div>
        </div>
      </div>
      <Nav />
    </div>
  );
};

/* =================================================================================================
 * D. The month's headline stays pinned (compact strip) with chip tabs under it; the full Summary card
 *    is no longer needed, so Overview starts straight at "At a glance".
 * ================================================================================================= */
export const D_PinnedSummary = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec>('Overview');
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <div className="sticky top-0 z-10 bg-white px-6 pb-2 pt-1 shadow-[0_6px_12px_-10px_rgba(0,0,0,0.15)]">
          <SummaryStrip c={c} />
          <div className="mt-2.5 flex gap-1.5">
            {SECS.map((k) => (
              <button key={k} onClick={() => setS(k)}
                className={`h-8 min-h-0 flex-1 rounded-full text-[12px] font-medium ${s === k ? 'bg-ink text-white' : 'bg-tint text-soft'}`}>{k}</button>
            ))}
          </div>
          <p className={`mt-2 text-[12px] ${c.paceLevel === 'good' ? 'text-good' : 'text-soft'}`}>{c.summary.paceMessage}</p>
        </div>
        <FocusBar c={c} />
        <Pad><Body sec={s} c={c} summary={false} /></Pad>
      </div>
      <Nav />
    </div>
  );
};

/* =================================================================================================
 * E. Overview hub: Summary on top, then one tile per section with its headline answer. Tap to open the
 *    section full screen; ‹ › at the top move between sections without going back.
 * ================================================================================================= */
export const E_HubAndDrillIn = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec | null>(null);
  const top = c.slices[0];
  const hotDay = [...c.weekday.stats].sort((a, b) => b.avg - a.avg)[0];
  const tiles: { sec: Exclude<Sec, 'Overview'> | 'Biggest'; label: string; value: string; sub: string }[] = [
    { sec: 'Trend', label: 'Trend', value: `${compactINR(c.summary.averageDay ?? 0)}/day`, sub: hotDay ? `${hotDay.name} run hottest` : 'Close a few days' },
    { sec: 'Categories', label: 'Categories', value: top ? `${top.name} ${Math.round(top.pct)}%` : '—', sub: `${c.slices.length} categories · ${c.payments[0]?.name ?? ''} most used` },
    { sec: 'Events', label: 'Events', value: c.evList[0] ? compactINR(c.evList[0].total) : '—', sub: c.evList[0] ? `${c.evList[0].name} is the biggest` : 'Nothing tagged' },
    { sec: 'Biggest', label: 'Biggest spend', value: c.biggest[0] ? compactINR(c.biggest[0].amount) : '—', sub: c.biggest[0]?.label ?? '' },
  ];
  const idx = s ? SECS.indexOf(s) : -1;
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        {s ? (
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-4 pb-2 pt-5">
            <button onClick={() => setS(null)} aria-label="Back" className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full border border-line text-ink">←</button>
            <h1 className="flex-1 text-[20px] font-semibold text-ink">{s}</h1>
            <button disabled={idx <= 1} onClick={() => setS(SECS[idx - 1])} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-full bg-tint text-ink disabled:opacity-30">‹</button>
            <span className="num text-[12px] text-faint">{idx}/3</span>
            <button disabled={idx >= 3} onClick={() => setS(SECS[idx + 1])} className="flex h-8 w-8 min-h-0 items-center justify-center rounded-full bg-tint text-ink disabled:opacity-30">›</button>
          </div>
        ) : <Header />}
        <FocusBar c={c} />
        <Pad>
          {s ? <Body sec={s} c={c} /> : (
            <>
              <div className="mt-2"><SummaryCard c={c} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {tiles.map((t) => (
                  <button key={t.label} onClick={() => setS(t.sec === 'Biggest' ? 'Overview' : t.sec)}
                    className="flex min-h-0 flex-col rounded-[18px] border border-line bg-white p-4 text-left shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{t.label}</p>
                    <p className="num mt-1.5 text-[19px] font-semibold text-ink">{t.value}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-soft">{t.sub}</p>
                    <p className="mt-2.5 text-[12px] font-medium text-ink">See all ›</p>
                  </button>
                ))}
              </div>
              <Section title="At a glance" isNew><AtAGlance c={c} /></Section>
              <Section title="Patterns"><Patterns c={c} /></Section>
            </>
          )}
        </Pad>
      </div>
      <Nav />
    </div>
  );
};

/* =================================================================================================
 * F. Value tabs: each tab IS a stat (spent, a day, top category, events), so the key numbers are visible
 *    before you tap anything. Selected tab turns ink.
 * ================================================================================================= */
export const F_StatTabs = () => {
  const c = useInsights();
  const [s, setS] = useState<Sec>('Overview');
  const vt: Record<Sec, { label: string; value: string }> = {
    Overview: { label: 'Spent', value: compactINR(c.summary.spentSoFar) },
    Trend: { label: 'A day', value: compactINR(c.summary.averageDay ?? 0) },
    Categories: { label: 'Top', value: c.slices[0]?.name ?? '—' },
    Events: { label: 'Events', value: compactINR(c.evList.reduce((a, e) => a + e.total, 0)) },
  };
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <div className="sticky top-0 z-10 bg-white px-6 pb-2 pt-1">
          <div className="grid grid-cols-4 gap-2">
            {SECS.map((k) => (
              <button key={k} onClick={() => setS(k)}
                className={`min-h-0 rounded-note border px-2.5 py-2.5 text-left transition-colors ${s === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>
                <p className={`text-[10px] font-medium uppercase tracking-wide ${s === k ? 'text-white/70' : 'text-faint'}`}>{vt[k].label}</p>
                <p className="num mt-0.5 truncate text-[16px] font-semibold">{vt[k].value}</p>
                <p className={`mt-0.5 text-[10px] ${s === k ? 'text-white/70' : 'text-faint'}`}>{k}</p>
              </button>
            ))}
          </div>
          <FocusBar c={c} />
        </div>
        <Pad><Body sec={s} c={c} /></Pad>
      </div>
      <Nav />
    </div>
  );
};
