'use client';
import { Logo } from './Logo';

/** Calm full-screen loader shown while a returning user's data is being restored. */
export function LoadingScreen({ message = 'Restoring your stash…' }: { message?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex h-full flex-col items-center justify-center bg-bg px-6"
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-goodBg opacity-70 motion-reduce:hidden" />
        <span className="absolute inset-0 rounded-full border-[3px] border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-good motion-reduce:animate-none" />
        <Logo size={56} />
      </div>
      <p className="mt-8 animate-pulse text-body text-soft motion-reduce:animate-none">{message}</p>
    </main>
  );
}
