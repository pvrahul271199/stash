'use client';
import { useState } from 'react';
import { BackIcon, GhostButton, IconButton, PrimaryButton } from '../ui/Button';
import { logIn, signUp, validateUsername } from '@/lib/auth';

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
    onDone(mode, name);
  }

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
          {mode === 'signup' && (
            <p className="rounded-key bg-tint px-3 py-2 text-[12px] text-soft">
              There is no password reset yet. If you forget it, the account cannot be recovered. Export a CSV
              from Settings for a safe copy.
            </p>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-warm">
              {error}
            </p>
          )}
        </form>
      </div>

      <div className="flex flex-col gap-1.5">
        <PrimaryButton disabled={busy || !name || !password} onClick={() => void submit()}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </PrimaryButton>
        <GhostButton
          disabled={busy}
          onClick={() => {
            setError(null);
            setMode(mode === 'signup' ? 'login' : 'signup');
          }}
        >
          {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
        </GhostButton>
      </div>
    </main>
  );
}
