import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { TitleTabs } from '@/components/ui/TitleTabs';
import { TabBar } from '@/components/ui/TabBar';

/**
 * History for a finished month (October 2026) with the recap pinned at the bottom, just above the tab bar, built around
 * the ring. The calendar is the same as the live one and never scrolls. Four looks for the pinned recap.
 * Sample: spent 20,147 of 22,000, so 1,853 left; top category Home.
 */
const meta: Meta = { title: 'History: month recap pinned at bottom', parameters: { layout: 'centered' } };
export default meta;

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const noop = () => {};
const SPENT = 20147, BUDGET = 22000, LEFT = BUDGET - SPENT;
const PCT = SPENT / BUDGET;
const WEEKS: (number | null)[][] = [
  [null, null, null, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17, 18], [19, 20, 21, 22, 23, 24, 25], [26, 27, 28, 29, 30, 31, null],
];
const AMT = (d: number) => (d * 137 + 311) % 1900;
const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n));
const INK = '#1E1B4B', TEAL = '#0F7A6B', SOFT = '#D9E6E3';

function Calendar() {
  return (
    <div className="mt-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-faint">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="mt-1 flex flex-col gap-1.5">
        {WEEKS.map((w, i) => (
          <div key={i} className="grid grid-cols-7 gap-1.5">
            {w.map((d, k) => {
              const amt = d ? AMT(d) : 0;
              const over = amt > 1500;
              return (
                <div key={k} className="flex h-[58px] flex-col items-center justify-center gap-0.5">
                  {d && (
                    <>
                      <span className={`num flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold text-ink ${over ? 'border-warm/40 bg-warmBg' : 'border-good/40 bg-goodBg'}`}>{d}</span>
                      <span className={`num text-[10px] font-semibold ${over ? 'text-warm' : 'text-ink'}`}>₹{compact(amt)}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The live History screen for October, plus a `bottom` slot between the calendar and the tab bar. */
function Screen({ bottom }: { bottom: ReactNode }) {
  return (
    <div className="relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm">
      <div className="min-h-0 flex-1 px-6 pt-6">
        <TitleTabs label="History sections" tabs={[{ id: 'spends', label: 'History' }, { id: 'lend', label: 'Lend' }]} value="spends" onChange={noop} />
        <div className="mt-4 h-11 rounded-full border border-line bg-white px-4 text-[15px] leading-[42px] text-faint">Search spends, category, UPI, Card…</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">October 2026 ⌄</span>
          <span className="text-faint">‹&nbsp;&nbsp;›</span>
        </div>
        <p className="mt-1 text-[15px] text-soft"><span className="num text-ink">{inr(SPENT)}</span> spent</p>
        <p className="text-[12px] text-faint">{inr(21165)} lent, not counted</p>
        <Calendar />
      </div>
      {bottom}
      <TabBar tab="history" onChange={noop} />
    </div>
  );
}

/** Ring: ink = spent, soft teal = left. Optional centre label. */
function Ring({ size, stroke = 7, center, colors }: { size: number; stroke?: number; center?: ReactNode; colors?: { track: string; arc: string } }) {
  const r = 18 - stroke / 2, C = 2 * Math.PI * r;
  const c = colors ?? { track: SOFT, arc: INK };
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={r} fill="none" stroke={c.track} strokeWidth={stroke} />
        <circle cx="18" cy="18" r={r} fill="none" stroke={c.arc} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${PCT * C} ${C}`} transform="rotate(-90 18 18)" />
      </svg>
      {center && <span className="absolute inset-0 flex items-center justify-center">{center}</span>}
    </span>
  );
}
const Chev = ({ c = 'currentColor' }: { c?: string }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;
const Dot = () => <span className="h-2 w-2 rounded-full bg-good" aria-hidden="true" />;

/* 1. Floating pill: small, centred, lifted above the tab bar with a soft shadow. */
export const Pinned1_FloatingPill = () => (
  <Screen bottom={
    <div className="pointer-events-none absolute inset-x-0 bottom-[78px] flex justify-center">
      <button type="button" className="pointer-events-auto flex min-h-0 items-center gap-2.5 rounded-full border border-line bg-white py-1.5 pl-2 pr-3.5 shadow-[0_10px_28px_-8px_rgba(30,27,75,0.35)] active:scale-95">
        <Ring size={30} stroke={6} />
        <span className="text-left leading-tight"><span className="block text-[13px] font-semibold text-ink">October recap</span><span className="num block text-[11px] text-soft">{inr(LEFT)} left over</span></span>
        <span className="flex items-center gap-1 text-soft"><Dot /><Chev /></span>
      </button>
    </div>
  } />
);

/* 2. Full-width card: ring with the percentage in the middle, totals, and a clear arrow. */
export const Pinned2_RingCard = () => (
  <Screen bottom={
    <div className="px-5 pb-3">
      <button type="button" className="flex min-h-0 w-full items-center gap-3.5 rounded-[22px] bg-tint px-4 py-3 text-left active:opacity-80">
        <Ring size={46} stroke={6} center={<span className="num text-[11px] font-semibold text-ink">{Math.round(PCT * 100)}%</span>} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">October wrapped up<Dot /></span>
          <span className="num block text-[12px] text-soft">{inr(SPENT)} spent · {inr(LEFT)} left</span>
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow-sm"><Chev /></span>
      </button>
    </div>
  } />
);

/* 3. Ink bar: dark, confident, teal ring. The one dark element on the screen, so it reads as the action. */
export const Pinned3_InkBar = () => (
  <Screen bottom={
    <div className="px-5 pb-3">
      <button type="button" className="flex min-h-0 w-full items-center gap-3 rounded-full bg-ink py-2 pl-2.5 pr-4 text-left text-white active:opacity-90">
        <Ring size={34} stroke={6} colors={{ track: 'rgba(255,255,255,0.2)', arc: '#6FD3C2' }} />
        <span className="min-w-0 flex-1 text-[14px] font-semibold">See your October recap</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#6FD3C2]" aria-hidden="true" /><Chev c="white" /></span>
      </button>
    </div>
  } />
);

/* 4. Peeking sheet: attached to the tab bar with a handle and three facts, like a drawer you can open. */
export const Pinned4_PeekSheet = () => (
  <Screen bottom={
    <div className="mx-3 rounded-t-[24px] border border-b-0 border-line bg-white px-5 pb-3 pt-2 shadow-[0_-10px_30px_-14px_rgba(30,27,75,0.3)]">
      <span className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line" aria-hidden="true" />
      <button type="button" className="flex min-h-0 w-full items-center gap-3 text-left">
        <Ring size={40} stroke={6} />
        <span className="flex-1">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">October recap<Dot /></span>
          <span className="text-[12px] text-soft">Tap to open</span>
        </span>
        <span className="rotate-[-90deg] text-soft"><Chev /></span>
      </button>
      <div className="mt-2.5 grid grid-cols-3 divide-x divide-line rounded-[14px] bg-tint py-2 text-center">
        {[['Spent', inr(SPENT)], ['Left', inr(LEFT)], ['Top', 'Home']].map(([l, v]) => (
          <div key={l}><p className="num text-[13px] font-semibold text-ink">{v}</p><p className="text-[10px] text-soft">{l}</p></div>
        ))}
      </div>
    </div>
  } />
);
