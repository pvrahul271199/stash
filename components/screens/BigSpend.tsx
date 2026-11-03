'use client';
import { PrimaryButton, SecondaryButton } from '../ui/Button';
import { inr } from '@/lib/format';

/** Bottom sheet shown when a spend is bigger than everything still available for the rest of the cycle. */
export function BigSpend({
  amount,
  label,
  left,
  allowance,
  busy,
  onClose,
  onKeep,
  onSpread,
}: {
  amount: number;
  label: string;
  /** Money still available for the rest of the cycle (the pool). */
  left: number;
  /** Today's daily amount. */
  allowance: number;
  busy?: boolean;
  onClose: () => void;
  /** Recommended: log it without touching the daily limit. */
  onKeep: () => void;
  /** Spread it over the remaining days (daily limit drops). */
  onSpread: () => void;
}) {
  const over = Math.max(amount - Math.max(left, 0), 0);
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bigger than what you have left"
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-[24px] bg-white px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <h2 className="text-section font-semibold text-ink">That&apos;s more than you have left</h2>
        <p className="mt-1 text-[14px] text-soft">
          <span className="font-medium text-ink">{label}</span> is <span className="num text-ink">{inr(amount)}</span>, and you have{' '}
          <span className="num text-ink">{inr(Math.max(left, 0))}</span> left for the rest of the month
          {over > 0 ? <> ({inr(over)} over)</> : null}.
        </p>

        <div className="mt-4 rounded-note border border-ink bg-tint/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold text-ink">Log it, keep my daily limit</p>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Recommended</span>
          </div>
          <p className="mt-1 text-[13px] text-soft">
            Your daily amount stays <span className="num font-medium text-ink">{inr(allowance)}</span>. This spend is
            recorded on its own and shows up as taken from savings in your month summary.
          </p>
        </div>

        <p className="mt-3 text-[12px] text-faint">
          Or spread it over the remaining days, which would take your daily amount down to {inr(0)}.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <PrimaryButton disabled={busy} onClick={onKeep}>
            {busy ? 'Saving…' : 'Log it, keep my daily limit'}
          </PrimaryButton>
          <SecondaryButton disabled={busy} onClick={onSpread}>
            Spread it over the remaining days
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
