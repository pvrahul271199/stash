import type { ReactElement } from 'react';
import type { Meta } from '@storybook/react-vite';

/**
 * Five looks for the "Tomorrow" card on the Close the day screen. Each is shown for both states:
 * under your amount (teal) and over it (amber). Same facts in all: tomorrow's amount, the change per day,
 * how much was kept / overspent, and how many days it is spread over. Palette only: ink, tint, good, goodBg, warm, warmBg.
 */
const meta: Meta = { title: 'Close the day: Tomorrow card', parameters: { layout: 'centered' } };
export default meta;

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const DAYS = 24;
const TODAY = 2346;
const cases = {
  under: { kind: 'under' as const, diff: 1807, per: 75, tomorrow: 2421 },
  over: { kind: 'over' as const, diff: 624, per: 26, tomorrow: 2320 },
};
type C = (typeof cases)['under'] | (typeof cases)['over'];
const sign = (c: C) => (c.kind === 'under' ? '+' : '−');
const shell = 'w-[342px]';
const Stack = ({ Card }: { Card: (p: { c: C }) => ReactElement }) => (
  <div className={`${shell} flex flex-col gap-4`}>
    <Card c={cases.under} />
    <Card c={cases.over} />
  </div>
);
const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/* 1. Split: amount left, change right, one short sentence */
const Card1 = ({ c }: { c: C }) => (
  <div className={`rounded-[20px] px-5 py-4 ${c.kind === 'under' ? 'bg-tint' : 'bg-warmBg'}`}>
    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow you can spend</p>
    <div className="mt-1 flex items-end justify-between">
      <p className="num text-[36px] leading-none text-ink"><span className="text-faint">₹</span>{c.tomorrow.toLocaleString('en-IN')}</p>
      <span className={`num mb-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${c.kind === 'under' ? 'bg-goodBg text-good' : 'bg-white text-warm'}`}>
        {sign(c)}{fmt(c.per)} a day
      </span>
    </div>
    <p className="mt-3 text-[13px] leading-snug text-soft">
      {c.kind === 'under'
        ? <>You kept <b className="num font-semibold text-ink">{fmt(c.diff)}</b> today. Shared over {DAYS} days, that&apos;s {fmt(c.per)} extra a day.</>
        : <>You went <b className="num font-semibold text-ink">{fmt(c.diff)}</b> over. Shared over {DAYS} days, that&apos;s {fmt(c.per)} less a day.</>}
    </p>
  </div>
);
export const Design1_Split = () => <Stack Card={Card1} />;

/* 2. Before → after */
const Card2 = ({ c }: { c: C }) => (
  <div className="rounded-[20px] border border-line bg-white px-5 py-4">
    <div className="flex items-center justify-between">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow</p>
      <span className={`num text-[13px] font-semibold ${c.kind === 'under' ? 'text-good' : 'text-warm'}`}>{sign(c)}{fmt(c.per)} a day</span>
    </div>
    <div className="mt-2 flex items-center gap-3">
      <p className="num text-[18px] text-faint line-through decoration-faint/60">{fmt(TODAY)}</p>
      <span className="text-faint"><ArrowRight /></span>
      <p className="num text-[34px] leading-none text-ink">{fmt(c.tomorrow)}</p>
    </div>
    <p className="mt-3 text-[13px] text-soft">
      {c.kind === 'under' ? `Kept ${fmt(c.diff)} today, so each of the next ${DAYS} days gets a bit more.` : `Over by ${fmt(c.diff)}, so each of the next ${DAYS} days gives a little.`}
    </p>
  </div>
);
export const Design2_BeforeAfter = () => <Stack Card={Card2} />;

/* 3. Three facts */
const Card3 = ({ c }: { c: C }) => (
  <div className={`rounded-[20px] px-5 pb-4 pt-4 ${c.kind === 'under' ? 'bg-tint' : 'bg-warmBg'}`}>
    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow you can spend</p>
    <p className="num mt-1 text-[38px] leading-none text-ink"><span className="text-faint">₹</span>{c.tomorrow.toLocaleString('en-IN')}</p>
    <div className={`mt-4 grid grid-cols-3 divide-x rounded-[14px] bg-white py-2.5 text-center ${c.kind === 'under' ? 'divide-line' : 'divide-line'}`}>
      {[
        [c.kind === 'under' ? 'Kept' : 'Over', fmt(c.diff), 'text-ink'],
        ['Days left', String(DAYS), 'text-ink'],
        ['Per day', `${sign(c)}${fmt(c.per)}`, c.kind === 'under' ? 'text-good' : 'text-warm'],
      ].map(([l, v, t]) => (
        <div key={l}>
          <p className="text-[11px] text-faint">{l}</p>
          <p className={`num text-[15px] font-semibold ${t}`}>{v}</p>
        </div>
      ))}
    </div>
  </div>
);
export const Design3_ThreeFacts = () => <Stack Card={Card3} />;

/* 4. Filled hero */
const Card4 = ({ c }: { c: C }) => (
  <div className={`rounded-[24px] px-5 py-5 ${c.kind === 'under' ? 'bg-goodBg' : 'bg-warmBg'}`}>
    <p className={`text-[12px] font-semibold uppercase tracking-[0.1em] ${c.kind === 'under' ? 'text-good' : 'text-warm'}`}>
      {c.kind === 'under' ? 'Nice. Tomorrow is bigger' : 'Tomorrow is a little smaller'}
    </p>
    <p className="num mt-1 text-[48px] leading-none text-ink"><span className={c.kind === 'under' ? 'text-good/50' : 'text-warm/50'}>₹</span>{c.tomorrow.toLocaleString('en-IN')}</p>
    <p className="mt-3 text-[13.5px] leading-snug text-ink/80">
      {sign(c)}{fmt(c.per)} a day for the next {DAYS} days, because you {c.kind === 'under' ? `kept ${fmt(c.diff)}` : `went ${fmt(c.diff)} over`} today.
    </p>
  </div>
);
export const Design4_FilledHero = () => <Stack Card={Card4} />;

/* 5. The sum, shown */
const Card5 = ({ c }: { c: C }) => (
  <div className="rounded-[20px] border border-line bg-white px-5 py-4">
    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Tomorrow you can spend</p>
    <p className="num mt-1 text-[36px] leading-none text-ink"><span className="text-faint">₹</span>{c.tomorrow.toLocaleString('en-IN')}</p>
    <div className="mt-4 flex items-center gap-1.5 text-[12.5px]">
      <span className="num rounded-full bg-tint px-2.5 py-1 text-ink">{fmt(c.diff)} {c.kind === 'under' ? 'kept' : 'over'}</span>
      <span className="text-faint">÷</span>
      <span className="num rounded-full bg-tint px-2.5 py-1 text-ink">{DAYS} days</span>
      <span className="text-faint">=</span>
      <span className={`num rounded-full px-2.5 py-1 font-semibold ${c.kind === 'under' ? 'bg-goodBg text-good' : 'bg-warmBg text-warm'}`}>{sign(c)}{fmt(c.per)} a day</span>
    </div>
  </div>
);
export const Design5_TheSum = () => <Stack Card={Card5} />;

export const Gallery = () => (
  <div className="grid gap-8 p-6" style={{ gridTemplateColumns: 'repeat(auto-fill, 342px)' }}>
    {[['1. Split', Card1], ['2. Before → after', Card2], ['3. Three facts', Card3], ['4. Filled hero', Card4], ['5. The sum', Card5]].map(([n, Card]) => {
      const K = Card as (p: { c: C }) => ReactElement;
      return (
        <div key={n as string}>
          <p className="mb-2 text-[13px] font-semibold text-ink">{n as string}</p>
          <Stack Card={K} />
        </div>
      );
    })}
  </div>
);
Gallery.parameters = { layout: 'fullscreen' };
