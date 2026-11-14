'use client';
import { entryLines } from '@/lib/entryDisplay';
import { track } from '@/lib/analytics';
import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { useToast } from '@/store/toast';
import { Logo } from '../ui/Logo';
import { HugeNumber } from '../ui/HugeNumber';
import { SyncStatusPill } from '../ui/SyncStatusPill';
import { WeekRow, type WeekDay } from '../ui/WeekRow';
import { LogSpend } from './LogSpend';
import { DayPeek } from './DayPeek';
import { CloseDay } from './CloseDay';
import { EditSpendSheet } from './EditSpendSheet';
import { IosHint } from '../pwa/IosHint';
import { BackupPrompt } from '../ui/BackupPrompt';
import { PreviousDayHint } from '../ui/PreviousDayHint';
import { useSampleMode } from '@/lib/sampleMode';
import { closeToday, dayRowsOf, useDayEntries } from '@/db/queries';
import type { Entry, Plan } from '@/db/schema';
import { monthView, type DerivedCycle } from '@/lib/period';
import {
  POOL_USED_UP_MESSAGE,
  daysLeft,
  displayLeft,
  overMessage,
  spentToday,
  todayAllowance,
  type CycleState,
} from '@/lib/budget';
import { dateOfDay, daysBetween, formatWithWeekday, todayISO } from '@/lib/dates';
import { inr } from '@/lib/format';

type View = 'today' | 'log' | 'close';

export function TodayTab({ cycle, plan, onCreateAccount, onHome }: { cycle: DerivedCycle; plan: Plan; onCreateAccount: () => void; onHome: () => void }) {
  const [view, setView] = useState<View>('today');
  useEffect(() => {
    if (view !== 'today') posthog.capture('screen_viewed', { screen: `today_${view}`, from: 'tab_today' });
  }, [view]);
  const [logReturn, setLogReturn] = useState<View>('today');
  const [logDay, setLogDay] = useState<number | undefined>(undefined);
  const [peekDay, setPeekDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const toast = useToast((s) => s.show);
  // First visit only: an arrow pointing at yesterday's circle ("you can log earlier days"). Remembered per device; sample mode has its own.
  const inSample = useSampleMode();
  const hintKey = `stash:hint:previous-day${inSample ? ':sample' : ''}`;
  const stripRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(hintKey) === '1';
    } catch {
      /* no storage: skip the hint rather than nag on every visit */
    }
    if (seen) return;
    const t = setTimeout(() => setShowHint(true), 700);
    return () => clearTimeout(t);
  }, [hintKey]);
  const endHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(hintKey, '1');
    } catch {
      /* ignore */
    }
  };
  const entries = useDayEntries(cycle.id, cycle.currentDay) ?? [];
  const dayRows = dayRowsOf(cycle);
  const todayEntries = entries.slice(0, 10);


  const state: CycleState = cycle;
  const allowance = todayAllowance(state);
  const spent = spentToday(entries);
  const left = displayLeft(allowance, spent);
  const n = daysLeft(state);
  const over = overMessage(allowance, spent, state);
  const used = state.pool <= 0;

  // The strip shows the whole month (1..30/31). Days before tracking began are muted but can still be logged into.
  const month = monthView(cycle);
  const week: WeekDay[] = Array.from({ length: cycle.monthDays }, (_, i) => i + 1).map((day) => {
    const cd = daysBetween(cycle.startDate, dateOfDay(cycle.monthStart, day)) + 1; // this day's number in the tracked cycle
    const row = dayRows.find((r) => r.day === cd);
    return {
      day,
      status: cd < 1 ? 'before' : row ? row.status : cd === cycle.currentDay ? 'today' : cd < cycle.currentDay ? 'closed' : 'future',
    };
  });
  const monthDay = daysBetween(cycle.monthStart, todayISO()) + 1;
  const remaining = Math.max(state.pool - spent, 0);

  /** Really closes the day on screen: the app moves on to the next day now, not at midnight. One tap, no second screen. */
  async function close() {
    setBusy(true);
    const r = await closeToday();
    setBusy(false);
    setView('today');
    if (r) {
      toast('Day closed');
      track('day_closed');
    }
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-4">
        <IosHint />
        <header className="flex items-center justify-between pt-3">
          <button
            type="button"
            onClick={onHome}
            aria-label="Chelav home: how it works"
            className="-ml-1 flex min-h-0 items-center gap-1.5 rounded-xl px-1 py-1 active:opacity-70"
          >
            <Logo size={24} />
            <span className="font-display text-[17px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span>
          </button>
          <div className="flex items-center gap-2">
            <SyncStatusPill />
          </div>
        </header>

        <p className="mt-3 text-[14px] text-soft">
          {formatWithWeekday(dateOfDay(cycle.startDate, cycle.currentDay))} ·{' '}
          <span className="num">
            Day {monthDay}/{cycle.monthDays}
          </span>
        </p>

        <p className="mt-4 text-[15px] text-soft">You can still spend today</p>
        <HugeNumber value={left} className="mt-1" />

        <div className="mt-2 min-h-[40px]">
          {used ? (
            <Note tone="adjust">{POOL_USED_UP_MESSAGE}</Note>
          ) : over ? (
            <p className="text-[13px] font-medium leading-snug tracking-[0.01em] text-warm">{over}</p>
          ) : (
            <p className="text-[15px] text-good">
              {spent > 0 ? `${inr(spent)} spent so far. You're on plan.` : `That's your amount for today is ${inr(allowance)}.`}
            </p>
          )}
        </div>

        <div className="relative mt-2" ref={stripRef}>
          <WeekRow
            days={week}
            startDate={cycle.monthStart}
            onSelect={(day) => {
              endHint();
              setPeekDay(day);
            }}
          />
          {showHint && view === 'today' && peekDay == null && <PreviousDayHint host={stripRef} onDone={endHint} />}
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
                        {entryLines(e).title}
                        {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                      </p>
                      {entryLines(e).detail && <p className="truncate text-[13px] text-soft">{entryLines(e).detail}</p>}
                      {entryLines(e).meta && <p className="text-[12px] text-faint">{entryLines(e).meta}</p>}
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
            setLogDay(undefined);
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
          cycle={state}
          busy={busy}
          onBack={() => setView('today')}
          onClose={close}
          onAddMore={() => {
            setLogDay(undefined);
            setLogReturn('close');
            setView('log');
          }}
        />
      )}
      {view === 'log' && <LogSpend cycle={month} plan={plan} targetDay={logDay} onClose={() => setView(logReturn)} />}
      {peekDay != null && view === 'today' && (
        <DayPeek
          cycle={month}
          day={peekDay}
          onClose={() => setPeekDay(null)}
          onEdit={setEditing}
          onLog={() => {
            setLogDay(peekDay === month.currentDay ? undefined : peekDay);
            setLogReturn('today');
            setPeekDay(null);
            setView('log');
          }}
        />
      )}
      {view === 'today' && peekDay == null && !editing && <BackupPrompt onCreate={onCreateAccount} />}
      {editing && <EditSpendSheet entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
