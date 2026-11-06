'use client';
import { Logo } from '../ui/Logo';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/Button';

export function Welcome({
  onStart,
  onAccount,
  onSample,
  onDemo,
  signedIn = false,
}: {
  onStart: () => void;
  onAccount: () => void;
  onSample: () => void;
  onDemo: () => void;
  /** Opened from the logo by someone already in: only "how it works" and a way back to the dashboard. */
  signedIn?: boolean;
}) {
  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-14">
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <span className="font-display text-[22px] font-semibold tracking-tight text-[#1E1B4B]">Chelav</span>
        </div>
        <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">
          Know what you can spend today.
        </h1>
        <p className="mt-4 text-body text-soft">
          Tell Chelav what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </p>
      </div>
      {signedIn ? (
        <div className="flex flex-col gap-1">
          <PrimaryButton onClick={onStart}>Back to dashboard</PrimaryButton>
          <SecondaryButton onClick={onDemo} className="mt-2">See how it works</SecondaryButton>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <PrimaryButton onClick={onStart}>Try now</PrimaryButton>
          <SecondaryButton onClick={onDemo} className="mt-2">See how it works</SecondaryButton>
          <div className="h-2" aria-hidden="true" />
          <GhostButton onClick={onAccount}>Sign up or log in with Google</GhostButton>
          <GhostButton onClick={onSample}>Or explore with sample data first</GhostButton>
        </div>
      )}
    </main>
  );
}
