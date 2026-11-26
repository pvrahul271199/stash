'use client';
import { track, trackOnce } from '@/lib/analytics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Keypad } from '../ui/Keypad';
import { CALC_INIT, OP_SYMBOL, calcPress, calcResult, formatTyped, isOp, type CalcState } from '../../lib/calc';
import { CategoryPicker } from './CategoryPicker';
import { LendFields, NEW_LEND_DRAFT, type LendDraft } from './LendFields';
import {
  addIncome,
  addLoan,
  addSpend,
  addSubcategory,
  endEvent,
  startEvent,
  useActiveEvent,
  useEvents,
  useLastPayment,
  useLoans,
  useCategories,
  useQuickTypes,
  useUsedTypes,
} from '@/db/queries';
import { PAYMENT_MODES, type Plan } from '@/db/schema';
import type { DerivedCycle } from '@/lib/period';
import { daysLeft, todayAllowance } from '@/lib/budget';
import { MAX_NAME } from '@/lib/categories';
import { dateOfDay, daysBetween, formatShort, formatWithWeekday, todayISO } from '@/lib/dates';
import { quickChips } from '@/lib/suggestions';
import { DEFAULT_LOAN_KINDS, LEND_CATEGORY, dueFromChoice, isLoanKind, validateLoan } from '@/lib/lend';
import { DEFAULT_INCOME_SOURCE, validateIncome } from '@/lib/income';
import { inr, num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
import { useToast } from '@/store/toast';
import { captureEvent } from '@/lib/analytics';
import { EventHint } from '../ui/EventHint';
import { EventPlanSheet } from './EventPlanSheet';
import { HugeNumber } from '../ui/HugeNumber';


interface Pending {
  label: string;
  category?: string;
  subcategory?: string | null;
}

export function LogSpend({
  cycle,
  plan,
  targetDay,
  targetDate,
  initialMode = 'spend',
  onClose,
}: {
  cycle: DerivedCycle;
  plan: Plan;
  /** Optional specific day (1..totalDays) to log into when adding from History. */
  targetDay?: number;
  /** Optional specific ISO date (yyyy-mm-dd) to log into from calendar. */
  targetDate?: string;
  /** Which tab to open on (the User tab opens it on Income). */
  initialMode?: 'spend' | 'lend' | 'income';
  onClose: () => void;
}) {
  const [calc, setCalc] = useState<CalcState>(CALC_INIT);
  const digits = calc.digits;
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  /** "Plan an occasion": the checklist side of events (EventPlanSheet). */
  const [planOpen, setPlanOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [eventErr, setEventErr] = useState<string | null>(null);
  const [view, setView] = useState<'keypad' | 'picker'>('keypad');
  /** Spend | Lend: Lend asks who / will they pay / by when instead of payment and note, and saves a loan too. */
  const [mode, setMode] = useState<'spend' | 'lend' | 'income'>(initialMode);
  const [lend, setLend] = useState<LendDraft>(NEW_LEND_DRAFT);
  const loans = useLoans() ?? [];
  const people = [...new Set(loans.map((l) => l.person).filter(Boolean))].slice(0, 20);
  /** For past/upcoming days: spread the spend over the remaining days (remembered between sessions). */
  const [spread, setSpread] = useState(true);
  const [spreadInfo, setSpreadInfo] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('stash.spreadOtherDay') === '0') setSpread(false);
    } catch {}
  }, []);
  function toggleSpread() {
    setSpread((v) => {
      try {
        localStorage.setItem('stash.spreadOtherDay', v ? '0' : '1');
      } catch {}
      return !v;
    });
  }
  // First time only: an arrow pointing at the event pill ("you can create an event"). Remembered per device.
  const [showEventHint, setShowEventHint] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem('stash:hint:event') === '1';
    } catch {
      /* no storage: skip the hint rather than nag */
    }
    if (seen) return;
    const t = setTimeout(() => setShowEventHint(true), 600);
    return () => clearTimeout(t);
  }, []);
  const endEventHint = () => {
    setShowEventHint(false);
    try {
      localStorage.setItem('stash:hint:event', '1');
    } catch {
      /* ignore */
    }
  };
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const lastPayment = useLastPayment();
  const [paymentOverride, setPaymentOverride] = useState<string | null>(null);
  const payment = paymentOverride ?? lastPayment;
  const activeEvent = useActiveEvent();
  const events = useEvents() ?? [];
  const toast = useToast((s) => s.show);
  const { currency } = useCurrency();
  const cats = useCategories() ?? [];
  const pinned = useQuickTypes();
  const used = useUsedTypes();
  // not on every keypress: only when the categories, pins or used types change
  const hour = new Date().getHours();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chips = useMemo(() => quickChips(cats, pinned, used, hour), [cats.length, pinned, used, hour]);
  const amount = calcResult(calc);
  // Whom you can lend to = the Lend category's types; "+ Add" in Lend mode adds one there (same as Categories).
  const lendCat = cats.find((c) => c.name.toLowerCase() === LEND_CATEGORY.toLowerCase());
  const lendKinds = lendCat?.subcategories.length ? lendCat.subcategories : [...DEFAULT_LOAN_KINDS];

  const press = useCallback((k: string) => setCalc((c) => calcPress(c, k)), []);

  async function handleQuickCreateEvent() {
    const err = await startEvent(newEventName);
    if (err) {
      setEventErr(err);
      return;
    }
    setNewEventName('');
    setEventErr(null);
    setEventMenuOpen(false);
  }

  const offsetFromCycle = targetDate ? daysBetween(cycle.startDate, targetDate) : null;
  const isTargetDateWithinCycle =
    offsetFromCycle != null && offsetFromCycle >= 0 && offsetFromCycle < cycle.totalDays;
  const isOutsideActiveCycle = targetDate != null && !isTargetDateWithinCycle;

  const effectiveDay =
    targetDate != null
      ? (isTargetDateWithinCycle ? offsetFromCycle! + 1 : null)
      : (targetDay ?? cycle.currentDay);

  /** Any day inside the cycle other than today: ask whether to spread it over the remaining days. */
  const isOtherDay = isOutsideActiveCycle
    ? false
    : (effectiveDay != null && effectiveDay !== cycle.currentDay);
  const isFutureDay = isOtherDay && effectiveDay != null && effectiveDay > cycle.currentDay;

  const targetIso = targetDate ?? (effectiveDay != null ? dateOfDay(cycle.startDate, effectiveDay) : todayISO());
  const targetDateLabel = formatShort(targetIso);

  async function persist(p: Pending, fromSavings: boolean, adjustPool = true) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await addSpend(
        cycle,
        {
          amount,
          ...p,
          payment,
          note: note.trim() || null,
          fromSavings,
          adjustPool: isOutsideActiveCycle ? false : adjustPool,
        },
        new Date(),
        effectiveDay ?? undefined,
        targetDate,
      );
      navigator.vibrate?.(10);
      captureEvent('spend_logged', {
        payment_method: payment,
        entry_timing: isOutsideActiveCycle ? 'historical' : isOtherDay ? (isFutureDay ? 'future' : 'past') : 'current_day',
        from_savings: fromSavings,
        adjusts_daily_budget: !isOutsideActiveCycle && adjustPool,
      });
      const suffix = isOutsideActiveCycle
        ? ` on ${targetDateLabel}`
        : (effectiveDay != null && effectiveDay !== cycle.currentDay
            ? ` on ${targetDateLabel} (Day ${effectiveDay})`
            : '');
      toast(`Logged ${inr(amount)}${suffix}`);
      onClose();
    } catch {
      toast('Couldn’t log that spend. Please try again.', 'warm');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /** Every save path goes through here so the past-day adjustment or big-spend rule always applies. */
  async function commit(p: Pending) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      setView('keypad');
      return;
    }
    if (isOutsideActiveCycle) {
      // Historical spend outside 30-day range: records directly without pool adjustment
      await persist(p, false, false);
      return;
    }
    if (isOtherDay) {
      await persist(p, false, spread);
      return;
    }
    await persist(p, false, true);
  }

  /** Lend mode's Save: the spend and its loan in one go. */
  async function commitLend() {
    if (savingRef.current) return;
    const dueDate = dueFromChoice(lend.due, todayISO());
    const bad = validateLoan({ amount, person: lend.person, kind: lend.kind, dueDate }, targetIso);
    if (bad) {
      toast(bad, 'warm');
      if (amount <= 0) setView('keypad');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await addLoan(
        cycle,
        { amount, person: lend.person, kind: lend.kind, dueDate: dueDate && dueDate < targetIso ? targetIso : dueDate, payment },
        new Date(),
        effectiveDay ?? undefined,
        targetDate,
      );
      navigator.vibrate?.(10);
      captureEvent('lend_logged', { kind: lend.kind, has_due_date: dueDate != null });
      toast(`Tracking ${inr(amount)} lent to ${lend.person.trim() || lend.kind}. See History > Lend`);
      onClose();
    } catch {
      toast('Couldn’t save that. Please try again.', 'warm');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /** Income mode's Save: money in. Raises this month's money, so every remaining day gets more. */
  async function commitIncome() {
    if (savingRef.current) return;
    const source = DEFAULT_INCOME_SOURCE;
    const bad = validateIncome({ amount, source });
    if (bad) {
      toast(bad, 'warm');
      if (amount <= 0) setView('keypad');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const remDays = Math.max(1, daysLeft(cycle));
      await addIncome(cycle, { amount, source, payment, note: note.trim() || null }, effectiveDay ?? undefined, targetDate);
      navigator.vibrate?.(10);
      captureEvent('income_logged', { source, entry_timing: isOutsideActiveCycle ? 'historical' : isOtherDay ? (isFutureDay ? 'future' : 'past') : 'current_day' });
      const inThisMonth = !isOutsideActiveCycle;
      toast(
        inThisMonth
          ? `Added +${inr(amount)}. Daily is now ${inr((cycle.pool + amount) / remDays)}`
          : `Added +${inr(amount)} on ${targetDateLabel}`,
      );
      onClose();
    } catch {
      toast('Couldn’t save that. Please try again.', 'warm');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /** Picking the Lend category (or one of its types) in the picker is the same as flipping the switch to Lend. */
  function pickCategory(category: string, subcategory: string | null) {
    if (category.toLowerCase() === LEND_CATEGORY.toLowerCase()) {
      setLend((d) => ({ ...d, kind: isLoanKind(subcategory) ? subcategory : d.kind }));
      setMode('lend');
      setView('keypad');
      return;
    }
    void commit({ label: subcategory ?? category, category, subcategory });
  }

  useEffect(() => {
    if (view !== 'keypad') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      const opKey = e.key === 'x' || e.key === 'X' ? '*' : e.key;
      if (/^\d$/.test(e.key) || e.key === '.' || e.key === ',') press(e.key === ',' ? '.' : e.key);
      else if (isOp(opKey)) press(opKey);
      else if (e.key === '=' ) press('=');
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        if (calc.op !== null) {
          press('=');
          return;
        }
        if (mode === 'lend') void commitLend();
        else if (mode === 'income') void commitIncome();
        else void commit({ label: 'Sort later' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [press, onClose, amount, view, calc.op, mode, lend, payment, note]);


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'income' ? 'Add income' : 'Log a spend'}
      className="absolute inset-0 z-40 flex flex-col bg-white px-5"
      style={{ paddingTop: 'calc(var(--safe-top) + 6px)', paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}
    >
      {view === 'picker' && (
        <CategoryPicker
          amount={amount}
          onBack={() => setView('keypad')}
          onPick={pickCategory}
        />
      )}

      {spreadInfo && (() => {
        const remDays = Math.max(1, daysLeft(cycle));
        const currentDaily = todayAllowance(cycle);
        const newPool = cycle.pool - amount;
        const newDaily = newPool / remDays;
        return (
          <div className="absolute inset-0 z-[60] flex items-end bg-ink/40" role="presentation" onClick={() => setSpreadInfo(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="About spreading a spend"
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-[24px] bg-white px-6 pt-3"
              style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
              <h2 className="text-section font-semibold text-ink">Spread over other days?</h2>
              <p className="mt-1 text-[14px] text-soft">
                You’re adding a spend to {isFutureDay ? 'an upcoming' : 'a past'} day ({targetDateLabel}, Day {effectiveDay}).
              </p>
              <div className="mt-4 flex items-center justify-between rounded-note border border-line px-4 py-3">
                <span className="text-[13px] text-soft">Daily limit</span>
                <span className="num text-[15px] font-semibold text-ink">
                  {inr(currentDaily)} <span className="px-1 text-faint">→</span> {inr(newDaily)}
                </span>
              </div>
              <div className="mt-3 rounded-note bg-tint p-4 text-[13px] leading-relaxed text-soft">
                <p className="text-ink">
                  <span className="font-semibold">On:</span> your pool goes from{' '}
                  <span className="num font-semibold">{inr(cycle.pool)}</span> to{' '}
                  <span className="num font-semibold">{inr(newPool)}</span>, so your next {remDays}{' '}
                  {remDays === 1 ? 'day becomes' : 'days become'}{' '}
                  <span className="num font-semibold">{inr(newDaily)}/day</span>.
                </p>
                <div className="my-2.5 border-t border-line" />
                <p>
                  <span className="font-semibold text-ink">Off:</span> it’s only recorded on{' '}
                  <span className="font-medium text-ink">{targetDateLabel}</span>. Your remaining days stay at{' '}
                  <span className="num font-semibold text-ink">{inr(currentDaily)}/day</span>.
                </p>
              </div>
              <div className="mt-4">
                <PrimaryButton onClick={() => setSpreadInfo(false)}>Got it</PrimaryButton>
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'keypad' && (
        <>
          <div className="relative flex items-center justify-between gap-2">
            <IconButton label="Close" onClick={onClose} className="-ml-2 h-9 w-9 min-h-0 shrink-0">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>

            <div className="relative flex min-w-0 items-center gap-1">
              {showEventHint && view === 'keypad' && !eventMenuOpen && !activeEvent && events.length === 0 && (
                <EventHint onDone={endEventHint} />
              )}
              <button
                type="button"
                onClick={() => {
                  endEventHint();
                  setEventMenuOpen((v) => !v);
                  setEventErr(null);
                }}
                aria-expanded={eventMenuOpen}
                aria-label={activeEvent ? `Logging in ${activeEvent}. Tap to switch event` : 'Choose an event'}
                className={`inline-flex h-8 min-h-0 max-w-[190px] items-center gap-1.5 rounded-full border pl-2.5 pr-2 text-[12px] font-medium transition-colors ${
                  activeEvent
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-white text-soft'
                }`}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                  <path d="M8 3v4M16 3v4M3.5 10h17" />
                </svg>
                <span className="truncate">{activeEvent ? activeEvent : 'No event'}</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`shrink-0 transition-transform duration-200 ${eventMenuOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {activeEvent && (
                <button
                  type="button"
                  onClick={() => {
                    void endEvent();
                    setEventMenuOpen(false);
                  }}
                  aria-label={`Stop logging in ${activeEvent}`}
                  title="Turn off event"
                  className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border border-line bg-white text-[12px] text-soft"
                >
                  ×
                </button>
              )}
            </div>

            <span className="w-7 shrink-0" aria-hidden="true" />

            {eventMenuOpen && (
              <>
                <div
                  aria-hidden="true"
                  onClick={() => setEventMenuOpen(false)}
                  className="fixed inset-0 z-20"
                />
                <div
                  role="region"
                  aria-label="Event switcher"
                  className="absolute left-1/2 top-full z-30 mt-2 w-[268px] -translate-x-1/2 rounded-note border border-ink/20 bg-white p-3 shadow-[0_12px_32px_-8px_rgba(30,27,75,0.16)]"
                >
                  {/* Two different jobs, said in plain words: tag spends you log now, or plan what an occasion will cost. */}
                  <div className="grid grid-cols-2 gap-1.5 pb-2.5">
                    <div className="flex flex-col items-start gap-0.5 rounded-[12px] border border-ink bg-tint px-2.5 py-2">
                      <span className="text-[12px] font-semibold text-ink">Log into an event</span>
                      <span className="text-[10.5px] leading-snug text-soft">Tag the spends you log now</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEventMenuOpen(false);
                        setPlanOpen(true);
                      }}
                      className="flex min-h-0 flex-col items-start gap-0.5 rounded-[12px] border border-line bg-white px-2.5 py-2 text-left transition-colors hover:border-ink/40"
                    >
                      <span className="text-[12px] font-semibold text-ink">Plan an occasion</span>
                      <span className="text-[10.5px] leading-snug text-soft">Items and amounts to tick off</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[11px] font-semibold tracking-wide text-soft">Event tag</span>
                    {activeEvent && (
                      <button
                        type="button"
                        onClick={() => {
                          void endEvent();
                          setEventMenuOpen(false);
                        }}
                        className="min-h-0 text-[11px] font-medium text-faint hover:text-ink"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        void endEvent();
                        setEventMenuOpen(false);
                      }}
                      aria-pressed={!activeEvent}
                      className={`h-7 min-h-0 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
                        !activeEvent
                          ? 'border-ink bg-ink text-white'
                          : 'border-line bg-white text-soft hover:border-ink/40 hover:text-ink'
                      }`}
                    >
                      None
                    </button>
                    {events.map((ev) => {
                      const isCurrent = ev.name === activeEvent;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            void startEvent(ev.name);
                            setEventMenuOpen(false);
                          }}
                          aria-pressed={isCurrent}
                          className={`h-7 min-h-0 max-w-[150px] truncate rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
                            isCurrent
                              ? 'border-ink bg-ink text-white'
                              : 'border-line bg-white text-ink hover:border-ink/40'
                          }`}
                        >
                          {ev.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 border-t border-line pt-2.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newEventName}
                        onChange={(e) => {
                          setNewEventName(e.target.value);
                          setEventErr(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleQuickCreateEvent();
                          }
                        }}
                        placeholder="Create new event…"
                        aria-label="New event name"
                        maxLength={MAX_NAME + 6}
                        className="h-7 min-h-0 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-[11px] text-ink placeholder:text-faint focus:border-ink focus:bg-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleQuickCreateEvent()}
                        className="h-7 min-h-0 shrink-0 rounded-full bg-ink px-3 text-[11px] font-semibold text-white transition-transform active:scale-95"
                      >
                        + Add
                      </button>
                    </div>
                    {eventErr && <p className="mt-1 px-1 text-[10px] text-warm">{eventErr}</p>}
                  </div>
                </div>
              </>
            )}
          </div>

          <div role="tablist" aria-label="Spend, lend or income" className="mx-auto mt-2 flex w-fit rounded-full bg-tint p-0.5">
            {(['spend', 'lend', 'income'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`h-7 min-h-0 rounded-full px-4 text-[12px] font-medium transition-colors ${mode === m ? 'bg-ink text-white' : 'text-soft'}`}
              >
                {m === 'spend' ? 'Spend' : m === 'lend' ? 'Lend' : 'Income'}
              </button>
            ))}
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto"
            aria-live="polite"
            onClick={() => eventMenuOpen && setEventMenuOpen(false)}
          >
            <div className="my-auto flex w-full flex-col items-center">
            {isOutsideActiveCycle ? (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-0.5 text-[11px] font-medium text-ink">
                {targetDateLabel} · Historical date
              </span>
            ) : targetDay != null || (targetDate != null && effectiveDay != null && effectiveDay !== cycle.currentDay) ? (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-0.5 text-[11px] font-medium text-ink">
                Day {effectiveDay} · {targetDateLabel}
              </span>
            ) : null}
            <div
              className="num mb-1.5 flex h-[42px] flex-col items-center justify-end gap-px text-[14px] leading-[18px]"
              aria-hidden={calc.op === null}
            >
              {calc.op !== null && calc.acc !== null && (
                <div className="flex min-w-[44px] flex-col items-stretch">
                  <span className="calc-pop text-right text-faint">{calc.acc.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                  <span key={calc.op} className="calc-pop flex justify-between gap-1.5 text-soft">
                    <span>{OP_SYMBOL[calc.op]}</span>
                    <span>{formatTyped(calc.digits)}</span>
                  </span>
                  <span className="mt-0.5 h-px w-full bg-line" />
                </div>
              )}
            </div>
            {/* Same size and style as the Today screen's number (HugeNumber, 52px, shrinks only if it must). */}
            <HugeNumber
              value={amount}
              size={52}
              className="text-center"
              color={amount === 0 ? 'text-faint' : 'text-ink'}
              prefix={mode === 'income' ? '+' : ''}
              text={calc.op === null && calc.digits !== '' ? formatTyped(calc.digits, currency.locale) : amount === 0 ? '0' : num(amount)}
            />

            {/* Same height and same top for Spend, Lend and Income, so nothing moves when the tab changes. */}
            <div className="mt-3 flex h-[184px] w-full flex-col items-center justify-start">
            {mode === 'lend' ? (
              <LendFields
                draft={lend}
                onChange={setLend}
                kinds={lendKinds}
                people={people}
                dailyHint={amount > 0 ? `Daily ${inr(todayAllowance(cycle))} → ${inr((cycle.pool - amount) / Math.max(1, daysLeft(cycle)))}` : null}
                onAddKind={async (name) => (lendCat ? addSubcategory(lendCat.id, name) : 'The Lend category was removed. Add it back in Categories.')}
              />
            ) : (
            <div className="flex w-fit flex-col items-stretch">
            <div className="inline-flex rounded-full bg-tint p-0.5" role="group" aria-label="Payment mode">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentOverride(m)}
                  aria-pressed={payment === m}
                  className={`h-7 min-h-0 rounded-full px-3 text-[12px] font-medium ${
                    payment === m ? 'bg-ink text-white' : 'text-soft'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-1.5 flex h-7 w-0 min-w-full items-center justify-center">
              {!noteOpen && !note.trim() && (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  aria-label="Add a note"
                  className="inline-flex h-6 min-h-0 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] font-medium text-soft"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add a note
                </button>
              )}

              {!noteOpen && note.trim() && (
                <div className="inline-flex h-6 min-h-0 max-w-full items-center gap-1 rounded-full border border-ink/20 bg-white pl-2.5 pr-1 text-[11px] text-ink">
                  <button
                    type="button"
                    onClick={() => setNoteOpen(true)}
                    aria-label={`Edit note: ${note}`}
                    className="min-h-0 truncate py-0.5 text-left font-medium text-ink"
                  >
                    {note}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNote('')}
                    aria-label="Clear note"
                    className="flex h-4 w-4 min-h-0 shrink-0 items-center justify-center rounded-full text-[12px] text-soft"
                  >
                    ×
                  </button>
                </div>
              )}

              {noteOpen && (
                <div className="flex h-7 w-full items-center gap-1 rounded-full border border-line bg-white px-2.5">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 text-soft"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setNoteOpen(false);
                      }
                    }}
                    placeholder={mode === 'income' ? 'Where did this come from?' : 'Note'}
                    aria-label={mode === 'income' ? 'Income note' : 'Spend note'}
                    autoFocus
                    maxLength={60}
                    className="h-6 min-h-0 w-0 min-w-0 flex-1 bg-transparent text-[12px] text-ink placeholder:text-faint"
                  />
                  {note && (
                    <button
                      type="button"
                      onClick={() => setNote('')}
                      aria-label="Clear note text"
                      className="flex h-4 w-4 min-h-0 shrink-0 items-center justify-center rounded-full text-[12px] text-soft"
                    >
                      ×
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNoteOpen(false)}
                    className="min-h-0 shrink-0 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
            </div>
            )}
            {mode === 'income' && amount > 0 && (
              <p className="mt-3 max-w-[260px] self-center text-center text-[13px] text-soft">
                Your {Math.max(1, daysLeft(cycle))} {daysLeft(cycle) === 1 ? 'day' : 'days'} left go from{' '}
                <span className="num font-semibold text-ink">{inr(todayAllowance(cycle))}</span> to{' '}
                <span className="num font-semibold text-ink">{inr((cycle.pool + amount) / Math.max(1, daysLeft(cycle)))}</span> a day.
              </p>
            )}

            {mode === 'spend' && isOtherDay && !isOutsideActiveCycle && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1.5 pr-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={spread}
                    aria-label="Spread over remaining days"
                    onClick={toggleSpread}
                    className="flex min-h-0 items-center gap-2 rounded-full pr-1"
                  >
                    <span
                      aria-hidden="true"
                      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${spread ? 'bg-ink' : 'bg-line'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${spread ? 'left-[14px]' : 'left-0.5'}`}
                      />
                    </span>
                    <span className="text-[12px] font-medium text-ink">Spread over other days</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpreadInfo(true)}
                    aria-label="What does this do?"
                    className="flex h-5 w-5 min-h-0 min-w-0 items-center justify-center rounded-full bg-tint text-soft"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5M12 8h.01" />
                    </svg>
                  </button>
                </div>
                <p className="num text-[11px] text-faint">
                  {spread
                    ? amount > 0
                      ? `Daily ${inr(todayAllowance(cycle))} → ${inr((cycle.pool - amount) / Math.max(1, daysLeft(cycle)))}`
                      : 'Your daily amount will adjust'
                    : `Just recorded. Daily stays ${inr(todayAllowance(cycle))}`}
                </p>
              </div>
            )}
            </div>
            </div>
          </div>

          <div className="mb-2 min-h-[70px] shrink-0">
          {mode === 'spend' && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {chips.map((c) => (
              <button
                key={`${c.category}::${c.subcategory}`}
                type="button"
                onClick={() => commit({ label: c.subcategory, category: c.category, subcategory: c.subcategory })}
                title={c.category}
                className="h-8 min-h-0 rounded-full border border-line bg-white px-3.5 text-[12px] font-medium text-ink transition-colors active:bg-tint"
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (amount <= 0) toast('Enter an amount first', 'warm');
                else setView('picker');
              }}
              className="flex h-8 min-h-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12px] font-medium text-ink transition-colors active:bg-tint"
            >
              More
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          )}
          </div>

          <Keypad onKey={press} pendingOp={calc.op} opSelected={calc.digits === ''} calc />
          <PrimaryButton
            disabled={saving}
            className="mt-2 h-[46px] min-h-0 shrink-0 text-[15px]"
            onClick={() => (mode === 'lend' ? commitLend() : mode === 'income' ? commitIncome() : commit({ label: 'Sort later' }))}
          >
            {saving ? 'Saving…' : mode === 'lend' ? 'Save lend' : mode === 'income' ? 'Add income' : 'Save'}
          </PrimaryButton>
        </>
      )}
      {planOpen && <EventPlanSheet cycle={cycle} targetDate={targetDate} onClose={() => setPlanOpen(false)} />}
    </div>
  );
}
