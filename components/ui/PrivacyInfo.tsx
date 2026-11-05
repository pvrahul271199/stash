'use client';
import { useState } from 'react';
import { BottomPrompt } from './BottomPrompt';
import { PrivacyNotice } from './PrivacyNotice';

/** A small "i" button; the full privacy notice only appears (as a bottom prompt) when it is tapped. */
export function PrivacyInfo({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How your data is used"
        title="How your data is used"
        className={`inline-flex h-5 w-5 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-full border border-line align-middle text-[11px] font-semibold italic leading-none text-soft ${className}`}
      >
        i
      </button>
      {open && (
        <BottomPrompt
          title="How your data is used"
          body={<PrivacyNotice />}
          actionLabel="Got it"
          onAction={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
