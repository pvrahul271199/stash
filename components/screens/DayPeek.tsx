'use client';
import { PrimaryButton } from '../ui/Button';
import { useDayEntries } from '@/db/queries';
import type { Cycle } from '@/db/schema';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';

/** Small bottom sheet shown when a date is tapped on Today: what happened that day + a way to log into it. */
export function DayPeek({
  cycle,
  day,
  onLog,
  onClose,
}: {
  cycle: Cycle;
  day: number;
  onLog: () => void;
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
        className="max-h-[70%] w-full overflow-y-auto rounded-t-[24px] bg-white px-6 pt-3"
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
          <ul className="mt-3 divide-y divide-line">
            {entries.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <span className="min-w-0 truncate text-[14px] text-ink">{e.label}</span>
                <span className="num ml-3 text-[14px] text-ink">{inr(e.amount)}</span>
              </li>
            ))}
            {entries.length > 6 && <li className="py-2 text-[12px] text-faint">+ {entries.length - 6} more</li>}
          </ul>
        )}

        <div className="mt-5">
          <PrimaryButton onClick={onLog}>Log a spend on this day</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
