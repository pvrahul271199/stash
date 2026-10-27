'use client';
import { useCallback, useEffect, useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
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
import { chipLabels } from '@/lib/suggestions';
import { num } from '@/lib/format';
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
  onClose,
}: {
  cycle: Cycle;
  plan: Plan;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [eventErr, setEventErr] = useState<string | null>(null);
  const [view, setView] = useState<'keypad' | 'picker' | 'big'>('keypad');
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

  async function persist(p: Pending, fromSavings: boolean) {
    await addSpend(cycle, { amount, ...p, payment, note: note.trim() || null, fromSavings });
    navigator.vibrate?.(10);
    toast(p.label === 'Sort later' ? `Saved ₹${num(amount)}` : `Saved ₹${num(amount)} for ${p.label}`);
    onClose();
  }

  /** Every save path goes through here so the big-spend rule always applies. */
  async function commit(p: Pending) {
    if (amount <= 0) {
      toast('Enter an amount first', 'warm');
      setView('keypad');
      return;
    }
    if (isBigSpend(amount, todayAllowance(cycle), cycle)) {
      setPending(p);
      setView('big');
      return;
    }
    await persist(p, false);
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
      className="absolute inset-0 z-40 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
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
          onSpread={() => persist(pending, false)}
          onSavings={() => persist(pending, true)}
        />
      )}

      {view === 'keypad' && (
        <>
          <div className="relative flex items-center justify-between gap-2">
            <IconButton label="Close" onClick={onClose} className="-ml-3 shrink-0">
              <CloseIcon />
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
                className={`inline-flex h-8 min-h-0 max-w-[180px] items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors ${
                  activeEvent
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-tint/70 text-soft'
                }`}
              >
                <svg
                  width="12"
                  height="12"
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
                <span className="shrink-0 text-[10px] opacity-75" aria-hidden="true">
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
                  className="flex h-7 w-7 min-h-0 shrink-0 items-center justify-center rounded-full border border-line bg-tint/70 text-[13px] text-soft"
                >
                  ×
                </button>
              )}
            </div>

            <span className="w-8 shrink-0" aria-hidden="true" />

            {eventMenuOpen && (
              <div
                role="region"
                aria-label="Event switcher"
                className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-2xl border border-line bg-white p-2.5 shadow-lg"
              >
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      void endEvent();
                      setEventMenuOpen(false);
                    }}
                    aria-pressed={!activeEvent}
                    className={`h-7 min-h-0 rounded-full border px-2.5 text-[12px] font-medium ${
                      !activeEvent
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-tint/60 text-ink'
                    }`}
                  >
                    No event
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
                        className={`h-7 min-h-0 max-w-[140px] truncate rounded-full border px-2.5 text-[12px] font-medium ${
                          isCurrent
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-tint/60 text-ink'
                        }`}
                      >
                        {ev.name}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 flex items-center gap-1">
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
                    placeholder="New event..."
                    aria-label="New event name"
                    maxLength={MAX_NAME + 6}
                    className="h-7 min-h-0 min-w-0 flex-1 rounded-full border border-line bg-tint/40 px-2.5 text-[12px] text-ink placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={() => void handleQuickCreateEvent()}
                    className="h-7 min-h-0 shrink-0 rounded-full bg-ink px-2.5 text-[11px] font-medium text-white"
                  >
                    Start
                  </button>
                </div>
                {eventErr && <p className="mt-1 text-[11px] text-warm">{eventErr}</p>}
              </div>
            )}
          </div>

          <div
            className="flex flex-1 flex-col items-center justify-center"
            aria-live="polite"
            onClick={() => eventMenuOpen && setEventMenuOpen(false)}
          >
            <div className="num flex items-baseline justify-center" style={{ fontSize: size, lineHeight: 1.05 }}>
              <span className="mr-1 text-faint" aria-hidden="true">₹</span>
              <span className={amount === 0 ? 'text-faint' : 'text-ink'} aria-label={`Amount ${amount} rupees`}>
                {amount === 0 ? '0' : num(amount)}
              </span>
            </div>

            <div className="mt-3 inline-flex rounded-full bg-tint p-1" role="group" aria-label="Payment mode">
              {PAYMENT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentOverride(m)}
                  aria-pressed={payment === m}
                  className={`min-h-[32px] rounded-full px-3.5 text-[13px] font-medium ${
                    payment === m ? 'bg-ink text-white' : 'text-soft'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="mt-2 flex h-9 w-full items-center justify-center">
              {!noteOpen && !note.trim() && (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  aria-label="Add a note"
                  className="inline-flex h-8 min-h-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-[12px] font-medium text-soft"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
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
                <div className="inline-flex h-8 min-h-0 max-w-[240px] items-center gap-1 rounded-full border border-ink/20 bg-tint pl-3 pr-1.5 text-[12px] text-ink">
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
                    className="flex h-5 w-5 min-h-0 shrink-0 items-center justify-center rounded-full text-[13px] text-soft"
                  >
                    ×
                  </button>
                </div>
              )}

              {noteOpen && (
                <div className="flex h-9 w-full max-w-[270px] items-center gap-1.5 rounded-full border border-line bg-tint/70 px-3">
                  <svg
                    width="13"
                    height="13"
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
                    className="h-7 min-h-0 min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint"
                  />
                  {note && (
                    <button
                      type="button"
                      onClick={() => setNote('')}
                      aria-label="Clear note text"
                      className="flex h-5 w-5 min-h-0 shrink-0 items-center justify-center rounded-full text-[13px] text-soft"
                    >
                      ×
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNoteOpen(false)}
                    className="min-h-0 shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-medium text-white"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {labels.map((l) => (
              <Chip key={l} onClick={() => commit({ label: l })}>
                {l}
              </Chip>
            ))}
            <Chip
              dashed
              onClick={() => {
                if (amount <= 0) toast('Enter an amount first', 'warm');
                else setView('picker');
              }}
            >
              More
            </Chip>
          </div>

          <Keypad onKey={press} />
          <PrimaryButton className="mt-3" onClick={() => commit({ label: 'Sort later' })}>
            Save
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
