'use client';
import { useToast } from '@/store/toast';

/** Always mounted so the live region is announced reliably. Kept small and quiet on purpose. */
export function Toast() {
  const { message, tone } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-6"
      style={{ top: 'calc(var(--safe-top) + 8px)' }}
    >
      {message && (
        <div
          className={`flex max-w-full items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-sm ${
            tone === 'warm' ? 'border-warm/30' : 'border-line'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'warm' ? 'bg-warm' : 'bg-good'}`}
          />
          <span className="truncate">{message}</span>
        </div>
      )}
    </div>
  );
}
