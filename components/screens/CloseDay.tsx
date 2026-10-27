'use client';
import { BackIcon, IconButton, PrimaryButton } from '../ui/Button';
import { HugeNumber } from '../ui/HugeNumber';
import { removeEntry } from '@/db/queries';
import type { Entry } from '@/db/schema';
import { inr } from '@/lib/format';
import { spentToday } from '@/lib/budget';

export function CloseDay({
  entries,
  onBack,
  onAddMore,
  onClose,
  busy,
}: {
  entries: Entry[];
  onBack: () => void;
  onAddMore: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const spent = spentToday(entries);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Close the day"
      className="absolute inset-0 z-30 flex flex-col bg-white px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      <IconButton label="Back" onClick={onBack} className="-ml-3 self-start">
        <BackIcon />
      </IconButton>
      <div className="flex-1 overflow-y-auto">
        <p className="mt-2 text-[14px] text-soft">Spent today</p>
        <HugeNumber value={spent} size={44} className="mt-1" />

        <ul className="mt-6 divide-y divide-line">
          {entries.length === 0 && <li className="py-3 text-body text-soft">Nothing logged today. That&apos;s fine.</li>}
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {e.label}
                  {e.fromSavings && <span className="ml-2 text-[12px] text-warm">from savings</span>}
                </p>
                <p className="text-[13px] text-faint">
                  {e.subcategory ?? e.category}
                  {e.payment ? ` · ${e.payment}` : ''}
                  {e.event ? ` · ${e.event}` : ''}
                </p>
                {e.note && <p className="mt-0.5 truncate text-[12px] text-soft">{e.note}</p>}
              </div>
              <p className="num text-[18px] text-ink">{inr(e.amount)}</p>
              <button
                aria-label={`Remove ${e.label} ${inr(e.amount)}`}
                onClick={() => removeEntry(e.id)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-faint"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={onAddMore}
          className="mt-4 h-[50px] w-full rounded-btn border border-dashed border-faint text-[15px] font-medium text-soft"
        >
          Paid cash or forgot something?
        </button>
      </div>
      <PrimaryButton onClick={onClose} disabled={busy}>
        Close the day
      </PrimaryButton>
    </div>
  );
}
