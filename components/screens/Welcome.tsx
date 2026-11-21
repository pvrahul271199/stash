'use client';
import { Logo } from '../ui/Logo';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/Button';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.5z" />
      <path fill="#34A853" d="M12 22.5c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10.5 10.5 0 0 0 12 22.5z" />
      <path fill="#FBBC05" d="M6.2 14.1a6.3 6.3 0 0 1 0-4.2V7.2H2.7a10.5 10.5 0 0 0 0 9.6z" />
      <path fill="#EA4335" d="M12 5.7c1.5 0 2.9.5 4 1.6l3-3A10.5 10.5 0 0 0 2.7 7.2l3.5 2.7C7 7.5 9.3 5.7 12 5.7z" />
    </svg>
  );
}

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
        <h2 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">
          Know what you can spend today.
        </h2>
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
          <SecondaryButton onClick={onAccount} className="mt-2 flex items-center justify-center gap-2.5">
            <GoogleG />
            Sign up or log in with Google
          </SecondaryButton>
          <div className="h-2" aria-hidden="true" />
          <GhostButton onClick={onSample}>Or explore with sample data first</GhostButton>
          <GhostButton onClick={onDemo}>See how it works</GhostButton>
        </div>
      )}
    </main>
  );
}
