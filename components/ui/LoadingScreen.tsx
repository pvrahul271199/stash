'use client';

/** Calm, text-only loader shown while the app opens or a returning user's data is restored. */
export function LoadingScreen({ message = 'Restoring your stash…' }: { message?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex h-full flex-col items-center justify-center bg-bg px-6"
    >
      <p className="animate-pulse font-display text-[44px] font-semibold leading-none tracking-[-0.02em] text-ink motion-reduce:animate-none">
        Stash
      </p>
      <p className="mt-3 animate-pulse font-display text-[15px] font-medium tracking-[-0.01em] text-ink motion-reduce:animate-none">
        {message}
      </p>
    </main>
  );
}
