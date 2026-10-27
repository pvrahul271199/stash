'use client';
import { PrimaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { WeekRow, weekWindow, type WeekDay } from '../ui/WeekRow';
import { useDayRows } from '@/db/queries';
import type { Cycle } from '@/db/schema';
import type { CloseResult } from '@/lib/budget';
import { inr } from '@/lib/format';

export function DayClosed({
  cycle,
  result,
  onNext,
}: {
  cycle: Cycle;
  result: CloseResult;
  onNext: () => void;
}) {
  const rows = useDayRows(cycle.id) ?? [];
  const over = result.state.currentDay > cycle.totalDays;
  const nextDay = result.state.currentDay;
  const week: WeekDay[] = weekWindow(Math.min(nextDay, cycle.totalDays), cycle.totalDays).map((day) => {
    const row = rows.find((r) => r.day === day);
    return { day, status: row ? row.status : day === nextDay ? 'today' : 'future' };
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Day closed"
      className="absolute inset-0 z-30 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 24px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      <div className="flex-1 overflow-y-auto">
        <h1 className="text-question font-semibold text-ink">Day closed</h1>
        <p className="mt-2 text-body text-soft">You know where {inr(result.record.spent)} went today.</p>

        {over ? (
          <Note tone="good" className="mt-10">
            That was the last day of your month. Let&apos;s look at how it went.
          </Note>
        ) : (
          <>
            <p className="mt-10 text-[15px] text-soft">Tomorrow you can spend</p>
            <HugeNumber value={result.tomorrowAllowance} className="mt-1" />
            <Note tone={result.kind === 'more' ? 'adjust' : 'good'} className="mt-4">
              {result.message}
            </Note>
            <div className="mt-8">
              <WeekRow days={week} startDate={cycle.startDate} />
            </div>
          </>
        )}
      </div>
      <PrimaryButton onClick={onNext}>{over ? 'See my month' : `Start day ${nextDay}`}</PrimaryButton>
    </div>
  );
}
