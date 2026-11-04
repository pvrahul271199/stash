'use client';
import { useEffect, useRef, useState } from 'react';
import { unsyncedBeforeLogout } from '@/lib/auth';

/**
 * Log-out choice. On a shared phone the next person could open this app and read the finances left on the
 * device, so removing the local copy is offered up front. Removal first tries a final sync, and warns if
 * changes could not be uploaded (they would be lost once the local copy is gone).
 */
export function LogoutDialog({
  onLogout,
  onCancel,
}: {
  onLogout: (removeLocalData: boolean) => void;
  onCancel: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [unsynced, setUnsynced] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function askRemove() {
    setChecking(true);
    const n = await unsyncedBeforeLogout();
    setChecking(false);
    if (n === 0) onLogout(true);
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
            ? 'Your data stays safe in your account. If other people use this phone, also remove your data from it: you get it all back when you log in again.'
            : 'They could not be uploaded (you may be offline). If you remove your data from this phone now, they are lost.'}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {unsynced == null ? (
            <>
              <button onClick={() => onLogout(false)} className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm">
                Log out
              </button>
              <button
                onClick={askRemove}
                disabled={checking}
                className="h-[50px] w-full rounded-btn border border-line text-[16px] font-semibold text-ink disabled:opacity-60"
              >
                {checking ? 'Syncing first…' : 'Log out and remove my data from this phone'}
              </button>
            </>
          ) : (
            <button onClick={() => onLogout(true)} className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm">
              Remove anyway
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
