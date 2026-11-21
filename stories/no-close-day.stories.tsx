import { useState, type ReactNode } from 'react';
import type { Meta } from '@storybook/react-vite';
import { Logo } from '@/components/ui/Logo';
import { HugeNumber } from '@/components/ui/HugeNumber';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';

/**
 * Today without the "Close the day" button. The day rolls over at midnight by itself, so the recap comes to the
 * person instead of being asked for. Real screen = what ships now. Options 1-5 are the replacements.
 * Sample: 1,333 a day, yesterday spent 820, so 513 kept and today is 1,355 (24 days left).
 */
const meta: Meta = { title: 'Today without Close the day', parameters: { layout: 'centered' } };
export default meta;

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');
const phone = 'relative flex h-[780px] w-[390px] flex-col overflow-hidden rounded-phone border border-line bg-white shadow-sm';
const noop = () => {};

const Week = () => (
  <div className="mt-2 flex justify-between">
    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
      <div key={i} className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-faint">{d}</span>
        <span className={`num flex h-8 w-8 items-center justify-center rounded-full text-[12px] ${i === 6 ? 'bg-ink text-white' : i < 6 ? 'bg-goodBg text-good' : 'bg-tint text-faint'}`}>{15 + i}</span>
      </div>
    ))}
  </div>
);

type Opts = { aboveNumber?: ReactNode; belowNumber?: ReactNode; afterWeek?: ReactNode; spends?: boolean; closeButton?: boolean; left?: number };
function Today({ aboveNumber, belowNumber, afterWeek, spends, closeButton, left = 1355 }: Opts) {
  return (
    <div className={phone}>
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <header className="flex items-center justify-between pt-3">
          <span className="flex items-center gap-1.5"><Logo size={24} /><span className="font-display text-[17px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span></span>
        </header>
        <p className="mt-3 text-[14px] text-soft">Sun, 21 Nov · <span className="num">Day 7/30</span></p>
        {aboveNumber}
        <p className="mt-4 text-[15px] text-soft">You can still spend today</p>
        <HugeNumber value={left} size={52} className="mt-1" />
        <div className="min-h-[22px] mt-1">{belowNumber ?? <p className="text-[15px] text-good">{spends ? `${fmt(1355 - left)} spent so far. You're on plan.` : `That's your amount for today is ${fmt(1355)}.`}</p>}</div>
        <Week />
        <p className="mt-5 text-[15px] text-soft"><span className="num text-ink">{fmt(32520)}</span> left for 24 days</p>
        {afterWeek}
        <section className="mt-6">
          {spends ? (
            <>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-soft">Today&apos;s spends</p>
              <ul className="divide-y divide-line">
                {[['Lunch', 320], ['Auto', 180]].map(([t, a]) => (
                  <li key={t} className="flex items-center justify-between py-3"><p className="text-[15px] font-medium text-ink">{t}</p><p className="num text-[20px] text-ink">{fmt(a as number)}</p></li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-body text-soft">No spends logged today yet. Paid for something? Log it in a few seconds.</p>
          )}
        </section>
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-6 pb-4 pt-2">
        <PrimaryButton onClick={noop}>Log a spend</PrimaryButton>
        {closeButton && <SecondaryButton onClick={noop}>Close the day</SecondaryButton>}
      </div>
    </div>
  );
}

/* ---- what ships now ---- */
export const Real_WithCloseButton = () => <Today closeButton spends left={855} />;

/* 1. Yesterday card: shown once, the first time the app opens on a new day. Dismiss with ×. */
function YesterdayCard() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="mt-4 rounded-[20px] bg-tint px-4 py-3.5">
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Yesterday</p>
        <button type="button" aria-label="Dismiss" onClick={() => setOpen(false)} className="-mr-1 -mt-1 flex h-7 min-h-0 w-7 items-center justify-center text-soft">×</button>
      </div>
      <p className="mt-1 text-[15px] leading-snug text-ink">You spent <b className="num font-semibold">{fmt(820)}</b> of {fmt(1333)}. You kept <b className="num font-semibold text-good">{fmt(513)}</b>.</p>
      <p className="mt-1 text-[13px] text-soft">Shared over 24 days, today gets <span className="num">{fmt(22)}</span> more.</p>
    </div>
  );
}
export const Option1_YesterdayCard = () => <Today aboveNumber={<YesterdayCard />} />;

/* 2. Yesterday line: always there, one quiet line under the number. */
export const Option2_YesterdayLine = () => (
  <Today belowNumber={<p className="text-[14px] text-soft">Yesterday <span className="num text-ink">{fmt(820)}</span> spent · <span className="num text-good">+{fmt(22)}</span> to today</p>} />
);

/* 3. Tomorrow card: appears under the week once something is logged, so the effect is visible before the day ends. */
export const Option3_TomorrowCard = () => (
  <Today
    spends
    left={855}
    afterWeek={
      <div className="mt-4 flex items-center justify-between rounded-[16px] bg-tint px-4 py-3">
        <span className="text-[13px] text-soft">If you stop here, tomorrow you get</span>
        <span className="num text-[18px] text-ink">{fmt(1378)}</span>
      </div>
    }
  />
);

/* 4. Tap the week: yesterday's dot pulses once and opens the day peek (already built). */
export const Option4_PeekYesterday = () => (
  <Today
    aboveNumber={<button type="button" className="mt-4 flex min-h-0 items-center gap-1.5 rounded-full bg-tint px-3 py-1.5 text-[13px] text-ink">Yesterday: <span className="num font-semibold">{fmt(820)}</span> <span aria-hidden="true" className="text-soft">›</span></button>}
  />
);

/* 5. Weekly card: Sundays only (or the first open of a new week). */
export const Option5_WeeklyCard = () => (
  <Today
    aboveNumber={
      <div className="mt-4 rounded-[20px] border border-line px-4 py-3.5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-soft">Last week</p>
        <div className="mt-2 grid grid-cols-3 divide-x divide-line text-center">
          {[['Spent', fmt(7420)], ['Avg a day', fmt(1060)], ['Kept', fmt(1911)]].map(([l, v]) => (
            <div key={l}><p className="num text-[16px] text-ink">{v}</p><p className="text-[11px] text-soft">{l}</p></div>
          ))}
        </div>
      </div>
    }
  />
);
