'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SwipeRow } from './SwipeRow';
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

export function WeekRow({
  days,
  startDate,
  onSelect,
}: {
  days: WeekDay[];
  startDate: string;
  /** Tap a date to open the log screen for that day. */
  onSelect?: (day: number) => void;
}) {
  const scrolling = days.length > 7;
  const wrap = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState<'left' | 'right' | null>(null);
  const todayDay = days.find((d) => d.status === 'today')?.day;

  /** Horizontal distance from today's chip centre to the scroller's centre (px). */
  const offset = useCallback(() => {
    const btn = wrap.current?.querySelector<HTMLElement>('[data-today]');
    const sc = btn?.closest<HTMLElement>('[role="group"]');
    if (!btn || !sc) return null;
    const b = btn.getBoundingClientRect();
    const r = sc.getBoundingClientRect();
    return { sc, delta: b.left + b.width / 2 - (r.left + r.width / 2) };
  }, []);

  const centre = useCallback(
    (smooth: boolean) => {
      const o = offset();
      if (o) o.sc.scrollTo({ left: o.sc.scrollLeft + o.delta, behavior: smooth ? 'smooth' : 'auto' });
    },
    [offset],
  );

  // Centre on open and when the day rolls over; never on ordinary re-renders, so dragging isn't fought.
  useEffect(() => {
    if (scrolling) centre(false);
  }, [scrolling, todayDay, centre]);

  // Show a "Today" pill once today is out of view.
  useEffect(() => {
    if (!scrolling) return;
    const sc = wrap.current?.querySelector<HTMLElement>('[role="group"]');
    if (!sc) return;
    const check = () => {
      const o = offset();
      if (!o) return;
      const limit = o.sc.clientWidth / 2;
      setAway(o.delta < -limit ? 'left' : o.delta > limit ? 'right' : null);
    };
    check();
    sc.addEventListener('scroll', check, { passive: true });
    return () => sc.removeEventListener('scroll', check);
  }, [scrolling, offset, todayDay]);
  const list = (
    <ul className={scrolling ? 'flex w-max gap-1.5 pb-1' : 'flex justify-between'} aria-label={scrolling ? 'Days this month' : 'This week'}>
      {days.map((d) => {
        const iso = dateOfDay(startDate, d.day);
        const dom = Number(iso.split('-')[2]);
        const wd = weekdayShort(weekdayOfDay(startDate, d.day));
        const isToday = d.status === 'today';
        const style =
          d.status === 'closed' || d.status === 'estimated'
            ? 'bg-ink text-white'
            : isToday
                ? 'border-2 border-ink bg-white text-ink'
                : 'border border-line bg-white text-faint';
        return (
          <li key={d.day} className={scrolling ? 'w-[46px]' : undefined}>
          <button
            type="button"
            data-today={isToday ? '' : undefined}
            disabled={!onSelect}
            onClick={() => onSelect?.(d.day)}
            className={`flex min-h-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1 transition-transform active:scale-95 ${scrolling ? 'w-full' : ''}`}
            aria-label={`Open day ${d.day}, ${wd} ${formatShort(iso)}, ${STATUS_LABEL[d.status]}`}
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
          </button>
          </li>
        );
      })}
    </ul>
  );
  if (!scrolling) return list;
  return (
    <div ref={wrap}>
      <div className="relative h-6" aria-hidden={!away}>
        {away && (
          <button
            type="button"
            onClick={() => centre(true)}
            className={`absolute top-0 flex h-6 min-h-0 items-center rounded-full border border-line bg-white px-2.5 text-[11px] font-medium text-ink ${
              away === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {away === 'left' ? '‹ Today' : 'Today ›'}
          </button>
        )}
      </div>
      <SwipeRow label="Days this month">{list}</SwipeRow>
    </div>
  );
}
