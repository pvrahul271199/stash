'use client';
import { useEffect, useRef, useState } from 'react';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { num } from '@/lib/format';
import type { PlanInput } from '@/lib/budget';

type Draft = { income: number; bills: number; savings: number; monthLength: number };

const STEPS = [
  { key: 'income', q: 'What lands in your account each month?', help: 'Your take-home salary, after tax.' },
  { key: 'bills', q: 'What goes out no matter what?', help: 'Rent, EMIs, phone, internet, school fees. Add them up roughly.' },
  { key: 'savings', q: 'What do you put away first?', help: 'SIPs, RD, emergency fund, insurance. Saving comes before spending here.' },
  { key: 'monthLength', q: 'How many days until your next salary?', help: 'Between 1 and 31.' },
] as const;

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
  });
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const s = STEPS[step];

  useEffect(() => {
    const prefill = initial?.[s.key];
    setRaw(prefill != null && prefill > 0 ? String(prefill) : step === 3 ? '30' : '');
    setError(null);
    ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function next() {
    const err = validate(step, draft, raw);
    if (err) return setError(err);
    const nd = { ...draft, [s.key]: Number(raw) } as Draft;
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
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} aria-label="Setup progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      <div className="mt-10 flex-1">
        <h1 className="font-sans text-question font-semibold text-ink">{s.q}</h1>
        <p className="mt-2 text-body text-soft">{s.help}</p>

        <label className="mt-10 flex items-baseline gap-2 border-b-2 border-ink pb-2">
          {step < 3 && <span className="num text-[44px] text-faint" aria-hidden="true">₹</span>}
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
        <p id="err" role="alert" className="mt-3 min-h-[22px] text-[14px] text-warm">
          {error}
        </p>
      </div>

      <PrimaryButton onClick={next}>{step === 3 ? 'See my plan' : 'Continue'}</PrimaryButton>
    </main>
  );
}
