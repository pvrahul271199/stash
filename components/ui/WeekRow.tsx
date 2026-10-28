'use client';
import { dateOfDay, formatShort, weekdayOfDay, weekdayShort } from '@/lib/dates';

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
        const iso = dateOfDay(startDate, d.day);
        const dom = Number(iso.split('-')[2]);
        const wd = weekdayShort(weekdayOfDay(startDate, d.day));
        const isToday = d.status === 'today';
        const style =
          d.status === 'closed'
            ? 'bg-ink text-white'
            : d.status === 'estimated'
              ? 'border border-dashed border-faint bg-tint text-soft'
              : isToday
                ? 'border-2 border-ink bg-white text-ink'
                : 'border border-line bg-white text-faint';
        return (
          <li
            key={d.day}
            className="flex flex-col items-center gap-1"
            aria-label={`Day ${d.day}, ${wd} ${formatShort(iso)}, ${STATUS_LABEL[d.status]}`}
          >
            <span className={`text-[10px] font-medium leading-none ${isToday ? 'font-semibold text-ink' : 'text-faint'}`}>
              Day {d.day}
            </span>
            <span className={`num flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${style}`}>
              {dom}
            </span>
            <span className={`text-[10px] leading-none ${isToday ? 'font-medium text-soft' : 'text-faint'}`}>
              {wd}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
