'use client';
import { useEffect, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { HugeNumber } from '../ui/HugeNumber';
import { WeekRow, weekWindow, type WeekDay } from '../ui/WeekRow';
import { LogSpend } from './LogSpend';
import { CloseDay } from './CloseDay';
import { DayClosed } from './DayClosed';
import { EditSpendSheet } from './EditSpendSheet';
import { IosHint } from '../pwa/IosHint';
import {
  closeCurrentDay,
  useCycleEntries,
  useDayEntries,
  useDayRows,
} from '@/db/queries';
import type { Cycle, Entry, Plan } from '@/db/schema';
import {
  POOL_USED_UP_MESSAGE,
  daysLeft,
  displayLeft,
  overMessage,
  spentToday,
  todayAllowance,
  type CloseResult,
  type CycleState,
} from '@/lib/budget';
import { dateOfDay, formatWithWeekday } from '@/lib/dates';
import { inr } from '@/lib/format';
import { useUI } from '@/store/ui';

type View = 'today' | 'log' | 'close' | 'closed';

export function TodayTab({ cycle, plan }: { cycle: Cycle; plan: Plan }) {
  const [view, setView] = useState<View>('today');
  const [logReturn, setLogReturn] = useState<View>('today');
  const [result, setResult] = useState<CloseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const setSheet = useUI((s) => s.setSheet);
  const entries = useDayEntries(cycle.id, cycle.currentDay) ?? [];
  const dayRows = useDayRows(cycle.id) ?? [];
  const todayEntries = entries.slice(0, 10);

  // Lets the shell hold back the month-end screen until the user has seen "Day closed".
  useEffect(() => {
    setSheet(view === 'closed' ? 'dayClosed' : 'none');
    return () => setSheet('none');
  }, [view, setSheet]);

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

  async function close() {
    setBusy(true);
    // Hold back the month-end screen before the write lands (see effect above).
    setSheet('dayClosed');
    const r = await closeCurrentDay(cycle.id!);
    setBusy(false);
    if (r) {
      setResult(r);
      setView('closed');
    } else setSheet('none');
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <IosHint />
        <header className="flex items-center justify-between">
          <p className="text-[14px] text-soft">
            {formatWithWeekday(dateOfDay(cycle.startDate, cycle.currentDay))}, day {cycle.currentDay} of{' '}
            {cycle.totalDays}
          </p>
          <button
            onClick={() => setSheet('plan')}
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

        <section className="mt-6" aria-label="Today's spends">
          {todayEntries.length === 0 ? (
            <p className="text-body text-soft">No spends logged today yet. Paid for something? Log it in a few seconds.</p>
          ) : (
            <>
              <p className="mb-1 text-[12px] font-semibold tracking-wide text-soft uppercase">Today&apos;s spends</p>
              <ul className="divide-y divide-line">
                {todayEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-[15px] font-medium text-ink">
                        {e.label}
                        {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                      </p>
                      <p className="text-[13px] text-faint">
                        {e.subcategory ?? e.category}
                        {e.payment ? ` · ${e.payment}` : ''}
                        {e.event ? ` · ${e.event}` : ''}
                      </p>
                      {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
                    </button>
                    <p className="num text-[20px] text-ink">{inr(e.amount)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="flex shrink-0 flex-col gap-2 px-6 pb-4 pt-2">
        <PrimaryButton
          onClick={() => {
            setLogReturn('today');
            setView('log');
          }}
        >
          Log a spend
        </PrimaryButton>
        <SecondaryButton onClick={() => setView('close')}>Close the day</SecondaryButton>
      </div>

      {view === 'close' && (
        <CloseDay
          entries={entries}
          busy={busy}
          onBack={() => setView('today')}
          onClose={close}
          onAddMore={() => {
            setLogReturn('close');
            setView('log');
          }}
        />
      )}
      {view === 'log' && <LogSpend cycle={cycle} plan={plan} onClose={() => setView(logReturn)} />}
      {editing && <EditSpendSheet entry={editing} onClose={() => setEditing(null)} />}
      {view === 'closed' && result && <DayClosed cycle={cycle} result={result} onNext={() => setView('today')} />}
    </>
  );
}
