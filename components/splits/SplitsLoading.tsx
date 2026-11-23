'use client';
import { useEffect, useState } from 'react';

/**
 * Splits loading screen: the app's own calm loader (breathing circle, slow ripples) with two coins passing each other in the
 * middle, since that is what Splits does. Coins hold still for people who prefer reduced motion.
 */
export function SplitsLoading({ message = 'Loading your groups…' }: { message?: string }) {
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false); }, []);
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={message} className="flex h-full flex-col items-center justify-center">
      <div className="relative flex h-[220px] w-[220px] items-center justify-center">
        <span aria-hidden="true" className="stash-breathe absolute inset-4 rounded-full bg-tint" />
        <span aria-hidden="true" className="stash-ripple absolute inset-4 rounded-full border border-good/40" />
        <span aria-hidden="true" className="stash-ripple absolute inset-4 rounded-full border border-good/40" style={{ animationDelay: '1.2s' }} />
        <svg width="90" height="50" viewBox="0 0 90 50" aria-hidden="true" className="relative">
          <circle cx={still ? 30 : 18} cy="25" r="12" fill="#1E1B4B">
            {!still && <animate attributeName="cx" values="18;72;18" dur="1.6s" repeatCount="indefinite" />}
            {!still && <animate attributeName="cy" values="25;18;25" dur="1.6s" repeatCount="indefinite" />}
          </circle>
          <circle cx={still ? 60 : 72} cy="25" r="12" fill="none" stroke="#1E1B4B" strokeWidth="2.5">
            {!still && <animate attributeName="cx" values="72;18;72" dur="1.6s" repeatCount="indefinite" />}
            {!still && <animate attributeName="cy" values="25;32;25" dur="1.6s" repeatCount="indefinite" />}
          </circle>
        </svg>
      </div>
      <p className="font-display animate-pulse text-[15px] font-medium tracking-[-0.01em] text-soft motion-reduce:animate-none">{message}</p>
    </div>
  );
}
