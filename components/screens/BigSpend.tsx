'use client';
import { BackIcon, IconButton, PrimaryButton, SecondaryButton } from '../ui/Button';
import { Note } from '../ui/Chip';
import { inr } from '@/lib/format';

export function BigSpend({
  amount,
  label,
  allowance,
  daysLeft,
  savingsSetAside,
  onBack,
  onSpread,
  onSavings,
}: {
  amount: number;
  label: string;
  allowance: number;
  daysLeft: number;
  savingsSetAside: number;
  onBack: () => void;
  onSpread: () => void;
  onSavings: () => void;
}) {
  const perDay = daysLeft > 1 ? amount / (daysLeft - 1) : amount;
  return (
    <div className="flex h-full flex-col">
      <IconButton label="Back to keypad" onClick={onBack} className="-ml-3 self-start">
        <BackIcon />
      </IconButton>
      <div className="mt-4 flex-1 overflow-y-auto">
        <p className="text-[14px] text-soft">{label}</p>
        <p className="num mt-1 text-big text-ink">
          <span className="text-faint">₹</span>
          {amount.toLocaleString('en-IN')}
        </p>
        <h2 className="mt-6 text-question font-semibold text-ink">That&apos;s a bigger one. How should it count?</h2>
        <p className="mt-2 text-body text-soft">
          Today&apos;s amount is about {inr(allowance)}. Either choice is fine.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Note tone="neutral">
            <strong>Spread it over the month.</strong> Every day ahead adjusts by about {inr(perDay)}.
          </Note>
          <Note tone="good">
            <strong>Take it from savings.</strong> Your daily amount stays the same. You set aside{' '}
            {inr(savingsSetAside)} for savings each month.
          </Note>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={onSpread}>Spread it over the month</PrimaryButton>
        <SecondaryButton onClick={onSavings}>Take it from savings</SecondaryButton>
      </div>
    </div>
  );
}
