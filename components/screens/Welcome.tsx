'use client';
import { PrimaryButton, GhostButton } from '../ui/Button';

export function Welcome({
  onStart,
  onSample,
}: {
  onStart: () => void;
  onSample: () => void;
}) {
  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-14">
      <div>
        <p className="mb-6 text-[15px] font-semibold text-good">Stash</p>
        <h1 className="font-display text-[40px] font-semibold leading-[1.1] tracking-tight text-ink">
          Know what you can spend today.
        </h1>
        <p className="mt-4 text-body text-soft">
          Tell Stash what comes in and what goes out once. Every day you get one number: what you can
          still spend. No guilt, no points. Just clarity.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <PrimaryButton onClick={onStart}>Set up my month</PrimaryButton>
        <p className="mb-2 mt-2 text-center text-[14px] text-soft">Takes about a minute</p>
        <GhostButton onClick={onSample}>Or explore with sample data first</GhostButton>
      </div>
    </main>
  );
}
