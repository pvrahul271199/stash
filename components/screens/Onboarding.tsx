'use client';
import { useEffect, useRef, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { inr, num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';
import { sumItems, type PlanInput, type PlanItem } from '@/lib/budget';
import { periodFor } from '@/lib/period';
import { daysBetween, formatLong, todayISO } from '@/lib/dates';
import { DatePicker } from '../ui/DatePicker';
import posthog from 'posthog-js';

const BILL_SUGGESTIONS = ['Rent', 'Health EMI', 'Loan EMI', 'Phone & Wi-Fi', 'Electricity'];
const SAVING_SUGGESTIONS = ['SIP', 'Emergency fund', 'RD / FD', 'Health insurance'];

const digits = (v: string, max: number) => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, max);

/** One optional money field (bills or savings): a total, or item by item. */
function OptionalAmount({
  title,
  help,
  suggestions,
  raw,
  onRaw,
  items,
  onItems,
  onPending,
}: {
  title: string;
  help: string;
  suggestions: string[];
  raw: string;
  onRaw: (v: string) => void;
  items: PlanItem[];
  onItems: (items: PlanItem[]) => void;
  onPending: (pending: boolean) => void;
}) {
  const { currency } = useCurrency();
  const [open, setOpen] = useState(items.length > 0);
  const [name, setName] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const itemised = items.length > 0;

  function report(n: string, a: string) {
    onPending(n.trim() !== '' || a !== '');
  }

  function add() {
    const amount = Number(amt);
    if (!name.trim()) return setErr('Give the item a name.');
    if (!amount || amount <= 0) return setErr('Enter an amount for this item.');
    onItems([...items, { name: name.trim(), amount: Math.round(amount) }]);
    setName('');
    setAmt('');
    setErr(null);
    report('', '');
    nameRef.current?.focus(); // ready for the next one
  }

  return (
    <section className="mt-3 min-w-0 rounded-note border border-line bg-white px-3.5 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold leading-tight text-ink">
            {title} <span className="text-[10px] font-normal text-faint">(optional)</span>
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-soft">{help}</p>
        </div>
        <label className="flex h-9 w-[104px] shrink-0 items-center gap-1 border-b border-line px-1 focus-within:border-ink">
          <span className="num text-[14px] text-faint" aria-hidden="true">
            {currency.symbol}
          </span>
          <span className="sr-only">{title} total</span>
          <input
            value={raw === '' ? '' : num(Number(raw))}
            onChange={(e) => onRaw(digits(e.target.value, 9))}
            readOnly={itemised}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            className="num w-full min-w-0 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-faint read-only:text-soft"
          />
        </label>
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="mt-3 inline-flex min-h-[30px] items-center gap-1 rounded-full border border-line px-3 text-[12px] font-medium text-ink active:bg-tint"
        >
          {itemised ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9a2.1 2.1 0 0 0-4-4L4 16v4z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
              {`${items.length} item${items.length === 1 ? '' : 's'}`}
              <span className="sr-only"> , edit</span>
            </>
          ) : (
            <>
              <span aria-hidden="true">+</span> Add item by item
            </>
          )}
        </button>
      )}

      {open && (
        <div className="mt-3 min-w-0 border-t border-line pt-3">
          {itemised && (
            <div className="mb-3">
              <ul className="flex flex-col gap-1.5">
                {items.map((it, idx) => (
                  <li
                    key={`${it.name}-${idx}`}
                    className="flex min-w-0 items-center gap-2 rounded-key border border-[#EDEBF9] bg-tint py-1.5 pl-3 pr-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{it.name}</span>
                    <span className="num shrink-0 text-[14px] text-ink">{inr(it.amount)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${it.name}`}
                      onClick={() => onItems(items.filter((_, i) => i !== idx))}
                      className="flex h-6 w-6 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-full text-[16px] leading-none text-faint active:bg-white hover:text-warm"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-line px-3 pt-2 text-[13px] font-semibold text-ink">
                <span>Total</span>
                <span className="num">{inr(sumItems(items))}</span>
              </div>
            </div>
          )}

          {suggestions.some((sug) => !items.some((it) => it.name === sug)) && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {suggestions
                .filter((sug) => !items.some((it) => it.name === sug))
                .map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setName(sug);
                      report(sug, amt);
                      amtRef.current?.focus();
                    }}
                    className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                      name === sug ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                    }`}
                  >
                    {sug}
                  </button>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={nameRef}
              name="plan-item-label"
              autoComplete="off" autoCorrect="off" spellCheck={false} 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                report(e.target.value, amt);
                setErr(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && (amt ? add() : amtRef.current?.focus())}
              placeholder="Name"
              aria-label="Item name"
              maxLength={32}
              className="[&:-webkit-autofill]:shadow-[inset_0_0_0_100px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#1E1B4B] h-10 min-w-0 flex-1 rounded-key border border-line bg-white px-2.5 text-[13px] text-ink placeholder:text-faint"
            />
            <input
              ref={amtRef}
              name="plan-item-value"
              autoComplete="off" autoCorrect="off" spellCheck={false} 
              value={amt === '' ? '' : num(Number(amt))}
              onChange={(e) => {
                const v = digits(e.target.value, 8);
                setAmt(v);
                report(name, v);
                setErr(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={`${currency.symbol} Amt`}
              aria-label="Item amount"
              className="[&:-webkit-autofill]:shadow-[inset_0_0_0_100px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#1E1B4B] num h-10 w-24 min-w-0 shrink-0 rounded-key border border-line bg-white px-2.5 text-[13px] text-ink placeholder:text-faint"
            />
          </div>
          {err && (
            <p role="alert" className="mt-1.5 text-[13px] text-warm">
              {err}
            </p>
          )}
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={add}
              className="h-10 flex-1 rounded-key bg-ink text-[14px] font-semibold text-white"
            >
              Add item
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-key px-4 text-[14px] font-medium text-soft"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Whole setup on one page. Only income is required; bills and savings default to 0 and can be added later. */
export function Onboarding({
  initial,
  onDone,
  onExit,
  startDate,
  onStartDateChange,
}: {
  initial?: Partial<PlanInput>;
  onDone: (p: PlanInput) => void;
  onExit: () => void;
  /** New plans only: the day tracking starts on (the 1st of this month by default, up to today). Omitted when editing a plan. */
  startDate?: string;
  onStartDateChange?: (iso: string) => void;
}) {
  const { currency } = useCurrency();
  const start = (n?: number) => (n != null && n > 0 ? String(n) : '');
  const [income, setIncome] = useState(start(initial?.income));
  const [billsRaw, setBillsRaw] = useState(start(initial?.bills));
  const [savingsRaw, setSavingsRaw] = useState(start(initial?.savings));
  const [billItems, setBillItems] = useState<PlanItem[]>(initial?.billItems ?? []);
  const [savingsItems, setSavingsItems] = useState<PlanItem[]>(initial?.savingsItems ?? []);
  const [pending, setPending] = useState({ bills: false, savings: false });
  const [pickingDate, setPickingDate] = useState(false);
  useEffect(() => {
    if (!pickingDate) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickingDate(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickingDate]);
  const [error, setError] = useState<string | null>(null);

  const inc = Number(income) || 0;
  const bills = billItems.length > 0 ? sumItems(billItems) : Number(billsRaw) || 0;
  const savings = savingsItems.length > 0 ? sumItems(savingsItems) : Number(savingsRaw) || 0;
  // Months are calendar months (start day 1). An existing plan keeps whatever start day it already has.
  const monthStartDay = initial?.periodStartDay ?? 1;
  const from = startDate ?? todayISO();
  const month = periodFor(monthStartDay, from);
  const monthLength = month.totalDays;
  const toLive = inc - bills - savings;
  const perDay = inc > 0 && toLive > 0 ? Math.floor(toLive / (daysBetween(from, month.end) + 1)) : null;
  const firstOfMonth = periodFor(1, todayISO()).start;

  function submit() {
    if (inc <= 0) return setError('Add your monthly income first.');
    if (pending.bills || pending.savings)
      return setError('You have an item typed but not added. Tap Add, or clear it.');
    if (bills >= inc) return setError(`Bills need to be less than your income (${inr(inc)}).`);
    if (bills + savings >= inc)
      return setError(`Bills and savings together need to be less than your income. You have ${inr(inc - bills)} after bills.`);
    posthog.capture('onboarding_plan_submitted', { has_bill_items: billItems.length > 0, has_savings_items: savingsItems.length > 0, backdated: from < todayISO() });
    onDone({ income: inc, bills, savings, monthLength, periodStartDay: monthStartDay, billItems, savingsItems });
  }

  return (
    <main className="relative flex h-full flex-col px-6 pb-6 pt-4">
      <div className="flex items-center gap-3">
        <IconButton label="Back" onClick={onExit} className="-ml-3">
          <BackIcon />
        </IconButton>
      </div>

      <div className="mt-3 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-4">
        <h1 className="font-sans text-[22px] font-semibold leading-snug text-ink">What lands in your account each month?</h1>
        <p className="mt-1.5 text-[14px] text-soft">Your take-home salary, after tax. That is all we need to start.</p>

        <label className="mt-4 flex min-w-0 items-baseline gap-2 border-b-2 border-ink pb-1.5">
          <span className="num text-[34px] text-faint" aria-hidden="true">
            {currency.symbol}
          </span>
          <span className="sr-only">Monthly income</span>
          <input
            autoFocus
            value={income === '' ? '' : num(Number(income))}
            onChange={(e) => {
              setIncome(digits(e.target.value, 9));
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            className="num w-full min-w-0 bg-transparent text-[34px] leading-tight text-ink outline-none placeholder:text-faint"
            aria-invalid={!!error}
            aria-describedby="err"
          />
        </label>

        <p className="mt-2 min-h-[44px] text-[14px] leading-snug text-soft" aria-live="polite">
          {perDay != null ? (
            <>
              About <span className="num font-semibold text-ink">{inr(perDay)}</span> a day to spend
              {bills + savings === 0 ? ' so far. Add bills and savings below to sharpen it.' : '.'}
            </>
          ) : null}
        </p>

        <div className="mt-4" />

        <OptionalAmount
          title="Bills you can't skip"
          help="Rent, EMIs, phone, internet, school fees."
          suggestions={BILL_SUGGESTIONS}
          raw={billsRaw}
          onRaw={(v) => {
            setBillsRaw(v);
            setError(null);
          }}
          items={billItems}
          onItems={(items) => {
            setBillItems(items);
            setBillsRaw(items.length ? String(sumItems(items)) : '');
            setError(null);
          }}
          onPending={(p) => setPending((s) => ({ ...s, bills: p }))}
        />

        <OptionalAmount
          title="What you put away first"
          help="SIPs, RD, emergency fund, insurance."
          suggestions={SAVING_SUGGESTIONS}
          raw={savingsRaw}
          onRaw={(v) => {
            setSavingsRaw(v);
            setError(null);
          }}
          items={savingsItems}
          onItems={(items) => {
            setSavingsItems(items);
            setSavingsRaw(items.length ? String(sumItems(items)) : '');
            setError(null);
          }}
          onPending={(p) => setPending((s) => ({ ...s, savings: p }))}
        />

        {startDate && onStartDateChange && (
          <section className="mt-3 rounded-note border border-line bg-white" aria-label="Start date">
            <button
              type="button"
              onClick={() => setPickingDate(true)}
              aria-haspopup="dialog"
              className="flex min-h-0 w-full items-center justify-between gap-3 px-3.5 py-3.5 text-left"
            >
              <span>
                <span className="block text-[13px] font-semibold text-ink">Start tracking from</span>
                <span className="mt-0.5 block text-[12px] text-soft">
                  {startDate === todayISO() ? 'Today, ' : ''}
                  {formatLong(startDate)}
                </span>
              </span>
              <span className="rounded-full bg-tint px-3 py-1.5 text-[12px] font-semibold text-ink">Change</span>
            </button>
          </section>
        )}

        <p id="err" role="alert" className="mt-3 min-h-[22px] text-[14px] text-warm">
          {error}
        </p>
      </div>

      <PrimaryButton onClick={submit}>See my plan</PrimaryButton>

      {pickingDate && startDate && onStartDateChange && (
        <div className="absolute inset-0 z-[45] flex items-end bg-ink/40" role="presentation" onClick={() => setPickingDate(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose start date"
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-[24px] bg-white px-5 pt-3"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-section font-semibold text-ink">Start tracking from</h2>
                <p className="mt-0.5 text-[13px] text-soft">Pick today, or an earlier day of this month.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPickingDate(false)}
                className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full bg-tint text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-3">
              <DatePicker
                bare
                label="Start date"
                value={startDate}
                min={firstOfMonth}
                max={todayISO()}
                onChange={(iso) => {
                  onStartDateChange(iso);
                  setPickingDate(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
