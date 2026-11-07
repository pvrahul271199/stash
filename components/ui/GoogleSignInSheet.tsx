'use client';
import { useEffect, useRef, useState } from 'react';
import { PrivacyInfo } from './PrivacyInfo';
import { signInWithGoogleToken } from '@/lib/auth';
import { acceptSyncConsent, flushConsentRecord } from '@/lib/consent';
import { googleEnabled } from '@/config/google';
import { renderGoogleButton } from '@/lib/googleSignIn';

const Spinner = ({ className = '' }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin motion-reduce:animate-none ${className}`}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-good">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * "Sign in with Google": the one place people sign up or log in. A small bottom sheet that says, plainly, that Google is the
 * easiest way in and that only the name and email are taken; the official Google button is inside it. Closing it (tap outside,
 * Escape, the X) just returns to the screen underneath. `onSignedIn` fires once Google has signed the person in.
 */
export function GoogleSignInSheet({
  onClose,
  onSignedIn,
}: {
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(!googleEnabled());
  const [error, setError] = useState<string | null>(null);
  const cb = useRef({ onClose, onSignedIn });
  cb.current = { onClose, onSignedIn };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cb.current.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Google's button is drawn exactly once. React's dev mode runs effects twice (mount, unmount, mount); drawing on both made the
  // button flash and re-appear, so a ref makes the second run a no-op while a separate `mounted` ref guards the state updates.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !googleEnabled() || !host.current) return;
    started.current = true;
    renderGoogleButton(host.current, host.current.clientWidth, async (idToken, nonce) => {
      setBusy(true);
      setError(null);
      acceptSyncConsent('google'); // before sign-in so the first sync is not held back by the consent gate
      const res = await signInWithGoogleToken(idToken, nonce);
      if (!mounted.current) return;
      setBusy(false);
      if (res.ok) {
        void flushConsentRecord();
        cb.current.onSignedIn();
      } else setError(res.error);
    })
      .then(() => mounted.current && setReady(true))
      .catch(() => mounted.current && setUnavailable(true)); // offline or blocked
  }, []);

  return (
    <div className="absolute inset-0 z-[55] flex items-end bg-ink/40" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gs-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94%] w-full overflow-y-auto rounded-t-[28px] bg-white px-6 pt-3"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <h2 id="gs-title" className="font-display text-[22px] font-semibold tracking-tight text-ink">
            Sign up or log in with Google
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-full text-faint active:bg-tint"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-[14px] text-soft">The easiest way in is Google. No password to remember.</p>

        <ul className="mt-4 divide-y divide-line rounded-[16px] border border-line">
          {[
            ['Your name', 'So we can say hello properly'],
            ['Your email', 'So you can always get back to your data'],
          ].map(([a, b]) => (
            <li key={a} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5">
                <Check />
              </span>
              <span>
                <span className="block text-[15px] font-medium text-ink">{a}</span>
                <span className="block text-[13px] text-soft">{b}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-[12px] text-faint">That&apos;s all we ask Google for.</p>

        {unavailable ? (
          <p role="status" className="mt-4 rounded-[14px] bg-tint px-4 py-3 text-[13px] leading-snug text-soft">
            Google sign-in isn&apos;t available right now. Check your connection and try again in a moment.
          </p>
        ) : (
          <div className="relative mt-4 min-h-[44px] w-full rounded-full bg-white">
            {/* the button fades in once Google has drawn it, and the placeholder fades out: nothing pops or blinks */}
            <div
              ref={host}
              className={`flex w-full justify-center transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
              aria-label="Continue with Google"
            />
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full border border-line bg-white text-[14px] text-soft transition-opacity duration-300 ${ready ? 'opacity-0' : 'opacity-100'}`}
            >
              <Spinner />
              Loading Google…
            </div>
            {busy && (
              <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-white text-[13px] font-medium text-soft">
                <Spinner />
                Signing in…
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-2 text-center text-[13px] text-warm">
            {error}
          </p>
        )}

        <div className="mt-3 flex items-start justify-center gap-1.5 px-2 text-center text-[11px] leading-snug text-faint">
          <p>By continuing you agree to your plan and spends being backed up to your account.</p>
          <PrivacyInfo />
        </div>
      </div>
    </div>
  );
}
