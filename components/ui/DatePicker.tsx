'use client';
import { useState } from 'react';
import { PICKER_WEEKDAYS, pickerMonth, shiftMonth } from '@/lib/calendar';
import { daysBetween, formatLong, todayISO } from '@/lib/dates';

/** A touch deeper than the page tint so the tracked days read as one band. */
const BAND = '#EFEDFB';

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

/**
 * Month calendar for picking a day between `min` and `max`. The days from the chosen one up to `max` are tinted as one
 * band, so it reads as "these days will be tracked". Days outside the range are dimmed and can't be picked.
 */
export function DatePicker({
  value,
  min,
  max,
  onChange,
  label,
  bare = false,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (iso: string) => void;
  label: string;
  /** No border or shadow: for use inside a card that already has them. */
  bare?: boolean;
}) {
  const [view, setView] = useState(value);
  const today = todayISO();
  const m = pickerMonth(view, { min, max, selected: value, today });
  const tracked = Math.max(0, daysBetween(value, max)) + 1;

  return (
    <div className={bare ? 'px-1 pb-1' : 'rounded-[20px] border border-line bg-white p-3.5 shadow-sm'} role="group" aria-label={label}>
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!m.hasPrev}
          onClick={() => setView(shiftMonth(m.first, -1))}
          className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-ink transition-colors active:bg-tint disabled:opacity-25"
        >
          <Chevron dir="left" />
        </button>
        <p className="font-display text-[16px] font-semibold tracking-tight text-ink" aria-live="polite">
          {m.title}
        </p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!m.hasNext}
          onClick={() => setView(shiftMonth(m.first, 1))}
          className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-ink transition-colors active:bg-tint disabled:opacity-25"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 px-0.5" aria-hidden="true">
        {PICKER_WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-faint">
            {d}
          </span>
        ))}
      </div>

      <div className="px-0.5" role="grid" aria-label={m.title}>
        {m.weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7" role="row">
            {week.map((c, ci) => {
              if (!c) return <span key={ci} className="h-10" aria-hidden="true" />;
              const edgeL = ci === 0 ? 'rounded-l-full' : '';
              const edgeR = ci === 6 || c.iso === max ? 'rounded-r-full' : '';
              // the tinted band: whole cell for days in range, right half for the chosen day (when more days follow)
              const band = c.inRange
                ? { background: BAND }
                : c.selected && value < max && ci < 6
                  ? { background: `linear-gradient(to right, transparent 50%, ${BAND} 50%)` }
                  : undefined;
              return (
                <div key={ci} role="gridcell" className={`flex h-10 items-center justify-center ${c.inRange ? `${edgeL} ${edgeR}` : ''}`} style={band}>
                  <button
                    type="button"
                    disabled={c.disabled}
                    aria-pressed={c.selected}
                    aria-label={formatLong(c.iso)}
                    aria-current={c.today ? 'date' : undefined}
                    onClick={() => onChange(c.iso)}
                    className={`num flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-[14px] transition-transform active:scale-90 ${
                      c.selected
                        ? 'bg-ink font-semibold text-white shadow-sm'
                        : c.disabled
                          ? 'font-normal text-faint/35'
                          : c.today
                            ? 'border border-ink font-semibold text-ink'
                            : 'font-medium text-ink'
                    }`}
                  >
                    {c.day}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 border-t border-line px-1 pt-2.5">
        <p className="text-[12.5px] font-medium leading-snug text-ink">
          {value === max ? 'Starting today.' : `${tracked} days tracked, from ${formatLong(value)} to today.`}
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-soft">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-good">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>
            {value === max
              ? 'Pick an earlier day to include spends you already made. You can also log older spends any time from the month on your Today screen.'
              : 'You can also log older spends any time from the month on your Today screen.'}
          </span>
        </p>
      </div>
    </div>
  );
}
