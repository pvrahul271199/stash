'use client';
import { useEffect, useState } from 'react';
import { inr } from '@/lib/format';
import { bucketDetail, weekdayDetail, type TimeBucket, type WeekdayStat } from '@/lib/insights';

export function WeekdayChart({
  stats,
  usual,
  color,
  resetKey,
}: {
  stats: WeekdayStat[];
  usual: number;
  color: string;
  resetKey: string | null;
}) {
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => setSel(null), [resetKey]);
  const max = Math.max(1, ...stats.map((s) => s.avg));
  const picked = stats.find((s) => s.wd === sel) ?? null;

  return (
    <div>
      <div className="flex h-[150px] items-end justify-between gap-2" role="group" aria-label="Average spend by weekday">
        {stats.map((s) => {
          const on = s.wd === sel;
          const dim = sel != null && !on;
          return (
            <button
              key={s.wd}
              onClick={() => setSel(on ? null : s.wd)}
              aria-pressed={on}
              aria-label={`${s.name}, average ${inr(s.avg)}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              style={{ opacity: dim ? 0.3 : 1, transition: 'opacity .15s' }}
            >
              <span className="num h-[18px] text-[13px] text-ink">{on ? inr(s.avg) : ''}</span>
              <span className="w-full rounded-t-md" style={{ height: `${Math.max((s.avg / max) * 100, s.avg > 0 ? 3 : 1)}px`, background: color, maxHeight: 96 }} />
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                  on ? 'bg-ink text-white' : 'text-soft'
                }`}
              >
                {s.letter}
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-3 min-h-[40px] text-[14px] leading-snug text-soft">
        {picked ? weekdayDetail(picked, usual) : 'Tap a bar to see that weekday.'}
      </p>
    </div>
  );
}

export function TimeOfDayChart({ buckets, color, resetKey }: { buckets: TimeBucket[]; color: string; resetKey: string | null }) {
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => setSel(null), [resetKey]);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const picked = buckets.find((b) => b.id === sel) ?? null;
  return (
    <div>
      <ul className="flex flex-col gap-1">
        {buckets.map((b) => {
          const on = b.id === sel;
          return (
            <li key={b.id}>
              <button
                onClick={() => setSel(on ? null : b.id)}
                aria-pressed={on}
                className="flex min-h-[48px] w-full items-center gap-3 text-left"
                style={{ opacity: sel && !on ? 0.4 : 1 }}
              >
                <span className="w-[74px] shrink-0">
                  <span className="block text-[14px] font-medium text-ink">{b.label}</span>
                  <span className="block text-[11px] text-faint">{b.range}</span>
                </span>
                <span className="h-3 flex-1 rounded-full bg-tint">
                  <span className="block h-3 rounded-full" style={{ width: `${(b.total / max) * 100}%`, background: color }} />
                </span>
                <span className="num w-[72px] text-right text-[16px] text-ink">{inr(b.total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p aria-live="polite" className="mt-2 min-h-[40px] text-[14px] leading-snug text-soft">
        {picked ? bucketDetail(picked) : 'Tap a row to see what it was.'}
      </p>
    </div>
  );
}
