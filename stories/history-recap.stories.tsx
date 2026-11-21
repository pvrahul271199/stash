import type { ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { TitleTabs } from '@/components/ui/TitleTabs';
import { TabBar } from '@/components/ui/TabBar';

/**
 * History, for a month that has ended (October 2026): where the month recap opens from. The recap button sits next to
 * "₹20,147 spent" and "₹21,165 lent, not counted". The calendar does not scroll: its five week rows share whatever height is
 * left, so it fits any screen (the phone below can be made taller or shorter and the grid follows).
 * Current = today's History with no recap entry. Options 1-5 are the placements.
 */
const meta: Meta = { title: 'History: month recap entry', parameters: { layout: 'centered' } };
export default meta;

const inr = (n: number) => '₹' + n.toLocaleString('en-IN');
const noop = () => {};
const SPENT = 20147;
const LENT = 21165;

/* October 2026 starts on a Thursday; weeks run Mon..Sun, so five rows. */
const WEEKS: (number | null)[][] = [
  [null, null, null, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, null],
];
const AMT = (d: number) => (d * 137 + 311) % 1900;
const compact = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n));

function Calendar() {
  return (
    <div role="table" aria-label="Spending calendar" className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-faint">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-1">{d}</span>)}
      </div>
      {/* rows share the remaining height: no scrolling, any screen */}
      <div className="mt-1 grid min-h-0 flex-1 gap-1.5" style={{ gridTemplateRows: `repeat(${WEEKS.length}, minmax(0, 1fr))` }}>
        {WEEKS.map((w, i) => (
          <div key={i} className="grid grid-cols-7 gap-1.5">
            {w.map((d, k) => {
              const amt = d ? AMT(d) : 0;
              const over = amt > 1500;
              return (
                <div key={k} className="flex min-h-0 flex-col items-center justify-center gap-0.5 rounded-[10px]">
                  {d && (
                    <>
                      <span className={`num flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${over ? 'border border-warm/40 bg-warmBg text-ink' : 'border border-good/40 bg-goodBg text-ink'}`}>{d}</span>
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

const Chevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>;
const Ring = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r="13" fill="none" stroke="#EDEAFB" strokeWidth="6" />
    <circle cx="18" cy="18" r="13" fill="none" stroke="#1E1B4B" strokeWidth="6" strokeDasharray="52 82" strokeDashoffset="0" transform="rotate(-90 18 18)" />
    <circle cx="18" cy="18" r="13" fill="none" stroke="#0F7A6B" strokeWidth="6" strokeDasharray="20 82" strokeDashoffset="-52" transform="rotate(-90 18 18)" />
  </svg>
);

/** Same screen as History > a month: tabs, search, month header, summary lines, calendar, tab bar. `summary` is what differs. */
function Screen({ summary, height = 780 }: { summary: ReactNode; height?: number }) {
  return (
    <div className="relative flex w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm" style={{ height }}>
      <div className="flex min-h-0 flex-1 flex-col px-6 pb-3 pt-6">
        <TitleTabs label="History sections" tabs={[{ id: 'spends', label: 'History' }, { id: 'lend', label: 'Lend' }]} value="spends" onChange={noop} />
        <div className="mt-4 h-11 rounded-full border border-line bg-white px-4 text-[15px] leading-[42px] text-faint">Search spends, category, UPI, Card…</div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[15px] font-semibold text-ink">October 2026 ⌄</span>
          <span className="text-faint">‹&nbsp;&nbsp;›</span>
        </div>
        {summary}
        <Calendar />
      </div>
      <TabBar tab="history" onChange={noop} />
    </div>
  );
}

const Lines = () => (
  <>
    <p className="mt-1 text-[15px] text-soft"><span className="num text-ink">{inr(SPENT)}</span> spent</p>
    <p className="text-[12px] text-faint">{inr(LENT)} lent, not counted</p>
  </>
);

/* ---- today's screen: nothing to open ---- */
export const Current_NoRecap = () => <Screen summary={<div><Lines /></div>} />;

/* 1. Pill on the right of the spent line. */
export const Option1_PillRight = () => (
  <Screen
    summary={
      <div className="mt-1 flex items-start justify-between">
        <div><Lines /></div>
        <button type="button" className="mt-0.5 flex h-7 min-h-0 items-center gap-1 rounded-full bg-tint px-3 text-[12px] font-semibold text-ink active:opacity-70">Recap<Chevron /></button>
      </div>
    }
  />
);

/* 2. Text link right after "spent", on the same line. */
export const Option2_InlineLink = () => (
  <Screen
    summary={
      <div>
        <p className="mt-1 text-[15px] text-soft">
          <span className="num text-ink">{inr(SPENT)}</span> spent
          <button type="button" className="ml-2 min-h-0 align-baseline text-[13px] font-semibold text-good underline underline-offset-4">See recap ›</button>
        </p>
        <p className="text-[12px] text-faint">{inr(LENT)} lent, not counted</p>
      </div>
    }
  />
);

/* 3. Little ring that previews the recap, tap to open. Centred on the two lines. */
export const Option3_MiniRing = () => (
  <Screen
    summary={
      <div className="mt-1 flex items-center justify-between">
        <div><Lines /></div>
        <button type="button" aria-label="Open month recap" className="flex min-h-0 flex-col items-center gap-0.5 rounded-[12px] px-2 py-1 active:bg-tint">
          <Ring size={32} />
          <span className="text-[10px] font-semibold text-soft">Recap</span>
        </button>
      </div>
    }
  />
);

/* 4. One quiet strip under the two lines, as slim as a line of text. */
export const Option4_SlimStrip = () => (
  <Screen
    summary={
      <div>
        <Lines />
        <button type="button" className="mt-2 flex h-9 min-h-0 w-full items-center justify-between rounded-[12px] bg-tint px-3 text-left text-[13px] text-ink active:opacity-70">
          <span><b className="font-semibold">October wrapped up.</b> <span className="text-soft">See how it went</span></span>
          <Chevron />
        </button>
      </div>
    }
  />
);

/* 5. The whole summary is the button: chevron after the amount and a dot when the recap is unseen. */
export const Option5_TapTheTotal = () => (
  <Screen
    summary={
      <button type="button" className="mt-1 block min-h-0 w-full text-left active:opacity-70">
        <p className="flex items-center gap-1.5 text-[15px] text-soft">
          <span className="num text-ink">{inr(SPENT)}</span> spent
          <span className="flex items-center gap-1 rounded-full bg-tint py-0.5 pl-2 pr-1 text-[11px] font-semibold text-soft"><span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />Recap<Chevron /></span>
        </p>
        <p className="text-[12px] text-faint">{inr(LENT)} lent, not counted</p>
      </button>
    }
  />
);

/* The same placement on a short screen: the calendar rows just get shorter, nothing scrolls. */
export const Option1_ShortScreen_680 = () => (
  <Screen
    height={680}
    summary={
      <div className="mt-1 flex items-start justify-between">
        <div><Lines /></div>
        <button type="button" className="mt-0.5 flex h-7 min-h-0 items-center gap-1 rounded-full bg-tint px-3 text-[12px] font-semibold text-ink">Recap<Chevron /></button>
      </div>
    }
  />
);
