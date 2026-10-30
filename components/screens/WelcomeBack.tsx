'use client';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import type { PendingCatchUp } from '@/db/queries';
import { dateOfDay, formatShort } from '@/lib/dates';
import { inr, num } from '@/lib/format';
import { useCurrency } from '@/lib/currency';

export function describeGap(p: Pick<PendingCatchUp, 'gap' | 'startDate'>, today: string): string {
  const n = p.gap.to - p.gap.from + 1;
  const a = dateOfDay(p.startDate, p.gap.from);
  const b = dateOfDay(p.startDate, p.gap.to);
  if (n === 1) {
    const yesterday = dateOfDay(p.startDate, p.gap.to);
    void today;
    return `${formatShort(yesterday)} didn't get logged.`;
  }
  return `The last ${n} days didn't get logged (${formatShort(a)} to ${formatShort(b)}).`;
}

export function WelcomeBack({
  pending,
  today,
  onSubmit,
}: {
  pending: PendingCatchUp;
  today: string;
  onSubmit: (total: number) => void;
}) {
  const { currency } = useCurrency();
  const [raw, setRaw] = useState('');
  const n = pending.gap.to - pending.gap.from + 1;
  const yesterday = dateOfDay(pending.startDate, pending.gap.to);
  const text =
    n === 1
      ? `${yesterday === dayBefore(today) ? 'Yesterday' : formatShort(yesterday)} didn't get logged (${formatShort(yesterday)}).`
      : describeGap(pending, today);

  return (
    <main className="flex h-full flex-col px-6 pb-6 pt-14">
      <div className="flex-1 overflow-y-auto">
        <p className="text-[15px] font-semibold text-good">Welcome back</p>
        <h1 className="mt-2 text-question font-semibold text-ink">{text}</h1>
        <p className="mt-3 text-body text-soft">Roughly how much did you spend? A guess is fine, or enter 0.</p>
        <label className="mt-8 flex items-baseline gap-2 border-b-2 border-ink pb-2">
          <span className="num text-[44px] text-faint" aria-hidden="true">{currency.symbol}</span>
          <span className="sr-only">Rough total spent</span>
          <input
            value={raw === '' ? '' : num(Number(raw))}
            onChange={(e) => setRaw(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7))}
            onKeyDown={(e) => e.key === 'Enter' && raw !== '' && onSubmit(Number(raw))}
            inputMode="numeric"
            placeholder={num(pending.onPlan)}
            className="num w-full bg-transparent text-big text-ink outline-none placeholder:text-faint"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <PrimaryButton disabled={raw === ''} onClick={() => onSubmit(Number(raw))}>
          Use my estimate
        </PrimaryButton>
        <SecondaryButton onClick={() => onSubmit(pending.onPlan)}>
          I stayed about on plan ({inr(pending.onPlan)})
        </SecondaryButton>
      </div>
    </main>
  );
}

function dayBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
