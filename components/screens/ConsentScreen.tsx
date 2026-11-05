'use client';
import { PrimaryButton, GhostButton } from '../ui/Button';
import { PrivacyInfo } from '../ui/PrivacyInfo';

/** Blocks cloud sync for signed-in users who have not yet accepted the privacy notice. The full notice is behind the "i". */
export function ConsentScreen({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <main className="absolute inset-0 z-[50] flex flex-col justify-between overflow-y-auto bg-bg px-6 pb-8 pt-10">
      <div>
        <h1 className="text-question font-semibold text-ink">Before we back up your data</h1>
        <div className="mt-2 flex items-start gap-2 text-body text-soft">
          <p>
            We back up your plan and spends to your account so you can use them on other devices. We never sell or share
            them. Nothing is uploaded until you agree, and you can export or delete everything any time.
          </p>
          <PrivacyInfo className="mt-1" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-1.5">
        <PrimaryButton onClick={onAccept}>I agree, back up my data</PrimaryButton>
        <GhostButton onClick={onDecline}>Log out instead</GhostButton>
      </div>
    </main>
  );
}
