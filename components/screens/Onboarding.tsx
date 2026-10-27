'use client';
import { useEffect, useRef, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { inr, num } from '@/lib/format';
import { sumItems, type PlanInput, type PlanItem } from '@/lib/budget';

type Draft = PlanInput;

const STEPS = [
  { key: 'income', q: 'What lands in your account each month?', help: 'Your take-home salary, after tax.' },
  {
    key: 'bills',
    q: 'What goes out no matter what?',
    help: 'Rent, EMIs, phone, internet, school fees. Enter a total or add them item by item below.',
  },
  {
    key: 'savings',
    q: 'What do you put away first?',
    help: 'SIPs, RD, emergency fund, insurance. Enter a total or add them item by item below.',
  },
  { key: 'monthLength', q: 'How many days until your next salary?', help: 'Between 1 and 31.' },
] as const;

const BILL_SUGGESTIONS = ['Rent', 'Health EMI', 'Loan EMI', 'Phone & Wi-Fi', 'Electricity'];
const SAVING_SUGGESTIONS = ['SIP', 'Emergency fund', 'RD / FD', 'Health insurance'];

function validate(step: number, d: Draft, raw: string): string | null {
  const v = raw === '' ? NaN : Number(raw);
  if (Number.isNaN(v)) return step === 1 || step === 2 ? 'Enter a number. 0 is fine.' : 'Enter a number first.';
  if (step === 0 && v <= 0) return 'This needs to be more than 0.';
  if (step === 1 && v >= d.income) return `Bills need to be less than your income (₹${num(d.income)}).`;
  if (step === 2 && d.bills + v >= d.income)
    return `Bills and savings together need to be less than your income. You have ₹${num(d.income - d.bills)} after bills.`;
  if (step === 3 && (v < 1 || v > 31 || !Number.isInteger(v))) return 'Pick a number from 1 to 31.';
  return null;
}

export function Onboarding({
  initial,
  onDone,
  onExit,
}: {
  initial?: Partial<Draft>;
  onDone: (p: PlanInput) => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    income: initial?.income ?? 0,
    bills: initial?.bills ?? 0,
    savings: initial?.savings ?? 0,
    monthLength: initial?.monthLength ?? 30,
    billItems: initial?.billItems ?? [],
    savingsItems: initial?.savingsItems ?? [],
  });
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemAmt, setItemAmt] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  const s = STEPS[step];

  const isItemStep = step === 1 || step === 2;
  const currentItems: PlanItem[] = step === 1 ? (draft.billItems ?? []) : step === 2 ? (draft.savingsItems ?? []) : [];
  const suggestions = step === 1 ? BILL_SUGGESTIONS : SAVING_SUGGESTIONS;

  useEffect(() => {
    const val = draft[s.key] ?? initial?.[s.key];
    const items = step === 1 ? draft.billItems : step === 2 ? draft.savingsItems : undefined;
    if (items && items.length > 0) {
      setRaw(String(sumItems(items)));
    } else {
      setRaw(val != null && val > 0 ? String(val) : step === 3 ? String(draft.monthLength || 30) : '');
    }
    setItemName('');
    setItemAmt('');
    setError(null);
    ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function addItem() {
    const name = itemName.trim();
    const amt = Number(itemAmt);
    if (!name) {
      setError('Give the item a name (e.g. Health EMI).');
      return;
    }
    if (!amt || amt <= 0) {
      setError('Enter an amount for this item.');
      return;
    }
    const nextItems = [...currentItems, { name, amount: Math.round(amt) }];
    const total = sumItems(nextItems);
    setDraft((d) =>
      step === 1
        ? { ...d, billItems: nextItems, bills: total }
        : { ...d, savingsItems: nextItems, savings: total },
    );
    setRaw(String(total));
    setItemName('');
    setItemAmt('');
    setError(null);
  }

  function removeItem(idx: number) {
    const nextItems = currentItems.filter((_, i) => i !== idx);
    const total = sumItems(nextItems);
    setDraft((d) =>
      step === 1
        ? { ...d, billItems: nextItems, bills: total }
        : { ...d, savingsItems: nextItems, savings: total },
    );
    setRaw(nextItems.length > 0 ? String(total) : '0');
    setError(null);
  }

  function next() {
    // If user typed an item name + amount and hit Continue without tapping Add, include it automatically
    let effectiveRaw = raw;
    let updatedDraft = draft;
    if (isItemStep && itemName.trim() && Number(itemAmt) > 0) {
      const nextItems = [...currentItems, { name: itemName.trim(), amount: Math.round(Number(itemAmt)) }];
      const total = sumItems(nextItems);
      effectiveRaw = String(total);
      updatedDraft =
        step === 1
          ? { ...draft, billItems: nextItems, bills: total }
          : { ...draft, savingsItems: nextItems, savings: total };
      setItemName('');
      setItemAmt('');
    }
    const err = validate(step, updatedDraft, effectiveRaw);
    if (err) return setError(err);
    const nd = { ...updatedDraft, [s.key]: Number(effectiveRaw) } as Draft;
    setDraft(nd);
    if (step === 3) onDone(nd);
    else setStep(step + 1);
  }

  function back() {
    if (step === 0) onExit();
    else setStep(step - 1);
  }

  return (
    <main className="flex h-full flex-col px-6 pb-6 pt-4">
      <div className="flex items-center gap-3">
        <IconButton label="Back" onClick={back} className="-ml-3">
          <BackIcon />
        </IconButton>
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={step + 1}
          aria-label="Setup progress"
        >
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto pb-4">
        <h1 className="font-sans text-question font-semibold text-ink">{s.q}</h1>
        <p className="mt-2 text-body text-soft">{s.help}</p>

        <label className="mt-6 flex items-baseline gap-2 border-b-2 border-ink pb-2">
          {step < 3 && (
            <span className="num text-[44px] text-faint" aria-hidden="true">
              ₹
            </span>
          )}
          <span className="sr-only">{s.q}</span>
          <input
            ref={ref}
            value={raw === '' ? '' : step < 3 ? num(Number(raw)) : raw}
            onChange={(e) => {
              setRaw(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9));
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && next()}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={step < 3 ? '0' : '30'}
            className="num w-full bg-transparent text-big text-ink outline-none placeholder:text-faint"
            aria-invalid={!!error}
            aria-describedby="err"
          />
        </label>
        <p id="err" role="alert" className="mt-2 min-h-[22px] text-[14px] text-warm">
          {error}
        </p>

        {isItemStep && (
          <div className="mt-3 rounded-note border border-line bg-tint/50 p-3.5">
            <p className="text-[13px] font-semibold text-ink">
              {step === 1 ? 'Or log item-wise (EMIs, rent, bills)' : 'Or log item-wise (SIP, RD, insurance)'}
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setItemName(sug);
                    amtRef.current?.focus();
                  }}
                  className={`min-h-[30px] rounded-full border px-2.5 text-[12px] font-medium ${
                    itemName === sug ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
                  }`}
                >
                  + {sug}
                </button>
              ))}
            </div>

            <div className="mt-2.5 flex gap-2">
              <input
                value={itemName}
                onChange={(e) => {
                  setItemName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                placeholder={step === 1 ? 'e.g. Health EMI' : 'e.g. Mutual fund SIP'}
                aria-label="Item name"
                maxLength={32}
                className="h-10 min-w-0 flex-1 rounded-key border border-line bg-white px-3 text-[14px] text-ink placeholder:text-faint"
              />
              <input
                ref={amtRef}
                value={itemAmt === '' ? '' : num(Number(itemAmt))}
                onChange={(e) => {
                  setItemAmt(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 8));
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="₹ Amount"
                aria-label="Item amount"
                className="num h-10 w-28 rounded-key border border-line bg-white px-3 text-[14px] text-ink placeholder:text-faint"
              />
              <button
                type="button"
                onClick={addItem}
                className="h-10 shrink-0 rounded-key bg-ink px-3.5 text-[13px] font-semibold text-white"
              >
                Add
              </button>
            </div>

            {currentItems.length > 0 && (
              <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
                {currentItems.map((it, idx) => (
                  <li key={`${it.name}-${idx}`} className="flex items-center justify-between py-2 text-[14px]">
                    <span className="font-medium text-ink">{it.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="num text-ink">{inr(it.amount)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${it.name}`}
                        onClick={() => removeItem(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-faint hover:text-warm"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <PrimaryButton onClick={next}>{step === 3 ? 'See my plan' : 'Continue'}</PrimaryButton>
    </main>
  );
}
