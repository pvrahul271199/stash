'use client';
import { useToast } from '@/store/toast';

/** Always mounted so the live region is announced reliably. */
export function Toast() {
  const { message, tone } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 z-[60] flex justify-center px-4"
      style={{ top: 'calc(var(--safe-top) + 12px)' }}
    >
      {message && (
        <div
          className={`rounded-full px-4 py-2.5 text-[14px] font-medium shadow-lg ${
            tone === 'warm' ? 'bg-warmBg text-warm' : 'bg-ink text-white'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
