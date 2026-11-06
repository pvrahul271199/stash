'use client';
import { useEffect, useRef, useState } from 'react';
import { unsyncedBeforeLogout } from '@/lib/auth';

/**
 * Log-out confirmation. Logging out always removes this account's data from the phone (it lives in the account and
 * comes back on the next login), so nobody who picks the phone up next can read it. A last sync runs first; if some
 * changes could not be uploaded (offline, rejected) the user is told they would be lost and must confirm.
 */
export function LogoutDialog({ onLogout, onCancel }: { onLogout: () => void; onCancel: () => void }) {
  const [checking, setChecking] = useState(false);
  const [unsynced, setUnsynced] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function confirm() {
    setChecking(true);
    const n = await unsyncedBeforeLogout();
    setChecking(false);
    if (n === 0) onLogout();
    else setUnsynced(n);
  }

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/40 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="lo-title" aria-describedby="lo-body" className="w-full rounded-[24px] bg-white p-6">
        <h2 id="lo-title" className="text-section font-semibold text-ink">
          {unsynced == null ? 'Log out?' : `${unsynced} ${unsynced === 1 ? 'change has' : 'changes have'} not synced`}
        </h2>
        <p id="lo-body" className="mt-2 text-body text-soft">
          {unsynced == null
            ? 'Your data stays safe in your account and comes back when you log in again. It is removed from this phone.'
            : 'They could not be uploaded (you may be offline). If you log out now, they are lost.'}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {unsynced == null ? (
            <button
              onClick={confirm}
              disabled={checking}
              className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm disabled:opacity-60"
            >
              {checking ? 'Syncing first…' : 'Log out'}
            </button>
          ) : (
            <button onClick={onLogout} className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm">
              Log out anyway
            </button>
          )}
          <button ref={cancelRef} onClick={onCancel} className="h-[50px] w-full rounded-btn border border-line text-[16px] font-semibold text-ink">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
