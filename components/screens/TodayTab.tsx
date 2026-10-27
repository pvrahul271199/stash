'use client';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { WeekRow, weekWindow, type WeekDay } from '../ui/WeekRow';
import { LogSpend } from './LogSpend';
import { useDayEntries, useDayRows } from '@/db/queries';
import type { Cycle } from '@/db/schema';
import {
  POOL_USED_UP_MESSAGE,
  daysLeft,
  displayLeft,
  overMessage,
  spentToday,
  todayAllowance,
  type CycleState,
} from '@/lib/budget';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { useToast } from '@/store/toast';

export function TodayTab({ cycle }: { cycle: Cycle }) {
  const [logging, setLogging] = useState(false);
  const toast = useToast((s) => s.show);
  const entries = useDayEntries(cycle.id, cycle.currentDay) ?? [];
  const dayRows = useDayRows(cycle.id) ?? [];

  const state: CycleState = cycle;
  const allowance = todayAllowance(state);
  const spent = spentToday(entries);
  const left = displayLeft(allowance, spent);
  const n = daysLeft(state);
  const over = overMessage(allowance, spent, state);
  const used = state.pool <= 0;

  const week: WeekDay[] = weekWindow(cycle.currentDay, cycle.totalDays).map((day) => {
    const row = dayRows.find((r) => r.day === day);
    return {
      day,
      status: row ? row.status : day === cycle.currentDay ? 'today' : day < cycle.currentDay ? 'closed' : 'future',
    };
  });
  const remaining = Math.max(state.pool - spent, 0);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <header className="flex items-center justify-between">
          <p className="text-[14px] text-soft">
            {formatWithWeekday(dateOfDay(cycle.startDate, cycle.currentDay))}, day {cycle.currentDay} of{' '}
            {cycle.totalDays}
          </p>
          <button
            onClick={() => toast('Plan settings arrive in a later milestone')}
            className="rounded-full border border-line px-4 text-[14px] font-medium text-ink"
          >
            Plan
          </button>
        </header>

        <p className="mt-8 text-[15px] text-soft">You can still spend today</p>
        <HugeNumber value={left} className="mt-1" />

        <div className="mt-3 min-h-[48px]">
          {used ? (
            <Note tone="adjust">{POOL_USED_UP_MESSAGE}</Note>
          ) : over ? (
            <Note tone="adjust">{over}</Note>
          ) : (
            <p className="text-[15px] text-good">
              {spent > 0 ? `${inr(spent)} spent so far. You're on plan.` : `That's your amount for today, ${inr(allowance)}.`}
            </p>
          )}
        </div>

        <div className="mt-6">
          <WeekRow days={week} startDate={cycle.startDate} />
        </div>
        <p className="mt-5 text-[15px] text-soft">
          <span className="num text-ink">{inr(remaining)}</span> left for {n} {n === 1 ? 'day' : 'days'}
        </p>

        <section className="mt-6" aria-label="Recent spends">
          {entries.length === 0 ? (
            <p className="text-body text-soft">Paid for something? Log it in a few seconds.</p>
          ) : (
            <ul className="divide-y divide-line">
              {entries.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-[15px] font-medium text-ink">
                      {e.label}
                      {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                    </p>
                    <p className="text-[13px] text-faint">{e.subcategory ?? e.category}</p>
                  </div>
                  <p className="num text-[20px] text-ink">{inr(e.amount)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-4 pt-2">
        <PrimaryButton onClick={() => setLogging(true)}>Log a spend</PrimaryButton>
        <SecondaryButton onClick={() => toast('Closing the day arrives in the next milestone')}>
          Close the day
        </SecondaryButton>
      </div>

      {logging && <LogSpend cycle={cycle} onClose={() => setLogging(false)} />}
    </>
  );
}
