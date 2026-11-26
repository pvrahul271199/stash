'use client';
import { useState } from 'react';
import { CloseIcon, IconButton, PrimaryButton } from '../ui/Button';
import { Keypad } from '../ui/Keypad';
import { payEventItem, useDayEntries, type PlannedItem } from '@/db/queries';
import { daysLeft, spentToday } from '@/lib/budget';
import { CALC_INIT, calcPress, calcResult, type CalcState } from '@/lib/calc';
import { dateOfDay } from '@/lib/dates';
import { payEffect } from '@/lib/eventPlan';
import { inr } from '@/lib/format';
import type { DerivedCycle } from '@/lib/period';
import { useToast } from '@/store/toast';
import { captureEvent } from '@/lib/analytics';

type Source = 'daily' | 'savings';

/** What ticking an item opens: the amount (pre-filled with the plan), where the money comes from, and what it does to the day. */
export function EventPaySheet({
  cycle,
  eventId,
  eventName,
  planned: row,
  targetDate,
  onBack,
  onPaid,
}: {
  cycle: DerivedCycle;
  eventId: string;
  eventName: string;
  planned: PlannedItem;
  /** The log screen's day when it was opened for another day. */
  targetDate?: string;
  onBack: () => void;
  onPaid: () => void;
}) {
  const { item } = row;
  const toast = useToast((s) => s.show);
  const [calc, setCalc] = useState<CalcState>({ ...CALC_INIT, digits: String(item.planned) });
  const [source, setSource] = useState<Source>('daily');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const todayIso = dateOfDay(cycle.startDate, cycle.currentDay);
  const onOtherDay = !!targetDate && targetDate !== todayIso;
  const entries = useDayEntries(cycle.id, cycle.currentDay) ?? [];
  const amount = calcResult(calc);
  const diff = amount - item.planned;
  const effect = payEffect({
    pool: cycle.pool,
    daysLeft: daysLeft(cycle),
    spentToday: spentToday(entries),
    amount,
    fromSavings: source === 'savings',
  });

  async function save() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    const e = await payEventItem(cycle, eventId, item.id, { amount, fromSavings: source === 'savings', date: onOtherDay ? targetDate : undefined });
    setSaving(false);
    if (e) {
      setErr(e);
      return;
    }
    captureEvent('event_item_paid', { from_savings: source === 'savings', over_plan: diff > 0 });
    toast(`${item.name} paid · ${inr(amount)}`);
    onPaid();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-section font-semibold text-ink">Pay for {item.name}</h2>
          <p className="num text-[13px] text-soft">
            {eventName} · planned {inr(item.planned)}
          </p>
        </div>
        <IconButton label="Close" onClick={onBack} className="-mr-3 shrink-0">
          <CloseIcon />
        </IconButton>
      </div>

      <div className="flex flex-col items-center gap-2 py-4">
        <p className="num text-[48px] leading-none text-ink" aria-live="polite">
          <span className="mr-1 text-faint">₹</span>
          {amount ? amount.toLocaleString('en-IN') : '0'}
        </p>
        <p className={`num h-4 text-[12px] ${diff > 0 ? 'text-warm' : 'text-faint'}`}>
          {amount > 0 && diff > 0 ? `${inr(diff)} over plan` : amount > 0 && diff < 0 ? `${inr(-diff)} under plan` : ''}
        </p>
        <div role="tablist" aria-label="Pay from" className="flex w-fit rounded-full bg-tint p-0.5">
          {([['daily', 'Daily budget'], ['savings', 'From savings']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={source === k}
              onClick={() => setSource(k)}
              className={`h-8 min-h-0 rounded-full px-4 text-[12px] font-medium transition-colors ${source === k ? 'bg-ink text-white' : 'text-soft'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="num min-h-[52px] max-w-[300px] text-center text-[13px] text-soft">
          {onOtherDay ? (
            <p>This goes on the day you picked, not today.</p>
          ) : amount <= 0 ? (
            <p>Enter what you paid.</p>
          ) : source === 'savings' ? (
            <p>Your daily amount stays the same. It adds to what you took from savings.</p>
          ) : (
            <>
              <p>
                Today goes to <b className="whitespace-nowrap font-semibold text-ink">{inr(effect.leftToday)}</b>
                {effect.tomorrow != null && (
                  <>
                    . From tomorrow <b className="whitespace-nowrap font-semibold text-ink">{inr(effect.tomorrow)}</b> a day
                  </>
                )}
                .
              </p>
              {(effect.tomorrow ?? effect.leftToday) < 0 && (
                <p className="mt-1 text-warm">That is more than this month has left. Paying from savings keeps your daily amount.</p>
              )}
            </>
          )}
        </div>
      </div>

      <Keypad onKey={(k) => setCalc((c) => calcPress(c, k))} pendingOp={calc.op} opSelected={calc.digits === ''} calc />
      {err && <p className="mt-2 text-center text-[12px] text-warm">{err}</p>}
      <PrimaryButton disabled={saving || amount <= 0} className="mt-3 h-[46px] min-h-0 text-[15px]" onClick={() => void save()}>
        {saving ? 'Saving…' : 'Mark as paid'}
      </PrimaryButton>
      <button type="button" onClick={onBack} className="mt-1 min-h-0 w-full py-2 text-center text-[13px] font-medium text-soft">
        Back to the list
      </button>
    </>
  );
}
