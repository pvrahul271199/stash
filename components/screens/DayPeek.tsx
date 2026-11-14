'use client';
import { entryLines } from '@/lib/entryDisplay';
import type { Entry } from '@/db/schema';
import { PrimaryButton } from '../ui/Button';
import { useDayEntries } from '@/db/queries';
import type { DerivedCycle } from '@/lib/period';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';

/** Small bottom sheet shown when a date is tapped on Today: what happened that day + a way to log into it. */
export function DayPeek({
  cycle,
  day,
  onLog,
  onEdit,
  onClose,
}: {
  /** The cycle seen over its whole month (`monthView`): `day` counts from the month's first day. */
  cycle: DerivedCycle;
  day: number;
  onLog: () => void;
  /** Open the edit sheet for one transaction. */
  onEdit: (entry: Entry) => void;
  onClose: () => void;
}) {
  const entries = useDayEntries(cycle.id, day) ?? [];
  const total = entries.filter((e) => !e.fromSavings).reduce((s, e) => s + e.amount, 0);
  const kind = day < cycle.currentDay ? 'Past day' : day > cycle.currentDay ? 'Upcoming' : 'Today';
  return (
    <div className="absolute inset-0 z-[45] flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Day ${day}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80%] w-full flex-col rounded-t-[24px] bg-white px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-section font-semibold text-ink">{formatWithWeekday(dateOfDay(cycle.startDate, day))}</p>
            <p className="text-[13px] text-soft">Day {day} · {kind}</p>
          </div>
          {entries.length > 0 && <p className="num text-[22px] text-ink">{inr(total)}</p>}
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-body text-soft">
            {day > cycle.currentDay ? 'Nothing planned for this day yet.' : 'Nothing logged on this day.'}
          </p>
        ) : (
          <>
            <p className="mt-3 text-[12px] text-faint">Tap a spend to edit it</p>
            <ul className="mt-1 min-h-0 flex-1 divide-y divide-line thin-scrollbar overflow-y-auto overscroll-contain">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    aria-label={`Edit ${entryLines(e).title}, ${inr(e.amount)}`}
                    className="flex w-full items-center gap-3 py-2.5 text-left active:bg-line/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{entryLines(e).title}</span>
                      {entryLines(e).detail && <span className="block truncate text-[13px] text-soft">{entryLines(e).detail}</span>}
                      <span className="block truncate text-[12px] text-faint">
                        {[entryLines(e).meta, e.fromSavings ? 'from savings' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="num text-[14px] text-ink">{inr(e.amount)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-faint" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 shrink-0">
          <PrimaryButton onClick={onLog}>Log a spend on this day</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
