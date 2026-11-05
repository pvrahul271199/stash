'use client';
import { useEffect, useRef, useState } from 'react';
import { BackIcon, GhostButton, IconButton, PrimaryButton } from '../ui/Button';
import { getAuth, logIn, signInWithGoogleToken, signUp, validateUsername } from '@/lib/auth';
import { googleEnabled } from '@/config/google';
import { renderGoogleButton } from '@/lib/googleSignIn';
import { acceptSyncConsent, flushConsentRecord } from '@/lib/consent';
import { PrivacyInfo } from '../ui/PrivacyInfo';
import { LegalLinks } from '../legal/LegalLinks';

export function AuthScreen({
  initialMode = 'login',
  onBack,
  onDone,
}: {
  initialMode?: 'signup' | 'login';
  onBack: () => void;
  onDone: (mode: 'signup' | 'login', username: string) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = username.trim().toLowerCase();
  const userHint = name ? validateUsername(name) : null;

  // Agreement is the tap on Create account / Log in / the Google button, with "By continuing you agree..." and the
  // "i" (full notice) directly above them.
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = mode === 'signup' ? await signUp(name, password) : await logIn(name, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    acceptSyncConsent(mode); // local flag after the account exists, i.e. before the first sync can run
    void flushConsentRecord(); // server-side proof (retried later if offline)
    onDone(mode, name);
  }

  const googleRef = useRef<HTMLDivElement>(null);
  const [googleOk, setGoogleOk] = useState(googleEnabled());
  const [googleReady, setGoogleReady] = useState(false);
  const done0 = useRef(onDone);
  done0.current = onDone;
  useEffect(() => {
    if (!googleEnabled() || !googleRef.current) return;
    renderGoogleButton(googleRef.current, googleRef.current.clientWidth, async (idToken, nonce) => {
      setBusy(true);
      setError(null);
      acceptSyncConsent('google'); // before sign-in so the first sync is not held back by the consent gate
      const res = await signInWithGoogleToken(idToken, nonce);
      setBusy(false);
      if (res.ok) {
        void flushConsentRecord();
        done0.current('login', getAuth().displayName ?? '');
      }
      else setError(res.error);
    })
      .then(() => setGoogleReady(true))
      .catch(() => setGoogleOk(false)); // offline or blocked: the username form still works
  }, []);

  return (
    <main className="flex h-full flex-col justify-between px-6 pb-8 pt-6">
      <div>
        <div className="flex items-center justify-between">
          <IconButton label="Back" onClick={onBack} className="-ml-3">
            <BackIcon />
          </IconButton>
          <span className="text-[13px] text-faint">{mode === 'signup' ? 'Create account' : 'Log in'}</span>
        </div>
        <h1 className="mt-2 text-question font-semibold text-ink">
          {mode === 'signup' ? 'Create your Chelav account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-[14px] text-soft">
          {mode === 'signup'
            ? 'Back up your month and use it on any device. Your guest data moves into the new account.'
            : 'Log in to load your account on this device.'}
        </p>

        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            aria-label="Username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
            maxLength={20}
            className="h-12 w-full rounded-key border border-line bg-white px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-faint"
          />
          {userHint && <p className="text-[12px] text-faint">{userHint}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            aria-label="Password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="h-12 w-full rounded-key border border-line bg-white px-4 text-[17px] text-ink placeholder:text-faint"
          />
          {error && (
            <p role="alert" className="text-[13px] text-warm">
              {error}
            </p>
          )}
        </form>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-center gap-1.5 px-1 pb-1 text-center text-[12px] leading-snug text-faint">
          <p>By continuing you agree to your plan and spends being backed up to your account.</p>
          <PrivacyInfo />
        </div>
        <PrimaryButton disabled={busy || !name || !password} onClick={() => void submit()}>
          {busy
            ? 'Please wait…'
            : mode === 'signup'
              ? 'Create account'
              : 'Log in'}
        </PrimaryButton>
        {googleOk && (
          <>
            <div className="my-2 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-faint">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="relative min-h-[44px] w-full">
              <div ref={googleRef} className="flex w-full justify-center" aria-label="Continue with Google" />
              {!googleReady && (
                <div
                  className="absolute inset-0 flex animate-pulse items-center justify-center rounded-full border border-line bg-white text-[14px] text-faint"
                  aria-hidden="true"
                >
                  Continue with Google
                </div>
              )}
            </div>
          </>
        )}
        {process.env.NODE_ENV !== 'production' && !googleEnabled() && (
          <p className="rounded-key bg-tint px-3 py-2 text-[12px] text-soft">
            Developer note: the Google button is hidden because NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set (see docs/GOOGLE_AUTH.md).
            Not shown in production.
          </p>
        )}
        {process.env.NODE_ENV !== 'production' && googleEnabled() && !googleOk && (
          <p className="rounded-key bg-tint px-3 py-2 text-[12px] text-soft">
            Developer note: Google&apos;s sign-in script could not load (offline, blocked or an ad-blocker).
          </p>
        )}
        <GhostButton
          disabled={busy}
          onClick={() => {
            setError(null);
            setMode(mode === 'signup' ? 'login' : 'signup');
          }}
        >
          {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
        </GhostButton>
        <LegalLinks className="mt-1" />
      </div>
    </main>
  );
}
