'use client';
import { weekdayOfDay, weekdayShort } from '@/lib/dates';

export interface WeekDay {
  day: number;
  status: 'closed' | 'estimated' | 'today' | 'future';
}

/** 7 days around the current day, clipped to the cycle. */
export function weekWindow(currentDay: number, totalDays: number): number[] {
  const count = Math.min(7, totalDays);
  let first = currentDay - 3;
  first = Math.min(first, totalDays - count + 1);
  first = Math.max(first, 1);
  return Array.from({ length: count }, (_, i) => first + i);
}

const STATUS_LABEL = { closed: 'closed', estimated: 'estimated', today: 'today', future: 'upcoming' } as const;

export function WeekRow({ days, startDate }: { days: WeekDay[]; startDate: string }) {
  return (
    <ul className="flex justify-between" aria-label="This week">
      {days.map((d) => {
        const wd = weekdayShort(weekdayOfDay(startDate, d.day));
        const style =
          d.status === 'closed'
            ? 'bg-ink text-white'
            : d.status === 'estimated'
              ? 'border border-dashed border-faint bg-tint text-soft'
              : d.status === 'today'
                ? 'border-2 border-ink bg-white text-ink'
                : 'bg-white text-faint';
        return (
          <li key={d.day} className="flex flex-col items-center gap-1" aria-label={`Day ${d.day}, ${wd}, ${STATUS_LABEL[d.status]}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold ${style}`}>
              {wd[0]}
            </span>
            <span className="text-[11px] text-faint">{d.day}</span>
          </li>
        );
      })}
    </ul>
  );
}
