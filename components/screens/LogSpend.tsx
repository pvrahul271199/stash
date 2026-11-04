'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
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
import { dateOfDay, daysBetween, formatShort, formatWithWeekday, todayISO } from '@/lib/dates';
import { chipLabels } from '@/lib/suggestions';
import { inr, num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
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
  targetDate,
  onClose,
}: {
  cycle: Cycle;
  plan: Plan;
  /** Optional specific day (1..totalDays) to log into when adding from History. */
  targetDay?: number;
  /** Optional specific ISO date (yyyy-mm-dd) to log into from calendar. */
  targetDate?: string;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [eventErr, setEventErr] = useState<string | null>(null);
  const [view, setView] = useState<'keypad' | 'picker' | 'big'>('keypad');
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
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const lastUsed = useLastUsedLabel();
  const lastPayment = useLastPayment();
  const [paymentOverride, setPaymentOverride] = useState<string | null>(null);
  const payment = paymentOverride ?? lastPayment;
  const activeEvent = useActiveEvent();
  const events = useEvents() ?? [];
  const toast = useToast((s) => s.show);
  const { currency } = useCurrency();
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
    // Spending record-only on another day (switch off) never touches the pool, so nothing to warn about.
    if ((!isOtherDay || spread) && isBigSpend(amount, cycle.pool, cycle)) {
      setPending(p);
      setView('big');
      return;
    }
    if (isOtherDay) {
      await persist(p, false, spread);
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
          left={cycle.pool}
          allowance={todayAllowance(cycle)}
          busy={saving}
          onClose={() => setView('keypad')}
          onKeep={() => persist(pending, true, true)}
          onSpread={() => persist(pending, false, true)}
        />
      )}

      {spreadInfo && (() => {
        const remDays = Math.max(1, daysLeft(cycle));
        const currentDaily = todayAllowance(cycle);
        const newPool = Math.max(0, cycle.pool - amount);
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

      {(view === 'keypad' || view === 'big') && (
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

          <div
            className="flex flex-1 flex-col items-center justify-center"
            aria-live="polite"
            onClick={() => eventMenuOpen && setEventMenuOpen(false)}
          >
            {isOutsideActiveCycle ? (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-0.5 text-[11px] font-medium text-ink">
                {targetDateLabel} · Historical date
              </span>
            ) : targetDay != null || (targetDate != null && effectiveDay != null && effectiveDay !== cycle.currentDay) ? (
              <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-tint px-3 py-0.5 text-[11px] font-medium text-ink">
                Day {effectiveDay} · {targetDateLabel}
              </span>
            ) : null}
            <div className="num flex items-baseline justify-center" style={{ fontSize: size, lineHeight: 1.05 }}>
              <span className="mr-1 text-faint" aria-hidden="true">{currency.symbol}</span>
              <span className={amount === 0 ? 'text-faint' : 'text-ink'} aria-label={`Amount ${amount} ${currency.code}`}>
                {amount === 0 ? '0' : num(amount)}
              </span>
            </div>

            <div className="mt-2 flex w-fit flex-col items-stretch">
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
                    placeholder="Note"
                    aria-label="Spend note"
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

            {isOtherDay && !isOutsideActiveCycle && (
              <div className="mt-5 flex flex-col items-center gap-1">
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
                      ? `Daily ${inr(todayAllowance(cycle))} → ${inr(Math.max(0, cycle.pool - amount) / Math.max(1, daysLeft(cycle)))}`
                      : 'Your daily amount will adjust'
                    : `Just recorded. Daily stays ${inr(todayAllowance(cycle))}`}
                </p>
              </div>
            )}
          </div>

          <div className="mb-2 flex flex-wrap justify-center gap-1">
            {labels.map((l) => (
              <Chip
                key={l}
                onClick={() => commit({ label: l })}
                className="h-7 min-h-0 px-2.5 text-[11px]"
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
              className="h-7 min-h-0 px-2.5 text-[11px]"
            >
              More
            </Chip>
          </div>

          <Keypad onKey={press} />
          <PrimaryButton
            disabled={saving}
            className="mt-2 h-[46px] min-h-0 text-[15px]"
            onClick={() => commit({ label: 'Sort later' })}
          >
            {saving ? 'Saving…' : 'Save'}
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
