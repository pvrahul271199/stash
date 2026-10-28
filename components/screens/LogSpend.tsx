'use client';
import { useCallback, useEffect, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Keypad } from '../ui/Keypad';
import { CategoryPicker } from './CategoryPicker';
import { BigSpend } from './BigSpend';
import {
  addSpend,
  endEvent,
  startEvent,
  useActiveEvent,
  useEvents,
  useLastPayment,
  useLastUsedLabel,
} from '@/db/queries';
import { PAYMENT_MODES, type Cycle, type Plan } from '@/db/schema';
import { daysLeft, isBigSpend, todayAllowance } from '@/lib/budget';
import { MAX_NAME } from '@/lib/categories';
import { dateOfDay, formatShort, formatWithWeekday } from '@/lib/dates';
import { chipLabels } from '@/lib/suggestions';
import { inr, num } from '@/lib/format';
import { useToast } from '@/store/toast';

const MAX_DIGITS = 7;

interface Pending {
  label: string;
  category?: string;
  subcategory?: string | null;
}

export function LogSpend({
  cycle,
  plan,
  targetDay,
  onClose,
}: {
  cycle: Cycle;
  plan: Plan;
  /** Optional specific day (1..totalDays) to log into when adding from History. */
  targetDay?: number;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [eventErr, setEventErr] = useState<string | null>(null);
  const [view, setView] = useState<'keypad' | 'picker' | 'big' | 'pastAdjust'>('keypad');
  const [pending, setPending] = useState<Pending | null>(null);
  const lastUsed = useLastUsedLabel();
  const lastPayment = useLastPayment();
  const [paymentOverride, setPaymentOverride] = useState<string | null>(null);
  const payment = paymentOverride ?? lastPayment;
  const activeEvent = useActiveEvent();
  const events = useEvents() ?? [];
  const toast = useToast((s) => s.show);
  const labels = chipLabels(new Date().getHours(), lastUsed);
  const amount = digits === '' ? 0 : Number(digits);

  const press = useCallback((k: string) => {
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      const nd = (d + k).replace(/^0+/, '');
      return nd.length > MAX_DIGITS ? d : nd;
    });
  }, []);

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

  const effectiveDay = targetDay ?? cycle.currentDay;
  const isPreviousDay = targetDay != null && targetDay < cycle.currentDay;
  const targetIso = dateOfDay(cycle.startDate, effectiveDay);
  const targetDateLabel = formatShort(targetIso);

  async function persist(p: Pending, fromSavings: boolean, adjustPool = true) {
    await addSpend(
      cycle,
      { amount, ...p, payment, note: note.trim() || null, fromSavings, adjustPool },
      new Date(),
      targetDay,
    );
    navigator.vibrate?.(10);
    const suffix = targetDay != null && targetDay !== cycle.currentDay ? ` on ${targetDateLabel} (Day ${targetDay})` : '';
    toast(
      p.label === 'Sort later'
        ? `Saved ₹${num(amount)}${suffix}`
        : `Saved ₹${num(amount)} for ${p.label}${suffix}`,
    );
    onClose();
  }

  /** Every save path goes through here so the past-day adjustment or big-spend rule always applies. */
  async function commit(p: Pending) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      setView('keypad');
      return;
    }
    if (isPreviousDay) {
      setPending(p);
      setView('pastAdjust');
      return;
    }
    if (isBigSpend(amount, todayAllowance(cycle), cycle)) {
      setPending(p);
      setView('big');
      return;
    }
    await persist(p, false, true);
  }

  useEffect(() => {
    if (view !== 'keypad') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') onClose();
      else if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
        e.preventDefault();
        void commit({ label: 'Sort later' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [press, onClose, amount, view]);

  const size = digits.length <= 5 ? 72 : digits.length === 6 ? 60 : 52;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log a spend"
      className="absolute inset-0 z-40 flex flex-col bg-white px-5"
      style={{ paddingTop: 'calc(var(--safe-top) + 6px)', paddingBottom: 'calc(var(--safe-bottom) + 14px)' }}
    >
      {view === 'picker' && (
        <CategoryPicker
          amount={amount}
          onBack={() => setView('keypad')}
          onPick={(category, subcategory) => commit({ label: subcategory ?? category, category, subcategory })}
        />
      )}

      {view === 'big' && pending && (
        <BigSpend
          amount={amount}
          label={pending.label}
          allowance={todayAllowance(cycle)}
          daysLeft={daysLeft(cycle)}
          savingsSetAside={plan.savings}
          onBack={() => setView('keypad')}
          onSpread={() => persist(pending, false, true)}
          onSavings={() => persist(pending, true, true)}
        />
      )}

      {view === 'pastAdjust' && pending && (() => {
        const remDays = Math.max(1, daysLeft(cycle));
        const currentDaily = todayAllowance(cycle);
        const newPool = Math.max(0, cycle.pool - amount);
        const newDaily = remDays > 0 ? newPool / remDays : 0;
        const perDayDelta = Math.max(0, currentDaily - newDaily);
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              <IconButton label="Back to keypad" onClick={() => setView('keypad')} className="-ml-3">
                <BackIcon />
              </IconButton>
              <span className="rounded-full bg-tint px-3 py-1 text-[12px] font-medium text-ink">
                Day {effectiveDay} · {formatWithWeekday(targetIso)}
              </span>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto">
              <p className="text-[14px] text-soft">{pending.label}</p>
              <p className="num mt-1 text-big text-ink">
                <span className="text-faint">₹</span>
                {amount.toLocaleString('en-IN')}
              </p>

              <h2 className="mt-5 text-question font-semibold text-ink">
                Adjust the remaining month for this spend?
              </h2>
              <p className="mt-1.5 text-body text-soft">
                You’re adding a transaction to a past day ({targetDateLabel}). Should this rebalance your{' '}
                {remDays} remaining unfilled {remDays === 1 ? 'day' : 'days'}?
              </p>

              <div className="mt-5 rounded-note border border-ink bg-tint/50 p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white"
                    aria-hidden="true"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 11v5" />
                      <path d="M12 8h.01" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-soft">
                    <p className="text-ink">
                      <span className="font-semibold">If Yes:</span> Pool adjusts from{' '}
                      <span className="num font-semibold">{inr(cycle.pool)}</span> to{' '}
                      <span className="num font-semibold">{inr(newPool)}</span>, and your next {remDays}{' '}
                      {remDays === 1 ? 'day becomes' : 'days become'}{' '}
                      <span className="num font-semibold">{inr(newDaily)}/day</span> ({inr(perDayDelta)} less/day).
                    </p>
                    <div className="my-2.5 border-t border-line" />
                    <p className="text-soft">
                      <span className="font-semibold text-ink">If No:</span> Logs{' '}
                      <span className="num font-semibold text-ink">{inr(amount)}</span> on{' '}
                      <span className="font-medium text-ink">
                        {targetDateLabel} (Day {effectiveDay})
                      </span>{' '}
                      while keeping your remaining days at{' '}
                      <span className="num font-semibold text-ink">{inr(currentDaily)}/day</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <PrimaryButton onClick={() => persist(pending, false, true)}>
                Yes, adjust remaining days
              </PrimaryButton>
              <SecondaryButton onClick={() => persist(pending, false, false)}>
                No, keep remaining days as is
              </SecondaryButton>
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

            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setEventMenuOpen((v) => !v);
                  setEventErr(null);
                }}
                aria-expanded={eventMenuOpen}
                aria-label={activeEvent ? `Logging in ${activeEvent}. Tap to switch event` : 'Choose an event'}
                className={`inline-flex h-7 min-h-0 max-w-[170px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${
                  activeEvent
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-tint/70 text-soft'
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
                <span className="shrink-0 text-[9px] opacity-75" aria-hidden="true">
                  {eventMenuOpen ? '▴' : '▾'}
                </span>
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
                  className="flex h-6 w-6 min-h-0 shrink-0 items-center justify-center rounded-full border border-line bg-tint/70 text-[12px] text-soft"
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
                          : 'border-line bg-tint/50 text-soft hover:border-ink/40 hover:text-ink'
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
                              : 'border-line bg-tint/50 text-ink hover:border-ink/40'
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
                        className="h-7 min-h-0 min-w-0 flex-1 rounded-full border border-line bg-tint/40 px-3 text-[11px] text-ink placeholder:text-faint focus:border-ink focus:bg-white focus:outline-none"
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

          <div
            className="flex flex-1 flex-col items-center justify-center"
            aria-live="polite"
            onClick={() => eventMenuOpen && setEventMenuOpen(false)}
          >
            {targetDay != null && (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-0.5 text-[11px] font-medium text-ink">
                Day {targetDay} · {targetDateLabel}
              </span>
            )}
            <div className="num flex items-baseline justify-center" style={{ fontSize: size, lineHeight: 1.05 }}>
              <span className="mr-1 text-faint" aria-hidden="true">₹</span>
              <span className={amount === 0 ? 'text-faint' : 'text-ink'} aria-label={`Amount ${amount} rupees`}>
                {amount === 0 ? '0' : num(amount)}
              </span>
            </div>

            <div className="mt-2 inline-flex rounded-full bg-tint p-0.5" role="group" aria-label="Payment mode">
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

            <div className="mt-1.5 flex h-7 w-full items-center justify-center">
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
                <div className="inline-flex h-6 min-h-0 max-w-[220px] items-center gap-1 rounded-full border border-ink/20 bg-tint pl-2.5 pr-1 text-[11px] text-ink">
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
                <div className="flex h-7 w-full max-w-[250px] items-center gap-1 rounded-full border border-line bg-tint/70 px-2.5">
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
                    placeholder="What was this for?"
                    aria-label="Spend note"
                    autoFocus
                    maxLength={60}
                    className="h-6 min-h-0 min-w-0 flex-1 bg-transparent text-[12px] text-ink placeholder:text-faint"
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

          <div className="mb-2.5 flex flex-wrap justify-center gap-1.5">
            {labels.map((l) => (
              <Chip
                key={l}
                onClick={() => commit({ label: l })}
                className="h-8 min-h-0 px-3 text-[12px]"
              >
                {l}
              </Chip>
            ))}
            <Chip
              dashed
              onClick={() => {
                if (amount <= 0) toast('Enter an amount first', 'warm');
                else setView('picker');
              }}
              className="h-8 min-h-0 px-3 text-[12px]"
            >
              More
            </Chip>
          </div>

          <Keypad onKey={press} />
          <PrimaryButton className="mt-2 h-[46px] min-h-0 text-[15px]" onClick={() => commit({ label: 'Sort later' })}>
            Save
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
