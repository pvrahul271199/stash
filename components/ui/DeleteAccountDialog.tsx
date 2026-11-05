'use client';
import { useEffect, useRef, useState } from 'react';
import { deleteAccount, useAuth } from '@/lib/auth';

/** Account erasure. Needs the password again, and says plainly that it cannot be undone. */
export function DeleteAccountDialog({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const google = useAuth().provider === 'google';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  const ready = google ? password.trim().toUpperCase() === 'DELETE' : !!password;

  async function submit() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    const res = await deleteAccount(password);
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.error);
  }

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/40 p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="da-title" aria-describedby="da-body" className="w-full rounded-[24px] bg-white p-6">
        <h2 id="da-title" className="text-section font-semibold text-ink">
          Delete your account?
        </h2>
        <p id="da-body" className="mt-2 text-body text-soft">
          This permanently erases your account and everything in it from the cloud and from every device you used.
          It cannot be undone and the username cannot be recovered. Export a CSV first if you want a copy.
        </p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type={google ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={google ? 'Type DELETE to confirm' : 'Enter your password to confirm'}
            aria-label={google ? 'Type DELETE' : 'Password'}
            autoComplete={google ? 'off' : 'current-password'}
            className="h-12 w-full rounded-key border border-line bg-white px-4 text-[16px] text-ink placeholder:text-faint"
          />
          {error && (
            <p role="alert" className="mt-2 text-[13px] text-warm">
              {error}
            </p>
          )}
        </form>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => void submit()}
            disabled={busy || !ready}
            className="h-[54px] w-full rounded-btn bg-warmBg text-[16px] font-semibold text-warm disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete my account forever'}
          </button>
          <button ref={cancelRef} onClick={onCancel} disabled={busy} className="h-[50px] w-full rounded-btn border border-line text-[16px] font-semibold text-ink">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
