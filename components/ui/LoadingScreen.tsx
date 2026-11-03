'use client';

/** Calm loader: the Chelav wordmark writes itself in over a softly breathing circle and a slow ripple.
 *  A message is optional; the app-open loader shows none. */
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? 'Loading Chelav'}
      className="flex h-full flex-col items-center justify-center bg-bg px-6"
    >
      <div className="relative flex h-[240px] w-[240px] items-center justify-center">
        <span aria-hidden="true" className="stash-breathe absolute inset-4 rounded-full bg-tint" />
        <span aria-hidden="true" className="stash-ripple absolute inset-4 rounded-full border border-good/40" />
        <span
          aria-hidden="true"
          className="stash-ripple absolute inset-4 rounded-full border border-good/40"
          style={{ animationDelay: '1.2s' }}
        />
        <p className="relative font-display text-[60px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {Array.from('Chelav').map((ch, i) => (
            <span key={i} aria-hidden="true" className="stash-letter" style={{ animationDelay: `${i * 90}ms` }}>
              {ch}
            </span>
          ))}
        </p>
      </div>
      {message && (
        <p className="mt-2 animate-pulse font-display text-[15px] font-medium tracking-[-0.01em] text-soft motion-reduce:animate-none">
          {message}
        </p>
      )}
    </main>
  );
}
