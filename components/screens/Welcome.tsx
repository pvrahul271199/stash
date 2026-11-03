'use client';
import { Logo } from '../ui/Logo';
import { PrimaryButton, SecondaryButton, GhostButton } from '../ui/Button';

export function Welcome({
  onStart,
  onAccount,
  onSample,
  onDemo,
}: {
  onStart: () => void;
  onAccount: () => void;
  onSample: () => void;
  onDemo: () => void;
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
      <div className="flex flex-col gap-1">
        <SecondaryButton onClick={onDemo}>See how it works</SecondaryButton>
        <PrimaryButton onClick={onStart} className="mt-2">Try without an account</PrimaryButton>
        <p className="mb-2 mt-2 text-center text-[14px] text-soft">Takes about a minute</p>
        <GhostButton onClick={onAccount}>Sign up or log in</GhostButton>
        <GhostButton onClick={onSample}>Or explore with sample data first</GhostButton>
      </div>
    </main>
  );
}
