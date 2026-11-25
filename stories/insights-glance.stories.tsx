import type { Meta } from '@storybook/react-vite';
import { phone, useInsights, Header, Nav, Pad, Section, SAMPLE, perDay, HOT, type Ctx } from './insights-shared';
import { compactINR } from '@/lib/history';
import { formatWithWeekday } from '@/lib/dates';
import { inr1 } from '@/lib/format';

/**
 * "At a glance", five redesigns. The old tiles (average day, left a day, month end) repeated the Summary card, so
 * these show NEW facts instead, all from numbers `lib/insights` already computes on the sample month (Nov, day 25):
 *   1. Top category (+ its top type)   2. Priciest / cheapest weekday   3. Biggest single spend
 *   4. Days over the day's amount + best streak   5. Spends a day + small-spend total   (+ busiest time, top payment)
 * and one plain-language suggestion built from them. Same facts in every design; only the layout differs.
 *   A  Highlights list      B  Tiles with a mini visual     C  A short story in sentences
 *   D  Swipe cards          E  "Your month in 5 questions"
 */
const meta: Meta = { title: 'Insights · At a glance (5 designs)', parameters: { layout: 'centered' } };
export default meta;

const SMALL = 150;

function useGlance(c: Ctx) {
  const closed = c.fullDays.filter((d) => d.status === 'closed' || d.status === 'estimated');
  const topCat = c.slices[0];
  const topType = topCat?.types[0];
  const wd = c.weekday.stats.filter((s) => s.count > 0);
  const priciest = [...wd].sort((a, b) => b.avg - a.avg)[0];
  const cheapest = [...wd].sort((a, b) => a.avg - b.avg)[0];
  const big = c.biggest[0];
  const over = closed.filter((d) => d.totalSpent > perDay).length;
  let best = 0, run = 0;
  for (const d of closed) { run = d.totalSpent <= perDay ? run + 1 : 0; best = Math.max(best, run); }
  const counted = SAMPLE.filter((e) => !e.fromSavings);
  const perDayCount = counted.length / Math.max(1, c.summary.closedDays);
  const small = counted.filter((e) => e.amount < SMALL);
  const smallTotal = small.reduce((s, e) => s + e.amount, 0);
  const time = [...c.time].sort((a, b) => b.total - a.total)[0];
  const timeTotal = c.time.reduce((s, b) => s + b.total, 0);
  const pay = c.payments[0];
  const usual = c.weekday.usual;
  const tip = priciest && priciest.avg > usual * 1.15
    ? `${priciest.name} are your priciest day, about ${inr1(priciest.avg - usual)} above a usual day. Planning one of those outings for a weekday could save around ${inr1((priciest.avg - usual) * 4)} a month.`
    : `Spending is even across the week. ${topCat?.name ?? 'Your top category'} is where any saving would come from.`;
  return { closed, topCat, topType, priciest, cheapest, big, over, best, perDayCount, small, smallTotal, time,
    timePct: timeTotal ? ((time?.total ?? 0) / timeTotal) * 100 : 0, pay, usual, tip, wd };
}
type G = ReturnType<typeof useGlance>;

const Label = ({ children }: { children: string }) => <p className="text-[11px] font-medium uppercase tracking-wide text-faint">{children}</p>;
const Tip = ({ g }: { g: G }) => (
  <p className="mt-3 rounded-note bg-tint px-3.5 py-2.5 text-[13px] leading-snug text-ink"><span className="font-semibold">Try this: </span>{g.tip}</p>
);
const Page = ({ children }: { children: (c: Ctx, g: G) => React.ReactNode }) => {
  const c = useInsights();
  const g = useGlance(c);
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto">
        <Header />
        <Pad><Section title="At a glance" hint="What stands out this month.">{children(c, g)}</Section></Pad>
      </div>
      <Nav />
    </div>
  );
};

/* A. Highlights list ------------------------------------------------------------------------- */
export const A_HighlightsList = () => (
  <Page>{(_c, g) => {
    const rows: [string, string, string][] = [
      ['Top category', `${g.topCat.name} · ${compactINR(g.topCat.total)}`, `${Math.round(g.topCat.pct)}% of spending${g.topType ? `, mostly ${g.topType.name}` : ''}`],
      ['Priciest day', g.priciest.name, `averages ${inr1(g.priciest.avg)}; cheapest is ${g.cheapest.name.toLowerCase()} at ${inr1(g.cheapest.avg)}`],
      ['Biggest spend', inr1(g.big.amount), `${g.big.label} · ${formatWithWeekday(g.big.date)}`],
      ['Over the day\'s amount', `${g.over} days`, `best run: ${g.best} days in a row under it`],
      ['Spends a day', g.perDayCount.toFixed(1), `${g.small.length} spends under ₹${150} add up to ${inr1(g.smallTotal)}`],
    ];
    return (<>
      <ul className="divide-y divide-line rounded-[20px] border border-line bg-white">
        {rows.map(([k, v, sub]) => (
          <li key={k} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3"><span className="text-[13px] text-soft">{k}</span><span className="num text-[16px] font-semibold text-ink">{v}</span></div>
            <p className="mt-0.5 text-[12px] text-faint">{sub}</p>
          </li>
        ))}
      </ul>
      <Tip g={g} />
    </>);
  }}</Page>
);

/* B. Tiles with a mini visual ---------------------------------------------------------------- */
export const B_TilesWithVisual = () => (
  <Page>{(c, g) => {
    const max = Math.max(...g.wd.map((s) => s.avg), 1);
    const tile = 'rounded-note border border-line bg-white p-3.5';
    return (<>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={tile}>
          <Label>Top category</Label>
          <p className="mt-1 flex items-center gap-1.5 text-[18px] font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.colorOf[g.topCat.name] }} />{g.topCat.name}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-tint"><div className="h-full rounded-full" style={{ width: `${g.topCat.pct}%`, background: c.colorOf[g.topCat.name] }} /></div>
          <p className="num mt-1.5 text-[12px] text-soft">{Math.round(g.topCat.pct)}% · {compactINR(g.topCat.total)}</p>
        </div>
        <div className={tile}>
          <Label>Priciest day</Label>
          <p className="mt-1 text-[18px] font-semibold text-ink">{g.priciest.name}</p>
          <div className="mt-2 flex h-6 items-end gap-0.5">
            {c.weekday.stats.map((s) => <div key={s.wd} className="flex-1 rounded-sm" style={{ height: `${Math.max(8, (s.avg / max) * 100)}%`, background: s === g.priciest ? HOT : '#E4E4E0' }} />)}
          </div>
          <p className="num mt-1.5 text-[12px] text-soft">avg {inr1(g.priciest.avg)}</p>
        </div>
        <div className={tile}>
          <Label>Biggest spend</Label>
          <p className="num mt-1 text-[20px] font-semibold text-ink">{inr1(g.big.amount)}</p>
          <p className="mt-0.5 truncate text-[12px] text-soft">{g.big.label}</p>
          <p className="text-[12px] text-faint">{formatWithWeekday(g.big.date)}</p>
        </div>
        <div className={tile}>
          <Label>Over the day's amount</Label>
          <p className="num mt-1 text-[20px] font-semibold text-ink">{g.over} <span className="text-[13px] font-normal text-soft">of {g.closed.length} days</span></p>
          <div className="mt-2 flex gap-0.5">
            {g.closed.map((d) => <span key={d.day} className="h-2 flex-1 rounded-sm" style={{ background: d.totalSpent > perDay ? HOT : '#CFE3D6' }} />)}
          </div>
        </div>
        <div className={`${tile} col-span-2`}>
          <Label>Spends a day</Label>
          <div className="mt-1 flex items-baseline gap-2"><span className="num text-[20px] font-semibold text-ink">{g.perDayCount.toFixed(1)}</span>
            <span className="text-[12px] text-soft">{g.small.length} spends under ₹150 add up to {inr1(g.smallTotal)}</span></div>
        </div>
      </div>
      <Tip g={g} />
    </>);
  }}</Page>
);

/* C. A short story in sentences -------------------------------------------------------------- */
export const C_Sentences = () => (
  <Page>{(_c, g) => {
    const B = ({ children }: { children: React.ReactNode }) => <b className="num font-semibold text-ink">{children}</b>;
    return (
      <div className="rounded-[20px] border border-line bg-white p-5 text-[15px] leading-relaxed text-soft">
        <p><B>{g.topCat.name}</B> took the biggest share, <B>{Math.round(g.topCat.pct)}%</B> of spending{g.topType ? <>, mostly <B>{g.topType.name}</B></> : null}.</p>
        <p className="mt-3"><B>{g.priciest.name}</B> run hottest at <B>{inr1(g.priciest.avg)}</B> a day, while <B>{g.cheapest.name}</B> are the calmest.</p>
        <p className="mt-3">Your single biggest spend was <B>{inr1(g.big.amount)}</B> on {g.big.label.toLowerCase()} ({formatWithWeekday(g.big.date)}).</p>
        <p className="mt-3">You went over the day's amount on <B>{g.over}</B> of {g.closed.length} days; your best run under it is <B>{g.best} days</B>.</p>
        <p className="mt-3">That is about <B>{g.perDayCount.toFixed(1)}</B> spends a day, and {g.small.length} small ones under ₹150 came to <B>{inr1(g.smallTotal)}</B>.</p>
        <Tip g={g} />
      </div>
    );
  }}</Page>
);

/* D. Swipe cards ----------------------------------------------------------------------------- */
export const D_SwipeCards = () => (
  <Page>{(c, g) => {
    const cards: { k: string; v: string; sub: string; accent: string }[] = [
      { k: 'Top category', v: g.topCat.name, sub: `${Math.round(g.topCat.pct)}% · ${compactINR(g.topCat.total)}`, accent: c.colorOf[g.topCat.name] },
      { k: 'Priciest day', v: g.priciest.name, sub: `avg ${inr1(g.priciest.avg)}`, accent: HOT },
      { k: 'Biggest spend', v: inr1(g.big.amount), sub: g.big.label, accent: '#2A2A2A' },
      { k: 'Over the amount', v: `${g.over} days`, sub: `best streak ${g.best}`, accent: '#C0584B' },
      { k: 'Spends a day', v: g.perDayCount.toFixed(1), sub: `${g.small.length} under ₹150`, accent: '#3E8E7E' },
      { k: 'Busiest time', v: g.time.label, sub: `${Math.round(g.timePct)}% of spends`, accent: '#6B5BA8' },
      { k: 'Most used', v: g.pay.name, sub: `${Math.round(g.pay.pct)}% of spends`, accent: '#4A7BB5' },
    ];
    return (<>
      <div className="-mx-6 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6 pb-2">
        {cards.map((x) => (
          <div key={x.k} className="w-[148px] shrink-0 snap-start rounded-[20px] border border-line bg-white p-4">
            <span className="block h-1 w-8 rounded-full" style={{ background: x.accent }} />
            <Label>{x.k}</Label>
            <p className="num mt-1 text-[20px] font-semibold leading-tight text-ink">{x.v}</p>
            <p className="mt-1 truncate text-[12px] text-soft">{x.sub}</p>
          </div>
        ))}
      </div>
      <Tip g={g} />
    </>);
  }}</Page>
);

/* E. Your month in 5 questions --------------------------------------------------------------- */
export const E_Questions = () => (
  <Page>{(_c, g) => {
    const qa: [string, string][] = [
      ['Where did most of it go?', `${g.topCat.name}, ${Math.round(g.topCat.pct)}% (${compactINR(g.topCat.total)})${g.topType ? `, mostly ${g.topType.name}` : ''}.`],
      ['Which day costs me most?', `${g.priciest.name}, ${inr1(g.priciest.avg)} on average. ${g.cheapest.name} are the lightest.`],
      ['What was the biggest spend?', `${inr1(g.big.amount)} · ${g.big.label} on ${formatWithWeekday(g.big.date)}.`],
      ['How often did I overshoot?', `${g.over} of ${g.closed.length} days. Longest run under the amount: ${g.best} days.`],
      ['Are small spends adding up?', `${g.perDayCount.toFixed(1)} spends a day; ${g.small.length} under ₹150 total ${inr1(g.smallTotal)}.`],
    ];
    return (<>
      <p className="rounded-note bg-ink px-4 py-3 text-[13px] leading-snug text-white"><span className="font-semibold">Try this: </span>{g.tip}</p>
      <dl className="mt-3 flex flex-col gap-2.5">
        {qa.map(([q, a]) => (
          <div key={q} className="rounded-note border border-line bg-white px-4 py-3">
            <dt className="text-[12px] font-medium text-faint">{q}</dt>
            <dd className="mt-0.5 text-[14px] text-ink">{a}</dd>
          </div>
        ))}
      </dl>
    </>);
  }}</Page>
);
