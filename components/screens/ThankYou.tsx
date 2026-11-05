'use client';
import { Logo } from '../ui/Logo';
import { PrimaryButton } from '../ui/Button';

/** Shown once after "Delete my account" finishes. */
export function ThankYou({ onDone }: { onDone: () => void }) {
  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-16">
      <div className="flex flex-col items-center text-center">
        <Logo size={52} />
        <h1 className="mt-8 font-display text-[32px] font-semibold leading-[1.15] tracking-tight text-ink">
          Thank you for being a part of Chelav
        </h1>
        <p className="mt-4 max-w-[300px] text-body text-soft">
          Your account and everything in it have been erased. We hope it helped, even a little. Your next month is
          always a fresh start.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <PrimaryButton onClick={onDone}>Done</PrimaryButton>
        <p className="text-[12px] text-faint">Made with care in India</p>
      </div>
    </main>
  );
}
