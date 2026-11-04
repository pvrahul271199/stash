'use client';
import { PrimaryButton, GhostButton } from '../ui/Button';
import { PrivacyNotice } from '../ui/PrivacyNotice';

/** Blocks cloud sync for signed-in users who have not yet accepted the privacy notice. */
export function ConsentScreen({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <main className="absolute inset-0 z-[50] flex flex-col justify-between overflow-y-auto bg-bg px-6 pb-8 pt-10">
      <div>
        <h1 className="text-question font-semibold text-ink">Before we back up your data</h1>
        <p className="mt-1.5 text-[14px] text-soft">Nothing is uploaded until you agree. Your data stays usable on this phone either way.</p>
        <div className="mt-5 rounded-note border border-line bg-white p-4">
          <PrivacyNotice />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-1.5">
        <PrimaryButton onClick={onAccept}>I agree, back up my data</PrimaryButton>
        <GhostButton onClick={onDecline}>Log out instead</GhostButton>
      </div>
    </main>
  );
}
