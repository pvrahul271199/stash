'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useSpendCount } from '@/db/queries';

const KEY = 'stash:backup-nudge-until';
const DAY = 24 * 60 * 60 * 1000;
/** Shown once the guest has logged this many spends (i.e. right after the 4th); "Maybe later" asks again after SNOOZE. */
export const NUDGE_AFTER_SPENDS = 4;
const SNOOZE_MS = 3 * DAY;
/** Let the Today screen settle first, so the sheet slides up rather than greeting the user. */
const SHOW_DELAY_MS = 1200;
/** At most once per app session, even if it is dismissed by tapping outside. */
let shownThisSession = false;

export function shouldNudge(isGuest: boolean, spends: number, snoozedUntil: number, now: number): boolean {
  return isGuest && spends >= NUDGE_AFTER_SPENDS && now >= snoozedUntil;
}

function readSnooze(): number {
  try {
    return Number(window.localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

function snooze() {
  try {
    window.localStorage.setItem(KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* it will simply show again next time */
  }
}

/** Bottom sheet (same style as the day peek) reminding guests that their month lives only on this phone. */
export function BackupPrompt({ onCreate }: { onCreate: () => void }) {
  const auth = useAuth();
  const spends = useSpendCount();
  const [open, setOpen] = useState(false);
  const eligible = shouldNudge(auth.status === 'guest', spends, readSnooze(), Date.now());

  useEffect(() => {
    if (!eligible || shownThisSession) return;
    const t = setTimeout(() => {
      shownThisSession = true;
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!open || !eligible) return null;

  function later() {
    snooze();
    setOpen(false);
  }

  return (
    <div className="absolute inset-0 z-[45] flex items-end bg-ink/40" role="presentation" onClick={later}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bp-title"
        className="w-full rounded-t-[24px] bg-white px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <p id="bp-title" className="text-section font-semibold text-ink">
          Keep your month safe
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-soft">
          It is saved only on this phone, so it can be lost if you clear data or lose the phone. A free account backs it up.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
            className="h-[52px] w-full rounded-btn bg-ink text-[16px] font-semibold text-white active:scale-[0.99]"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={later}
            className="h-[48px] w-full rounded-btn text-[15px] font-medium text-soft"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
