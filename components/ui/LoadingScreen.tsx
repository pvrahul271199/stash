'use client';

/** Calm loader: the Malayalam ച (cha) is drawn in, then the Chelav name fades in, over a softly breathing circle and a slow ripple.
 *  A message is optional; the app-open loader shows none. */
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? 'Loading Chelav'}
      className="relative flex h-full flex-col items-center justify-center bg-bg px-6"
    >
      <div className="relative flex h-[240px] w-[240px] items-center justify-center">
        <span aria-hidden="true" className="stash-breathe absolute inset-4 rounded-full bg-tint" />
        <span aria-hidden="true" className="stash-ripple absolute inset-4 rounded-full border border-good/40" />
        <span
          aria-hidden="true"
          className="stash-ripple absolute inset-4 rounded-full border border-good/40"
          style={{ animationDelay: '1.2s' }}
        />
        <svg viewBox="16 14 66 64" width="64" height="62" aria-hidden="true" className="relative -translate-x-1.5 text-ink">
          <path
            d="M74 22 V70 H24 M32 54 C30 40 40 33 50 36 C62 40 62 58 50 70"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stash-draw"
          />
        </svg>
      </div>
      <p aria-hidden="true" className="stash-letter absolute left-0 right-0 text-center font-display text-[20px] font-semibold tracking-tight text-ink" style={{ animationDelay: '700ms', bottom: 'calc(var(--safe-bottom, 0px) + 48px)' }}>
        Chelav
      </p>
      {message && (
        <p className="mt-2 animate-pulse font-display text-[15px] font-medium tracking-[-0.01em] text-soft motion-reduce:animate-none">
          {message}
        </p>
      )}
    </main>
  );
}
